interface LeaveCountResponseDto {
    approveLeaveCount: number;
    rejectLeaveCount: number;
    pendingLeaveCount: number;
    remainingLeaveCount: number;
    yearlyEligibleLeaveCount: number;
}

export default LeaveCountResponseDto;
