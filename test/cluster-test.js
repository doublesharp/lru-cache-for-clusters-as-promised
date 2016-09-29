const request = require('supertest');
const should = require('should');
const config = require('./lib/config');

describe('LRU Cache for Clusters', () => {
  // run before the tests start
  before((done) => {
    // This will call done with the cluster has forked and the worker is listening
    require('./lib/cluster-master')(done);
  });

  afterEach((done) => {
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/reset')
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      should(response.text).equal('{"result":0}');
      return done();
    });
  });

  it('should timeout', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/timeout')
    .expect(200)
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      response.text.should.eql('ok');
      return done();
    });
  });

  it('should set(key, value)', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/set')
    .expect(200)
    .end((err) => {
      if (err) {
        return done(err);
      }
      return done();
    });
  });

  it('should get(key)', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/get')
    .expect(200)
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      response.text.should.equal(config.args.one);
      return done();
    });
  });

  it('should del(key)', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/del')
    .expect(200)
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      should(response.text).be.empty(null);
      return done();
    });
  });

  it('should add four keys and have the first fall out', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/one-two-three-four')
    .expect(200)
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      should(response.text).be.empty();
      return done();
    });
  });

  it('should add four keys and then access the first so the second falls out', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/one-two-three-four-one')
    .expect(200)
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      should(response.text).be.equal(config.args.one);
      return done();
    });
  });

  it('should peek(key)', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/peek')
    .expect(200)
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      should(response.text).equal('["one",null]');
      return done();
    });
  });

  it('should has(key)', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/has')
    .expect(200)
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      should(response.text).be.equal('true');
      return done();
    });
  });

  it('should return length/itemCount', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/length-itemcount')
    .expect(200)
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      should(response.text).be.equal('[1,1]');
      return done();
    });
  });

  it('should reset the cache', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/reset')
    .expect(200)
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      should(response.text).be.equal('{"result":0}');
      return done();
    });
  });

  it('should return keys/values', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/keys-values')
    .expect(200)
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      should(response.text).equal('[["one"],["one"]]');
      return done();
    });
  });

  it('should prune the cache', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/prune')
    .expect(200)
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      should(response.text).equal('{"result":1}');
      return done();
    });
  });

  it('should dump the cache', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/dump')
    .expect(200)
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      should(response.text).equal('{"result":[{"k":"one","v":"one","e":0}]}');
      return done();
    });
  });

  it('should not respond to messages that are from somewhere else', (done) => {
    // run the request
    request(`http://${config.server.host}:${config.server.port}`)
    .get('/hi')
    .expect(200)
    .end((err, response) => {
      if (err) {
        return done(err);
      }
      should(response.text).equal('hello');
      return done();
    });
  });
});
