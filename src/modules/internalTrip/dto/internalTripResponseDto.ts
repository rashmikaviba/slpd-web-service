interface InternalTripResponseDto {
    _id: string;
    startDate: Date;
    endDate: Date;
    driver: string;
    reason: string;
    createdBy: string;
    createdAt: Date;
    createdByUser: string;
    updatedBy: string;
    updatedAt: Date;
    updatedByUser: string;
}

export default InternalTripResponseDto;
