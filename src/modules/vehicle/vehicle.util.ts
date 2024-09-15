import { vehicleTypes } from '../../util/data/commonData';
import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';
import helperUtil from '../../util/helper.util';
import VehicleResponseDto from './dto/vehicleResponseDto';

const vehicleModelToVehicleResponseDto = (vehicle: any): VehicleResponseDto => {
    return {
        vehicleType: vehicle.vehicleType,
        vehicleTypeName:
            vehicleTypes.find(
                (vehicleType) => vehicleType.id === vehicle.vehicleType
            )?.name || '',
        registrationNumber: vehicle.registrationNumber,
        gpsTracker: vehicle.gpsTracker,
        capacity: vehicle.capacity,
        availableSeats: vehicle.availableSeats,
        description: vehicle.description,
        status: vehicle.status,
        statusName: helperUtil.getNameFromEnum(
            WellKnownLeaveStatus,
            vehicle.status
        ),
        createdBy: vehicle.createdBy?._id,
        createdUser: vehicle.createdBy?.fullName || '',
        updatedBy: vehicle.updatedBy?._id,
        updatedUser: vehicle.updatedBy?.fullName || '',
        createdAt: vehicle.createdAt,
        updatedAt: vehicle.updatedAt,
    };
};

const vehicleModelArrToVehicleResponseDtos = (
    vehicles: any[]
): VehicleResponseDto[] => {
    return vehicles.map((vehicle) =>
        vehicleModelToVehicleResponseDto(vehicle)
    ) as VehicleResponseDto[];
};
export default {
    vehicleModelToVehicleResponseDto,
    vehicleModelArrToVehicleResponseDtos,
};
