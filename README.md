# lru-cache-for-clusters-as-promised

[![lru-cache-for-clusters-as-promised](https://img.shields.io/npm/v/lru-cache-for-clusters-as-promised.svg)](https://www.npmjs.com/package/email-templates-mock)
![Build Status](https://jenkins.doublesharp.com/badges/build/lru-cache-for-clusters-as-promised.svg)
![Code Coverage](https://jenkins.doublesharp.com/badges/coverage/lru-cache-for-clusters-as-promised.svg)
[![Code Climate](https://codeclimate.com/github/doublesharp/lru-cache-for-clusters-as-promised/badges/gpa.svg)](https://codeclimate.com/github/doublesharp/lru-cache-for-clusters-as-promised)
[![Issue Count](https://codeclimate.com/github/doublesharp/lru-cache-for-clusters-as-promised/badges/issue_count.svg)](https://codeclimate.com/github/doublesharp/lru-cache-for-clusters-as-promised)
![Dependency Status](https://david-dm.org/doublesharp/lru-cache-for-clusters-as-promised.svg)
![Dev Dependency Status](https://david-dm.org/doublesharp/lru-cache-for-clusters-as-promised/dev-status.svg)
![Downloads](https://img.shields.io/npm/dt/lru-cache-for-clusters-as-promised.svg)

LRU Cache for Clusters as Promised provides a cluster-safe [`lru-cache`](https://www.npmjs.com/package/lru-cache) via Promises. For environments not using [`cluster`](https://nodejs.org/api/cluster.html), the class will provide a Promisified interface to a standard [`lru-cache`](https://www.npmjs.com/package/lru-cache).

Each time you call [`cluster.fork()`](https://nodejs.org/api/cluster.html#cluster_cluster_fork_env), a new thread is spawned to run your application. When using a load balancer even if a user is assigned a particular IP and port these values are shared between the [`workers`](https://nodejs.org/api/cluster.html#cluster_class_worker) in your cluster, which means there is no guarantee that the user will use the same `workers` between requests. Caching the same objects in multiple threads is not an efficient use of memory. 

LRU Cache for Clusters as Promised stores a single `lru-cache` on the [`master`](https://nodejs.org/api/cluster.html#cluster_cluster_ismaster) thread which is accessed by the `workers` via IPC messages. The same `lru-cache` is shared between `workers` having a common `master`, so no memory is wasted.

To differentiate caches on the master as instances on the `workers`, specify a `namespace` value in the options argument of the `new LRUCache(options)` constructor.

# install
```shell
npm install --save lru-cache-for-clusters-as-promised
```

# example usage
```javascript
const LRUCache = require('lru-cache-for-clusters-as-promised');
const cache = new LRUCache({
  max: 50,
  stale: false,
  namespace: 'users',
});

const user = { name: 'user name' };
const key = 'userKey';

// set a user for a the key
cache.set(key, user)
.then(() => {
  console.log('set the user');

  // get the same use back out of the cache
  return cache.get(key);
})
.then((cachedUser) => {
  console.log('got the user', cachedUser);

  // check the number of items in the cache
  return cache.length();
})
.then((size) => {
  console.log('cache size/length', size);

  // remove all the items from the cache
  return cache.reset();
})
.then(() => {
  console.log('the cache is empty');

  // this will return the same value as calling length()
  return cache.itemCount();
})
.then((size) => {
  console.log('cache size/itemCount', size);
});

```

# options

* `namespace: string`
  * the namespace for this cache on the master thread as it is not aware of the worker instances
* `max: number`
  * the maximum items that can be stored in the cache
* `maxAge: milliseconds`
  * the maximum age for an item to be considered valid
* `stale: true|false`
  * when true expired items are return before they are removed rather than undefined

> ! note that `length` and `dispose` are missing as it is not possible to pass `functions` via IPC messages.

# api

* `set(key, value)`
  * sets a value for a key
* `get(key)`
  * returns a value for a key
* `peek(key)`
  * return the value for a key without updating its last access time
* `del(key)`
  * remove a value from the cache
* `has(key)`
  * returns true if the key exists in the cache
* `reset()`
  * removes all values from the cache
* `keys()`
  * returns an array of all the cache keys
* `values()`
  * returns an array of all the cache values
* `dump()`
  * returns a serialized array of the cache contents
* `prune()`
  * manually removes items from the cache rather than on get
* `length()`
  * return the number of items in the cache
* `itemCount()`
  * return the number of items in the cache. same as `length()`.

# process flow

**Clustered cache on master thread for clustered environments***
```
                                                                +-----+
+--------+  +---------------+  +---------+  +---------------+   # M T #
|        +--> LRU Cache for +-->         +--> Worker Sends  +--># A H #
| Worker |  |  Clusters as  |  | Promise |  |  IPC Message  |   # S R #
|        <--+   Promised    <--+         <--+   to Master   <---# T E #
+--------+  +---------------+  +---------+  +---------------+   # E A #
                                                                # R D #
v---------------------------------------------------------------+-----+
+-----+
* W T *   +--------------+  +--------+  +-----------+
* O H *--->   Master     +-->        +--> LRU Cache |
* R R *   | IPC Message  |  | Master |  |    by     |
* K E *<--+  Listener    <--+        <--+ namespace |
* E A *   +--------------+  +--------+  +-----------+
* R D *
+-----+
```

**Promisified for non-clustered environments***
```
+---------------+  +---------------+  +---------+  +-----------+
|               +--> LRU Cache for +-->         +-->           |
| Non-clustered |  |  Clusters as  |  | Promise |  | LRU Cache |
|               <--+   Promised    <--+         <--+           |
+---------------+  +---------------+  +---------+  +-----------+
```
