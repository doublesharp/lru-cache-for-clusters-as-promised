# lru-cache-for-clusters-as-promised

[![lru-cache-for-clusters-as-promised](https://img.shields.io/npm/v/lru-cache-for-clusters-as-promised.svg)](https://www.npmjs.com/package/lru-cache-for-clusters-as-promised)
![Code Coverage Badge](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/doublesharp/bc53be57c56fa0c0fc80a29164cc22fc/raw/lru-cache-for-clusters-as-promised__heads_master.json)
[![Code Climate](https://codeclimate.com/github/doublesharp/lru-cache-for-clusters-as-promised/badges/gpa.svg)](https://codeclimate.com/github/doublesharp/lru-cache-for-clusters-as-promised)
![Downloads](https://img.shields.io/npm/dt/lru-cache-for-clusters-as-promised.svg)

LRU Cache for Clusters as Promised provides a cluster-safe [`lru-cache`](https://www.npmjs.com/package/lru-cache) via Promises. For environments not using [`cluster`](https://nodejs.org/api/cluster.html), the class will provide a Promisified interface to a standard [`lru-cache`](https://www.npmjs.com/package/lru-cache).

Each time you call [`cluster.fork()`](https://nodejs.org/api/cluster.html#cluster_cluster_fork_env), a new thread is spawned to run your application. When using a load balancer even if a user is assigned a particular IP and port these values are shared between the [`workers`](https://nodejs.org/api/cluster.html#cluster_class_worker) in your cluster, which means there is no guarantee that the user will use the same `workers` between requests. Caching the same objects in multiple threads is not an efficient use of memory. 

LRU Cache for Clusters as Promised stores a single `lru-cache` on the [`master`](https://nodejs.org/api/cluster.html#cluster_cluster_ismaster) thread which is accessed by the `workers` via IPC messages. The same `lru-cache` is shared between `workers` having a common `master`, so no memory is wasted.

When creating a new instance and `cluster.isMaster === true` the shared cache is checked based on the  and the shared cache is populated, it will be used instead but acted on locally rather than via IPC messages. If the shared cache is not populated a new LRUCache instance is returned.

# install
```shell
npm install --save lru-cache-for-clusters-as-promised
```

```shell
yarn add lru-cache-for-clusters-as-promised
```

# options

* `namespace: string`, default `"default"`;
  * The namespace for this cache on the master thread as it is not aware of the worker instances.
* `timeout: integer`, default `100`.
  * The amount of time in milliseconds that a worker will wait for a response from the master before rejecting the `Promise`.
* `failsafe: string`, default `resolve`.
  * When a request times out the `Promise` will return `resolve(undefined)` by default, or with a value of `reject` the return will be `reject(Error)`.
* `max: number`
  * The maximum items that can be stored in the cache
* `maxAge: milliseconds`
  * The maximum age for an item to be considered valid
* `stale: true|false`
  * When `true` expired items are return before they are removed rather than `undefined`
* `prune: false|crontime string`, defaults to `false`
  * Use a cron job on the master thread to call `prune()` on your cache at regular intervals specified in "crontime", for example "*/30 * * * * *" would prune the cache every 30 seconds (See [`node-cron` patterns](https://www.npmjs.com/package/cron#available-cron-patterns) for more info). Also works in single threaded environments not using the `cluster` module. Passing `false` to an existing namespace will disable any jobs that are scheduled.
* `parse: function`, defaults to `JSON.parse`
  * Pass in a custom parser function to use for deserializing data sent to/from the cache. This is set on the `LRUCacheForClustersAsPromised` instance and in theory could be different per worker.
* `stringify: function`, defaults to `JSON.stringify`
  * Pass in a custom stringifier function to for creating a serializing data sent to/from the cache.

> ! note that `length` and `dispose` are missing as it is not possible to pass `functions` via IPC messages.

# api

## static functions

* `init(): void`
  * Should be called when `cluster.isMaster === true` to initialize the caches. 
* `getInstance(options): Promise<LRUCacheForClustersAsPromised>`
  * Asynchronously returns an `LRUCacheForClustersAsPromised` instance once the underlying `LRUCache` is guaranteed to exist. Uses the same `options` you would pass to the constructor. When constructed synchronously other methods will ensure the underlying cache is created, but this method can be useful from the worker when you plan to interact with the caches directly. Note that this will slow down the construction time on the worker by a few milliseconds while the cache creation is confirmed.
* `getAllCaches(): { key : LRUCache }`
  * Synchronously returns a dictionary of the underlying `LRUCache` caches keyed by namespace. Accessible only when `cluster.isMaster === true`, otherwise throws an exception.

## instance functions

* `getCache(): LRUCache`
  * Gets the underlying `LRUCache`. Accessible only when `cluster.isMaster === true`, otherwise throws an exception.
* `set(key, value, maxAge): Promise<void>`
  * Sets a value for a key. Specifying the `maxAge` will cause the value to expire per the `stale` value or when `prune`d.
* `setObject async (key, object, maxAge): Promise<void>`
  * Sets a cache value where the value is an object. Passes the values through `cache.stringify()`, which defaults to `JSON.stringify()`. Use a custom parser like [`flatted`](https://www.npmjs.com/package/flatted) to cases like circular object references.
* `mSet({ key1: 1, key2: 2, ...}, maxAge): Promise<void>`
  * Sets multiple key-value pairs in the cache at one time.
* `mSetObjects({ key1: { obj: 1 }, key2: { obj: 2 }, ...}, maxAge): Promise<void>`
  * Sets multiple key-value pairs in the cache at one time, where the value is an object. Passes the values through `cache.stringify()`, see `cache.setObject()`;
* `get(key): Promise<string | number | null | undefined>`
  * Returns a value for a key.
* `getObject(key): Promise<Object | null | undefined>`
  * Returns an object value for a key. Passes the values through `cache.parse()`, which defaults to `JSON.parse()`. Use a custom parser like [`flatted`](https://www.npmjs.com/package/flatted) to cases like circular object references.
* `mGet([key1, key2, ...]): Promise<{key:string | number | null | undefined}?>`
  * Returns values for multiple keys, results are in the form of `{ key1: '1', key2: '2' }`.
* `mGetObjects([key1, key2, ...]): Promise<{key:Object | null | undefined}?>`
  * Returns values as objects for multiple keys, results are in the form of `{ key1: '1', key2: '2' }`. Passes the values through `cache.parse()`, see `cache.getObject()`.
* `peek(key): Promise<string | number | null | undefined>`
  * Returns the value for a key without updating its last access time.
* `del(key): Promise<void>`
  * Removes a value from the cache.
* `mDel([key1, key2...]): Promise<void>`
  * Removes multiple keys from the cache..
* `has(key): Promise<boolean>`
  * Returns true if the key exists in the cache.
* `incr(key, [amount]): Promise<number>`
  * Increments a numeric key value by the `amount`, which defaults to `1`. More atomic in a clustered environment.
* `decr(key, [amount]): Promise<number>`
  * Decrements a numeric key value by the `amount`, which defaults to `1`. More atomic in a clustered environment.
* `reset(): Promise<void>`
  * Removes all values from the cache.
* `keys(): Promise<Array<string>>`
  * Returns an array of all the cache keys.
* `values(): Promise<Array<string | number>>`
  * Returns an array of all the cache values.
* `dump()`
  * Returns a serialized array of the cache contents.
* `prune(): Promise<void>`
  * Manually removes items from the cache rather than on get.
* `length(): Promise<number>`
  * Return the number of items in the cache.
* `itemCount(): Promise<number>`
  * Return the number of items in the cache - same as `length()`.
* `max([max]): Promise<number | void>`
  * Get or update the `max` value for the cache.
* `maxAge([maxAge]): Promise<number | void>`
  * Get or update the `maxAge` value for the cache.
* `allowStale([true|false]): Promise<boolean | void>`
  * Get or update the `allowStale` value for the cache (set via `stale` in options). The `stale()` method is deprecated.
* `execute(command, [arg1, arg2, ...]): Promise<any>`
  * Execute arbitrary command (`LRUCache` function) on the cache, returns whatever value was returned.

# example usage
**Master**
```javascript
// require the module in your master thread that creates workers to initialize
require('lru-cache-for-clusters-as-promised').init();
```

**Worker**
```javascript
// worker code
const LRUCache = require('lru-cache-for-clusters-as-promised');

// this is safe on the master and workers. if you need to ensure the underlying
// LRUCache exists use `await getInstance()` to fetch the promisified cache.
let cache = new LRUCache({
  namespace: 'users',
  max: 50,
  stale: false,
  timeout: 100,
  failsafe: 'resolve',
});

const user = { name: 'user name' };
const key = 'userKey';

// using async/await
(async function() {  
  // get cache instance asynchronously. this will always be the same underlying cache
  cache = await LRUCache.getInstance({ /* ...options */ });

  // set a user for a the key
  await cache.set(key, user);
  console.log('set the user to the cache');

    // get the same user back out of the cache
  const cachedUser = await cache.get(key);
  console.log('got the user from cache', cachedUser);

  // check the number of users in the cache
  const size = await cache.length();
  console.log('user cache size/length', size);

  // remove all the items from the cache
  await cache.reset();
  console.log('the user cache is empty');

  // return user count, this will return the same value as calling length()
  const itemCount = await cache.itemCount();
  console.log('user cache size/itemCount', itemCount);
}());

// using thenables
LRUCache.getInstance({ /* ...options */ })
.then((myCache) => 
  myCache.set(key, user)
  .then(() => 
    myCache.get(key)
  )
)
```

Use a custom object parser for the cache to handle cases like circular object references that `JSON.parse()` and `JSON.stringify()` cannot, or use custom revivers, etc.

```javascript
const flatted = require('flatted');
const LRUCache = require('lru-cache-for-clusters-as-promised');

const cache = new LRUCache({
  namespace: 'circular-objects',
  max: 50,
  parse: flatted.parse,
  stringify: flatted.stringify,
});

// create a circular reference
const a = { b: null };
const b = { a };
b.a.b = b;

// this will work
await cache.setObject(1, a);

// this will return an object with the same circular reference via flatted
const c = await cache.getObject(1);
if (a == c && a.b === c.b) {
  console.log('yes they are the same!');
}
```

# process flow

**Clustered cache on master thread for clustered environments**

![Clustered/Worker Thread](https://www.websequencediagrams.com/files/render?link=RqoArRgR8ZFZCL9ELm9C)


**Promisified for non-clustered environments**

![Single/Master Thread](https://www.websequencediagrams.com/files/render?link=OfdL9HvP0ntvqPSAavdV)
