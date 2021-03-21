const cluster = require('cluster');
const CronJob = require('cron').CronJob;
const Debug = require('debug');
const LRUCache = require('lru-cache');

const config = require('../config');
const utils = require('./utils');

const debug = new Debug(`${config.source}-master`);
const messages = new Debug(`${config.source}-messages`);

// lru caches by namespace on the master
const caches = {};

function getLruCache(cache, options) {
  if (caches[cache.namespace]) {
    debug(`Loaded cache from shared namespace ${cache.namespace}`);
    return caches[cache.namespace];
  }

  const lru = new LRUCache(options);
  caches[cache.namespace] = lru;
  if (options.prune) {
    lru.job = startPruneCronJob(lru, options.prune, cache.namespace);
  }
  debug(`Created new LRU cache ${cache.namespace}`);
  return lru;
}

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

const processMessages = function () {
  if (cluster.isMaster) {
    // for each worker created...
    cluster.on('fork', (worker) => {
      // wait for the worker to send a message
      worker.on('message', (request) => {
        if (request.source !== config.source) return;
        messages(`Master recieved message from worker ${worker.id}`, request);

        // try to load an existing lru-cache
        const lru = caches[request.namespace];

        const params = request.arguments;

        /**
         * Sends the response back to the worker thread
         * @param  {Object} data The response from the cache
         * @param  {Object} request The request
         * @param  {Object} worker The worker sending the response
         */
        function sendResponseToWorker(data) {
          const response = data;
          response.source = config.source;
          response.id = request.id;
          response.func = request.func;
          messages(`Master sending response to worker ${worker.id}`, response);
          worker.send(response);
        }

        const constructLruCache = function () {
          let created = false;
          let lru = caches[request.namespace];
          const options = params[0];
          // create a new lru-cache, give it a namespace, and save it locally
          if (caches[request.namespace]) {
            lru = caches[request.namespace];
            // update property values as needed
            ['max', 'maxAge', 'stale'].forEach((prop) => {
              if (options[prop] && options[prop] !== lru[prop]) {
                lru[prop] = options[prop];
              }
            });
          } else {
            created = true;
            lru = caches[request.namespace] = new LRUCache(...params);
            // start a job to clean the cache
            if (params[0].prune) {
              lru.job = startPruneCronJob(
                lru,
                params[0].prune,
                request.namespace
              );
            }
          }
          sendResponseToWorker({
            value: {
              namespace: request.namespace,
              isnew: created,
              max: lru.max,
              maxAge: lru.maxAge,
              stale: lru.stale,
            },
          });
        };

        const getCacheConfigValue = function () {
          if (params[0]) {
            lru[request.func] = params[0];
          }
          return sendResponseToWorker({
            value: lru[request.func],
          });
        };

        const incrementOrDecrement = function () {
          // get the current value
          let value = lru.get(params[0]);
          // maybe initialize and increment
          value =
            (typeof value === 'number' ? value : 0) +
            (params[1] || 1) * (request.func === 'decr' ? -1 : 1);
          // set the new value
          lru.set(params[0], value);
          // send the new value
          return sendResponseToWorker({
            value,
          });
        };

        const getMultipleValues = function () {
          const mGetValues = utils.mGet(lru, params);
          return sendResponseToWorker({ value: mGetValues });
        };

        const setMultipleValues = function () {
          utils.mSet(lru, params);
          return sendResponseToWorker({ value: true });
        };
        const deleteMultipleValues = function () {
          utils.mDel(lru, params);
          return sendResponseToWorker({ value: true });
        };

        switch (request.func) {
          // constructor request
          case '()': {
            return constructLruCache();
          }
          case 'max':
          case 'maxAge':
          case 'stale':
          case 'length':
          case 'itemCount': {
            return getCacheConfigValue();
          }
          case 'decr':
          case 'incr': {
            return incrementOrDecrement();
          }
          case 'mGet': {
            return getMultipleValues();
          }
          case 'mSet': {
            return setMultipleValues();
          }
          case 'mDel': {
            return deleteMultipleValues();
          }
          // return the function value
          default: {
            return sendResponseToWorker({
              value: lru[request.func](...params),
            });
          }
        }
      });
    });
  }
};

// return a promise that resolves to the result of the method on
// the local lru-cache this is the master thread, or from the
// lru-cache on the master thread if this is a worker
const getPromisified = (namespace, options) => {
  const lru = getLruCache(namespace, options);
  return (...args) => {
    // first argument is the function to run
    const func = args[0];
    // the rest of the args are the function arguments of N length
    const funcArgs = Array.prototype.slice.call(args, 1, args.length);
    // acting on the local lru-cache
    messages(namespace, args);
    let promise;
    switch (func) {
      case 'max':
      case 'maxAge':
      case 'stale': {
        promise = new Promise((resolve) => {
          if (funcArgs[0]) {
            lru[func] = funcArgs[0];
          }
          return resolve(lru[func]);
        });
        break;
      }
      case 'decr':
      case 'incr': {
        promise = new Promise((resolve) => {
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
        break;
      }
      case 'mGet': {
        promise = new Promise((resolve) => {
          const mGetValues = utils.mGet(lru, funcArgs);
          return resolve(mGetValues);
        });
        break;
      }
      case 'mSet': {
        promise = new Promise((resolve) => {
          utils.mSet(lru, funcArgs);
          return resolve(true);
        });
        break;
      }
      case 'mDel': {
        promise = new Promise((resolve) => {
          utils.mDel(lru, funcArgs);
          return resolve(true);
        });
        break;
      }
      case 'itemCount':
      case 'length': {
        // return the property value
        promise = new Promise((resolve) => {
          return resolve(lru[func]);
        });
        break;
      }
      default: {
        // just call the function on the lru-cache
        promise = new Promise((resolve) => {
          return resolve(lru[func](...funcArgs));
        });
        break;
      }
    }
    return promise;
  };
};

module.exports = {
  processMessages,
  getLruCache,
  getPromisified,
};
