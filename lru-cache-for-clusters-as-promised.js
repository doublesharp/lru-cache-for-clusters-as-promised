/**
 * Provide a cluster-safe lru-cache with Promises
 *
 * @module lru-cache-for-clusters-as-promised
 * @exports LRUCacheForClustersAsPromised
 */

/* eslint strict: 0 */

'use strict';

const cluster = require('cluster');
const CronJob = require('cron').CronJob;
const Debug = require('debug');
const uuid = require('uuid');
const LRUCache = require('lru-cache');

const debug = new Debug('lru-cache-for-clusters-as-promised');
const messages = new Debug('lru-cache-for-clusters-as-promised-messages');

// lru caches by namespace on the master
const caches = {};

// track callbacks on the worker by request id
const callbacks = {};

// use to identify messages from our module
const source = 'lru-cache-for-clusters-as-promised';

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

const funcs = {
  mapObjects: (pairs, objs, jsonFunction) =>
    Promise.all(
      Object.keys(pairs).map((key) => Promise.resolve((objs[key] = JSON[jsonFunction](pairs[key]))))
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
      Object.keys(params[0]).map((key) => lru.set(key, params[0][key], params[1]));
    }
  },
};

// only run on the master thread
if (cluster.isMaster) {
  // for each worker created...
  cluster.on('fork', (worker) => {
    // wait for the worker to send a message
    worker.on('message', (request) => {
      if (request.source !== source) return;
      messages(`Master recieved message from worker ${worker.id}`, request);

      /**
       * Sends the response back to the worker thread
       * @param  {Object} data The response from the cache
       */
      function sendResponse(data) {
        const response = data;
        response.source = source;
        response.id = request.id;
        response.func = request.func;
        messages(`Master sending response to worker ${worker.id}`, response);
        worker.send(response);
      }

      // try to load an existing lru-cache
      let lru = caches[request.namespace];

      const params = request.arguments;

      switch (request.func) {
        // constructor request
        case '()': {
          let created = false;
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
              lru.job = startPruneCronJob(lru, params[0].prune, request.namespace);
            }
          }
          sendResponse({
            value: {
              namespace: request.namespace,
              isnew: created,
              max: lru.max,
              maxAge: lru.maxAge,
              stale: lru.stale,
            },
          });
          break;
        }
        case 'max':
        case 'maxAge':
        case 'stale': {
          lru = caches[request.namespace];
          if (params[0]) {
            lru[request.func] = params[0];
          }
          sendResponse({
            value: lru[request.func],
          });
          break;
        }
        case 'decr':
        case 'incr': {
          // get the current value
          let value = lru.get(params[0]);
          // maybe initialize and increment
          value = (typeof value === 'number' ? value : 0) +
            ((params[1] || 1) * (request.func === 'decr' ? -1 : 1));
          // set the new value
          lru.set(params[0], value);
          // send the new value
          sendResponse({
            value,
          });
          break;
        }
        case 'mGet': {
          const mGetValues = funcs.mGet(lru, params);
          sendResponse({ value: mGetValues });
          break;
        }
        case 'mSet': {
          funcs.mSet(lru, params);
          sendResponse({ value: true });
          break;
        }
        case 'mDel': {
          funcs.mDel(lru, params);
          sendResponse({ value: true });
          break;
        }
        // return the property value
        case 'length':
        case 'itemCount': {
          sendResponse({
            value: lru[request.func],
          });
          break;
        }
        // return the function value
        default: {
          sendResponse({
            value: lru[request.func](...params),
          });
          break;
        }
      }
    });
  });
}

// run on each worker thread
if (cluster.isWorker) {
  process.on('message', (response) => {
    messages(`Worker ${cluster.worker.id} recieved message`, response);
    // look up the callback based on the response ID, delete it, then call it
    if (response.source !== source || !callbacks[response.id]) return;
    const callback = callbacks[response.id];
    delete callbacks[response.id];
    callback(response);
  });
}

/**
 * LRUCacheForClustersAsPromised roughly approximates the functionality of LRUCache
 * but in a promisified way. When running as a cluster workers send requests to the
 * master thread which actually holds the cache via IPC which then sends a response
 * that resolves the Promise. For non-clustered environments a Promisfied interface
 * to the cache is provided to match the interface for clustered environments.
 *
 * @param {Object} opts The lru-cache options. Properties can be set, functions cannot.
 * @return {Object} Object with LRU methods
 */
