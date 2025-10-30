interface GarageResponseDto {
    _id: string;
    name: string;
    address: string;
    city: string;
    contactNumber1: string;
    contactNumber2: string;
    googleMapUrl: string;
    specializations: string;
    status: number;
    statusName: string;
    createdBy: string;
    createdUser: string;
    updatedBy: string;
    updatedUser: string;
    createdAt: Date;
    updatedAt: Date;
}

export default GarageResponseDto;