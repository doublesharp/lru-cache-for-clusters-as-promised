const request = require('supertest');
const config = require('./lib/config');
const TestUtils = require('./lib/test-utils');

let master = null;
describe('LRU Cache for Clusters', () => {
  const testUtils = new TestUtils();

  // run before the tests start
  before((done) => {
    // This will call done with the cluster has forked and the worker is listening
    master = require('./lib/cluster-master')(done);
  });

  afterEach((done) => {
    request(`http://${config.server.host}:${config.server.port}`)
      .get('/reset')
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  ['tests', 'clusterTests'].forEach((test) => {
    Object.keys(testUtils[test]).forEach((method) => {
      it(`should ${testUtils[test][method]}`, (done) => {
        // run the request
        request(`http://${config.server.host}:${config.server.port}`)
          .get(`/${method}`)
          .expect(200)
          .end((err, response) => {
            if (err) {
              return done(err);
            }
            return response.body === true
              ? done()
              : done(new Error(response.body));
          });
      });
    });
  });

  it('should access the shared cache from the master thread', (done) => {
    master.accessSharedFromMaster(done);
  });
});