function LRUCacheForClustersAsPromised(opts) {
  // default to some empty options
  const options = opts || {};

  // keep a reference as 'this' is lost inside the Promise contexts
  const cache = this;

  // this is how the clustered cache differentiates
  cache.namespace = options.namespace || 'default';

  // this is how long the worker will wait for a response from the master in milliseconds
  cache.timeout = options.timeout || 100;

  // how should timeouts be handled - default is resolve(undefined), otherwise reject(Error)
  cache.failsafe = options.failsafe === 'reject' ? 'reject' : 'resolve';

  // if this is the master thread, we just promisify an lru-cache
  let lru = null;
  if (cluster.isMaster) {
    if (caches[cache.namespace]) {
      lru = caches[cache.namespace];
      debug(`Loaded cache from shared namespace ${cache.namespace}`);
    } else {
      lru = new LRUCache(options);
      caches[cache.namespace] = lru;
      if (options.prune) {
        lru.job = startPruneCronJob(lru, options.prune, cache.namespace);
      }
      debug(`Created new LRU cache ${cache.namespace}`);
    }
  }

  // return a promise that resolves to the result of the method on
  // the local lru-cache this is the master thread, or from the
  // lru-cache on the master thread if this is a worker
  const promiseTo = (...args) => {
    // first argument is the function to run
    const func = args[0];
    // the rest of the args are the function arguments of N length
    const funcArgs = Array.prototype.slice.call(args, 1, args.length);
    if (cluster.isMaster) {
      // acting on the local lru-cache
      messages(cache.namespace, args);
      switch (func) {
        case 'max':
        case 'maxAge':
        case 'stale': {
          if (funcArgs[0]) {
            lru[func] = funcArgs[0];
          }
          return Promise.resolve(lru[func]);
        }
        case 'decr':
        case 'incr': {
          // get the current value default to 0
          let value = lru.get(funcArgs[0]);
          // maybe initialize and increment
          value = (typeof value === 'number' ? value : 0) +
            ((funcArgs[1] || 1) * (func === 'decr' ? -1 : 1));
          // set the new value
          lru.set(funcArgs[0], value);
          // resolve the new value
          return Promise.resolve(value);
        }
        case 'mGet': {
          const mGetValues = funcs.mGet(lru, funcArgs);
          return Promise.resolve(mGetValues);
        }
        case 'mSet': {
          funcs.mSet(lru, funcArgs);
          return Promise.resolve(true);
        }
        case 'mDel': {
          funcs.mDel(lru, funcArgs);
          return Promise.resolve(true);
        }
        case 'itemCount':
        case 'length': {
          // return the property value
          return Promise.resolve(lru[func]);
        }
        default: {
          // just call the function on the lru-cache
          return Promise.resolve(lru[func](...funcArgs));
        }
      }
    }
    return new Promise((resolve, reject) => {
      // create the request to the master
      const request = {
        source,
        namespace: cache.namespace,
        id: uuid.v4(),
        func,
        arguments: funcArgs,
      };
      // if we don't get a response in 100ms, return undefined
      let failsafeTimeout = setTimeout(() => {
        failsafeTimeout = undefined;
        if (cache.failsafe === 'reject') {
          return reject(new Error('Timed out in isFailed()'));
        }
        return resolve(undefined);
      }, func === '()' ? 5000 : cache.timeout);
      // set the callback for this id to resolve the promise
      callbacks[request.id] = (result) => {
        if (failsafeTimeout) {
          clearTimeout(failsafeTimeout);
          return resolve(result.value);
        }
        return false;
      };
      // send the request to the master process
      process.send(request);
    });
  };

  if (cluster.isWorker) {
    // create a new LRU cache on the master
    promiseTo('()', options)
    .then((lruOptions) => debug('created lru cache on master', lruOptions))
    .catch((err) => {
      /* istanbul ignore next */
      debug('failed to create lru cache on master', err, options);
    });
  }

  // the lru-cache functions we are able to provide. Note that length()
  // and itemCount() are functions and not properties. All functions
  // return a Promise.
  return {
    set: (key, value, maxAge) => promiseTo('set', key, value, maxAge),
    get: (key) => promiseTo('get', key),
    setObject: (key, value, maxAge) => promiseTo('set', key, JSON.stringify(value), maxAge),
    getObject: (key) => promiseTo('get', key).then((value) => Promise.resolve(value ? JSON.parse(value) : undefined)),
    del: (key) => promiseTo('del', key),
    mGet: (keys) => promiseTo('mGet', keys),
    mSet: (pairs, maxAge) => promiseTo('mSet', pairs, maxAge),
    mGetObjects: (keys) => promiseTo('mGet', keys).then((pairs) => {
      const objs = {};
      return funcs
        .mapObjects(pairs, objs, 'parse')
        .then(() => Promise.resolve(objs));
    }),
    mSetObjects: (pairs, maxAge) => {
      const objs = {};
      return funcs
        .mapObjects(pairs, objs, 'stringify')
        .then(() => promiseTo('mSet', objs, maxAge));
    },
    mDel: (keys) => promiseTo('mDel', keys),
    peek: (key) => promiseTo('peek', key),
    has: (key) => promiseTo('has', key),
    incr: (key, amount) => promiseTo('incr', key, amount),
    decr: (key, amount) => promiseTo('decr', key, amount),
    reset: () => promiseTo('reset'),
    keys: () => promiseTo('keys'),
    values: () => promiseTo('values'),
    dump: () => promiseTo('dump'),
    prune: () => promiseTo('prune'),
    length: () => promiseTo('length'),
    itemCount: () => promiseTo('itemCount'),
    stale: (stale) => promiseTo('stale', stale),
    max: (max) => promiseTo('max', max),
    maxAge: (maxAge) => promiseTo('maxAge', maxAge),
  };
}

module.exports = LRUCacheForClustersAsPromised;
module.exports.init = () => true;
