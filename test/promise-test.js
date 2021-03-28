const LRUCacheForClustersAsPromised = require('../lru-cache-for-clusters-as-promised');
const TestUtils = require('./lib/test-utils');
const async = require('async');

describe('LRU Cache as Promised', async () => {
  const cache = new LRUCacheForClustersAsPromised({
    namespace: 'lru-cache-as-promised',
    max: 3,
    stale: false,
  });

  const testUtils = new TestUtils(cache);

  before(function () {
    this.timeout(5000);
  });

  afterEach((done) => {
    testUtils.reset(done);
  });

  await async.eachOf(Object.keys(testUtils.tests), async (method) => {
    return new Promise((resolve, reject) => {
      it(`should ${testUtils.tests[method]}`, () => {
        // run the request
        testUtils[method]((err) => {
          if (err) {
            return reject(err);
          }
          return resolve();
        });
      });
    });
  });
});
