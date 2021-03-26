const config = require('./test-config');
const express = require('express');
const http = require('http');
const LRUCache = require('../../lru-cache-for-clusters-as-promised');
const TestUtils = require('./test-utils');

// this will be the SAME cache no matter which module calls it.
const initCache = new LRUCache();
initCache.keys();

require('../../lib/worker');

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
          return res.send({ error: `${err.stack}` });
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
