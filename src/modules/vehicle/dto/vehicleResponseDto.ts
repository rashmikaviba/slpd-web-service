interface VehicleResponseDto {
    _id: string;
    vehicleType: number;
    vehicleTypeName: string;
    registrationNumber: string;
    vehicleOwner: string;
    gpsTracker: string;
    capacity: number;
    availableSeats: number;
    description: string;
    status: number;
    statusName: string;
    createdBy: string;
    createdUser: string;
    updatedBy: string;
    updatedUser: string;
    createdAt: Date;
    updatedAt: Date;
}

export default VehicleResponseDto;
