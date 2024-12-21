import { ExpenseRequest } from './expenseRequest.model';

const save = async (expenseExtension: any, session: any) => {
    if (session) {
        return await expenseExtension.save({ session });
    } else {
        return await expenseExtension.save();
    }
};

const findByTripIdAndStatusIn = async (tripId: string, status: number[]) => {
    return ExpenseRequest.find({
        tripId: tripId,
        status: { $in: status },
    });
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
