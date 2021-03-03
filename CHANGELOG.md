1.5.25 / 2021-03-02
==================

  * Update dependencies

1.5.24 / 2020-07-02
==================

  * Update dependencies
  * npm audit fix
  
1.5.23 / 2020-06-10
==================

  * Typescript support (thanks @hanspeter1!)
  * Update dependencies

1.5.22 / 2020-05-01
==================

  * Remove yarn.lock

1.5.21 / 2020-05-01
==================

  * Update dependencies

1.5.20 / 2019-09-29
==================

  * Update dependencies

1.5.19 / 2019-08-03
==================

  * Update dependencies
  * Fix coverage badges with nyc

1.5.18 / 2019-08-01
==================

  * Update dependencies
  * Use nyc for coverage
  
1.5.17 / 2019-04-25
==================

  * Update dependencies
  * Lint code

1.5.16 / 2017-11-21
==================

  * Update dependencies

1.5.15 / 2017-10-14
==================

  * Update dependencies

1.5.14 / 2017-09-11
==================

  * Update dependencies

1.5.13 / 2017-08-04
==================

  * Update dependencies

1.5.12 / 2017-07-06
==================

  * Update dependencies

1.5.11 / 2017-05-07
==================

  * Update dependencies

1.5.10 / 2017-05-07
==================

  * Deduplicate common methods - fixes CodeClimate rating to 4.0

1.5.9 / 2017-05-06
==================

  * Remove `npm-shrinkwrap.json`
  * Update depedencies

1.5.8 / 2017-03-03
==================

  * Use Google ESLint config
  * Update depedencies

1.5.7 / 2017-02-02
==================

  * Use `yarn` for installs
  * Update dependencies and dev dependencies

1.5.6 / 2016-12-14
==================

  * Update dependencies

1.5.5 / 2016-12-14
==================

  * Update dependencies

1.5.4 / 2016-12-05
==================

  * Update dependencies

1.5.3 / 2016-11-19
==================

  * Update `uuid` and `developer-tools`

1.5.2 / 2016-11-17
==================

  * Improved debug logging

1.5.1 / 2016-11-17
==================

  * Add support for `mSetObjects()` and `mGetObjects()`
  * Pass namespace through to pruning job for debugging 

1.5.0 / 2016-11-16
==================

  * Add support for `mGet([key])`, `mSet({key: value}, maxAge)`, and `mDel([key])`.

1.4.6 / 2016-11-16
==================

  * Always use a shared cache for consistent behavior

1.4.5 / 2016-11-15
==================

  * Bug fix for null objects

1.4.4 / 2016-11-15
==================

  * Support for getting and setting objects + test coverage
    Update deps
    Bump version

1.4.3 / 2016-11-12
==================

  * Update ESLint settings
    Remove duplicated code
    Update deps
    Bump version

1.4.2 / 2016-11-08
==================

  * Update dependencies
    Bump version

1.4.1 / 2016-10-26
==================

  * bump version
  * fix the tests, provide more coverage
    fix for case when no options are passed in.
  * Give longer to create cache
    Overwrite settings if they are different (allow workers to just use
    name, for example).
    Better properties on create return options
    Bugfix, cache master caches by namespace.

1.4.0 / 2016-10-21
==================

  * Use cron to optionally prune cache on the master
    Support for `maxAge` parameter on `set()`
    Updated debugging
    Updated test coverage
    Updated deps
    Bumped version
  * use web sequence diagrams

1.3.1 / 2016-10-11
==================

  * bump version
  * Update code climate config
  * dedupe keys test
  * dedupe tests
  * Dedupe test code
  * fix hello test
  * Refactor tests to improve coverage and remove duplicated code.
  * Downgrade version of `eslint-plugin-import`
  * Update deps
    Add pre-push testing
    Allow code climate to calc duplication

1.3.0 / 2016-10-03
==================

  * When `cluster.isMaster===true` and the `caches[namespace]` is
    populated, use that instead of creating a `new LRUCache()` - the master
    thread will now act on the same cache as the workers.
    Support for updating the max, maxAge, stale of the cache.
    Update README for new features.
    Update tests to provide 100% coverage.
    Bump version
  * use a long random string as the lru key value to give the promise time
    to call the failsafe with reject()
  * update eslint config for code climate
  * disable duplication check
  * Fix `import/no-extraneous-dependencies` value

1.2.0 / 2016-09-30
==================

  * Bump version
  * Add support and tests for `incr()`/`decr()`
    Update readme.
    Syntax cleanup.

1.1.0 / 2016-09-29
==================

  * bump version
  * Update to failsafe with `resolve(undefined)` and `reject(Error)` via
    `options.failsafe=reject`, update docs

1.0.6 / 2016-09-29
==================

  * Update readme, bump version
  * bump version

1.0.5 / 2016-09-29
==================

  * Export `init` method stub
    Some refactoring
    Add tests for timeout coverage - 100% covered!
    Update README for `init()`

1.0.4 / 2016-09-26
==================

  * Update dependencies, new lint rules, start worker for each cpu core and
    then call mocha done(), don’t resolve a value if the callback has timed
    out, set timeout in options, update README, bump version

1.0.3 / 2016-09-21
==================

  * Bump version, remove code climate issue count since it won’t update
  * Update standards/linting
    Update main filename
    Update tests
  * update developer-tools confs
    lint code
  * update code climate config
  * use .eslintrc instead of .eslintrc.js
  * ignore eslintrc.js in code climate, update config file to standards
  * check in code climate file

1.0.2 / 2016-08-25
==================

  * fix link in readme, bump version

1.0.1 / 2016-08-25
==================

  * add header, eslint config, clean up code, bump version to 1.0.1

1.0.0 / 2016-08-25
==================

  * fix typo, more example updates
  * fix example
  * more comments
  * add more comments
  * Update README.md
    update with info about `namespace` option.
  * Update README.md
    update with api and options, fix example
  * Update README.md
    add description, install, usage, patterns.
  * fix for properties on promisified lru-cache
  * Update readme and add git repo to package
  * Update to create coverage badge
  * Only fork twice for tests
  * First version, linted with test coverage.
  * Initial commit
