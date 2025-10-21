import { WellKnownStatus } from "../../util/enums/well-known-status.enum";
import helperUtil from "../../util/helper.util";
import GarageResponseDto from "./dto/garageResponseDto";

const modelToGarageResponseDto = (garage: any): GarageResponseDto => {
    let specializations = garage.specializations.map((spec: any) => spec.name).join(', ');
    return {
        _id: garage._id,
        name: garage.name,
        address: garage.address,
        city: garage.city,
        contactNumber1: garage.contactNumber1,
        contactNumber2: garage.contactNumber2,
        googleMapUrl: garage.googleMapUrl,
        specializations: specializations,
        status: garage.status,
        statusName: helperUtil.getNameFromEnum(WellKnownStatus, garage.status),
        createdBy: garage.createdBy?._id,
        createdUser: garage.createdBy?.fullName,
        updatedBy: garage.updatedBy?._id,
        updatedUser: garage.updatedBy?.fullName,
        createdAt: garage.createdAt,
        updatedAt: garage.updatedAt
    };
}

const modelToGarageResponseDtoList = (garages: any[]): GarageResponseDto[] => {
    return garages.map(garage => modelToGarageResponseDto(garage));
}

export default {
    modelToGarageResponseDto,
    modelToGarageResponseDtoList
};