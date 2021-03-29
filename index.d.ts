import LRUCache from "lru-cache";

// https://github.com/doublesharp/lru-cache-for-clusters-as-promised#lru-cache-for-clusters-as-promised
declare module "lru-cache-for-clusters-as-promised" {

    interface LRUCaches {
        [key: string]: LRUCache
    }

    // https://github.com/doublesharp/lru-cache-for-clusters-as-promised#options
    interface cacheConstructorParam {
        // The namespace for this cache on the master thread as it is not aware of the worker instances.
        namespace?: string,
        // The amount of time in milliseconds that a worker will wait for a response from the master before rejecting the Promise.
        timeout?: number,
        // When a request times out the Promise will return resolve(undefined) by default, or with a value of reject the return will be reject(Error)
        failsafe?: "resolve" | "reject",
        // The maximum items that can be stored in the cache
        max?: number,
        // The maximum age for an item to be considered valid
        maxAge?: number,
        // When true expired items are return before they are removed rather than undefined
        stale?: boolean,
        // Use a cron job on the master thread to call prune() on your cache at regular intervals specified in "crontime", for example "*/30 * * * * *" would prune the cache every 30 seconds. Also works in single threaded environments not using the cluster module.
        prune?: false | string,
        // custom stringify function
        stringify?: function,
        // custom parse function
        parse?: function,
    }

    // https://github.com/doublesharp/lru-cache-for-clusters-as-promised#example-usage
    class Cache <G1 = never, G2 = never, G3 = never, G4 = never> {
        constructor(options?: cacheConstructorParam);

        // Call from the master to ensure that the listeners are enabled
        static init(): void
        
        // Called from the master to fetch unerlying LRUCaches keyed by namespace
        static getLruCaches(): LRUCaches

        // Load an instance asynchronously to ensure that the cache has been created on the master.
        static async getInstance(): Promise<Cache>

        // Get the underlying LRUCache on the master thread (throws exception on worker)
        getCache(): LRUCache

        // Execute arbitrary command (function) on the cache.
        async execute(command: string, ...args: any[]): Promise<any>

        // Sets a value for a key. Specifying the maxAge will cause the value to expire per the stale value or when pruned.
        async set(key: string, value: G1 | G2 | G3 | G4, maxAge?: number): Promise<void>

        // Sets a value for a key. Specifying the maxAge will cause the value to expire per the stale value or when pruned.
        async setObject(key: string, object: Object, maxAge?: number): Promise<void>

        // Sets multiple key-value pairs in the cache at one time.
        async mSet(keys: { [index: string]: string | number }, maxAge?: number): Promise<void>

        // Sets multiple key-value pairs in the cache at one time, where the value is an object.
        async mSetObjects(keys: { [index: string]: G1 | G2 | G3 | G4 }, maxAge?: number): Promise<void>

        // Returns a value for a key.
        async get(key: string): Promise<G1 | G2 | G3 | G4 | string | number>

        // Returns a value for a key.
        async getObject(key: string): Promise<Object>

        // Returns values for multiple keys, results are in the form of { key1: '1', key2: '2' }.
        async mGet(keys: Array<string>): Promise<{ [index: string]: string | number }>

        // Returns values as objects for multiple keys, results are in the form of { key1: '1', key2: '2' }.
        async mGetObjects(keys: Array<string>): Promise<{ [index: string]: G1 | G2 | G3 | G4 | string | number}>

        // Returns the value for a key without updating its last access time.
        async peek(key: string): Promise< G1 | G2 | G3 | G4 | string | number>

        // Removes a value from the cache.
        async del(key: string): Promise<void>

        // Removes multiple keys from the cache..
        async mDel(keys: Array<string>): Promise<void>

        // Returns true if the key exists in the cache.
        async has(key: string): Promise<boolean>

        // Increments a numeric key value by the amount, which defaults to 1. More atomic in a clustered environment.
        async incr(key: string, amount?: number): Promise<void>

        // Decrements a numeric key value by the amount, which defaults to 1. More atomic in a clustered environment.
        async decr(key: string, amount?: number): Promise<void>

        // Removes all values from the cache.
        async reset(): Promise<void>

        // Returns an array of all the cache keys.
        async keys(): Promise<Array<string>>

        // Returns an array of all the cache values.
        async values(): Promise<Array< G1 | G2 | G3 | G4 | string | number>>

        // Returns a serialized array of the cache contents.
        async dump(): Promise<Array<string>>

        // Manually removes items from the cache rather than on get.
        async prune(): Promise<void>

        // Return the number of items in the cache.
        async length(): Promise<number>

        // Return the number of items in the cache - same as length().
        async itemCount(): Promise<number>

        // Get or update the max value for the cache.
        async max(): Promise<number>

        // Get or update the maxAge value for the cache.
        async max(max: number): Promise<void>

        // Get or update the maxAge value for the cache.
        async maxAge(): Promise<number>

        // Get or update the maxAge value for the cache.
        async maxAge(maxAge: number): Promise<void>

        /**
         * Get or update the stale value for the cache.
         * @deprecated please use allowStale()
         */
        async stale(): Promise<boolean>

        /**
         * Get or update the stale value for the cache.
         * @param stale 
         * @deprecated please use allowStale(stale)
         */
        async stale(stale: boolean): Promise<void>
        
        // Get or update the stale value for the cache.
        async allowStale(): Promise<boolean>

        // Get or update the stale value for the cache.
        async allowStale(stale: boolean): Promise<void>
    }

    module Cache {
    }

    export = Cache;
}
