import constants from "../../constant";
import cache from "../../util/cache";
import MonthlyExpenses from "./monthlyExpenses.model";

const save = async (monthlyExpenses: any, session: any) => {
    let prefix = constants.CACHE.PREFIX.MONTHLY_EXPENSES;
    cache.clearCacheByPrefixs(prefix);
    if (session) {
        return await monthlyExpenses.save({ session });
    } else {
        return await monthlyExpenses.save();
    }
}

const findAllByEndMonthAndStatusIn = async (
    endMonth: number,
    currYear: number,
    status: number[]
) => {

    let cacheKey = constants.CACHE.PREFIX.MONTHLY_EXPENSES + endMonth + currYear + JSON.stringify(status);
    const cached = await cache.getCache(cacheKey) as any[];
    if (cached) return cached;

    let endDate = new Date();
    endDate.setFullYear(currYear);
    endDate.setMonth(endMonth);
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    endDate.setHours(23, 59, 59, 999);

    let data: any[] = await MonthlyExpenses.find({
        month: { $lt: endDate },
        status: { $in: status },
        isMonthEndDone: false,
    }).sort({ startDate: 1 });

    if (data) {
        cache.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

const findByIdAndStatusIn = async (id: any, status: any) => {
    return await MonthlyExpenses.findOne({ _id: id, status: { $in: status } });
};


const advanceSearch = async (startMonth: Date, endMonth: Date) => {
    let prefix = constants.CACHE.PREFIX.MONTHLY_EXPENSES + "AdvanceSearch-" + startMonth + endMonth;

    const cached = await cache.getCache(prefix) as any[];
    if (cached) return cached;

    let data: any[] = await MonthlyExpenses.find({ month: { $gte: startMonth, $lte: endMonth } })
        .populate('createdBy updatedBy')
        .sort({ startDate: 1 });

    if (data) {
        cache.setCache(prefix, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};


export default {
    save,
    findAllByEndMonthAndStatusIn,
    findByIdAndStatusIn, advanceSearch
}