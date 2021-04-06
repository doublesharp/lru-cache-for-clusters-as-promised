const cluster = require('cluster');
const path = require('path');
const Debug = require('debug');
const config = require('../../config');
const LRUCache = require('../../');

const debug = new Debug(`${config.source}-test-cluster-master`);

LRUCache.init();

// this is the path to the cluster worker that spawns the http server
cluster.setupMaster({
  exec: path.join(__dirname, 'cluster-worker.js'),
});

// start one worker to handle the threads
const workers = 1;
for (let i = 0; i < workers; i += 1) {
  cluster.fork();
}

let listeningCount = 0;

// provide a function for mocha so we can call back when the worker is ready
module.exports = (done) => {
  // fire when a new worker is forked
  cluster.on('fork', (worker) => {
    // fire when the worker is ready for new connections
    worker.on('listening', () => {
      listeningCount += 1;
      // tell mocha we are good to go
      if (listeningCount === workers) {
        done();
      }
    });
    // wait for the worker to send a message
    worker.on('message', (request) => {
      if (request === 'hi') {
        worker.send('hello');
      }
    });
    // wait for the worker to send a message
    worker.on('error', (error) => {
      debug(error.message);
    });
  });
  return {
    accessSharedFromMaster: async (done2) => {
      const cache = new LRUCache({
        namespace: 'test-cache',
      });
      await cache.keys();
      return done2();
    },
    getCacheMax: () => {
      const cache = new LRUCache({
        namespace: 'test-cache',
      });
      return cache.max();
    },
    getCacheMaxAge: () => {
      const cache = new LRUCache({
        namespace: 'test-cache',
      });
      return cache.maxAge();
    },
    getCacheStale: () => {
      const cache = new LRUCache({
        namespace: 'test-cache',
      });
      return cache.stale();
    },
    shutdown: (done) => {
      cluster.disconnect(() => {
        done();
      });
    },
  };
};
