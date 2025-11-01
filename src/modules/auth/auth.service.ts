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
const findById = async (id: string) => {
    const cacheKey = constants.CACHE.PREFIX.AUTH + id;
    const cached = await cache.getCache(cacheKey);
    if (cached) return cached;

    const data: any = await Auth.findOne({
        _id: id,
        status: WellKnownStatus.ACTIVE,
    }).populate('user role');

    if (data) {
        cache.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

const findByUserId = async (userId: string) => {
    return await Auth.findOne({
        user: userId,
        status: WellKnownStatus.ACTIVE,
    });
};

export default { save, findByUserName, findById, findByUserId };
