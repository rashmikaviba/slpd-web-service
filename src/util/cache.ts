import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

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

const clearCacheByPrefixs = (prefixs: string) => {
    const keys = cache.keys();

    let prifixes = prefixs.split(",");

    prifixes.forEach((prifix) => {
        keys.forEach((key) => {
            if (key.startsWith(prifix)) {
                cache.del(key);
            }
        });
    });
};

const getCacheKeys = () => {
    return cache.keys();
};


export default { setCache, getCache, deleteCache, clearCache, clearCacheByPrefixs, getCacheKeys };