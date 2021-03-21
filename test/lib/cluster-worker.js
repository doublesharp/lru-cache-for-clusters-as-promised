const config = require('./test-config');
const express = require('express');
const http = require('http');
const LRUCache = require('../../');
const TestUtils = require('./test-utils');

// this will be the SAME cache no matter which module calls it.
const initCache = new LRUCache();
initCache.keys();

// this will be the SAME cache no matter which module calls it.
const defaultCache = new LRUCache({
  max: 1,
  maxAge: 100000,
  stale: true,
});
defaultCache.keys();

const cache = new LRUCache({
  namespace: 'test-cache',
  max: 3,
});

const testUtils = new TestUtils(cache);

// create Express App
const app = express();

['tests', 'clusterTests'].forEach((test) => {
  Object.keys(testUtils[test]).forEach((method) => {
    app.get(`/${method}`, (req, res) => {
      testUtils[method]((err) => {
        if (err) {
          return res.send(err);
        }
        return res.send(true);
      });
    });
  });
});

const server = http.createServer(app);
server.listen(config.server.port, config.server.host);

// export the app
module.exports = app;
