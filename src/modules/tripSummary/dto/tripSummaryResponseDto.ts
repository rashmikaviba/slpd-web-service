interface TripSummaryResponseDto {
    _id: string;
    tripId: string;
    date: Date;
    startTime: Date;
    endTime: Date;
    startingKm: number;
    endingKm: number;
    totalKm: number;
}

export default TripSummaryResponseDto;
