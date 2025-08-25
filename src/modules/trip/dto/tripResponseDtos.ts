interface PassengerDto {
    id: string;
    name: string;
    nationality: string;
    age: number;
    gender: string;
}

interface ArrivalInfoDto {
    arrivalDate: Date | null;
    arrivalTime: Date | null;
    arrivalFlightNumber: string | null;
}

interface DepartureInfoDto {
    departureDate: Date | null;
    departureTime: Date | null;
    departureFlightNumber: string | null;
}

interface PickUpInfoDto {
    pickupDate: Date | null;
    pickupTime: Date | null;
    pickupCity: string | null;
    pickupAddress: string | null;
}

interface DropOffInfoDto {
    dropOffDate: Date | null;
    dropOffTime: Date | null;
    dropOffCity: string | null;
    dropOffAddress: string | null;
}

interface ActivityDto {
    id: string;
    date: Date | null;
    description: string | null;
    adultCount: number | null;
    childCount: number | null;
    totalCost: number | null;
}

interface DriverDto {
    driver: string;
    driverName: string;
    driverAssignedBy: string;
    driverAssignedByName: string;
    isActive: boolean;
}

interface VehicleDto {
    vehicle: string;
    registrationNumber: string;
    vehicleAssignedBy: string;
    licenseRenewalDate: Date | null;
    insuranceRenewalDate: Date | null;
    isActive: boolean;
}

interface TripResponseDto {
    startDate: Date;
    endDate: Date;
    dateCount: number;
    totalCost: number;
    totalCostLocalCurrency: number;
    estimatedExpense: number;
    passengers: PassengerDto[];
    arrivalInfo: ArrivalInfoDto | null;
    departureInfo: DepartureInfoDto | null;
    pickUpInfo: PickUpInfoDto | null;
    dropOffInfo: DropOffInfoDto | null;
    activities: ActivityDto[];
    email: string;
    phoneNumber: string | null;
    drivers: DriverDto[];
    status: number;
    createdBy: string;
    updatedBy: string;
    startedBy: string | null;
    endedBy: string | null;
    createdUser: string;
    updatedUser: string;
    startedUser: string | null;
    endedUser: string | null;
    createdAt: Date;
    updatedAt: Date;
    statusName: string;
}

interface TripResponseDtoGetAll {
    id: string;
    startDate: Date;
    endDate: Date;
    dateCount: number;
    totalCost: number;
    paymentMode: string;
    requestedVehicle: string;
    totalCostLocalCurrency: number;
    isPaymentCollected: boolean;
    isActiveDriver: boolean;
    isCheckListDone: boolean;
    activeDriverId: string;
    drivers: DriverDto[];
    vehicles: VehicleDto[];
    activeDriverName: string;
    tripConfirmedNumber: string;
    canUndo: boolean;
    isMonthEndDone: boolean;
    isDriverSalaryDone: boolean;
    contactPerson: string;
    activeVehicleId: string;
    activeRegistrationNumber: string;
    passengersCount: number;
    paidByCompanyCount: number;
    email: string;
    phoneNumber: string | null;
    status: number;
    statusName: string;
    createdBy: string;
    updatedBy: string;
    startedBy: string | null;
    endedBy: string | null;
    createdUser: string;
    updatedUser: string;
    startedUser: string | null;
    endedUser: string | null;
    createdAt: Date;
    updatedAt: Date;
}

interface TripPlaceResponseDto {
    description: string;
    dates: Date[];
    isReached: boolean;
    index: number;
    updatedBy: string;
    _id: string;
    location: any;
    reachedBy: string;
    reachedDate: Date;
    reachedByUser: string;
}

export {
    PassengerDto,
    ArrivalInfoDto,
    DepartureInfoDto,
    PickUpInfoDto,
    DropOffInfoDto,
    ActivityDto,
    DriverDto,
    TripResponseDto,
    TripResponseDtoGetAll,
    VehicleDto,
    TripPlaceResponseDto,
};
