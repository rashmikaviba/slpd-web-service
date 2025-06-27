import MonthlyExpensesResponseDto from "./dto/monthlyExpensesResponseDto";

const modelToMonthlyExpensesResponseDto = (monthlyExpenses: any): MonthlyExpensesResponseDto => {
    return {
        _id: monthlyExpenses._id,
        month: monthlyExpenses.month,
        totalExpenses: monthlyExpenses.totalExpenses,
        status: monthlyExpenses.status,
        isMonthEndDone: monthlyExpenses.isMonthEndDone,
        batchId: monthlyExpenses.batchId,
        createdBy: monthlyExpenses?.createdBy?._id,
        updatedBy: monthlyExpenses?.updatedBy?._id,
        createdByUser: monthlyExpenses?.createdBy?.userName || '',
        updatedByUser: monthlyExpenses?.updatedBy?.userName || '',
        createdAt: monthlyExpenses.createdAt,
        updatedAt: monthlyExpenses.updatedAt
    }
}

const modelToMonthlyExpensesResponseDtoList = (monthlyExpensesList: any[]): MonthlyExpensesResponseDto[] => {
    return monthlyExpensesList.map(modelToMonthlyExpensesResponseDto);
}

export default {
    modelToMonthlyExpensesResponseDto,
    modelToMonthlyExpensesResponseDtoList
}