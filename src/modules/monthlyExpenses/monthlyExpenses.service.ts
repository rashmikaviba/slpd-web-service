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

    // Month end only, not cached: only the ids are needed to flag the monthly expenses and log them.
    let endDate = new Date();
    endDate.setFullYear(currYear);
    endDate.setMonth(endMonth);
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    endDate.setHours(23, 59, 59, 999);

    let data: any[] = await MonthlyExpenses.find({
        month: { $lt: endDate },
        status: { $in: status },
        isMonthEndDone: false,
    }).select('_id').sort({ startDate: 1 }).lean();

    return data;
};

// Month end: flag many monthly expenses in one write (same fields the per-document save set).
const markMonthEndDone = async (ids: any[], userId: string, batchId: number, session: any) => {
    if (ids.length === 0) return;
    cache.clearCacheByPrefixs(constants.CACHE.PREFIX.MONTHLY_EXPENSES);
    await MonthlyExpenses.updateMany({ _id: { $in: ids } }, { $set: { isMonthEndDone: true, batchId, updatedBy: userId } }, { session });
};

const findByIdAndStatusIn = async (id: any, status: any) => {
    return await MonthlyExpenses.findOne({ _id: id, status: { $in: status } });
};


const advanceSearch = async (startMonth: Date, endMonth: Date) => {
    let prefix = constants.CACHE.PREFIX.MONTHLY_EXPENSES + "AdvanceSearch-" + startMonth + endMonth;

    const cached = cache.getCache(prefix) as any[];
    if (cached) return cached;

    let data: any[] = await MonthlyExpenses.find({ month: { $gte: startMonth, $lte: endMonth } })
        .populate({ path: 'createdBy updatedBy', select: '_id userName' })
        .sort({ startDate: 1 });

    if (data) {
        cache.setCache(prefix, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};


export default {
    save,
    findAllByEndMonthAndStatusIn,
    markMonthEndDone,
    findByIdAndStatusIn, advanceSearch
}