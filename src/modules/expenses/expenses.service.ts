import Expenses from './expenses.model';

const save = async (expenses: any, session: any) => {
    if (session) {
        return await expenses.save({ session });
    } else {
        return await expenses.save();
    }
};

const findAndHardDeleteByTripId = async (tripId: string, session: any) => {
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

export default {
    save,
    findAndHardDeleteByTripId,
    findByTripIdAndStatusIn,
};
