/**
 * Provide a cluster-optimized lru-cache with Promises
 *
 * @module lru-cache-for-clusters-as-promised
 * @exports LRUCacheForClustersAsPromised
 */

'use strict';

const cluster = require('cluster');
const master = require('./lib/master');
const worker = require('./lib/worker');
const utils = require('./lib/utils');

/**
 * LRUCacheForClustersAsPromised roughly approximates the functionality of LRUCache
 * but in a promisified way. When running as a cluster workers send requests to the
 * master thread which actually holds the cache via IPC which then sends a response
 * that resolves the Promise. For non-clustered environments a Promisfied interface
 * to the cache is provided to match the interface for clustered environments.
 *
 * @param {Object} options The lru-cache options. Properties can be set, functions cannot.
 * @return {Object} Object with LRU methods
 */
class LRUCacheForClustersAsPromised {
  constructor(options = {}) {
    // this is how the clustered cache differentiates
    this.namespace = options.namespace || 'default';

    // this is how long the worker will wait for a response from the master in milliseconds
    this.timeout = options.timeout || 100;

    // how should timeouts be handled - default is resolve(undefined), otherwise reject(Error)
    this.failsafe = options.failsafe === 'reject' ? 'reject' : 'resolve';

    this.parse = options.parse || JSON.parse;
    this.stringify = options.stringify || JSON.stringify;

    // if this is the master thread, we just promisify an lru-cache
    // if it is the worker we need to send messages to the master to resolve the values
    this.promisify = (cluster.isMaster ? master : worker).getPromisified(
      this,
      options
    );
  }

  static async getInstance(options) {
    const lru = new LRUCacheForClustersAsPromised({ ...options, noInit: true });
    if (cluster.isWorker) {
      await lru.promisify('()', options);
    }
    return lru;
  }

  static getAllCaches() {
    if (cluster.isWorker) {
      throw new Error(
        'LRUCacheForClustersAsPromised.getAllCaches() should only be called from the master thread.'
      );
    }
    return master.caches;
  }

  getCache() {
    const caches = LRUCacheForClustersAsPromised.getAllCaches();
    return caches[this.namespace];
  }

  async execute(command, ...args) {
    return this.promisify(command, ...args);
  }

  async set(key, value, maxAge) {
    return this.promisify('set', key, value, maxAge);
  }

  async get(key) {
    return this.promisify('get', key);
  }

  async setObject(key, value, maxAge) {
    return this.promisify('set', key, this.stringify(value), maxAge);
  }

  async getObject(key) {
    const value = await this.promisify('get', key);
    // eslint-disable-next-line no-undefined
    return value ? this.parse(value) : undefined;
  }

  async del(key) {
    return this.promisify('del', key);
  }

  async mGet(keys) {
    return this.promisify('mGet', keys);
  }

  async mSet(pairs, maxAge) {
    return this.promisify('mSet', pairs, maxAge);
  }

  async mGetObjects(keys) {
    const pairs = await this.promisify('mGet', keys);
    const objs = {};
    await utils.mapObjects(pairs, objs, this.parse);
    return objs;
  }

  async mSetObjects(pairs, maxAge) {
    const objs = {};
    await utils.mapObjects(pairs, objs, this.stringify);
    return this.promisify('mSet', objs, maxAge);
  }

  async mDel(keys) {
    return this.promisify('mDel', keys);
  }

  async peek(key) {
    return this.promisify('peek', key);
  }

  async has(key) {
    return this.promisify('has', key);
  }

  async incr(key, amount) {
    return this.promisify('incr', key, amount);
  }

  async decr(key, amount) {
    return this.promisify('decr', key, amount);
  }

  async reset() {
    return this.promisify('reset');
  }

  async keys() {
    return this.promisify('keys');
  }

  async values() {
    return this.promisify('values');
  }

  async dump() {
    return this.promisify('dump');
  }

  async prune() {
    return this.promisify('prune');
  }

  async length() {
    return this.promisify('length');
  }

  async itemCount() {
    return this.promisify('itemCount');
  }

  /**
   * @deprecated use allowStale(stale)
   */
  async stale(stale) {
    return this.allowStale(stale);
  }

  async allowStale(stale) {
    return this.promisify('allowStale', stale);
  }

  async max(max) {
    return this.promisify('max', max);
  }

  async maxAge(maxAge) {
    return this.promisify('maxAge', maxAge);
  }
}

module.exports = LRUCacheForClustersAsPromised;
module.exports.init = () => true;
