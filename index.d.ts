// https://github.com/doublesharp/lru-cache-for-clusters-as-promised#lru-cache-for-clusters-as-promised
declare module "lru-cache-for-clusters-as-promised" {

    // https://github.com/doublesharp/lru-cache-for-clusters-as-promised#example-usage
    class Cache <G1 = never, G2 = never, G3 = never, G4 = never> {
        constructor(options?: cacheConstructorParam);

        static init(): void

        // Sets a value for a key. Specifying the maxAge will cause the value to expire per the stale value or when pruned.
        set(key: string, value: G1 | G2 | G3 | G4, maxAge?: number): Promise<void>

        // Sets a value for a key. Specifying the maxAge will cause the value to expire per the stale value or when pruned.
        setObject(key: string, object: Object, maxAge?: number): Promise<void>

        // Sets multiple key-value pairs in the cache at one time.
        mSet(keys: { [index: string]: string | number }, maxAge?: number): Promise<void>

        // Sets multiple key-value pairs in the cache at one time, where the value is an object.
        mSetObjects(keys: { [index: string]: G1 | G2 | G3 | G4 }, maxAge?: number): Promise<void>

        // Returns a value for a key.
        get(key: string): Promise<G1 | G2 | G3 | G4 | string | number>

        // Returns a value for a key.
        getObject(key: string): Promise<Object>

        // Returns values for multiple keys, results are in the form of { key1: '1', key2: '2' }.
        mGet(keys: Array<string>): Promise<{ [index: string]: string | number }>

        // Returns values as objects for multiple keys, results are in the form of { key1: '1', key2: '2' }.
        mGetObjects(keys: Array<string>): Promise<{ [index: string]: G1 | G2 | G3 | G4 | string | number}>

        // Returns the value for a key without updating its last access time.
        peek(key: string): Promise< G1 | G2 | G3 | G4 | string | number>

        // Removes a value from the cache.
        del(key: string): Promise<void>

        // Removes multiple keys from the cache..
        mDel(keys: Array<string>): Promise<void>

        // Returns true if the key exists in the cache.
        has(key: string): Promise<boolean>

        // Increments a numeric key value by the amount, which defaults to 1. More atomic in a clustered environment.
        incr(key: string, amount?: number): Promise<void>

        // Decrements a numeric key value by the amount, which defaults to 1. More atomic in a clustered environment.
        decr(key: string, amount?: number): Promise<void>

        // Removes all values from the cache.
        reset(): Promise<void>

        // Returns an array of all the cache keys.
        keys(): Promise<Array<string>>

        // Returns an array of all the cache values.
        values(): Promise<Array< G1 | G2 | G3 | G4 | string | number>>

        // Returns a serialized array of the cache contents.
        dump(): Promise<Array<string>>

        // Manually removes items from the cache rather than on get.
        prune(): Promise<void>

        // Return the number of items in the cache.
        length(): Promise<number>

        // Return the number of items in the cache - same as length().
        itemCount(): Promise<number>

        // Get or update the max value for the cache.
        max(): Promise<number>

        // Get or update the maxAge value for the cache.
        max(max: number): Promise<void>

        // Get or update the maxAge value for the cache.
        maxAge(): Promise<number>

        // Get or update the maxAge value for the cache.
        maxAge(maxAge: number): Promise<void>

        // Get or update the stale value for the cache.
        stale(): Promise<boolean>

        // Get or update the stale value for the cache.
        stale(stale: boolean): Promise<void>
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

    module Cache {
    }

    export = Cache;
}
