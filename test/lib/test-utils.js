const config = require('./test-config');
const cluster = require('cluster');
const { parse, stringify } = require('flatted');
const should = require('should');
const LRUCacheForClustersAsPromised = require('../../lru-cache-for-clusters-as-promised');
const LRUCache = require('lru-cache');
const member = cluster.isWorker ? 'worker' : 'master';

// create a default
new LRUCacheForClustersAsPromised();

/**
 * Test class definitions for clusterd and non-clustered environments
 * @param {LRUCacheForClustersAsPromised} cache The cache that the test should be run against.
 * @return {void} Node style callback
 */
function TestUtils(cache) {
  const object = {
    foo:
      'bar barbarbar barbarbar barbarbar barbarbar barbarbar barbarbar barbarbar barbarbar barbar',
  };
  const pairs = {
    foo: 'bar',
    bizz: 'buzz',
    obj: {
      hi: 'im an object',
    },
  };
  const keys = Object.keys(pairs);
  return {
    clusterTests: {
      hi: 'not respond to messages that are from somewhere else',
      timeout: 'timeout',
      reject: 'timeout with reject',
    },
    tests: {
      executeSetGet: 'try to call set via the execute() option',
      executeFail: 'execute fail',
      getLruCachesOnMaster:
        'getLruCaches to return the underlying LRUCaches from master, throw error on worker',
      getCache: 'get underlying LRUCache for promisified version',
      mSet: 'mSet values',
      mSetNull: 'mSet null pairs',
      mGet: 'mGet values',
      mGetNull: 'mGet with null keys',
      mGetAndSetObjects: 'mGetObjects and mSetObjects',
      mDel: 'mGet keys',
      mDelNull: 'mDel with null keys',
      objects: 'get and set objects',
      null_objects: 'null objects should be ok',
      undefined_objects: 'undefined objects should be ok',
      circular_objects: 'circular objects should be ok',
      miss_undefined: 'missing objects should return undefined',
      pruneJob: 'prune cache using cron job',
      pruneJob2: 'prune cache using cron job, longer than test',
      set: 'set(key, value)',
      get: 'get(key)',
      del: 'del(key)',
      incr: 'incr(key) - increment value by 1',
      incr2: 'incr(key, 2) - increment value by 2',
      decr: 'decr(key) - decrement value by 1',
      decr2: 'decr(key, 2) - decrement value by 2',
      peek:
        'peek(key) - get a cache value but do not update access time for LRU',
      has: 'has(key) - check if a key exists',
      length: 'length()',
      itemCount: 'itemCount()',
      reset: 'reset()',
      keys: 'keys()',
      values: 'values()',
      prune: 'prune()',
      dump: 'dump()',
      addFour: 'add four keys and have the first fall out',
      addFourAccessOne:
        'add four keys and then access the first so the second falls out',
      getMax: 'max()',
      getMaxAge: 'maxAge()',
      getStale: 'stale()',
      getAllowStale: 'allowStale()',
      setMax: 'max(10)',
      setMaxAge: 'maxAge(10)',
      setStale: 'stale(true)',
      setAllowStale: 'allowStale(true)',
      properties: 'update cache properties',
      getInstance:
        'get an instance asynchronously, ensures cache has been created on the server',
    },
    executeSetGet: async (cb) => {
      try {
        await cache.execute('set', 1, 'execute');
        const value = await cache.execute('get', 1);
        should(value).equal('execute');
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    executeFail: async (cb) => {
      try {
        try {
          await cache.execute('borked', 1, 'execute');
        } catch (err) {
          should(err.message).equal(
            'LRUCache.borked() is not a valid function'
          );
        }
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    getLruCachesOnMaster: async (cb) => {
      try {
        try {
          const yo = 'yo yo yo';
          // get the default cache and set the value using a promise
          const defCache = new LRUCacheForClustersAsPromised();
          await defCache.set(1, yo);

          // get all the caches and check the default namespace
          const caches = LRUCacheForClustersAsPromised.getAllCaches();
          should(typeof caches.default).not.equal('undefined');
          should(caches.default instanceof LRUCache).equal(true);
          should(caches.default.allowStale).equal(false);
          should(caches.default.maxAge).equal(0);

          // get the value we set synchronously
          const value = caches.default.get(1);
          should(value).equal(yo);
        } catch (err) {
          if (!cluster.isWorker) {
            throw err;
          }
          should(err.message).containEql('LRUCacheForClustersAsPromised');
        }
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    getCache: async (cb) => {
      try {
        try {
          const foo = 'foo foo foo';
          const defCache = new LRUCacheForClustersAsPromised();
          await defCache.set(1, foo);

          const cache = defCache.getCache();
          should(cache.get(1)).equal(foo);
        } catch (err) {
          if (!cluster.isWorker) {
            throw err;
          }
        }
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    mSet: async (cb) => {
      try {
        await cache.mSet(pairs);
        const value = await cache.get(keys[0]);
        should(value).equal(pairs[keys[0]]);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    mSetNull: async (cb) => {
      try {
        await cache.mSet(null);
        await cache.mSet('string');
        await cache.mSet(['array']);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    mGet: async (cb) => {
      try {
        await cache.mSet(pairs);
        const values = await cache.mGet(keys);
        should(typeof values).not.equal('undefined');
        should(values.bizz).equal(pairs.bizz);
        should(values.foo).equal(pairs.foo);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    mGetAndSetObjects: async (cb) => {
      try {
        await cache.mSetObjects(pairs);
        const values = await cache.mGetObjects(keys);
        should(values.bizz).deepEqual(pairs.bizz);
        should(values.foo).deepEqual(pairs.foo);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    mGetNull: async (cb) => {
      try {
        let values = await cache.mGet('string');
        should(values).deepEqual({});
        values = await cache.mGet(null);
        should(values).deepEqual({});
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    mDel: async (cb) => {
      try {
        await cache.mSet(pairs);
        await cache.mDel(keys);
        const value = await cache.get(keys[0]);
        should(typeof value).equal('undefined');
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    mDelNull: async (cb) => {
      try {
        await cache.mSet(pairs);
        await cache.mDel(null);
        const value = await cache.get(keys[0]);
        should(value).equal(pairs[keys[0]]);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    objects: async (cb) => {
      try {
        await cache.setObject(1, object);
        const obj = await cache.getObject(1);
        should(obj).not.equal(null);
        should(obj.foo).equal(object.foo);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    undefined_objects: async (cb) => {
      try {
        let object;
        await cache.setObject(1, object);
        const obj = await cache.getObject(1);
        should(typeof obj).equal('undefined');
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    null_objects: async (cb) => {
      try {
        let object = null;
        await cache.setObject(1, object);
        const obj = await cache.getObject(1);
        should(obj).equal(null);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    circular_objects: async (cb) => {
      try {
        // this cache uses the flatted parse and stringify
        const cacheCircular = new LRUCacheForClustersAsPromised({
          namespace: 'circular-cache',
          max: 3,
          parse,
          stringify,
        });

        // create a circular dependency
        const a = { b: null };
        const b = { a };
        b.a.b = b;

        // see if we can set and then extract the circular object
        await cacheCircular.setObject(1, a);
        const obj = await cacheCircular.getObject(1);

        should(obj).deepEqual(a);
        should(obj.b).deepEqual(b);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    miss_undefined: async (cb) => {
      try {
        const obj = await cache.getObject(1);
        should(typeof obj).equal('undefined');
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    hi: async (cb) => {
      try {
        let responded = false;
        const callback = (response) => {
          if (!responded) {
            responded = true;
            should(response).equal('hello');
            cb(null, true);
          }
        };
        process.on('message', (response) => callback && callback(response));
        process.send('hi');
      } catch (err) {
        cb(err);
      }
    },
    timeout: async (cb) => {
      try {
        const cacheBad = new LRUCacheForClustersAsPromised({
          max: 1,
          stale: false,
          timeout: 1,
          namespace: `bad-cache-resolve-${member}`,
        });
        let large = '1234567890';
        for (let i = 0; i < 17; i += 1) {
          large += large;
        }
        const result = await cacheBad.get(`bad-cache-key-${large}`);
        cb(null, result);
      } catch (err) {
        cb(err);
      }
    },
    reject: async (cb) => {
      try {
        const cacheBad = new LRUCacheForClustersAsPromised({
          max: 2,
          stale: false,
          timeout: 1,
          failsafe: 'reject',
          namespace: `bad-cache-reject-${member}`,
        });
        let large = '1234567890';
        for (let i = 0; i < 17; i += 1) {
          large += large;
        }
        await cacheBad.get(`bad-cache-key-${large}`);
        cb('fail');
      } catch (err) {
        cb(null, true);
      }
    },
    pruneJob: async (cb) => {
      try {
        const namespace = `pruned-cache-${member}-${Math.random()}`;
        const prunedCache = new LRUCacheForClustersAsPromised({
          max: 10,
          stale: true,
          maxAge: 100,
          namespace,
          prune: '*/1 * * * * *',
        });

        // maybe delay the start to sync with cron
        const now = new Date();
        const delay =
          now.getMilliseconds() < 800 ? 0 : 1000 - now.getMilliseconds() + 10;
        setTimeout(async () => {
          await prunedCache.set(config.args.one, config.args.one, 200);
          await prunedCache.set(config.args.two, config.args.two, 1200);
          const itemCount = await prunedCache.itemCount();
          // we should see 2 items in the cache
          should(itemCount).equal(2);
          // check again in 1100 ms
          setTimeout(async () => {
            // one of the items should have been removed based on the expiration
            const itemCount2 = await prunedCache.itemCount();
            try {
              should(itemCount2).equal(1);
              new LRUCacheForClustersAsPromised({
                namespace,
                prune: false,
              });
              return cb(null, true);
            } catch (err) {
              return cb(err);
            }
          }, 1100);
        }, delay);
      } catch (err) {
        cb(err);
      }
    },
    pruneJob2: async (cb) => {
      try {
        const namespace = `pruned-cache-${member}-2-${Math.random()}`;
        // create it with 1 sec pruning
        new LRUCacheForClustersAsPromised({
          namespace,
          prune: '*/1 * * * * *',
        });
        // update it to run every 10 secs
        const prunedCache = new LRUCacheForClustersAsPromised({
          namespace,
          prune: '*/5 * * * * *',
        });

        // maybe delay the start to sync with cron
        const now = new Date();
        const delay =
          now.getSeconds() % 5 < 4 ? 0 : 1000 - now.getMilliseconds() + 10;
        setTimeout(async () => {
          await prunedCache.set(config.args.one, config.args.one, 200);
          await prunedCache.set(config.args.two, config.args.two, 1200);
          const itemCount = await prunedCache.itemCount();
          // we should see 2 items in the cache
          should(itemCount).equal(2);
          // check again in 1100 ms
          setTimeout(async () => {
            // both items should be there after they are expired
            const itemCount2 = await prunedCache.itemCount();
            try {
              should(itemCount2).equal(2);
              // disable prune job
              await LRUCacheForClustersAsPromised.getInstance({
                namespace,
                prune: false,
              });
              return cb(null, true);
            } catch (err) {
              return cb(err);
            }
          }, 1000);
        }, delay);
      } catch (err) {
        cb(err);
      }
    },
    set: async (cb) => {
      try {
        const result = await cache.set(config.args.one, config.args.one);
        cb(null, result);
      } catch (err) {
        cb(err);
      }
    },
    get: async (cb) => {
      try {
        await cache.set(config.args.one, config.args.one);
        const result = await cache.get(config.args.one);
        should(result).equal(config.args.one);
        cb(null, result);
      } catch (err) {
        cb(err);
      }
    },
    del: async (cb) => {
      try {
        await cache.set(config.args.one, config.args.one);
        await cache.del(config.args.one);
        const result = await cache.get(config.args.one);
        should(typeof result).equal('undefined');
        cb(null, result);
      } catch (err) {
        cb(err);
      }
    },
    incr: async (cb) => {
      try {
        const value = await cache.incr(config.args.one);
        should(value).eql(1);
        const value2 = await cache.incr(config.args.one);
        should(value2).eql(2);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    incr2: async (cb) => {
      try {
        const amount = 2;
        const value = await cache.incr(config.args.one, amount);
        should(value).eql(2);
        const value2 = await cache.incr(config.args.one, amount);
        should(value2).eql(4);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    decr: async (cb) => {
      try {
        const value = await cache.decr(config.args.one);
        should(value).eql(-1);
        const value2 = await cache.decr(config.args.one);
        should(value2).eql(-2);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    decr2: async (cb) => {
      try {
        const amount = 2;
        const value = await cache.decr(config.args.one, amount);
        should(value).eql(-2);
        const value2 = await cache.decr(config.args.one, amount);
        should(value2).eql(-4);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    peek: async (cb) => {
      try {
        await cache.set(config.args.one, config.args.one);
        await cache.set(config.args.two, config.args.two);
        await cache.set(config.args.three, config.args.three);
        const result = await cache.peek(config.args.one);
        should(result).equal(config.args.one);
        await cache.set(config.args.four, config.args.four);
        const result2 = await cache.get(config.args.one);
        should(typeof result2).equal('undefined');
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    has: async (cb) => {
      try {
        await cache.set(config.args.one, config.args.one);
        const has = await cache.has(config.args.one);
        should(has).equal(true);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    length: async (cb) => {
      try {
        await cache.set(config.args.two, config.args.two);
        await cache.set(config.args.three, config.args.three);
        const length = await cache.length();
        should(length).equal(2);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    itemCount: async (cb) => {
      try {
        await cache.set(config.args.one, config.args.one);
        const itemCount = await cache.itemCount();
        should(itemCount).equal(1);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    reset: async (cb) => {
      try {
        await cache.set(config.args.one, config.args.one);
        const result = await cache.get(config.args.one);
        should(typeof result).equal('string');
        await cache.reset();
        const result2 = await cache.get(config.args.one);
        should(typeof result2).equal('undefined');
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    keys: async (cb) => {
      try {
        const result = await cache.set(config.args.one, config.args.one);
        should(result).equal(true);
        const keys = await cache.keys();
        should(keys.length).equal(1);
        should(keys[0]).equal(config.args.one);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    values: async (cb) => {
      try {
        await cache.set(config.args.two, config.args.two);
        const values = await cache.values();
        should(values).deepEqual([config.args.two]);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    prune: async (cb) => {
      try {
        await cache.set(config.args.one, config.args.one);
        await cache.prune();
        const itemCount = await cache.itemCount();
        should(itemCount).equal(1);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    dump: async (cb) => {
      try {
        await cache.set(config.args.one, config.args.two);
        const dump = await cache.dump();
        should(dump[0].k).equal(config.args.one);
        should(dump[0].v).equal(config.args.two);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    getMax: async (cb) => {
      try {
        const max = await cache.max();
        should(max).equal(3);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    getMaxAge: async (cb) => {
      try {
        await cache.maxAge(20);
        const maxAge = await cache.maxAge();
        should(maxAge).equal(20);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    getStale: async (cb) => {
      try {
        const stale = await cache.stale();
        should(stale).equal(false);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    getAllowStale: async (cb) => {
      try {
        const stale = await cache.allowStale();
        should(stale).equal(false);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    setMax: async (cb) => {
      try {
        const max = await cache.max(10000);
        should(max).equal(10000);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    setMaxAge: async (cb) => {
      try {
        const maxAge = await cache.maxAge(10);
        should(maxAge).equal(10);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    setStale: async (cb) => {
      try {
        const stale = await cache.stale(true);
        should(stale).equal(true);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    setAllowStale: async (cb) => {
      try {
        const stale = await cache.allowStale(true);
        should(stale).equal(true);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    properties: async (cb) => {
      try {
        const propsCache = new LRUCacheForClustersAsPromised({
          namespace: 'props-cache',
          max: 1,
          maxAge: 100000,
          stale: true,
        });
        should(await propsCache.allowStale()).equal(true);
        should(await propsCache.max()).equal(1);
        should(await propsCache.maxAge()).equal(100000);

        const propsCache2 = new LRUCacheForClustersAsPromised({
          namespace: 'props-cache',
          max: 10101,
          stale: false,
        });
        should(await propsCache2.allowStale()).equal(false);
        should(await propsCache2.max()).equal(10101);
        should(await propsCache2.maxAge()).equal(100000);

        const propsCache3 = new LRUCacheForClustersAsPromised({
          namespace: 'props-cache',
          maxAge: 1000,
        });
        should(await propsCache3.allowStale()).equal(false);
        should(await propsCache3.max()).equal(10101);
        should(await propsCache3.maxAge()).equal(1000);

        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    getInstance: async (cb) => {
      try {
        const propsCache = await LRUCacheForClustersAsPromised.getInstance({
          namespace: 'props-cache',
          max: 1,
          maxAge: 100000,
          stale: true,
        });
        should(await propsCache.allowStale()).equal(true);
        should(await propsCache.max()).equal(1);
        should(await propsCache.maxAge()).equal(100000);

        const propsCache2 = await LRUCacheForClustersAsPromised.getInstance({
          namespace: 'props-cache',
          max: 10101,
          stale: false,
        });
        should(await propsCache2.allowStale()).equal(false);
        should(await propsCache2.max()).equal(10101);
        should(await propsCache2.maxAge()).equal(100000);

        const propsCache3 = await LRUCacheForClustersAsPromised.getInstance({
          namespace: 'props-cache',
          maxAge: 1000,
        });
        should(await propsCache3.allowStale()).equal(false);
        should(await propsCache3.max()).equal(10101);
        should(await propsCache3.maxAge()).equal(1000);

        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    addFour: async (cb) => {
      try {
        const value = await cache.set(config.args.one, config.args.one);
        should(value).equal(true);
        await cache.set(config.args.two, config.args.two);
        await cache.set(config.args.three, config.args.three);
        await cache.set(config.args.four, config.args.four);
        const result = await cache.get(config.args.one);
        should(typeof result).equal('undefined');
        const result2 = await cache.get(config.args.four);
        should(result2).equal(config.args.four);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
    addFourAccessOne: async (cb) => {
      try {
        const value = await cache.set(config.args.one, config.args.one);
        should(value).equal(true);
        const value2 = await cache.set(config.args.two, config.args.two);
        should(value2).equal(true);
        const value3 = await cache.set(config.args.three, config.args.three);
        should(value3).equal(true);
        const value4 = await cache.get(config.args.one);
        should(value4).equal(config.args.one);
        const value5 = await cache.set(config.args.four, config.args.four);
        should(value5).equal(true);
        const result = await cache.get(config.args.one);
        should(result).equal(config.args.one);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
  };
}

module.exports = TestUtils;
