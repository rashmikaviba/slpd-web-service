import { ExpensesRequest } from "./expensesRequest.model";

const save = async (expensesRequest: any, session: any) => {
    if (session) {
        return await expensesRequest.save({ session });
    } else {
        return await expensesRequest.save();
    }
};

const findByTripIdAndStatusIn = async (tripId: string, status: number[]) => {
    return ExpensesRequest.find({
        tripId: tripId,
        status: { $in: status },
    })
};

const findByIdAndStatusIn = async (id: string, status: number[]) => {
    return ExpensesRequest.findOne({ _id: id, status: { $in: status } });
};


export default {
    save,
    findByTripIdAndStatusIn,
    findByIdAndStatusIn
};