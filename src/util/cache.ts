import NodeCache from "node-cache";

// useClones: false -> get() returns the stored object instead of a deep copy (a deep clone of a
// Mongoose document on every hit, including the auth lookup on every request, was the main cost).
// The flip side: cached values are shared, so callers must treat them as read-only. Anything that
// mutates and saves a document has to load it fresh (see authService.findByIdFresh,
// companyWorkingInfoService.getCompanyWorkingInfoFresh).
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120, useClones: false });

const setCache = (key: string, data: any, ttl?: number) => {
    cache.set(key, data, ttl || 300);
};

const getCache = (key: string) => {
    return cache.get(key);
};

const deleteCache = (key: string) => {
    cache.del(key);
};

const clearCache = () => {
    cache.flushAll();
};

// prefixs: comma separated list of key prefixes. One pass over the keys, however many prefixes.
const clearCacheByPrefixs = (prefixs: string) => {
    const prifixes = prefixs.split(",");

    cache.del(
        cache.keys().filter((key) => prifixes.some((prifix) => key.startsWith(prifix)))
    );
};

const getCacheKeys = () => {
    return cache.keys();
};


export default { setCache, getCache, deleteCache, clearCache, clearCacheByPrefixs, getCacheKeys };
