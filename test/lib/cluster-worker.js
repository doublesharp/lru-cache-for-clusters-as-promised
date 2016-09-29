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
app.get('/hi', (req, res) => {
  let responded = false;
  const callback = (response) => {
    if (!responded) {
      responded = true;
      res.send(response);
    }
  };
  process.on('message', response => callback && callback(response));
  process.send('hi');
});

app.get('/timeout', (req, res) => {
  const cacheBad = new LRUCache({
    max: 3,
    stale: false,
    timeout: 1,
    namespace: 'bad-cache',
  });
  return cacheBad.get('test')
  .then(() => res.send('fail'))
  .catch(() => res.send('ok'));
});

app.get('/set', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(result => res.send(result))
  .catch(err => res.send(err));
});

app.get('/get', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.get(config.args.one))
  .then(result => res.send(result))
  .catch(err => res.send(err));
});

app.get('/del', (req, res) => {
  cache.del(config.args.one)
  .then(() => cache.get(config.args.one))
  .then(result => res.send(result))
  .catch(err => res.send(err));
});

app.get('/one-two-three-four', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.set(config.args.two, config.args.two))
  .then(() => cache.set(config.args.three, config.args.three))
  .then(() => cache.set(config.args.four, config.args.four))
  .then(() => cache.get(config.args.one))
  .then(result => res.send(result))
  .catch(err => res.send(err));
});

app.get('/one-two-three-four-one', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.set(config.args.two, config.args.two))
  .then(() => cache.set(config.args.three, config.args.three))
  .then(() => cache.get(config.args.one))
  .then(() => cache.set(config.args.four, config.args.four))
  .then(() => cache.get(config.args.one))
  .then(result => res.send(result))
  .catch(err => res.send(err));
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
  })
  .catch(err => res.send(err));
});

app.get('/has', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.has(config.args.one))
  .then(result => res.send(result))
  .catch(err => res.send(err));
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
  })
  .catch(err => res.send(err));
});

app.get('/reset', (req, res) => {
  cache.reset()
  .then(() => cache.itemCount())
  .then(result => res.send({ result }))
  .catch(err => res.send(err));
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
  })
  .catch(err => res.send(err));
});

app.get('/prune', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.prune()
  .catch(err => res.send(err)))
  .then(() => cache.itemCount()
  .catch(err => res.send(err)))
  .then(result => res.send({ result }))
  .catch(err => res.send(err));
});

app.get('/dump', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.dump())
  .then(result => res.send({ result }))
  .catch(err => res.send(err));
});

const server = http.createServer(app);
server.listen(config.server.port, config.server.host);

// export the app
module.exports = app;
