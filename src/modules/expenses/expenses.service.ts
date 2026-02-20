import constants from '../../constant';
import cache from '../../util/cache';
import Expenses from './expenses.model';

const save = async (expenses: any, session: any) => {
    let prefix = constants.CACHE.PREFIX.EXPENSES;
    cache.clearCacheByPrefixs(prefix);
    if (session) {
        return await expenses.save({ session });
    } else {
        return await expenses.save();
    }
};

const findAndHardDeleteByTripId = async (tripId: string, session: any) => {
    let prefix = constants.CACHE.PREFIX.EXPENSES;
    cache.clearCacheByPrefixs(prefix);
    if (session) {
        return await Expenses.findOneAndDelete({ tripId: tripId }, { session });
    } else {
        return await Expenses.findOneAndDelete({ tripId: tripId });
    }
};

const findByTripIdAndStatusIn = async (tripId: string, status: number[]) => {
    return Expenses.findOne({
        tripId: tripId,
        status: { $in: status },
    }).populate('tripId');
};


const findByTripIdsInAndStatusIn = async (tripIds: string[], status: number[]) => {
    const cacheKey = constants.CACHE.PREFIX.EXPENSES + JSON.stringify(tripIds) + JSON.stringify(status);
    const cached = await cache.getCache(cacheKey) as any[];
    if (cached) return cached;


    const data: any[] = await Expenses.find({
        tripId: { $in: tripIds },
        status: { $in: status },
    })

    if (data) {
        cache.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
}

export default {
    save,
    findAndHardDeleteByTripId,
    findByTripIdAndStatusIn,
    findByTripIdsInAndStatusIn
};
