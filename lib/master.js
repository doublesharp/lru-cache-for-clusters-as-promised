const cluster = require('cluster');
const Debug = require('debug');
const LRUCache = require('lru-cache');

const utils = require('./utils');
const config = require('../config');

const masterMessages = require('./master-messages');

const debug = new Debug(`${config.source}-master`);
const messages = new Debug(`${config.source}-messages`);

// lru caches by namespace on the master
const caches = {};

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
        worker
      );
    });
  });
}

function getLruCache(caches, namespace, options) {
  let lru = caches[namespace];
  if (!lru || lru instanceof LRUCache === false) {
    lru = caches[namespace] = new LRUCache(options);
    debug(`Created new LRUCache for namespace '${namespace}'`);
  }

  utils.handlePruneCronJob(lru, options.prune, namespace);

  return lru;
}

const getOrSetConfigValue = async ({
  caches,
  namespace,
  options,
  func: property,
  funcArgs: value,
}) => {
  const lru = getLruCache(caches, namespace, options);
  if (value[0]) {
    lru[property] = value[0];
  }
  return lru[property];
};

const incrementOrDecrement = async ({
  caches,
  namespace,
  options,
  func,
  funcArgs,
}) => {
  const lru = getLruCache(caches, namespace, options);
  // get the current value default to 0
  let value = lru.get(funcArgs[0]);
  // maybe initialize and increment
  value =
    (typeof value === 'number' ? value : 0) +
    (funcArgs[1] || 1) * (func === 'decr' ? -1 : 1);
  // set the new value
  lru.set(funcArgs[0], value);
  return value;
};

const getMultipleValues = async (options) =>
  handleMultipleValues('mGet', options);
const setMultipleValues = async (options) =>
  handleMultipleValues('mSet', options);
const deleteMultipleValues = async (options) =>
  handleMultipleValues('mDel', options);

const handleMultipleValues = async (func, { namespace, options, funcArgs }) => {
  const lru = getLruCache(caches, namespace, options);
  return utils[func](lru, funcArgs);
};

const defaultLruFunction = async ({
  caches,
  namespace,
  options,
  func,
  funcArgs,
}) => {
  const lru = getLruCache(caches, namespace, options);
  if (typeof lru[func] !== 'function') {
    throw new Error(`LRUCache.${func}() is not a valid function`);
  }
  // just call the function on the lru-cache
  return lru[func](...funcArgs);
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
    const cache = getLruCache(caches, namespace, options);
    utils.setCacheProperties(cache, options);
    // return function to promisify function calls
    return async (...args) => {
      // acting on the local lru-cache
      messages(namespace, args);
      // first argument is the function to run
      const func = args[0];
      // the rest of the args are the function arguments of N length
      const funcArgs = Array.prototype.slice.call(args, 1, args.length);
      // this returns an async function to handle the function call
      return getPromiseHandler(func)({
        caches,
        namespace,
        options,
        func,
        funcArgs,
      });
    };
  },
};
