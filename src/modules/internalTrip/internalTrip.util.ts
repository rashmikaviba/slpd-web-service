import InternalTripResponseDto from './dto/internalTripResponseDto';

const modelToInternalTripResponseDto = (
    internalTrip: any
): InternalTripResponseDto => {
    return {
        _id: internalTrip._id,
        startDate: internalTrip.startDate,
        endDate: internalTrip.endDate,
        driver: internalTrip.driver.fullName,
        reason: internalTrip.reason,
        createdBy: internalTrip.createdBy?._id,
        createdAt: internalTrip.createdAt,
        createdByUser: internalTrip.createdBy?.userName,
        updatedBy: internalTrip.updatedBy?._id,
        updatedAt: internalTrip.updatedAt,
        updatedByUser: internalTrip.updatedBy?.userName,
    };
};

const modelsToInternalTripResponseDto = (
    internalTrips: any[]
): InternalTripResponseDto[] => {
    return internalTrips.map((internalTrip) =>
        modelToInternalTripResponseDto(internalTrip)
    );
};

export default {
    modelToInternalTripResponseDto,
    modelsToInternalTripResponseDto,
};
