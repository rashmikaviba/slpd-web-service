import { WellKnownStatus } from '../../../util/enums/well-known-status.enum';
import companyWorkingInfo from '../model/companyWorkingInfo.model';
import cacheUtil from '../../../util/cache';
import constants from '../../../constant';

const getCompanyWorkingInfo = async () => {
    const cacheKey = constants.CACHE.PREFIX.COMPANY_WORKING_INFO;

    const cached = await cacheUtil.getCache(cacheKey);
    if (cached) return cached;

    const data: any = await companyWorkingInfo
        .findOne({ status: WellKnownStatus.ACTIVE })
        .sort({ $natural: -1 })
        .populate("createdBy updatedBy");

    if (data) {
        cacheUtil.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_MONTH);
    }

    return data;
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

export default { getCompanyWorkingInfo, save };
