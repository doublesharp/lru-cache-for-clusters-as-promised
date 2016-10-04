const http = require('http');
const config = require('./config');
const express = require('express');
const LRUCache = require('../../');

// this will be the SAME cache no matter what module calls it.
const defaultCache = new LRUCache({
  max: 1,
});
defaultCache.keys();

const cache = new LRUCache({
  max: 3,
  stale: false,
  namespace: 'test-cache',
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
  .then(result => res.send(result === undefined ? 'ok' : 'fail'));
});

app.get('/reject', (req, res) => {
  const cacheBad = new LRUCache({
    max: 3,
    stale: false,
    timeout: 1,
    failsafe: 'reject',
    namespace: 'bad-cache-reject',
  });
  let large = '1234567890';
  for (let i = 0; i < 17; i += 1) {
    large += large;
  }
  return cacheBad.get(`bad-cache-key-${large}`)
  .then(() => res.send('fail'))
  .catch(() => res.send('ok'));
});

app.get('/set', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(result => res.send(result));
});

app.get('/get', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.get(config.args.one))
  .then(result => res.send(result));
});

app.get('/del', (req, res) => {
  cache.del(config.args.one)
  .then(() => cache.get(config.args.one))
  .then(result => res.send(result))
  .catch(err => res.send(err));
});

app.get('/incr', (req, res) => {
  const values = [];
  return cache.incr(config.args.one)
  .then((value) => {
    values.push(value);
    return cache.incr(config.args.one);
  })
  .then((value) => {
    values.push(value);
    res.send(values);
  });
});

app.get('/incr2', (req, res) => {
  const values = [];
  const amount = 2;
  return cache.incr(config.args.one, amount)
  .then((value) => {
    values.push(value);
    return cache.incr(config.args.one, amount);
  })
  .then((value) => {
    values.push(value);
    res.send(values);
  });
});

app.get('/decr', (req, res) => {
  const values = [];
  return cache.decr(config.args.one)
  .then((value) => {
    values.push(value);
    return cache.decr(config.args.one);
  })
  .then((value) => {
    values.push(value);
    res.send(values);
  });
});

app.get('/decr2', (req, res) => {
  const values = [];
  const amount = 2;
  return cache.decr(config.args.one, amount)
  .then((value) => {
    values.push(value);
    return cache.decr(config.args.one, amount);
  })
  .then((value) => {
    values.push(value);
    res.send(values);
  });
});

app.get('/one-two-three-four', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.set(config.args.two, config.args.two))
  .then(() => cache.set(config.args.three, config.args.three))
  .then(() => cache.set(config.args.four, config.args.four))
  .then(() => cache.get(config.args.one))
  .then(result => res.send(result));
});

app.get('/one-two-three-four-one', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.set(config.args.two, config.args.two))
  .then(() => cache.set(config.args.three, config.args.three))
  .then(() => cache.get(config.args.one))
  .then(() => cache.set(config.args.four, config.args.four))
  .then(() => cache.get(config.args.one))
  .then(result => res.send(result));
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
  .then(result => res.send(result));
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
  .then(result => res.send({ result }));
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
  .then(() => cache.prune())
  .then(() => cache.itemCount())
  .then(result => res.send({ result }));
});

app.get('/dump', (req, res) => {
  cache.set(config.args.one, config.args.one)
  .then(() => cache.dump())
  .then(result => res.send({ result }));
});

app.get('/stale', (req, res) => {
  const vals = [];
  cache.stale()
  .then((stale) => {
    vals.push(stale);
    cache.stale(true)
    .then((stale2) => {
      vals.push(stale2);
      return res.send(vals);
    });
  });
});

app.get('/max', (req, res) => {
  const vals = [];
  cache.max()
  .then((max) => {
    vals.push(max);
    cache.max(10)
    .then((max2) => {
      vals.push(max2);
      return res.send(vals);
    });
  });
});

app.get('/maxAge', (req, res) => {
  const vals = [];
  cache.maxAge()
  .then((maxAge) => {
    vals.push(maxAge);
    cache.maxAge(100)
    .then((maxAge2) => {
      vals.push(maxAge2);
      return res.send(vals);
    });
  });
});

const server = http.createServer(app);
server.listen(config.server.port, config.server.host);

// export the app
module.exports = app;
