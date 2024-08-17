import LeaveResponseDto from './dto/leaveResponseDto';
import helperUtil from '../../util/helper.util';
import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';
const leaveModelToLeaveResponseDto = (leave: any): LeaveResponseDto => {
    return {
        _id: leave._id,
        startDate: leave.startDate,
        endDate: leave.endDate,
        dateCount: leave.dateCount,
        reason: leave.reason,
        status: leave.status,
        statusName: helperUtil.getNameFromEnum(
            WellKnownLeaveStatus,
            leave.status
        ),
        appliedUser: leave.appliedUser._id,
        appliedUserName: leave.appliedUser.fullName || '',
        approveBy: leave.approveBy?._id || null,
        approvedUser: leave.approveBy?.fullName || '',
        approveDate: leave.approveDate || null,
        approveRemark: leave.approveRemark || '',
        rejectBy: leave.rejectBy?._id || null,
        rejectedUser: leave.rejectBy?.fullName || '',
        rejectDate: leave.rejectDate || null,
        rejectReason: leave.rejectReason || '',
        isMonthEndDone: leave.isMonthEndDone ? true : false,
        createdBy: leave.createdBy?._id,
        createdUser: leave.createdBy?.fullName || '',
        updatedBy: leave.updatedBy?._id,
        updatedUser: leave.updatedBy?.fullName || '',
        createdAt: leave.createdAt,
        updatedAt: leave.updatedAt,
    };
};

const leaveModelToLeaveResponseDtos = (leaves: any[]): LeaveResponseDto[] => {
    return leaves.map((leave) =>
        leaveModelToLeaveResponseDto(leave)
    ) as LeaveResponseDto[];
};

export default { leaveModelToLeaveResponseDto, leaveModelToLeaveResponseDtos };
