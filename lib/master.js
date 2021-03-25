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
  response.func = request.func;
  messages(`Master sending response to worker ${worker.id}`, response);
  worker.send(response);
};

const handleConstructLruCache = (request, worker) => {
  let created = false;
  let lru;
  const params = request.arguments;
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
        stale: lru.stale,
      },
    },
    request,
    worker
  );

const handleGetCacheConfigValue = (request, worker) => {
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

const handleIncrementOrDecrement = (request, worker) => {
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

const handleGetMultipleValues = (request, worker) =>
  handleMultipleValues(request, worker, 'mGet');

const handleSetMultipleValues = (request, worker) =>
  handleMultipleValues(request, worker, 'mSet');

const handleDeleteMultipleValues = (request, worker) =>
  handleMultipleValues(request, worker, 'mDel');

const handleMultipleValues = (request, worker, func) => {
  const value = utils[func](caches[request.namespace], request.arguments);
  return sendResponseToWorker({ value }, request, worker);
};

const handleDefaultLruFunction = (request, worker) => {
  return sendResponseToWorker(
    {
      value: caches[request.namespace][request.func](...request.arguments),
    },
    request,
    worker
  );
};

const getCacheConfigValue = (namespace, options, func, funcArgs) => {
  const lru = getLruCache(namespace, options);
  return new Promise((resolve) => {
    if (funcArgs[0]) {
      lru[func] = funcArgs[0];
    }
    return resolve(lru[func]);
  });
};

const incrementOrDecrement = (namespace, options, func, funcArgs) => {
  const lru = getLruCache(namespace, options);
  return new Promise((resolve) => {
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
};

const getMultipleValues = (namespace, options, func, funcArgs) => {
  const lru = getLruCache(namespace, options);
  return new Promise((resolve) => {
    const mGetValues = utils.mGet(lru, funcArgs);
    return resolve(mGetValues);
  });
};

const setMultipleValues = (namespace, options, func, funcArgs) => {
  const lru = getLruCache(namespace, options);
  return new Promise((resolve) => {
    utils.mSet(lru, funcArgs);
    return resolve(true);
  });
};

const deleteMultipleValues = (namespace, options, func, funcArgs) => {
  const lru = getLruCache(namespace, options);
  return new Promise((resolve) => {
    utils.mDel(lru, funcArgs);
    return resolve(true);
  });
};

const defaultLruFunction = (namespace, options, func, funcArgs) => {
  const lru = getLruCache(namespace, options);
  return new Promise((resolve) => {
    return resolve(lru[func](...funcArgs));
  });
};

// return a promise that resolves to the result of the method on
// the local lru-cache this is the master thread, or from the
// lru-cache on the master thread if this is a worker
const getPromisified = (namespace, options) => {
  return (...args) => {
    // acting on the local lru-cache
    messages(namespace, args);
    // first argument is the function to run
    const func = args[0];
    // the rest of the args are the function arguments of N length
    const funcArgs = Array.prototype.slice.call(args, 1, args.length);
    let promise;
    if ('mGet' === func) {
      promise = getMultipleValues(namespace, options, func, funcArgs);
    } else if ('mSet' === func) {
      promise = setMultipleValues(namespace, options, func, funcArgs);
    } else if ('mDel' === func) {
      promise = deleteMultipleValues(namespace, options, func, funcArgs);
    } else if (['decr', 'incr'].includes(func)) {
      promise = incrementOrDecrement(namespace, options, func, funcArgs);
    } else if (
      ['max', 'maxAge', 'stale', 'itemCount', 'length'].includes(func)
    ) {
      promise = getCacheConfigValue(namespace, options, func, funcArgs);
    } else {
      promise = defaultLruFunction(namespace, options, func, funcArgs);
    }
    return promise;
  };
};

if (cluster.isMaster) {
  // for each worker created...
  cluster.on('fork', (worker) => {
    // wait for the worker to send a message
    worker.on('message', (request) => {
      if (request.source !== config.source) return;
      messages(`Master recieved message from worker ${worker.id}`, request);

      switch (request.func) {
        // constructor request
        case '()': {
          return handleConstructLruCache(request, worker);
        }
        case 'max':
        case 'maxAge':
        case 'stale':
        case 'length':
        case 'itemCount': {
          return handleGetCacheConfigValue(request, worker);
        }
        case 'decr':
        case 'incr': {
          return handleIncrementOrDecrement(request, worker);
        }
        case 'mGet': {
          return handleGetMultipleValues(request, worker);
        }
        case 'mSet': {
          return handleSetMultipleValues(request, worker);
        }
        case 'mDel': {
          return handleDeleteMultipleValues(request, worker);
        }
      }
      return handleDefaultLruFunction(request, worker);
    });
  });
}

module.exports = {
  getLruCache,
  getPromisified,
};
