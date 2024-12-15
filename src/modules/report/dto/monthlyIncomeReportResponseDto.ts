interface MonthlyIncomeReportResponseDto {
    tripId: string;
    confirmationNumber: string;
    startDate: Date;
    endDate: Date;
    expenseId: string;
    totalCost: number;
    totalCostLocalCurrency: number;
    estimatedExpense: number;
    remainingExpenses: number;
    totalExpense: number;
    totalDriverSalary: number;
    isRemainingToDriver: boolean;
    tripIncome: number;
}

export default MonthlyIncomeReportResponseDto;
