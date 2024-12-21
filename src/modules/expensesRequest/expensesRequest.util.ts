import ExpensesExtensionByIdResponseDto from "./ExpensesExtensionByIdResponseDto";


const modelToExpensesExtensionByIdResponseDto = (
    expenseRequest: any
): ExpensesExtensionByIdResponseDto => {
    return {
        _id: expenseRequest._id,
        tripId: expenseRequest?.tripId?._id || '',
        typeName: 'Expense Extension Request',
        description: expenseRequest?.description || '',
        requestedAmount: expenseRequest?.requestedAmount || 0,
        requestedUserId: expenseRequest?.createdBy?._id || '',
        requestedUserName: expenseRequest?.createdBy?.userName || '',
        bankName: expenseRequest?.createdBy?.bankName || '',
        bankId: expenseRequest?.createdBy?.bankId || '',
        branch: expenseRequest?.createdBy?.branch || '',
        accountNumber: expenseRequest?.createdBy?.accountNumber || '',
        accountHolderName: expenseRequest?.createdBy?.accountHolderName || '',
        accountHolderAddress: expenseRequest?.createdBy?.accountHolderAddress || '',
        tripConfirmedNumber: expenseRequest?.tripId?.tripConfirmedNumber || '',
        createdAt: expenseRequest?.createdAt,
    }
}

const modelsToExpensesExtensionByIdResponseDto = (expenseRequests: any[]): ExpensesExtensionByIdResponseDto[] => {
    return expenseRequests.map((expenseRequest) => modelToExpensesExtensionByIdResponseDto(expenseRequest));
}
export default { modelToExpensesExtensionByIdResponseDto, modelsToExpensesExtensionByIdResponseDto };