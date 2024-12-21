import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';
import { ExpenseRequest } from '../expenseRequest/expenseRequest.model';

const getPendingExpenseRequest = async () => {
    return await ExpenseRequest.find({
        status: WellKnownLeaveStatus.PENDING,
    }).populate('tripId createdBy');
};

export default {
    getPendingExpenseRequest,
};
