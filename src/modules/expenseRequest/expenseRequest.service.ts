import constants from '../../constant';
import cache from '../../util/cache';
import { ExpenseRequest } from './expenseRequest.model';

const save = async (expenseExtension: any, session: any) => {
    let prefix = constants.CACHE.PREFIX.EXPENSES_REQUEST;
    cache.clearCacheByPrefixs(prefix);
    if (session) {
        return await expenseExtension.save({ session });
    } else {
        return await expenseExtension.save();
    }
};

const findByTripIdAndStatusIn = async (tripId: string, status: number[]) => {
    const cacheKey = constants.CACHE.PREFIX.EXPENSES_REQUEST + tripId + JSON.stringify(status);
    const cached = await cache.getCache(cacheKey) as any[];
    if (cached) return cached;

    let data: any = await ExpenseRequest.find({
        tripId: tripId,
        status: { $in: status },
    });

    if (data) {
        cache.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

const findByIdAndStatusIn = async (id: string, status: number[]) => {
    return ExpenseRequest.findOne({
        _id: id,
        status: { $in: status },
    }).populate('tripId createdBy');
};

export default {
    save,
    findByTripIdAndStatusIn,
    findByIdAndStatusIn,
};
