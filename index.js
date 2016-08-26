const cluster = require('cluster');
const uuid = require('uuid');
const LRUCache = require('lru-cache');

// lru caches by namespace on the master
const caches = {};

// track callbacks on the worker by request id
const callbacks = {};

// use to identify messages from our module
const source = 'lru-cache-for-clusters';

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
        case '()':
          // create a new lru-cache, give it a namespace, and save it locally
          lru = caches[request.namespace] = new LRUCache(...request.arguments);
          lru.namespace = request.namespace;
          sendResponse(lru);
          break;
        // return the property value
        case 'length':
        case 'itemCount':
          sendResponse({
            value: lru[request.func],
          });
          break;
        // return the function value
        default:
          sendResponse({
            value: lru[request.func](...request.arguments),
          });
          break;
      }
    });
  });
} else {
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
        case 'itemCount':
        case 'length':
          // return the property value
          return Promise.resolve(lru[func]);
          break;
        default:
          // just call the function on the lru-cache
          return Promise.resolve(lru[func](...funcArgs));
          break;
      }
    }
    return new Promise((resolve) => {
      // create the request to the master
      const request = {
        source,
        namespace: cache.namespace,
        id: uuid.v4(),
        func,
        arguments: funcArgs,
      };
      // if we don't get a response in 100ms, return undefined
      let isFailed = setTimeout(() => {
        isFailed = undefined;
        resolve(undefined);
      }, 100);
      // set the callback for this id to resolve the promise
      callbacks[request.id] = (result) =>
        (!isFailed || clearTimeout(isFailed) || resolve(result.value));
      // send the request to the master process
      process.send(request);
    });
  };

  if (cluster.isWorker) {
    // create a new LRU cache on the master
    promiseTo('()', options);
  }

  // the lru-cache functions we are able to provide. Note that length()
  // and itemCount() are functions and not properties. All functions
  // return a Promise.
  return {
    set: (key, value) => promiseTo('set', key, value),
    get: (key) => promiseTo('get', key),
    peek: (key) => promiseTo('peek', key),
    del: (key) => promiseTo('del', key),
    has: (key) => promiseTo('has', key),
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
