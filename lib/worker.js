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

const requestToMaster = async (cache, func, funcArgs) =>
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
    let failsafeTimeout = setTimeout(() => {
      failsafeTimeout = null;
      return cache.failsafe === 'reject'
        ? reject(new Error('Timed out in isFailed()'))
        : resolve();
    }, cache.timeout);
    // set the callback for this id to resolve the promise
    callbacks[request.id] = (result) => {
      if (failsafeTimeout) {
        clearTimeout(failsafeTimeout);
        return typeof result.error !== 'undefined'
          ? reject(new Error(result.error))
          : resolve(result.value);
      }
    };
    // send the request to the master process
    process.send(request);
  });

const getPromisified = (cache, options) => {
  // return a promise calls the lru-cache on the master thread via IPC messages
  const promisified = async (...args) => {
    // first argument is the function to run
    const func = args[0];
    // the rest of the args are the function arguments of N length
    const funcArgs = Array.prototype.slice.call(args, 1, args.length);
    // cluster.isWorker
    return requestToMaster(cache, func, funcArgs);
  };

  if (!options.noInit) {
    // create a new LRU cache on the master
    promisified('()', options).catch(
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
