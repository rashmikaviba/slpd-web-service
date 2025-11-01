import constants from '../../constant';
import cache from '../../util/cache';
import MonthAudit from './monthAudit.model';

const save = async (monthAudi: any, session: any) => {
    const prefixes = Object.values(constants.CACHE.PREFIX).join(",");
    cache.clearCacheByPrefixs(prefixes);

    if (session) {
        return await monthAudi.save({ session });
    } else {
        return await monthAudi.save();
    }
};

const generateBatchId = async () => {
    const count = await MonthAudit.countDocuments();

    return count + 1;
};

export default { save, generateBatchId };
