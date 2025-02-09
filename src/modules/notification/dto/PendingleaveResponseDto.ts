interface PendingLeaveResponseDto {
    _id: string; // leave request id
    type: number;
    appliedBy: string;
    typeName: string;
    description: string;
    startDate: Date;
    createdAt: Date;
}

export default PendingLeaveResponseDto;
