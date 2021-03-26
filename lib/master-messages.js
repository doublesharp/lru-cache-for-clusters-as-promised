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

const handleConstructLruCache = (
  caches,
  request,
  worker,
  { startPruneCronJob }
) => {
  let created = false;
  let lru;
  const params = request.arguments;
  const options = params[0];
  // create a new lru-cache, give it a namespace, and save it locally
  if (caches[request.namespace]) {
    lru = caches[request.namespace];
    // update property values as needed
    if (typeof options.max !== 'undefined') lru.max = options.max;
    if (typeof options.maxAge !== 'undefined') lru.maxAge = options.maxAge;
    if (typeof options.stale !== 'undefined') lru.allowStale = options.stale;
  } else {
    created = true;
    lru = caches[request.namespace] = new LRUCache(...params);
    // start a job to clean the cache
    if (params[0].prune) {
      lru.job = startPruneCronJob(lru, params[0].prune, request.namespace);
    }
  }

  return handleConstructLruCacheResponse(request, worker, created, lru);
};

const handleConstructLruCacheResponse = (request, worker, created, lru) =>
  sendResponseToWorker(
    {
      value: {
        namespace: request.namespace,
        isnew: created,
        max: lru.max,
        maxAge: lru.maxAge,
        stale: lru.allowStale,
      },
    },
    request,
    worker
  );

const handleGetOrSetConfigValue = (caches, request, worker) => {
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

const handleIncrementOrDecrement = (caches, request, worker) => {
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

const handleGetMultipleValues = (caches, request, worker) =>
  handleMultipleValues(caches, request, worker, 'mGet');
const handleSetMultipleValues = (caches, request, worker) =>
  handleMultipleValues(caches, request, worker, 'mSet');
const handleDeleteMultipleValues = (caches, request, worker) =>
  handleMultipleValues(caches, request, worker, 'mDel');
const handleMultipleValues = (caches, request, worker, func) => {
  const value = utils[func](caches[request.namespace], request.arguments);
  return sendResponseToWorker({ value }, request, worker);
};

const handleDefaultLruFunction = (caches, request, worker) => {
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

const messageHandlerFunctions = {
  '()': handleConstructLruCache,
  mGet: handleGetMultipleValues,
  mSet: handleSetMultipleValues,
  mDel: handleDeleteMultipleValues,
  decr: handleIncrementOrDecrement,
  incr: handleIncrementOrDecrement,
  max: handleGetOrSetConfigValue,
  maxAge: handleGetOrSetConfigValue,
  stale: handleGetOrSetConfigValue,
  allowStale: handleGetOrSetConfigValue,
  itemCount: handleGetOrSetConfigValue,
  length: handleGetOrSetConfigValue,
};

/**
 * get a handler for the promisified version of the LRU cache
 * @param {string} func
 * @returns function
 */
const getMessageHandler = (func) => {
  const handler = messageHandlerFunctions[func];
  return handler ? handler : handleDefaultLruFunction;
};

module.exports = {
  getMessageHandler,
};
