const config = require('./config');
const cluster = require('cluster');
const should = require('should');
const LRUCache = require('../../');

const member = cluster.isWorker ? 'worker' : 'master';

/**
 * Test class definitions for clusterd and non-clustered environments
 * @param {LRUCacheForClustersAsPromised} cache The cache that the test should be run against.
 * @return {void} Node style callback
 */
function TestUtils(cache) {
  return {
    clusterTests: {
      hi: 'not respond to messages that are from somewhere else',
      timeout: 'timeout',
      reject: 'timeout with reject',
    },
    tests: {
      mSet: 'mSet values',
      mSetNull: 'mSet null pairs',
      mGet: 'mGet values',
      mGetNull: 'mGet with null keys',
      mGetAndSetObjects: 'mGetObjects and mSetObjects',
      mDel: 'mGet keys',
      mDelNull: 'mDel with null keys',
      objects: 'get and set objects',
      null_objects: 'null objects should be ok',
      pruneJob: 'prune cache using cron job',
      set: 'set(key, value)',
      get: 'get(key)',
      del: 'del(key)',
      incr: 'incr(key)',
      incr2: 'incr(key, 2)',
      decr: 'decr(key)',
      decr2: 'decr(key, 2)',
      peek: 'peek(key)',
      has: 'has(key)',
      length: 'length()',
      itemCount: 'itemCount()',
      reset: 'reset()',
      keys: 'keys()',
      values: 'values()',
      prune: 'prune()',
      dump: 'dump()',
      addFour: 'add four keys and have the first fall out',
      addFourAccessOne: 'add four keys and then access the first so the second falls out',
      getMax: 'max()',
      getMaxAge: 'maxAge()',
      getStale: 'stale()',
      setMax: 'max(10)',
      setMaxAge: 'maxAge(10)',
      setStale: 'stale(true)',
    },
    mSet: (cb) => {
      const pairs = {
        foo: 'bar',
        bizz: 'buzz',
      };
      cache.mSet(pairs)
          .then(() => cache.get('bizz'))
          .then((value) => {
            should(value).equal('buzz');
            cb(null, true);
          })
          .catch((err) => cb(err));
    },
    mSetNull: (cb) => {
      const pairs = null;
      cache.mSet(pairs)
          .then(() => cache.mSet('string'))
          .then(() => cache.mSet(['array']))
          .then(() => {
            cb(null, true);
          })
          .catch((err) => cb(err));
    },
    mGet: (cb) => {
      const pairs = {
        foo: 'bar',
        bizz: 'buzz',
      };
      cache.mSet(pairs)
          .then(() => cache.mGet(['bizz', 'foo']))
          .then((values) => {
            // should(values).not.equal(undefined);
            should(values.bizz).equal('buzz');
            should(values.foo).equal('bar');
            cb(null, true);
          })
          .catch((err) => cb(err));
    },
    mGetAndSetObjects: (cb) => {
      const pairs = {
        foo: { boo: 'bar' },
        bizz: { bam: 'buzz' },
      };
      cache.mSetObjects(pairs)
          .then(() => cache.mGetObjects(['bizz', 'foo']))
          .then((values) => {
            should(values.bizz).deepEqual({ bam: 'buzz' });
            should(values.foo).deepEqual({ boo: 'bar' });
            cb(null, true);
          })
          .catch((err) => cb(err));
    },
    mGetNull: (cb) => {
      cache.mGet('string')
          .then((values) => {
            should(values).deepEqual({});
            return cache.mGet(null);
          })
          .then((values) => {
            should(values).deepEqual({});
            cb(null, true);
          })
          .catch((err) => cb(err));
    },
    mDel: (cb) => {
      const pairs = {
        my: 'bar',
        get: 'buzz',
      };
      cache.mSet(pairs)
          .then(() => cache.mDel(['my', 'get']))
          .then(() => cache.get('get'))
          .then((value) => {
            should(value).equal(undefined);
            cb(null, true);
          })
          .catch((err) => cb(err));
    },
    mDelNull: (cb) => {
      const pairs = {
        foo: 'whamo',
        bizz: 'blamo',
      };
      cache.mSet(pairs)
          .then(() => cache.mDel(null))
          .then(() => cache.get('bizz'))
          .then((value) => {
            should(value).equal('blamo');
            cb(null, true);
          })
          .catch((err) => cb(err));
    },
    objects: (cb) => {
      const myObj = { foo: 'bar' };
      cache.setObject(1, myObj)
          .then(() => cache.getObject(1))
          .then((obj) => {
            should(obj).not.equal(null);
            should(obj.foo).equal('bar');
            cb(null, true);
          })
          .catch((err) => cb(err));
    },
    null_objects: (cb) => {
      cache.setObject(1, undefined)
          .then(() => cache.getObject(1))
          .then((obj) => {
            should(obj).equal(undefined);
            cb(null, true);
          })
          .catch((err) => cb(err));
    },
    hi: (cb) => {
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
    },
    timeout: (cb) => {
      const cacheBad = new LRUCache({
        max: 1,
        stale: false,
        timeout: 1,
        namespace: `bad-cache-resolve-${member}`,
      });
      let large = '1234567890';
      for (let i = 0; i < 17; i += 1) {
        large += large;
      }
      return cacheBad.get(`bad-cache-key-${large}`)
          .then((result) => cb(null, result))
          .catch((err) => cb(err));
    },
    reject: (cb) => {
      const cacheBad = new LRUCache({
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
      return cacheBad.get(`bad-cache-key-${large}`)
          .then(() => cb('fail'))
          .catch(() => cb(null, true));
    },
    pruneJob: (cb) => {
      const prunedCache = new LRUCache({
        max: 10,
        stale: true,
        maxAge: 100,
        namespace: `pruned-cache-${member}`,
        prune: '*/1 * * * * *',
      });
      prunedCache.set(config.args.one, config.args.one)
          .then(() => prunedCache.set(config.args.two, config.args.two, 2000))
          .then(() => prunedCache.itemCount())
          .then((itemCount) => {
            // we should see 2 items in the cache
            should(itemCount).equal(2);
            // check again in 1100 ms
            setTimeout(() => {
              // one of the items should have been removed based on the expiration
              prunedCache.itemCount()
                  .then((itemCount2) => {
                    try {
                      should(itemCount2).equal(1);
                      return cb(null, true);
                    } catch (err) {
                      return cb(err);
                    }
                  });
            }, 1100);
          })
          .catch((err) => cb(err));
    },
    set: (cb) => {
      cache.set(config.args.one, config.args.one)
          .then((result) => cb(null, result))
          .catch((err) => cb(err));
    },
    get: (cb) => {
      cache.set(config.args.one, config.args.one)
          .then(() => cache.get(config.args.one))
          .then((result) => {
            should(result).equal(config.args.one);
            return cb(null, result);
          })
          .catch((err) => cb(err));
    },
    del: (cb) => {
      cache.del(config.args.one)
          .then(() => cache.get(config.args.one))
          .then((result) => {
            should(result).equal(undefined);
            return cb(null, result);
          })
          .catch((err) => cb(err));
    },
    incr: (cb) => {
      cache.incr(config.args.one)
          .then((value) => {
            should(value).eql(1);
            return cache.incr(config.args.one);
          })
          .then((value) => {
            should(value).eql(2);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    incr2: (cb) => {
      const amount = 2;
      cache.incr(config.args.one, amount)
          .then((value) => {
            should(value).eql(2);
            return cache.incr(config.args.one, amount);
          })
          .then((value) => {
            should(value).eql(4);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    decr: (cb) => {
      cache.decr(config.args.one)
          .then((value) => {
            should(value).eql(-1);
            return cache.decr(config.args.one);
          })
          .then((value) => {
            should(value).eql(-2);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    decr2: (cb) => {
      const amount = 2;
      cache.decr(config.args.one, amount)
          .then((value) => {
            should(value).eql(-2);
            return cache.decr(config.args.one, amount);
          })
          .then((value) => {
            should(value).eql(-4);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    peek: (cb) => {
      cache.set(config.args.one, config.args.one)
          .then(() => cache.set(config.args.two, config.args.two))
          .then(() => cache.set(config.args.three, config.args.three))
          .then(() => cache.peek(config.args.one))
          .then((result) => {
            should(result).equal(config.args.one);
            return cache.set(config.args.four, config.args.four);
          })
          .then(() => cache.get(config.args.one))
          .then((result) => {
            should(undefined).equal(result);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    has: (cb) => {
      cache.set(config.args.one, config.args.one)
          .then(() => cache.has(config.args.one))
          .then((has) => {
            should(has).equal(true);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    length: (cb) => {
      cache.set(config.args.two, config.args.two)
          .then(() => cache.set(config.args.three, config.args.three))
          .then(() => cache.length())
          .then((length) => {
            should(length).equal(2);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    itemCount: (cb) => {
      cache.set(config.args.one, config.args.one)
          .then(() => cache.itemCount())
          .then((itemCount) => {
            should(itemCount).equal(1);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    reset: (cb) => {
      cache.set(config.args.one, config.args.one)
          .then(() => cache.reset())
          .then(() => cache.get(config.args.one))
          .then((result) => {
            should(result).equal(undefined);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    keys: (cb) => {
      cache.set(config.args.one, config.args.one)
          .then((result) => {
            should(result).equal(true);
            return cache.keys();
          })
          .then((keys) => {
            should(keys.length).equal(1);
            should(keys[0]).equal(config.args.one);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    values: (cb) => {
      cache.set(config.args.two, config.args.two)
          .then(() => cache.values())
          .then((values) => {
            should(values).deepEqual([config.args.two]);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    prune: (cb) => {
      cache.set(config.args.one, config.args.one)
          .then(() => cache.prune())
          .then(() => cache.itemCount())
          .then((itemCount) => {
            should(itemCount).equal(1);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    dump: (cb) => {
      cache.set(config.args.one, config.args.two)
          .then(() => cache.dump())
          .then((dump) => {
            should(dump[0].k).equal(config.args.one);
            should(dump[0].v).equal(config.args.two);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    getMax: (cb) => {
      cache.max()
          .then((max) => {
            should(max).equal(3);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    getMaxAge: (cb) => {
      cache.maxAge()
          .then((maxAge) => {
            should(maxAge).equal(0);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    getStale: (cb) => {
      cache.stale()
          .then((stale) => {
            should(stale).equal(undefined);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    setMax: (cb) => {
      cache.max(100)
          .then((max) => {
            should(max).equal(100);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    setMaxAge: (cb) => {
      cache.maxAge(10)
          .then((maxAge) => {
            should(maxAge).equal(10);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    setStale: (cb) => {
      cache.stale(true)
          .then((stale) => {
            should(stale).equal(true);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    addFour: (cb) => {
      cache.set(config.args.one, config.args.one)
          .then((value) => {
            should(value).equal(true);
            return cache.set(config.args.two, config.args.two);
          })
          .then(() => cache.set(config.args.three, config.args.three))
          .then(() => cache.set(config.args.four, config.args.four))
          .then(() => cache.get(config.args.one))
          .then((result) => {
            should(result).equal(undefined);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
    addFourAccessOne: (cb) => {
      cache.set(config.args.one, config.args.one)
          .then((value) => {
            should(value).equal(true);
            return cache.set(config.args.two, config.args.two);
          })
          .then((value) => {
            should(value).equal(true);
            return cache.set(config.args.three, config.args.three);
          })
          .then((value) => {
            should(value).equal(true);
            return cache.get(config.args.one);
          })
          .then((value) => {
            should(value).equal(config.args.one);
            return cache.set(config.args.four, config.args.four);
          })
          .then((value) => {
            should(value).equal(true);
            return cache.get(config.args.one);
          })
          .then((result) => {
            should(result).equal(config.args.one);
            return cb(null, true);
          })
          .catch((err) => cb(err));
    },
  };
}

module.exports = TestUtils;
