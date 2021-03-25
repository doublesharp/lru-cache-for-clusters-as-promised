const cluster = require('cluster');
const CronJob = require('cron').CronJob;
const Debug = require('debug');
const LRUCache = require('lru-cache');

const utils = require('./utils');
const config = require('../config');

const masterMessages = require('./master-messages');

const debug = new Debug(`${config.source}-master`);
const messages = new Debug(`${config.source}-messages`);

// lru caches by namespace on the master
const caches = {};

/**
 * Starts a cron job to prune stale objects from the cache
 * @param  {LRUCache} cache     The cache we want to prune
 * @param  {string} cronTime  The cron schedule
 * @param  {string} namespace The namespace for shared caches
 * @return {CronJob}           The cron job which has already been started
 */
function startPruneCronJob(cache, cronTime, namespace) {
  debug('Creating cache prune job.', cache);
  const job = new CronJob({
    cronTime,
    onTick: () => {
      debug(`Pruning cache ${namespace}`, cache);
      cache.prune();
    },
    start: true,
    runOnInit: true,
  });
  job.start();
  return job;
}

// this code will only run on the master to set up handles for messages from the workers
if (cluster.isMaster) {
  // for each worker created...
  cluster.on('fork', (worker) => {
    // wait for the worker to send a message
    worker.on('message', (request) => {
      if (request.source !== config.source) return;
      messages(`Master recieved message from worker ${worker.id}`, request);
      return masterMessages.getMessageHandler(request.func)(
        caches,
        request,
        worker,
        {
          startPruneCronJob,
        }
      );
    });
  });
}

function getLruCache(caches, cache, options, startPruneCronJob) {
  if (caches[cache.namespace]) {
    debug(`Loaded cache from shared namespace ${cache.namespace}`);
    return caches[cache.namespace];
  }

  const lru = new LRUCache(options);
  caches[cache.namespace] = lru;
  if (options.prune && startPruneCronJob) {
    lru.job = startPruneCronJob(lru, options.prune, cache.namespace);
  }
  debug(`Created new LRU cache ${cache.namespace}`);
  return lru;
}

const getCacheConfigValue = ({
  caches,
  namespace,
  options,
  func,
  funcArgs,
}) => {
  const lru = getLruCache(caches, namespace, options);
  return new Promise((resolve) => {
    if (funcArgs[0]) {
      lru[func] = funcArgs[0];
    }
    return resolve(lru[func]);
  });
};

const incrementOrDecrement = ({
  caches,
  namespace,
  options,
  func,
  funcArgs,
  startPruneCronJob,
}) => {
  const lru = getLruCache(caches, namespace, options, startPruneCronJob);
  return new Promise((resolve) => {
    // get the current value default to 0
    let value = lru.get(funcArgs[0]);
    // maybe initialize and increment
    value =
      (typeof value === 'number' ? value : 0) +
      (funcArgs[1] || 1) * (func === 'decr' ? -1 : 1);
    // set the new value
    lru.set(funcArgs[0], value);
    // resolve the new value
    return resolve(value);
  });
};

const getMultipleValues = ({
  caches,
  namespace,
  options,
  funcArgs,
  startPruneCronJob,
}) => {
  const lru = getLruCache(caches, namespace, options, startPruneCronJob);
  return new Promise((resolve) => {
    const mGetValues = utils.mGet(lru, funcArgs);
    return resolve(mGetValues);
  });
};

const setMultipleValues = ({
  caches,
  namespace,
  options,
  funcArgs,
  startPruneCronJob,
}) => {
  const lru = getLruCache(caches, namespace, options, startPruneCronJob);
  return new Promise((resolve) => {
    utils.mSet(lru, funcArgs);
    return resolve(true);
  });
};

const deleteMultipleValues = ({
  caches,
  namespace,
  options,
  funcArgs,
  startPruneCronJob,
}) => {
  const lru = getLruCache(caches, namespace, options, startPruneCronJob);
  return new Promise((resolve) => {
    utils.mDel(lru, funcArgs);
    return resolve(true);
  });
};

const defaultLruFunction = ({
  caches,
  namespace,
  options,
  func,
  funcArgs,
  startPruneCronJob,
}) => {
  const lru = getLruCache(caches, namespace, options, startPruneCronJob);
  return new Promise((resolve) => {
    return resolve(lru[func](...funcArgs));
  });
};

const promiseHandlerFunctions = {
  mGet: getMultipleValues,
  mSet: setMultipleValues,
  mDel: deleteMultipleValues,
  decr: incrementOrDecrement,
  incr: incrementOrDecrement,
  max: getCacheConfigValue,
  maxAge: getCacheConfigValue,
  stale: getCacheConfigValue,
  itemCount: getCacheConfigValue,
  length: getCacheConfigValue,
};

const getPromiseHandler = (func) => {
  const handler = promiseHandlerFunctions[func];
  return handler ? handler : defaultLruFunction;
};

// return a promise that resolves to the result of the method on
// the local lru-cache this is the master thread, or from the
// lru-cache on the master thread if this is a worker
module.exports = {
  getPromisified: (namespace, options) => {
    return (...args) => {
      // acting on the local lru-cache
      messages(namespace, args);
      // first argument is the function to run
      const func = args[0];
      // the rest of the args are the function arguments of N length
      const funcArgs = Array.prototype.slice.call(args, 1, args.length);
      return getPromiseHandler(func)({
        caches,
        namespace,
        options,
        func,
        funcArgs,
        startPruneCronJob,
      });
    };
  },
};
