const should = require('should');
const LRUCache = require('../');
const config = require('./lib/config');

describe('LRU Cache as Promised', () => {
  const cache = new LRUCache({
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

  it('should incr(key)', (done) => {
    cache.incr(config.args.one)
    .then((value) => {
      should(value).eql(1);
      return cache.incr(config.args.one);
    })
    .then((value) => {
      should(value).eql(2);
      return done();
    })
    .catch(err => done(err));
  });

  it('should incr(key, 2)', (done) => {
    const amount = 2;
    cache.incr(config.args.one, amount)
    .then((value) => {
      should(value).eql(2);
      return cache.incr(config.args.one, amount);
    })
    .then((value) => {
      should(value).eql(4);
      return done();
    })
    .catch(err => done(err));
  });

  it('should decr(key)', (done) => {
    cache.decr(config.args.one)
    .then((value) => {
      should(value).eql(-1);
      return cache.decr(config.args.one);
    })
    .then((value) => {
      should(value).eql(-2);
      return done();
    })
    .catch(err => done(err));
  });

  it('should decr(key, 2)', (done) => {
    const amount = 2;
    cache.decr(config.args.one, amount)
    .then((value) => {
      should(value).eql(-2);
      return cache.decr(config.args.one, amount);
    })
    .then((value) => {
      should(value).eql(-4);
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

  it('should set the max()', (done) => {
    cache.max(10)
    .then((max) => {
      should(max).equal(10);
      return done();
    })
    .catch(err => done(err));
  });

  it('should set the stale()', (done) => {
    cache.stale(true)
    .then((stale) => {
      should(stale).equal(true);
      return done();
    })
    .catch(err => done(err));
  });

  it('should set the maxAge()', (done) => {
    cache.maxAge(10)
    .then((maxAge) => {
      should(maxAge).equal(10);
      return done();
    })
    .catch(err => done(err));
  });
});
