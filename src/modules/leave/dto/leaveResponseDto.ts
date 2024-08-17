interface LeaveResponseDto {
    _id: string;
    startDate: Date;
    endDate: Date;
    dateCount: number;
    reason: string;
    status: number;
    statusName: string;
    appliedUser: string;
    appliedUserName: string;
    approveBy: string;
    approvedUser: string;
    approveDate: Date;
    approveRemark: string;
    isMonthEndDone: boolean;
    rejectBy: string;
    rejectedUser: string;
    rejectDate: Date;
    rejectReason: string;
    createdBy: string;
    createdUser: string;
    updatedBy: string;
    updatedUser: string;
    createdAt: Date;
    updatedAt: Date;
}

export default LeaveResponseDto;
