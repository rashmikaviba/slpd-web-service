interface GarageResponseDto {
    _id: string;
    name: string;
    address: string;
    city: string;
    contactNumber: string;
    googleMapUrl: string;
    specializations: string;
    status: number;
    createdBy: string;
    createdUser: string;
    updatedBy: string;
    updatedUser: string;
    createdAt: Date;
    updatedAt: Date;
}

export default GarageResponseDto;