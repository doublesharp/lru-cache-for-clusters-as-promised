/**
 * Provide a cluster-safe lru-cache with Promises
 *
 * @module lru-cache-for-clusters-as-promised
 * @exports LRUCacheForClustersAsPromised
 */
/* eslint comma-dangle: [2, "always"] */

const cluster = require('cluster');
const Debug = require('debug');
const uuid = require('uuid');
const LRUCache = require('lru-cache');

const debug = new Debug('lru-cache-for-clusters-as-promised');

// lru caches by namespace on the master
const caches = {};

// track callbacks on the worker by request id
const callbacks = {};

// use to identify messages from our module
const source = 'lru-cache-for-clusters-as-promised';

// only run on the master thread
if (cluster.isMaster) {
  // for each worker created...
  cluster.on('fork', (worker) => {
    // wait for the worker to send a message
    worker.on('message', (request) => {
      if (request.source !== source) return;

      // send a response back to the worker thread
      function sendResponse(data) {
        const response = data;
        response.source = source;
        response.id = request.id;
        response.func = request.func;
        worker.send(response);
      }

      // try to load an existing lru-cache
      let lru = caches[request.namespace];

      switch (request.func) {
        // constructor request
        case '()': {
          // create a new lru-cache, give it a namespace, and save it locally
          lru = caches[request.namespace] = new LRUCache(...request.arguments);
          lru.namespace = request.namespace;
          sendResponse(lru);
          break;
        }
        case 'decr':
        case 'incr': {
          // get the current value
          let value = lru.get(request.arguments[0]);
          // maybe initialize and increment
          value = (typeof value === 'number' ? value : 0) +
            ((request.arguments[1] || 1) * (request.func === 'decr' ? -1 : 1));
          // set the new value
          lru.set(request.arguments[0], value);
          // send the new value
          sendResponse({
            value,
          });
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
            value: lru[request.func](...request.arguments),
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
 * @param Object options The lru-cache options. Properties can be set, functions cannot.
 */
function LRUCacheForClustersAsPromised(options) {
  // keep a reference as 'this' is lost inside the Promise contexts
  const cache = this;

  // if this is the master thread, we just promisify an lru-cache
  const lru = cluster.isMaster ? new LRUCache(options) : null;

  // this is how the clustered cache differentiates
  cache.namespace = options.namespace || 'default';

  // this is how long the worker will wait for a response from the master in milliseconds
  cache.timeout = options.timeout || 100;

  // how should timeouts be handled - default is resolve(undefined), otherwise reject(Error)
  cache.failsafe = options.failsafe === 'reject' ? 'reject' : 'resolve';

  // return a promise that resolves to the result of the method on
  // the local lru-cache this is the master thread, or from the
  // lru-cache on the master thread if this is a worker
  const promiseTo = (...args) => {
    // first argument is the function to run
    const func = args[0];
    // the rest of the args are the function arguments of N length
    const funcArgs = Array.prototype.slice.call(args, 1, args.length);
    if (cluster.isMaster) {
      // act on the local lru-cache
      switch (func) {
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
      }, cache.timeout);
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
    .catch(err => debug('failed to create lru cache on master', err, options));
  }

  // the lru-cache functions we are able to provide. Note that length()
  // and itemCount() are functions and not properties. All functions
  // return a Promise.
  return {
    set: (key, value) => promiseTo('set', key, value),
    get: key => promiseTo('get', key),
    peek: key => promiseTo('peek', key),
    del: key => promiseTo('del', key),
    has: key => promiseTo('has', key),
    incr: (key, amount) => promiseTo('incr', key, amount),
    decr: (key, amount) => promiseTo('decr', key, amount),
    reset: () => promiseTo('reset'),
    keys: () => promiseTo('keys'),
    values: () => promiseTo('values'),
    dump: () => promiseTo('dump'),
    prune: () => promiseTo('prune'),
    length: () => promiseTo('length'),
    itemCount: () => promiseTo('itemCount'),
  };
}

module.exports = LRUCacheForClustersAsPromised;
module.exports.init = () => true;
