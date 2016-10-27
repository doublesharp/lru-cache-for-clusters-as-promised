const LRUCache = require('../');
const TestUtils = require('./lib/test-utils');

describe('LRU Cache as Promised', () => {
  const cache = new LRUCache({
    namespace: 'lru-cache-as-promised',
    max: 3,
    stale: false,
  });

  const testUtils = new TestUtils(cache);

  afterEach((done) => {
    testUtils.reset(() => done());
  });

  ['tests'].forEach((test) => {
    Object.keys(testUtils[test]).forEach((method) => {
      it(`should ${testUtils[test][method]}`, (done) => {
        // run the request
        testUtils[method]((err) => {
          if (err) {
            return done(err);
          }
          return done();
        });
      });
    });
  });
});
