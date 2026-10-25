import { WellKnownStatus } from '../../../util/enums/well-known-status.enum';
import companyWorkingInfo from '../model/companyWorkingInfo.model';
import cacheUtil from '../../../util/cache';
import constants from '../../../constant';

const findLatestActive = async () => {
    const data: any = await companyWorkingInfo
        .findOne({ status: WellKnownStatus.ACTIVE })
        .sort({ $natural: -1 })
        .populate("createdBy updatedBy");

    return data;
};

// Cached and shared between requests: read-only. Use getCompanyWorkingInfoFresh to modify and save.
const getCompanyWorkingInfo = async () => {
    const cacheKey = constants.CACHE.PREFIX.COMPANY_WORKING_INFO;

    const cached = cacheUtil.getCache(cacheKey);
    if (cached) return cached;

    const data = await findLatestActive();

    if (data) {
        cacheUtil.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_MONTH);
    }

    return data;
};

// same lookup, never cached
const getCompanyWorkingInfoFresh = async () => {
    return await findLatestActive();
};


const save = async (data: any, session: any) => {
    let cacheKey = constants.CACHE.PREFIX.COMPANY_WORKING_INFO;
    cacheUtil.deleteCache(cacheKey);

    if (session) {
        return await data.save({ session });
    } else {
        return await data.save();
    }
};

export default { getCompanyWorkingInfo, getCompanyWorkingInfoFresh, save };
