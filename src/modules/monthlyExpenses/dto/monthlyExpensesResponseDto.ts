interface MonthlyExpensesResponseDto {
    _id: string;
    month: string;
    totalExpenses: number;
    status: number;
    isMonthEndDone: boolean;
    batchId: number;
    createdBy: string;
    updatedBy: string;
    createdByUser: string;
    updatedByUser: string;
    createdAt: Date;
    updatedAt: Date;
}

export default MonthlyExpensesResponseDto;