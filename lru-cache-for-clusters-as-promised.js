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

  set(key, value, maxAge) {
    return this.promisify('set', key, value, maxAge);
  }

  get(key) {
    return this.promisify('get', key);
  }

  setObject(key, value, maxAge) {
    return this.promisify('set', key, this.stringify(value), maxAge);
  }

  getObject(key) {
    return this.promisify('get', key).then((value) =>
      Promise.resolve(
        // eslint-disable-next-line no-undefined
        value ? this.parse(value) : undefined
      )
    );
  }

  del(key) {
    return this.promisify('del', key);
  }

  mGet(keys) {
    return this.promisify('mGet', keys);
  }

  mSet(pairs, maxAge) {
    return this.promisify('mSet', pairs, maxAge);
  }

  mGetObjects(keys) {
    return this.promisify('mGet', keys).then((pairs) => {
      const objs = {};
      return utils
        .mapObjects(pairs, objs, this.parse)
        .then(() => Promise.resolve(objs));
    });
  }

  mSetObjects(pairs, maxAge) {
    const objs = {};
    return utils
      .mapObjects(pairs, objs, this.stringify)
      .then(() => this.promisify('mSet', objs, maxAge));
  }

  mDel(keys) {
    return this.promisify('mDel', keys);
  }

  peek(key) {
    return this.promisify('peek', key);
  }

  has(key) {
    return this.promisify('has', key);
  }

  incr(key, amount) {
    return this.promisify('incr', key, amount);
  }

  decr(key, amount) {
    return this.promisify('decr', key, amount);
  }

  reset() {
    return this.promisify('reset');
  }

  keys() {
    return this.promisify('keys');
  }

  values() {
    return this.promisify('values');
  }

  dump() {
    return this.promisify('dump');
  }

  prune() {
    return this.promisify('prune');
  }

  length() {
    return this.promisify('length');
  }

  itemCount() {
    return this.promisify('itemCount');
  }

  stale(stale) {
    return this.promisify('stale', stale);
  }

  max(max) {
    return this.promisify('max', max);
  }

  maxAge(maxAge) {
    return this.promisify('maxAge', maxAge);
  }
}

module.exports = LRUCacheForClustersAsPromised;
module.exports.init = () => true;
