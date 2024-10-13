import {
    ActivityDto,
    ArrivalInfoDto,
    DepartureInfoDto,
    DriverDto,
    DropOffInfoDto,
    PassengerDto,
    PickUpInfoDto,
    TripResponseDto,
    TripResponseDtoGetAll,
    VehicleDto,
} from './dto/tripResponseDtos';
import helperUtil from '../../util/helper.util';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';

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
        isActiveDriver: trip.isActiveDriver || false,
        email: trip.email,
        phoneNumber: trip.phoneNumber || null,
        status: trip.status,
        passengersCount: trip.passengers.length || 0,
        statusName: helperUtil.getNameFromEnum(
            WellKnownTripStatus,
            trip.status
        ),
        tripConfirmedNumber: `JK-${trip?.tripConfirmedNumber
            .toString()
            .padStart(3, '0')}`,
        contactPerson: trip?.contactPerson || '',
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
        activeVehicleId:
            trip?.vehicles.find((x: any) => x.isActive)?.vehicle?._id || '',
        activeRegistrationNumber:
            trip?.vehicles.find((x: any) => x.isActive)?.vehicle
                ?.registrationNumber || '',
        activeDriverId: trip?.drivers?.[0]?.driver?._id || '',
        activeDriverName: trip?.drivers?.[0]?.driver?.fullName || '',
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
export default {
    tripModelToTripResponseDto,
    tripModelArrToTripResponseDtos,
    tripModelToTripResponseDtoGetAll,
    tripModelArrToTripResponseDtoGetAlls,
};
