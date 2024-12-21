import { WellKnownNotificationType } from "../../util/enums/well-known-notification-type.enum";
import ExpensesExtensionResponseDto from "./dto/expensesExtensionResponseDto";

const modelToExpensesExtensionResponseDto = (
    expenseRequest: any
): ExpensesExtensionResponseDto => {
    return {
        _id: expenseRequest._id,
        tripId: expenseRequest?.tripId?._id || '',
        type: WellKnownNotificationType.ExpenseExtensionRequest,
        typeName: 'Expense Extension Request',
        description: expenseRequest?.description || '',
        requestedAmount: expenseRequest?.requestedAmount || 0,
        requestedUserId: expenseRequest?.createdBy?._id || '',
        requestedUserName: expenseRequest?.createdBy?.userName || '',
        tripConfirmedNumber: expenseRequest?.tripId?.tripConfirmedNumber || '',
        createdAt: expenseRequest?.createdAt,
    }
}

const modelsToExpensesExtensionResponseDto = (expenseRequests: any[]): ExpensesExtensionResponseDto[] => {
    return expenseRequests.map((expenseRequest) => modelToExpensesExtensionResponseDto(expenseRequest));
}
export default { modelToExpensesExtensionResponseDto, modelsToExpensesExtensionResponseDto };