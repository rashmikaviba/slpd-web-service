import { WellKnownStatus } from '../../../util/enums/well-known-status.enum';
import Gender from '../model/gender.model';
import cacheUtil from '../../../util/cache';
import constants from '../../../constant';

// get All genders by status in
const findAllGendersByStatusIn = async (status: number[]) => {
    const cacheKey = constants.CACHE.PREFIX.GENDER + JSON.stringify(status);
    const cached = await cacheUtil.getCache(cacheKey);
    if (cached) return cached;

    const data: any = await Gender.find({ status: { $in: status } });

    if (data) {
        cacheUtil.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

const findGenderByCustomId = async (id: number) => {
    const cacheKey = constants.CACHE.PREFIX.GENDER + id;
    const cached = await cacheUtil.getCache(cacheKey);

    if (cached) {
        return cached;
    }

    const data: any = await Gender.findOne({ id: id, status: WellKnownStatus.ACTIVE });

    if (data) {
        cacheUtil.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

export default { findAllGendersByStatusIn, findGenderByCustomId };
