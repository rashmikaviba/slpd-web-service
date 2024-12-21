import { WellKnownLeaveStatus } from "../../util/enums/well-known-leave-status.enum";
import { ExpensesRequest } from "../expensesRequest/expensesRequest.model";

const getPendingExpenseRequest = async () => {
    return await ExpensesRequest.find({
        status: WellKnownLeaveStatus.PENDING,
    }).populate('tripId createdBy');
};

export default {
    getPendingExpenseRequest,
};