import constants from '../../constant';
import cache from '../../util/cache';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import Auth from './auth.model';

const save = async (auth: any, session: any) => {
    let prefix = constants.CACHE.PREFIX.AUTH;
    cache.clearCacheByPrefixs(prefix);

    if (session) {
        return await auth.save({ session });
    } else {
        return await auth.save();
    }
};

const findByUserName = async (userName: string) => {
    return await Auth.findOne({
        userName,
        status: WellKnownStatus.ACTIVE,
    }).populate('user role');
};

// find by id and status not delete
// The result is cached and shared between requests: a plain read-only object (lean).
// Use findByIdFresh when the document is going to be modified and saved.
const findById = async (id: string) => {
    const cacheKey = constants.CACHE.PREFIX.AUTH + id;
    const cached = cache.getCache(cacheKey);
    if (cached) return cached;

    const data: any = await Auth.findOne({
        _id: id,
        status: WellKnownStatus.ACTIVE,
    })
        .populate('user role')
        .lean();

    if (data) {
        cache.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

// same lookup, never cached and returns a document that can be changed and saved
const findByIdFresh = async (id: string) => {
    return await Auth.findOne({
        _id: id,
        status: WellKnownStatus.ACTIVE,
    }).populate('user role');
};

const findByUserId = async (userId: string) => {
    return await Auth.findOne({
        user: userId,
        status: WellKnownStatus.ACTIVE,
    });
};

export default { save, findByUserName, findById, findByIdFresh, findByUserId };
