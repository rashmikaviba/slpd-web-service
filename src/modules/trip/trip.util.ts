import {
    ActivityDto,
    ArrivalInfoDto,
    DepartureInfoDto,
    DriverDto,
    DropOffInfoDto,
    PassengerDto,
    PickUpInfoDto,
    TripPlaceResponseDto,
    TripResponseDto,
    TripResponseDtoGetAll,
    VehicleDto,
} from './dto/tripResponseDtos';
import helperUtil from '../../util/helper.util';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import { truncate } from 'fs/promises';

const mapPassengerToPassengerDto = (passenger: any): PassengerDto => ({
    id: passenger.id,
    name: passenger.name,
    nationality: passenger.nationality,
    age: passenger.age,
    gender: passenger.gender,
});

const mapArrivalInfoToArrivalInfoDto = (arrivalInfo: any): ArrivalInfoDto => ({
    arrivalDate: arrivalInfo?.arrivalDate || null,
    arrivalTime: arrivalInfo?.arrivalTime || null,
    arrivalFlightNumber: arrivalInfo?.arrivalFlightNumber || null,
});

const mapDepartureInfoToDepartureInfoDto = (
    departureInfo: any
): DepartureInfoDto => ({
    departureDate: departureInfo?.departureDate || null,
    departureTime: departureInfo?.departureTime || null,
    departureFlightNumber: departureInfo?.departureFlightNumber || null,
});

const mapPickUpInfoToPickUpInfoDto = (pickUpInfo: any): PickUpInfoDto => ({
    pickupDate: pickUpInfo?.pickupDate || null,
    pickupTime: pickUpInfo?.pickupTime || null,
    pickupCity: pickUpInfo?.pickupCity || null,
    pickupAddress: pickUpInfo?.pickupAddress || null,
});

const mapDropOffInfoToDropOffInfoDto = (dropOffInfo: any): DropOffInfoDto => ({
    dropOffDate: dropOffInfo?.dropOffDate || null,
    dropOffTime: dropOffInfo?.dropOffTime || null,
    dropOffCity: dropOffInfo?.dropOffCity || null,
    dropOffAddress: dropOffInfo?.dropOffAddress || null,
});

const mapActivityToActivityDto = (activity: any): ActivityDto => ({
    id: activity?._id || '',
    date: activity?.date || null,
    description: activity?.description || '',
    adultCount: activity?.adultCount || 0,
    childCount: activity?.childCount || 0,
    totalCost: activity?.totalCost || 0,
});

const mapVehicleToVehicleDto = (vehicle: any): VehicleDto => ({
    vehicle: vehicle.vehicle?._id || '',
    registrationNumber: vehicle.vehicle?.registrationNumber || '',
    vehicleAssignedBy: vehicle.vehicleAssignedBy?._id || '',
    isActive: vehicle.isActive || false,
});

const mapDriverToDriverDto = (driver: any): DriverDto => ({
    driver: driver.driver?._id || '',
    driverName: driver.driver?.fullName || '',
    driverAssignedBy: driver.driverAssignedBy?._id || '',
    driverAssignedByName: driver.driverAssignedBy?.fullName || '',
    isActive: driver.isActive || false,
});

const tripModelToTripResponseDto = (trip: any): TripResponseDto => {
    return {
        startDate: trip.startDate,
        endDate: trip.endDate,
        dateCount: trip.dateCount,
        totalCost: trip.totalCost,
        totalCostLocalCurrency: trip.totalCostLocalCurrency,
        estimatedExpense: trip.estimatedExpense,
        passengers: Array.isArray(trip.passengers)
            ? trip.passengers.map(mapPassengerToPassengerDto)
            : [],
        arrivalInfo: mapArrivalInfoToArrivalInfoDto(trip.arrivalInfo),
        departureInfo: mapDepartureInfoToDepartureInfoDto(trip.departureInfo),
        pickUpInfo: mapPickUpInfoToPickUpInfoDto(trip.pickUpInfo),
        dropOffInfo: mapDropOffInfoToDropOffInfoDto(trip.dropOffInfo),
        activities: Array.isArray(trip.activities)
            ? trip.activities.map(mapActivityToActivityDto)
            : [],
        email: trip.email,
        phoneNumber: trip.phoneNumber || null,
        drivers: Array.isArray(trip.drivers)
            ? trip.drivers.map(mapDriverToDriverDto)
            : [],
        status: trip.status,
        statusName: helperUtil.getNameFromEnum(
            WellKnownTripStatus,
            trip.status
        ),
        createdBy: trip.createdBy?._id || '',
        updatedBy: trip.updatedBy?._id || '',
        startedBy: trip.startedBy?._id || null,
        endedBy: trip.endedBy?._id || null,
        createdUser: trip.createdBy?.fullName || '',
        updatedUser: trip.updatedBy?.fullName || '',
        startedUser: trip.startedBy?.fullName || null,
        endedUser: trip.endedBy?.fullName || null,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt,
    };
};

