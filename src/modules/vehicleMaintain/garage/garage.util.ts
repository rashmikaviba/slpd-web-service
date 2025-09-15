import GarageResponseDto from "./dto/garageResponseDto";

const modelToGarageResponseDto = (garage: any): GarageResponseDto => {
    return {
        _id: garage._id,
        name: garage.name,
        address: garage.address,
        city: garage.city,
        contactNumber: garage.contactNumber,
        googleMapUrl: garage.googleMapUrl,
        specializations: garage.specializations,
        status: garage.status,
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