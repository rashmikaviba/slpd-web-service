import MonthlyExpenses from "./monthlyExpenses.model";

const save = async (monthlyExpenses: any, session: any) => {
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
    let endDate = new Date();
    endDate.setFullYear(currYear);
    endDate.setMonth(endMonth);
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    endDate.setHours(23, 59, 59, 999);

    return MonthlyExpenses.find({
        month: { $lt: endDate },
        status: { $in: status },
        isMonthEndDone: false,
    }).sort({ startDate: 1 });
};

const findByIdAndStatusIn = async (id: any, status: any) => {
    return await MonthlyExpenses.findOne({ _id: id, status: { $in: status } });
};


const advanceSearch = async (startMonth: Date, endMonth: Date) => {
    return await MonthlyExpenses.find({ month: { $gte: startMonth, $lte: endMonth } })
        .populate('createdBy updatedBy')
        .sort({ startDate: 1 });
};


export default {
    save,
    findAllByEndMonthAndStatusIn,
    findByIdAndStatusIn, advanceSearch
}