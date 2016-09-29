const should = require('should');
const LRUCache = require('../');
const config = require('./lib/config');

describe('LRU Cache as Promised', () => {
  const cache = new LRUCache({
    namespace: 'default',
    max: 3,
    stale: false,
  });

  afterEach((done) => {
    cache.reset()
    .then(() => done());
  });

  it('should set(key, value)', (done) => {
    cache.set(config.args.one, config.args.one)
    .then(() => done())
    .catch(err => done(err));
  });

  it('should get(key)', (done) => {
    cache.set(config.args.one, config.args.one)
    .then(() => cache.get(config.args.one))
    .then((result) => {
      should(result).equal(config.args.one);
      return done();
    });
  });

  it('should del(key)', (done) => {
    cache.del(config.args.one)
    .then(() => cache.get(config.args.one))
    .then((result) => {
      should(result).equal(undefined);
      return done();
    })
    .catch(err => done(err));
  });

  it('should add four keys and have the first fall out', (done) => {
    cache.set(config.args.one, config.args.one)
    .then(() => cache.set(config.args.two, config.args.two))
    .then(() => cache.set(config.args.three, config.args.three))
    .then(() => cache.set(config.args.four, config.args.four))
    .then(() => cache.get(config.args.one))
    .then((result) => {
      should(result).equal(undefined);
      return done();
    })
    .catch(err => done(err));
  });

  it('should add four keys and then access the first so the second falls out', (done) => {
    cache.set(config.args.one, config.args.one)
    .then(() => cache.set(config.args.two, config.args.two))
    .then(() => cache.set(config.args.three, config.args.three))
    .then(() => cache.get(config.args.one))
    .then(() => cache.set(config.args.four, config.args.four))
    .then(() => cache.get(config.args.one))
    .then((result) => {
      should(result).equal(config.args.one);
      return done();
    })
    .catch(err => done(err));
  });

  it('should peek(key)', (done) => {
    const vals = [];
    cache.set(config.args.one, config.args.one)
    .then(() => cache.set(config.args.two, config.args.two))
    .then(() => cache.set(config.args.three, config.args.three))
    .then(() => cache.peek(config.args.one))
    .then((result) => {
      vals.push(result);
      return cache.set(config.args.four, config.args.four);
    })
    .then(() => cache.get(config.args.one))
    .then((result) => {
      vals.push(result);
      should(vals).deepEqual(['one', undefined]);
      return done();
    })
    .catch(err => done(err));
  });

  it('should has(key)', (done) => {
    cache.set(config.args.one, config.args.one)
    .then(() => cache.has(config.args.one))
    .then((result) => {
      should(result).equal(true);
      return done();
    })
    .catch(err => done(err));
  });

  it('should return length/itemCount', (done) => {
    const vals = [];
    cache.set(config.args.one, config.args.one)
    .then(() => cache.length())
    .then((result) => {
      vals.push(result);
      return cache.itemCount();
    })
    .then((result) => {
      vals.push(result);
      should(vals).deepEqual([1, 1]);
      return done();
    })
    .catch(err => done(err));
  });

  it('should reset the cache', (done) => {
    cache.set(config.args.one, config.args.one)
    .then(() => cache.reset())
    .then(() => cache.get(config.args.one))
    .then((result) => {
      should(result).equal(undefined);
      return done();
    })
    .catch(err => done(err));
  });

  it('should get the itemCount', (done) => {
    cache.set(config.args.one, config.args.one)
    .then(() => cache.itemCount())
    .then((result) => {
      should(result).equal(1);
      return done();
    })
    .catch(err => done(err));
  });
});
