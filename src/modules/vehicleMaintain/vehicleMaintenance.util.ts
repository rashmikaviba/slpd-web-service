import vehicleMaintenanceInvoiceResponseDto from "./dto/vehicleMaintenanceInvoiceResponseDto";
import VehicleMaintenanceResponseDto from "./dto/vehicleMaintenanceResponseDto";


const mapmodelToVehicleMaintenanceResponseDto = (model: any): VehicleMaintenanceResponseDto => {
    return {
        id: model._id,
        vehicleId: model.vehicle._id,
        vehicleNumber: model.vehicle.registrationNumber,
        maintenancePart: model.maintenancePart,
        isCompanyVehicle: !model.isRentalVehicle && !model.isFreelanceVehicle || false,
        isRentalVehicle: model.isRentalVehicle || false,
        isFreelanceVehicle: model.isFreelanceVehicle || false,
        garageId: model.garage._id,
        garageName: model.garage.name,
        maintenanceDate: model.maintenanceDate,
        cost: model.cost,
        note: model.note,
        billImageUrls: model.billImageUrls,
        isMonthEndDone: model.isMonthEndDone,
        createdBy: model.createdBy?._id,
        createdUser: model.createdBy?.fullName || '',
        updatedBy: model.updatedBy?._id,
        updatedUser: model.updatedBy?.fullName || '',
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
    };
}

const mapmodelArrToVehicleMaintenanceResponseDtos = (models: any[]): VehicleMaintenanceResponseDto[] => {
    return models.map((model) => mapmodelToVehicleMaintenanceResponseDto(model)) as VehicleMaintenanceResponseDto[];
}

const modelTovehicleMaintainInvoiceResponseDto = (model: any): vehicleMaintenanceInvoiceResponseDto => {
    return {
        id: model._id,
        vehicleId: model.vehicle._id,
        vehicleNumber: model.vehicle.registrationNumber,
        vehicleOwnerName: model.vehicle.vehicleOwner,
        maintenancePart: model.maintenancePart,
        isCompanyVehicle: !model.isRentalVehicle && !model.isFreelanceVehicle || false,
        isRentalVehicle: model.isRentalVehicle || false,
        isFreelanceVehicle: model.isFreelanceVehicle || false,
        garageId: model.garage._id,
        garageName: model.garage.name,
        maintenanceDate: model.maintenanceDate,
        cost: model.cost,
        note: model.note,
        billImageUrls: model.billImageUrls,
        isMonthEndDone: model.isMonthEndDone,
        createdBy: model.createdBy?._id,
        createdUser: model.createdBy?.fullName || '',
        updatedBy: model.updatedBy?._id,
        updatedUser: model.updatedBy?.fullName || '',
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
    };
}

export default {
    mapmodelToVehicleMaintenanceResponseDto,
    mapmodelArrToVehicleMaintenanceResponseDtos,
    modelTovehicleMaintainInvoiceResponseDto,
};