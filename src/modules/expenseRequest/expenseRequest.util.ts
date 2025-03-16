import ExpenseRequestByIdResponseDto from './dto/ExpenseRequestByIdResponseDto';

const modelToExpensesRequestByIdResponseDto = (
    expenseRequest: any
): ExpenseRequestByIdResponseDto => {
    return {
        _id: expenseRequest._id,
        tripId: expenseRequest?.tripId?._id || '',
        typeName: 'Expense Extension Request',
        description: expenseRequest?.description || '',
        requestedAmount: expenseRequest?.requestedAmount || 0,
        requestedUserId: expenseRequest?.createdBy?._id || '',
        requestedUserName: expenseRequest?.createdBy?.fullName || '',
        bankName: expenseRequest?.createdBy?.bankName || '',
        bankId: expenseRequest?.createdBy?.bankId || '',
        branch: expenseRequest?.createdBy?.branch || '',
        accountNumber: expenseRequest?.createdBy?.accountNumber || '',
        accountHolderName: expenseRequest?.createdBy?.accountHolderName || '',
        accountHolderAddress:
            expenseRequest?.createdBy?.accountHolderAddress || '',
        tripConfirmedNumber: expenseRequest?.tripId?.tripConfirmedNumber,
        createdAt: expenseRequest?.createdAt,
    };
};

const modelsToExpensesRequestByIdResponseDto = (
    expenseRequests: any[]
): ExpenseRequestByIdResponseDto[] => {
    return expenseRequests.map((expenseRequest) =>
        modelToExpensesRequestByIdResponseDto(expenseRequest)
    );
};
export default {
    modelToExpensesRequestByIdResponseDto,
    modelsToExpensesRequestByIdResponseDto,
};
