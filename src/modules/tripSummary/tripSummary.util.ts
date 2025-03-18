import TripSummaryResponseDto from './dto/tripSummaryResponseDto';

const modelToTripSummaryResponseDto = (
    tripSummary: any
): TripSummaryResponseDto => {
    return {
        _id: tripSummary._id,
        tripId: tripSummary.tripId,
        date: tripSummary.date,
        startTime: tripSummary.startTime,
        endTime: tripSummary.endTime,
        startingKm: tripSummary.startingKm,
        endingKm: tripSummary.endingKm,
        totalKm: tripSummary.totalKm,
        fuel: tripSummary.fuel,
        description: tripSummary.description,
    };
};

const modelsToTripSummaryResponseDtos = (tripSummaries: any): any => {
    return tripSummaries.map((tripSummary: any) =>
        modelToTripSummaryResponseDto(tripSummary)
    );
};

export default {
    modelToTripSummaryResponseDto,
    modelsToTripSummaryResponseDtos,
};
