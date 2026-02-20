import { WellKnownStatus } from '../../../util/enums/well-known-status.enum';
import Role from '../model/role.model';
import cacheUtil from '../../../util/cache';
import constants from '../../../constant';

const findAllByStatusIn = async (status: number[]) => {
    const cacheKey = constants.CACHE.PREFIX.ROLE + JSON.stringify(status);
    const cached = await cacheUtil.getCache(cacheKey);
    if (cached) return cached;

    const data: any = await Role.find({ status: { $in: status } });

    if (data) {
        cacheUtil.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

const findByIdAndStatus = async (id: string, status: number) => {
    const cacheKey = constants.CACHE.PREFIX.ROLE + id + status;
    const cached = await cacheUtil.getCache(cacheKey);
    if (cached) return cached;


    const data: any = await Role.findOne({ _id: id, status });

    if (data) {
        cacheUtil.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

const findByCustomId = async (id: string) => {
    const cacheKey = constants.CACHE.PREFIX.ROLE + id;
    const cached = await cacheUtil.getCache(cacheKey);
    if (cached) return cached;

    const data: any = await Role.findOne({ id: id, status: WellKnownStatus.ACTIVE });

    if (data) {
        cacheUtil.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

// pass _id as string array
// const findIdsByCustomIds = async (ids: string[]) => {
//     const roles = await Role.find({
//         id: { $in: ids },
//         status: WellKnownStatus.ACTIVE,
//     }).select('id');

//     return roles?.map((role) => role._id.toString()) || [];
// };

export default {
    findAllByStatusIn,
    findByIdAndStatus,
    findByCustomId,
    // findIdsByCustomIds,
};
