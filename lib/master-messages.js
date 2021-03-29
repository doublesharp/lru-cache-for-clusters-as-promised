const Debug = require('debug');
const LRUCache = require('lru-cache');
const config = require('../config');
const utils = require('./utils');

const messages = new Debug(`${config.source}-messages`);

/**
 * Sends the response back to the worker thread
 * @param  {Object} data The response from the cache
 * @param  {Object} request The request
 * @param  {Object} worker The worker sending the response
 */
const sendResponseToWorker = (data, request, worker) => {
  const response = data;
  response.source = config.source;
  response.id = request.id;
  messages(`Master sending response to worker ${worker.id}`, response);
  worker.send(response);
};

const getLruCache = (caches, request, worker) => {
  const { namespace, arguments: args } = request;
  let lru = caches[namespace];
  if (lru && lru instanceof LRUCache) {
    lru.isnew = false;
    utils.setCacheProperties(lru, args[0]);
  } else {
    lru = caches[namespace] = new LRUCache(...args);
    lru.isnew = true;
    messages(`Created new LRUCache for namespace '${namespace}'`);
  }
  // use cronjob on master to prune cache, false to disable if running
  utils.handlePruneCronJob(lru, args[0].prune, request.namespace);
  const value = {
    namespace: request.namespace,
    isnew: lru.isnew,
    max: lru.max,
    maxAge: lru.maxAge,
    stale: lru.allowStale,
  };
  messages(`${lru.isnew ? 'Created' : 'Fetched'} LRUCache`, args[0], value);
  return sendResponseToWorker({ value }, request, worker);
};

const getOrSetConfigValue = (caches, request, worker) => {
  const lru = caches[request.namespace];
  const params = request.arguments;
  if (params[0]) {
    lru[request.func] = params[0];
  }
  return sendResponseToWorker(
    {
      value: lru[request.func],
    },
    request,
    worker
  );
};

const incrementOrDecrement = (caches, request, worker) => {
  const lru = caches[request.namespace];
  const params = request.arguments;
  // get the current value
  let value = lru.get(params[0]);
  // maybe initialize and increment
  value =
    (typeof value === 'number' ? value : 0) +
    (params[1] || 1) * (request.func === 'decr' ? -1 : 1);
  // set the new value
  lru.set(params[0], value);
  // send the new value
  return sendResponseToWorker(
    {
      value,
    },
    request,
    worker
  );
};

const getMultipleValues = (caches, request, worker) =>
  handleMultipleValues(caches, request, worker, 'mGet');
const setMultipleValues = (caches, request, worker) =>
  handleMultipleValues(caches, request, worker, 'mSet');
const deleteMultipleValues = (caches, request, worker) =>
  handleMultipleValues(caches, request, worker, 'mDel');
const handleMultipleValues = (caches, request, worker, func) => {
  const value = utils[func](caches[request.namespace], request.arguments);
  return sendResponseToWorker({ value }, request, worker);
};

const defaultLruFunction = (caches, request, worker) => {
  try {
    if (typeof caches[request.namespace][request.func] !== 'function') {
      throw new Error(`LRUCache.${request.func}() is not a valid function`);
    }
    return sendResponseToWorker(
      {
        value: caches[request.namespace][request.func](...request.arguments),
      },
      request,
      worker
    );
  } catch (err) {
    return sendResponseToWorker(
      {
        error: err.message,
      },
      request,
      worker
    );
  }
};

const messageHandlers = {
  '()': getLruCache,
  mGet: getMultipleValues,
  mSet: setMultipleValues,
  mDel: deleteMultipleValues,
  decr: incrementOrDecrement,
  incr: incrementOrDecrement,
  max: getOrSetConfigValue,
  maxAge: getOrSetConfigValue,
  stale: getOrSetConfigValue,
  allowStale: getOrSetConfigValue,
  itemCount: getOrSetConfigValue,
  length: getOrSetConfigValue,
  default: defaultLruFunction,
};

/**
 * get a handler for the promisified version of the LRU cache
 * @param {string} func
 * @returns function
 */
const getMessageHandler = (func) =>
  messageHandlers[func] || messageHandlers.default;

module.exports = {
  getMessageHandler,
};
