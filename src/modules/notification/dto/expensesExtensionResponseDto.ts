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
    // bankName: string
    // bankId: string
    // branch: string
    // accountNumber: string
    // accountHolderName: string
    // accountHolderAddress: string
}

export default ExpensesExtensionResponseDto;
