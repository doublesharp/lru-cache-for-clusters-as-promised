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
 * Starts/stops a cron job to prune stale objects from the cache
 * @param  {LRUCache} cache     The cache we want to prune
 * @param  {string} cronTime  The cron schedule
 * @param  {string} namespace The namespace for shared caches
 * @return {CronJob}           The cron job which has already been started
 */
function handlePruneCronJob(cache, cronTime, namespace) {
  if (typeof cronTime !== 'undefined') {
    if (cache.job) {
      debug(
        `${cronTime ? 'Updating' : 'Stopping'} cache prune job.`,
        namespace
      );
      cache.job.stop();
      delete cache.job;
    }
    if (cronTime) {
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
    }
  }
  return cache.job;
}

// this code will only run on the master to set up handles for messages from the workers
if (cluster.isMaster) {
  // for each worker created...
  cluster.on('fork', (worker) => {
    // wait for the worker to send a message
    worker.on('message', (request) => {
      if (request.source !== config.source) return;
      messages(`Master received message from worker ${worker.id}`, request);
      return masterMessages.getMessageHandler(request.func)(
        caches,
        request,
        worker,
        {
          handlePruneCronJob,
        }
      );
    });
  });
}

function getLruCache(caches, namespace, options) {
  let lru = caches[namespace];
  if (caches[namespace]) {
    debug(`Loaded cache from namespace '{namespace}'`);
    if (typeof options.max !== 'undefined') lru.max = options.max;
    if (typeof options.maxAge !== 'undefined') lru.maxAge = options.maxAge;
    if (typeof options.stale !== 'undefined') lru.allowStale = options.stale;
  } else {
    lru = caches[namespace] = new LRUCache(options);
    debug(`Created new LRUCache for namespace '${namespace}'`);
  }

  handlePruneCronJob(lru, options.prune, namespace);

  return lru;
}

const getOrSetConfigValue = ({
  caches,
  namespace,
  options,
  func: property,
  funcArgs: value,
}) => {
  const lru = getLruCache(caches, namespace, options);
  return new Promise((resolve) => {
    if (value[0]) {
      lru[property] = value[0];
    }
    return resolve(lru[property]);
  });
};

const incrementOrDecrement = ({
  caches,
  namespace,
  options,
  func,
  funcArgs,
}) => {
  const lru = getLruCache(caches, namespace, options);
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

const getMultipleValues = (options) => handleMultipleValues('mGet', options);
const setMultipleValues = (options) => handleMultipleValues('mSet', options);
const deleteMultipleValues = (options) => handleMultipleValues('mDel', options);
const handleMultipleValues = (func, { namespace, options, funcArgs }) => {
  const lru = getLruCache(caches, namespace, options);
  return new Promise((resolve) => {
    return resolve(utils[func](lru, funcArgs));
  });
};

const defaultLruFunction = ({ caches, namespace, options, func, funcArgs }) => {
  const lru = getLruCache(caches, namespace, options);
  if (typeof lru[func] !== 'function') {
    throw new Error(`LRUCache.${func}() is not a valid function`);
  }
  // just call the function on the lru-cache
  return Promise.resolve(lru[func](...funcArgs));
};

const promiseHandlerFunctions = {
  mGet: getMultipleValues,
  mSet: setMultipleValues,
  mDel: deleteMultipleValues,
  decr: incrementOrDecrement,
  incr: incrementOrDecrement,
  max: getOrSetConfigValue,
  maxAge: getOrSetConfigValue,
  allowStale: getOrSetConfigValue,
  itemCount: getOrSetConfigValue,
  length: getOrSetConfigValue,
};

const getPromiseHandler = (func) => {
  const handler = promiseHandlerFunctions[func];
  return handler ? handler : defaultLruFunction;
};

// return a promise that resolves to the result of the method on
// the local lru-cache this is the master thread, or from the
// lru-cache on the master thread if this is a worker
module.exports = {
  caches,
  getPromisified: ({ namespace }, options) => {
    // create the new LRU cache
    getLruCache(caches, namespace, options);
    // return function to promisify function calls
    return (...args) => {
      // acting on the local lru-cache
      messages(namespace, args);
      // first argument is the function to run
      const func = args[0];
      // the rest of the args are the function arguments of N length
      const funcArgs = Array.prototype.slice.call(args, 1, args.length);
      try {
        return getPromiseHandler(func)({
          caches,
          namespace,
          options,
          func,
          funcArgs,
        });
      } catch (err) {
        return Promise.reject(err);
      }
    };
  },
};
