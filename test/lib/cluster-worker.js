const http = require('http');
const config = require('./config');
const express = require('express');
const LRUCache = require('../../');

const cache = new LRUCache({
  max: 3,
  stale: false,
});

// create Express App
const app = express();

// test non-caching messages
let callback;
process.on('message', (response) => callback && callback(response));

app.get('/hi', (req, res) => {
  callback = (response) => {
    res.send(response);
  };
  process.send('hi');
});

app.get('/set', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then((result) => res.send(result));
});

app.get('/get', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.get(config.args.one))
  .then((result) => res.send(result));
});

app.get('/del', (req, res) => {
  cache.del(config.args.one)
  .then(() => cache.get(config.args.one))
  .then((result) => res.send(result));
});

app.get('/one-two-three-four', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.set(config.args.two, config.args.two))
  .then(() => cache.set(config.args.three, config.args.three))
  .then(() => cache.set(config.args.four, config.args.four))
  .then(() => cache.get(config.args.one))
  .then((result) => res.send(result));
});

app.get('/one-two-three-four-one', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.set(config.args.two, config.args.two))
  .then(() => cache.set(config.args.three, config.args.three))
  .then(() => cache.get(config.args.one))
  .then(() => cache.set(config.args.four, config.args.four))
  .then(() => cache.get(config.args.one))
  .then((result) => res.send(result));
});

app.get('/peek', (req, res) => {
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
    return res.send(vals);
  });
});

app.get('/has', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.has(config.args.one))
  .then((result) => res.send(result));
});

app.get('/length-itemcount', (req, res) => {
  const vals = [];
  cache.set(config.args.one, config.args.one)
  .then(() => cache.length())
  .then((result) => {
    vals.push(result);
    return cache.itemCount();
  })
  .then((result) => {
    vals.push(result);
    return res.send(vals);
  });
});

app.get('/reset', (req, res) => {
  cache.reset()
  .then(() => cache.itemCount())
  .then((result) => res.send({ result }));
});

app.get('/keys-values', (req, res) => {
  const vals = [];
  cache.set(config.args.one, config.args.one)
  .then(() => cache.keys())
  .then((result) => {
    vals.push(result);
    return cache.values();
  })
  .then((result) => {
    vals.push(result);
    return res.send(vals);
  });
});

app.get('/prune', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.prune())
  .then(() => cache.itemCount())
  .then((result) => res.send({ result }));
});

app.get('/dump', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.dump())
  .then((result) => res.send({ result }));
});

const server = http.createServer(app);
server.listen(config.server.port, config.server.host);

// export the app
module.exports = app;
