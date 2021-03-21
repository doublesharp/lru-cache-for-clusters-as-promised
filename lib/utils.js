module.exports = {
  mapObjects: (pairs, objs, jsonFunction) =>
    Promise.all(
      Object.keys(pairs).map((key) =>
        Promise.resolve((objs[key] = jsonFunction(pairs[key])))
      )
    ),
  mDel: (lru, params) => {
    if (params[0] && params[0] instanceof Array) {
      params[0].map((key) => lru.del(key));
    }
  },
  mGet: (lru, params) => {
    const mGetValues = {};
    if (params[0] && params[0] instanceof Array) {
      params[0].map((key) => (mGetValues[key] = lru.get(key)));
    }
    return mGetValues;
  },
  mSet: (lru, params) => {
    if (params[0] && params[0] instanceof Object) {
      Object.keys(params[0]).map((key) =>
        lru.set(key, params[0][key], params[1])
      );
    }
  },
};
