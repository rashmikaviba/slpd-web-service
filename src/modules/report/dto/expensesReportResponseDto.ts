interface ExpensesReportResponseDto {
    tripId: string;
    confirmationNumber: string;
    expenseId: string;
    typeId: number;
    typeName: string;
    amount: number;
    description: string;
    date: Date;
    createdDate: Date;
    createdUser: string;
    updatedDate: Date;
    updatedUser: string;
}

export default ExpensesReportResponseDto;