const tripModelArrToTripResponseDtos = (trips: any[]): TripResponseDto[] => {
    return trips.map((trip) =>
        tripModelToTripResponseDto(trip)
    ) as TripResponseDto[];
};

const tripModelToTripResponseDtoGetAll = (trip: any): TripResponseDtoGetAll => {
    return {
        id: trip._id || '',
        startDate: trip.startDate,
        endDate: trip.endDate,
        dateCount: trip.dateCount,
        totalCost: trip.totalCost,
        totalCostLocalCurrency: trip.totalCostLocalCurrency,
        paymentMode: trip?.paymentMode || '',
        isActiveDriver: trip.isActiveDriver || false,
        isCheckListDone: trip.checkListAnswers != null ? true : false,
        email: trip.email,
        phoneNumber: trip.phoneNumber || null,
        status: trip.status,
        passengersCount: trip.passengers.length || 0,
        statusName: helperUtil.getNameFromEnum(
            WellKnownTripStatus,
            trip.status
        ),
        tripConfirmedNumber: `DK-${trip?.tripConfirmedNumber
            .toString()
            .padStart(3, '0')}`,
        contactPerson: trip?.contactPerson || '',
        createdBy: trip.createdBy?._id || '',
        updatedBy: trip.updatedBy?._id || '',
        startedBy: trip.startedBy?._id || null,
        isMonthEndDone: trip.isMonthEndDone || false,
        isDriverSalaryDone: trip.isDriverSalaryDone || false,
        endedBy: trip.endedBy?._id || null,
        createdUser: trip.createdBy?.fullName || '',
        updatedUser: trip.updatedBy?.fullName || '',
        startedUser: trip.startedBy?.fullName || null,
        endedUser: trip.endedBy?.fullName || null,
        canUndo:
            trip?.status === WellKnownTripStatus.START &&
            !trip?.places.find((x: any) => x.isReached === true)
                ? true
                : false,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt,
        activeVehicleId:
            trip?.vehicles.find((x: any) => x.isActive)?.vehicle?._id || '',
        activeRegistrationNumber:
            trip?.vehicles.find((x: any) => x.isActive)?.vehicle
                ?.registrationNumber || '',
        activeDriverId:
            trip?.drivers?.find((x: any) => x.isActive)?.driver?._id || '',
        activeDriverName:
            trip?.drivers?.find((x: any) => x.isActive)?.driver?.fullName || '',
        drivers: trip.drivers.map((x: any) => mapDriverToDriverDto(x)),
        vehicles: trip.vehicles.map((x: any) => mapVehicleToVehicleDto(x)),
    };
};

const tripModelArrToTripResponseDtoGetAlls = (
    trips: any[]
): TripResponseDtoGetAll[] => {
    return trips.map((trip) =>
        tripModelToTripResponseDtoGetAll(trip)
    ) as TripResponseDtoGetAll[];
};

const TripModelToTripPlaceResponseDto = (place: any): TripPlaceResponseDto => {
    return {
        description: place.description,
        dates: place.dates,
        isReached: place.isReached || false,
        index: place.index || 0,
        updatedBy: place.updatedBy || '',
        _id: place?._id || '',
        location: place.location,
        reachedBy: place.reachedBy?._id || '',
        reachedDate: place.reachedDate || null,
        reachedByUser: place.reachedBy?.fullName || '',
    };
};

const TripModelArrToTripPlaceResponseDtos = (
    places: any[]
): TripPlaceResponseDto[] => {
    return places.map((place) =>
        TripModelToTripPlaceResponseDto(place)
    ) as TripPlaceResponseDto[];
};
export default {
    tripModelToTripResponseDto,
    tripModelArrToTripResponseDtos,
    tripModelToTripResponseDtoGetAll,
    tripModelArrToTripResponseDtoGetAlls,
    TripModelArrToTripPlaceResponseDtos,
};
