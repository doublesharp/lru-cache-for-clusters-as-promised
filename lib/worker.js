const cluster = require('cluster');
const Debug = require('debug');
const uuid = require('uuid');
const config = require('../config');

const debug = new Debug(`${config.source}-worker`);
const messages = new Debug(`${config.source}-messages`);

// track callbacks on the worker by request id
const callbacks = {};

// run on each worker thread
if (cluster.isWorker) {
  process.on('message', (response) => {
    messages(`Worker ${cluster.worker.id} recieved message`, response);
    // look up the callback based on the response ID, delete it, then call it
    if (response.source !== config.source || !callbacks[response.id]) return;
    const callback = callbacks[response.id];
    delete callbacks[response.id];
    callback(response);
  });
}

const requestToMaster = (cache, func, funcArgs) =>
  new Promise((resolve, reject) => {
    // create the request to the master
    const request = {
      source: config.source,
      namespace: cache.namespace,
      id: uuid.v4(),
      func,
      arguments: funcArgs,
    };
    // if we don't get a response in 100ms, return undefined
    let failsafeTimeout = setTimeout(
      () => {
        failsafeTimeout = null;
        return cache.failsafe === 'reject'
          ? reject(new Error('Timed out in isFailed()'))
          : resolve();
      },
      func === '()' ? 5000 : cache.timeout
    );
    // set the callback for this id to resolve the promise
    callbacks[request.id] = (result) => {
      if (failsafeTimeout) {
        clearTimeout(failsafeTimeout);
        if (typeof result.error !== 'undefined') {
          return reject(new Error(result.error));
        }
        return resolve(result.value);
      }
      return false;
    };
    // send the request to the master process
    process.send(request);
  });

const getPromisified = (cache, options) => {
  // return a promise that resolves to the result of the method on
  // the local lru-cache this is the master thread, or from the
  // lru-cache on the master thread if this is a worker
  const promisified = (...args) => {
    // first argument is the function to run
    const func = args[0];
    // the rest of the args are the function arguments of N length
    const funcArgs = Array.prototype.slice.call(args, 1, args.length);
    // cluster.isWorker
    return requestToMaster(cache, func, funcArgs);
  };

  if (!options.noInit) {
    // create a new LRU cache on the master
    promisified('()', options)
      .then((lruOptions) => {
        // track that we have created this namespace on the master
        debug('created lru cache on master', options, lruOptions);
      })
      .catch(
        /* istanbul ignore next */ (err) => {
          debug('failed to create lru cache on master', err, options);
        }
      );
  }

  return promisified;
};

module.exports = {
  getPromisified,
};
