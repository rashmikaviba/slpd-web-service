interface PendingTripResponseDto {
    _id: string; // tripId
    type: number;
    tripConfirmedNumber: string;
    typeName: string;
    description: string;
    startDate: Date;
    createdAt: Date;
}

export default PendingTripResponseDto;
