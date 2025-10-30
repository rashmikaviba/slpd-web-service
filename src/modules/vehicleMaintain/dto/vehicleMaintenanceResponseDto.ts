interface VehicleMaintenanceResponseDto {
    id: string;
    vehicleId: string;
    vehicleNumber: string;
    maintenancePart: string;
    isCompanyVehicle: boolean;
    isRentalVehicle: boolean;
    isFreelanceVehicle: boolean;
    garageId: string;
    garageName: string;
    maintenanceDate: Date;
    cost: number;
    note?: string;
    billImageUrls?: string[];
    isMonthEndDone: boolean;
    createdBy: string;
    createdUser: string;
    updatedBy: string;
    updatedUser: string;
    createdAt: Date;
    updatedAt: Date;
}

export default VehicleMaintenanceResponseDto;