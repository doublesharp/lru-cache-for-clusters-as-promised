const CronJob = require('cron').CronJob;
const Debug = require('debug');
const config = require('../config');

const debug = new Debug(`${config.source}-utils
`);

const destroyCacheCron = (cache, cronTime, namespace) => {
  debug(`${cronTime ? 'Updating' : 'Stopping'} cache prune job.`, namespace);
  cache.job.stop();
  delete cache.job;
};

const createCacheCron = (cache, cronTime, namespace) => {
  debug('Creating cache prune job.', namespace, cronTime);
  const job = new CronJob({
    cronTime,
    onTick: () => {
      debug(`Pruning cache ${namespace}`, namespace, cronTime);
      cache.prune();
    },
    start: true,
  });
  cache.job = job;
};

module.exports = {
  mapObjects: (pairs, objs, jsonFunction) =>
    Promise.all(
      Object.keys(pairs).map((key) =>
        Promise.resolve((objs[key] = jsonFunction(pairs[key])))
      )
    ),
  mDel: (lru, params) => {
    if (params[0] && params[0] instanceof Array) {
      params[0].map((key) => lru.del(key));
    }
  },
  mGet: (lru, params) => {
    const mGetValues = {};
    if (params[0] && params[0] instanceof Array) {
      params[0].map((key) => (mGetValues[key] = lru.get(key)));
    }
    return mGetValues;
  },
  mSet: (lru, params) => {
    if (params[0] && params[0] instanceof Object) {
      Object.keys(params[0]).map((key) =>
        lru.set(key, params[0][key], params[1])
      );
    }
  },
  setCacheProperties: (cache, options) => {
    if (typeof options.max !== 'undefined') cache.max = options.max;
    if (typeof options.maxAge !== 'undefined') cache.maxAge = options.maxAge;
    if (typeof options.stale !== 'undefined') cache.allowStale = options.stale;
  },
  /**
   * Starts/stops a cron job to prune stale objects from the cache
   * @param  {LRUCache} cache     The cache we want to prune
   * @param  {string} cronTime  The cron schedule
   * @param  {string} namespace The namespace for shared caches
   * @return {CronJob}           The cron job which has already been started
   */
  handlePruneCronJob: (cache, cronTime, namespace) => {
    if (typeof cronTime !== 'undefined' && cache.cronTime !== cronTime) {
      if (cache.job) {
        destroyCacheCron(cache, cronTime, namespace);
      }
      if (cronTime !== false) {
        createCacheCron(cache, cronTime, namespace);
      }
      cache.cronTime = cronTime;
    }
    return cache.job;
  },
};
