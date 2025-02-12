interface ExpensesExtensionResponseDto {
    _id: string;
    tripId: string;
    type: number;
    typeName: string;
    requestedAmount: number;
    requestedUserId: string;
    requestedUserName: string;
    tripConfirmedNumber: string;
    description: string;
    createdAt: Date;
}

export default ExpensesExtensionResponseDto;
