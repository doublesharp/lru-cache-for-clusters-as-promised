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
const flatted = require('flatted');

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
      Object.keys(pairs).map((key) =>
        Promise.resolve((objs[key] = flatted[jsonFunction](pairs[key])))
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
};

/**
 * Sends the response back to the worker thread
 * @param  {Object} data The response from the cache
 * @param  {Object} request The request
 * @param  {Object} worker The worker sending the response
 */
function sendResponse(data, request, worker) {
  const response = data;
  response.source = source;
  response.id = request.id;
  response.func = request.func;
  messages(`Master sending response to worker ${worker.id}`, response);
  worker.send(response);
}

// only run on the master thread
if (cluster.isMaster) {
  const construct = function (request, params, worker) {
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
        lru.job = startPruneCronJob(lru, params[0].prune, request.namespace);
      }
    }
    sendResponse(
      {
        value: {
          namespace: request.namespace,
          isnew: created,
          max: lru.max,
          maxAge: lru.maxAge,
          stale: lru.stale,
        },
      },
      request,
      worker
    );
  };

  const getCacheConfigValue = function (request, params, worker) {
    const lru = caches[request.namespace];
    if (params[0]) {
      lru[request.func] = params[0];
    }
    return sendResponse(
      {
        value: lru[request.func],
      },
      request,
      worker
    );
  };

  const incrementOrDecrement = function (request, params, worker) {
    const lru = caches[request.namespace];
    // get the current value
    let value = lru.get(params[0]);
    // maybe initialize and increment
    value =
      (typeof value === 'number' ? value : 0) +
      (params[1] || 1) * (request.func === 'decr' ? -1 : 1);
    // set the new value
    lru.set(params[0], value);
    // send the new value
    return sendResponse(
      {
        value,
      },
      request,
      worker
    );
  };

  // for each worker created...
  cluster.on('fork', (worker) => {
    // wait for the worker to send a message
    worker.on('message', (request) => {
      if (request.source !== source) return;
      messages(`Master recieved message from worker ${worker.id}`, request);

      // try to load an existing lru-cache
      let lru = caches[request.namespace];

      const params = request.arguments;

      switch (request.func) {
        // constructor request
        case '()': {
          construct(request, params, worker);
          break;
        }
        case 'max':
        case 'maxAge':
        case 'stale': {
          getCacheConfigValue(request, params, worker);
          break;
        }
        case 'decr':
        case 'incr': {
          incrementOrDecrement(request, params, worker);
          break;
        }
        case 'mGet': {
          const mGetValues = funcs.mGet(lru, params);
          return sendResponse({ value: mGetValues }, request, worker);
        }
        case 'mSet': {
          funcs.mSet(lru, params);
          return sendResponse({ value: true }, request, worker);
        }
        case 'mDel': {
          funcs.mDel(lru, params);
          return sendResponse({ value: true }, request, worker);
        }
        // return the property value
        case 'length':
        case 'itemCount': {
          return sendResponse(
            {
              value: lru[request.func],
            },
            request,
            worker
          );
        }
        // return the function value
        default: {
          return sendResponse(
            {
              value: lru[request.func](...params),
            },
            request,
            worker
          );
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
            const mGetValues = funcs.mGet(lru, funcArgs);
            return resolve(mGetValues);
          });
          break;
        }
        case 'mSet': {
          promise = new Promise((resolve) => {
            funcs.mSet(lru, funcArgs);
            return resolve(true);
          });
          break;
        }
        case 'mDel': {
          promise = new Promise((resolve) => {
            funcs.mDel(lru, funcArgs);
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
      let failsafeTimeout = setTimeout(
        () => {
          failsafeTimeout = null;
          if (cache.failsafe === 'reject') {
            return reject(new Error('Timed out in isFailed()'));
          }
          return resolve();
        },
        func === '()' ? 5000 : cache.timeout
      );
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
      .catch(
        /* istanbul ignore next */ (err) => {
          debug('failed to create lru cache on master', err, options);
        }
      );
  }

  // the lru-cache functions we are able to provide. Note that length()
  // and itemCount() are functions and not properties. All functions
  // return a Promise.
  return {
    set: (key, value, maxAge) => promiseTo('set', key, value, maxAge),
    get: (key) => promiseTo('get', key),
    setObject: (key, value, maxAge) =>
      promiseTo('set', key, flatted.stringify(value), maxAge),
    getObject: (key) =>
      promiseTo('get', key).then((value) =>
        // eslint-disable-next-line no-undefined
        Promise.resolve(value ? flatted.parse(value) : undefined)
      ),
    del: (key) => promiseTo('del', key),
    mGet: (keys) => promiseTo('mGet', keys),
    mSet: (pairs, maxAge) => promiseTo('mSet', pairs, maxAge),
    mGetObjects: (keys) =>
      promiseTo('mGet', keys).then((pairs) => {
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
