import { Request, Response } from 'express';
import leaveValidation from './leave.validation';
import BadRequestError from '../../error/BadRequestError';
import constants from '../../constant';
import leaveService from './leave.service';
import { startSession } from 'mongoose';
import Leave from './leave.model';
import { StatusCodes } from 'http-status-codes';
import CommonResponse from '../../util/commonResponse';
import userService from '../user/user.service';
import LeaveResponseDto from './dto/leaveResponseDto';
import companyWorkingInfoService from '../common/service/companyWorkingInfo.service';
import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';
import leaveUtil from './leave.util';
import NotFoundError from '../../error/NotFoundError';
import LeaveCountResponseDto from './dto/leaveCountResponseDto';

const applyLeave = async (req: Request, res: Response) => {
    const auth = req.auth;
    const { startDate, endDate, dateCount, reason } = req.body;

    // Validate request body
    const { error } = leaveValidation.leaveSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    // Check if leave has already been applied
    const isLeaveOverlapped = await leaveService.checkUserAlreadyApplied(
        auth.id,
        startDate,
        endDate
    );
    if (isLeaveOverlapped) {
        throw new BadRequestError(
            'Leave is already applied for the given dates.'
        );
    }

    const session = await startSession();
    try {
        session.startTransaction();

        // Apply leave based on the user role
        const appliedLeave =
            auth.role === constants.USER.ROLES.DRIVER
                ? await applyDriverLeave(
                      auth,
                      startDate,
                      endDate,
                      dateCount,
                      reason,
                      session
                  )
                : await applyAdminLeave(
                      auth,
                      startDate,
                      endDate,
                      dateCount,
                      reason,
                      session
                  );

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Leave applied successfully!',
            appliedLeave
        );
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// Helper function to apply leave for a driver
const applyDriverLeave = async (
    auth: any,
    startDate: Date,
    endDate: Date,
    dateCount: number,
    reason: string,
    session: any
) => {
    const newLeave = new Leave({
        startDate,
        endDate,
        dateCount,
        reason,
        appliedUser: auth.id,
        createdBy: auth.id,
        updatedBy: auth.id,
    });

    return leaveService.save(newLeave, session);
};

// Helper function to apply leave for an admin
const applyAdminLeave = async (
    auth: any,
    startDate: Date,
    endDate: Date,
    dateCount: number,
    reason: string,
    session: any
) => {
    const appliedAdmin: any = await userService.findById(auth.id);
    const fromYear = new Date(startDate).getFullYear();

    const leaveCountForYear = await leaveService.getTotalLeaveDaysFromYear(
        auth.id,
        fromYear
    );

    if (
        leaveCountForYear >= appliedAdmin.leaveCount ||
        leaveCountForYear + dateCount > appliedAdmin.leaveCount
    ) {
        throw new BadRequestError(
            `You have exceeded the leave limit for ${fromYear} year!`
        );
    }

    const newLeave = new Leave({
        startDate,
        endDate,
        dateCount,
        reason,
        appliedUser: auth.id,
        createdBy: auth.id,
        updatedBy: auth.id,
    });

    return leaveService.save(newLeave, session);
};

const updateLeave = async (req: Request, res: Response) => {
    const { id } = req.params;
    const auth = req.auth;
    const { startDate, endDate, dateCount, reason } = req.body;

    // Validate request body
    const { error } = leaveValidation.leaveSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    // Check if leave has already been applied
    const isLeaveOverlapped =
        await leaveService.checkUserAlreadyAppliedForUpdate(
            auth.id,
            id,
            startDate,
            endDate
        );
    if (isLeaveOverlapped) {
        throw new BadRequestError(
            'Leave is already applied for the given dates.!'
        );
    }

    const leave = await leaveService.findByIdAndStatusIn(id, [
        WellKnownLeaveStatus.PENDING,
    ]);

    if (!leave) {
        throw new NotFoundError('Leave not found!');
    }

    const session = await startSession();
    try {
        session.startTransaction();

        // Apply leave based on the user role
        const appliedLeave =
            auth.role === constants.USER.ROLES.DRIVER
                ? await updateDriverLeave(
                      auth,
                      startDate,
                      endDate,
                      dateCount,
                      reason,
                      leave,
                      session
                  )
                : await updateAdminLeave(
                      auth,
                      startDate,
                      endDate,
                      dateCount,
                      reason,
                      leave,
                      session
                  );

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }

    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        'Leave updated successfully!',
        leave
    );
};

const updateDriverLeave = async (
    auth: any,
    startDate: Date,
    endDate: Date,
    dateCount: number,
    reason: string,
    leave: any,
    session: any
) => {
    leave.startDate = startDate;
    leave.endDate = endDate;
    leave.dateCount = dateCount;
    leave.reason = reason;
    leave.updatedBy = auth.id;

    return leaveService.save(leave, session);
};

const updateAdminLeave = async (
    auth: any,
    startDate: Date,
    endDate: Date,
    dateCount: number,
    reason: string,
    leave: any,
    session: any
) => {
    const appliedAdmin: any = await userService.findById(auth.id);
    const fromYear = new Date(startDate).getFullYear();

    const leaveCountForYear = await leaveService.getTotalLeaveDaysFromYear(
        auth.id,
        fromYear
    );

    if (
        leaveCountForYear == 0 &&
        leaveCountForYear - leave.dateCount + dateCount <=
            appliedAdmin.leaveCount
    ) {
        throw new BadRequestError(
            `You have exceeded the leave limit for ${fromYear} year!`
        );
    } else if (
        leaveCountForYear - leave.dateCount + dateCount >
        appliedAdmin.leaveCount
    ) {
        throw new BadRequestError(
            `You have exceeded the leave limit for ${fromYear} year!`
        );
    }

    // if (leaveCountForYear >= appliedAdmin.leaveCount) {
    //     throw new BadRequestError(
    //         `You have exceeded the leave limit for ${fromYear} year!`
    //     );
    // }

    leave.startDate = startDate;
    leave.endDate = endDate;
    leave.dateCount = dateCount;
    leave.reason = reason;
    leave.updatedBy = auth.id;

    return leaveService.save(leave, session);
};

const getAllLeaves = async (req: Request, res: Response) => {
    const auth: any = req.auth;
    const userId = auth.id;

    let response: LeaveResponseDto[] = [];

    const activeCompanyInfo: any =
        await companyWorkingInfoService.getCompanyWorkingInfo();

    if (!activeCompanyInfo) {
        throw new BadRequestError('No active company information found!');
    }

    switch (auth.role) {
        case constants.USER.ROLES.DRIVER:
            const DriverLeaves =
                await leaveService.findAllByUserIdYearAndStatus(
                    userId,
                    activeCompanyInfo.workingYear,
                    [
                        WellKnownLeaveStatus.APPROVED,
                        WellKnownLeaveStatus.REJECTED,
                        WellKnownLeaveStatus.PENDING,
                    ]
                );

            response = leaveUtil.leaveModelToLeaveResponseDtos(DriverLeaves);
            break;

        case constants.USER.ROLES.ADMIN:
            const adminLeaves = await leaveService.findAllByUserIdYearAndStatus(
                userId,
                activeCompanyInfo.workingYear,
                [
                    WellKnownLeaveStatus.APPROVED,
                    WellKnownLeaveStatus.REJECTED,
                    WellKnownLeaveStatus.PENDING,
                ]
            );

            response = leaveUtil.leaveModelToLeaveResponseDtos(adminLeaves);
            break;

        case constants.USER.ROLES.SUPERADMIN:
            const superAdminLeaves =
                await leaveService.findAllByUserIdYearAndStatus(
                    '',
                    activeCompanyInfo.workingYear,
                    [
                        WellKnownLeaveStatus.APPROVED,
                        WellKnownLeaveStatus.REJECTED,
                        WellKnownLeaveStatus.PENDING,
                    ]
                );

            if (superAdminLeaves.length > 0) {
                for (const leave of superAdminLeaves) {
                    if (leave.status == WellKnownLeaveStatus.PENDING) {
                        const appliedUser: any =
                            await userService.findByIdWithGenderRole(
                                leave.appliedUser._id
                            );

                        if (
                            appliedUser?.role?.id == constants.USER.ROLES.ADMIN
                        ) {
                            const availableLeaveCount =
                                await leaveService.getTotalLeaveDaysFromYear(
                                    appliedUser._id,
                                    activeCompanyInfo.workingYear
                                );

                            leave.availableLeaveCount =
                                appliedUser.leaveCount - availableLeaveCount;
                        }
                    }
                }
            }

            response =
                leaveUtil.leaveModelToLeaveResponseDtos(superAdminLeaves);
            break;
        default:
            break;
    }

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

const getLeaveById = async (req: Request, res: Response) => {
    const leaveId = req.params.id;

    const leave = await leaveService.findByIdAndStatusIn(leaveId, [
        WellKnownLeaveStatus.APPROVED,
        WellKnownLeaveStatus.REJECTED,
        WellKnownLeaveStatus.PENDING,
    ]);

    if (!leave) throw new NotFoundError('Leave not found!');

    const response = leaveUtil.leaveModelToLeaveResponseDto(leave);

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

const approveLeave = async (req: Request, res: Response) => {
    const { remark } = req.body;
    const leaveId = req.params.id;
    const userAuth: any = req.auth;

    // Validate request body
    const { error } = leaveValidation.approveRejectLeaveSchema.validate(
        req.body
    );

    if (error) {
        throw new BadRequestError(error.message);
    }

    const leave: any = await leaveService.findByIdAndStatusIn(leaveId, [
        WellKnownLeaveStatus.PENDING,
        WellKnownLeaveStatus.REJECTED,
    ]);

    if (!leave) throw new NotFoundError('Leave not found!');

    const appliedUser: any = await userService.findByIdWithGenderRole(
        leave?.appliedUser?._id
    );

    if (appliedUser?.role?.id === constants.USER.ROLES.ADMIN) {
        const fromYear = new Date(leave?.startDate).getFullYear();
        const leaveCountForYear = await leaveService.getTotalLeaveDaysFromYear(
            appliedUser._id,
            fromYear
        );

        if (leaveCountForYear + leave?.dateCount > appliedUser.leaveCount) {
            throw new BadRequestError(
                `This user have exceeded the leave limit for ${fromYear} year!`
            );
        }
    }

    const session = await startSession();
    let leaveUpdate = null;
    try {
        session.startTransaction();

        leave.status = WellKnownLeaveStatus.APPROVED;
        leave.approveBy = userAuth.id;
        leave.updatedBy = userAuth.id;
        leave.approveDate = new Date();
        leave.approveRemark = remark;

        // remove reject info
        leave.rejectBy = null;
        leave.rejectDate = null;
        leave.rejectReason = '';

        leaveUpdate = await leaveService.save(leave, session);

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }

    return CommonResponse(
        res,
        true,
        StatusCodes.CREATED,
        'Leave approved successfully!',
        leaveUtil.leaveModelToLeaveResponseDto(leaveUpdate)
    );
};

const rejectLeave = async (req: Request, res: Response) => {
    const { remark } = req.body;
    const leaveId = req.params.id;
    const userAuth: any = req.auth;

    const { error } = leaveValidation.approveRejectLeaveSchema.validate(
        req.body
    );

    if (error) {
        throw new BadRequestError(error.message);
    }

    const leave: any = await leaveService.findByIdAndStatusIn(leaveId, [
        WellKnownLeaveStatus.PENDING,
        WellKnownLeaveStatus.APPROVED,
    ]);

    if (!leave) throw new NotFoundError('Leave not found!');

    const session = await startSession();
    let leaveUpdate = null;
    try {
        session.startTransaction();

        leave.status = WellKnownLeaveStatus.REJECTED;
        leave.rejectBy = userAuth.id;
        leave.updatedBy = userAuth.id;
        leave.rejectDate = new Date();
        leave.rejectReason = remark;

        // remove approve info
        leave.approveBy = null;
        leave.approveDate = null;
        leave.approveRemark = '';

        leaveUpdate = await leaveService.save(leave, session);

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }

    return CommonResponse(
        res,
        true,
        StatusCodes.CREATED,
        'Leave rejected successfully!',
        leaveUtil.leaveModelToLeaveResponseDto(leaveUpdate)
    );
};

const cancelLeave = async (req: Request, res: Response) => {
    const leaveId = req.params.id;
    const userAuth: any = req.auth;

    const leave: any = await leaveService.findByIdAndStatusIn(leaveId, [
        WellKnownLeaveStatus.PENDING,
    ]);

    if (!leave) throw new NotFoundError('Leave not found!');

    const session = await startSession();
    let leaveUpdate = null;
    try {
        session.startTransaction();

        leave.status = WellKnownLeaveStatus.CANCELLED;
        leave.updatedBy = userAuth.id;

        leaveUpdate = await leaveService.save(leave, session);

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }

    return CommonResponse(
        res,
        true,
        StatusCodes.CREATED,
        'Leave cancelled successfully!',
        leaveUtil.leaveModelToLeaveResponseDto(leaveUpdate)
    );
};

const getLeaveCount = async (req: Request, res: Response) => {
    const auth: any = req.auth;

    const activeCompanyInfo: any =
        await companyWorkingInfoService.getCompanyWorkingInfo();

    if (!activeCompanyInfo) {
        throw new BadRequestError('Company not found!');
    }
    let response: LeaveCountResponseDto;
    let approveLeaveCount: number = 0;
    let rejectLeaveCount: number = 0;
    let pendingLeaveCount: number = 0;
    let remainingLeaveCount: number = 0;
    let yearlyEligibleLeaveCount: number = 0;

    switch (auth.role) {
        case constants.USER.ROLES.ADMIN:
            approveLeaveCount = await leaveService.countByYearUserIdAndStatusIn(
                auth.id,
                activeCompanyInfo.workingYear,
                [WellKnownLeaveStatus.APPROVED]
            );

            rejectLeaveCount = await leaveService.countByYearUserIdAndStatusIn(
                auth.id,
                activeCompanyInfo.workingYear,
                [WellKnownLeaveStatus.REJECTED]
            );

            pendingLeaveCount = await leaveService.countByYearUserIdAndStatusIn(
                auth.id,
                activeCompanyInfo.workingYear,
                [WellKnownLeaveStatus.PENDING]
            );

            const admin: any = await userService.findById(auth.id);

            const leaveCountForYear =
                await leaveService.getTotalLeaveDaysFromYear(
                    auth.id,
                    activeCompanyInfo.workingYear
                );

            remainingLeaveCount = admin.leaveCount - leaveCountForYear;

            yearlyEligibleLeaveCount = admin.leaveCount;

            break;

        case constants.USER.ROLES.DRIVER:
            approveLeaveCount = await leaveService.countByYearUserIdAndStatusIn(
                auth.id,
                activeCompanyInfo.workingYear,
                [WellKnownLeaveStatus.APPROVED]
            );

            rejectLeaveCount = await leaveService.countByYearUserIdAndStatusIn(
                auth.id,
                activeCompanyInfo.workingYear,
                [WellKnownLeaveStatus.REJECTED]
            );

            pendingLeaveCount = await leaveService.countByYearUserIdAndStatusIn(
                auth.id,
                activeCompanyInfo.workingYear,
                [WellKnownLeaveStatus.PENDING]
            );

            break;

        case constants.USER.ROLES.SUPERADMIN:
            approveLeaveCount =
                await leaveService.countByMonthYearUserIdAndStatusIn(
                    '',
                    activeCompanyInfo.workingYear,
                    activeCompanyInfo.workingMonth,
                    [WellKnownLeaveStatus.APPROVED]
                );

            rejectLeaveCount =
                await leaveService.countByMonthYearUserIdAndStatusIn(
                    '',
                    activeCompanyInfo.workingYear,
                    activeCompanyInfo.workingMonth,
                    [WellKnownLeaveStatus.REJECTED]
                );

            pendingLeaveCount =
                await leaveService.countByMonthYearUserIdAndStatusIn(
                    '',
                    activeCompanyInfo.workingYear,
                    activeCompanyInfo.workingMonth,
                    [WellKnownLeaveStatus.PENDING]
                );
            break;

        default:
            break;
    }

    response = {
        approveLeaveCount,
        rejectLeaveCount,
        pendingLeaveCount,
        remainingLeaveCount,
        yearlyEligibleLeaveCount,
    };

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

const getEligibleLeaves = async (req: Request, res: Response) => {
    const auth: any = req.auth;

    const activeCompanyInfo: any =
        await companyWorkingInfoService.getCompanyWorkingInfo();

    if (!activeCompanyInfo) {
        throw new BadRequestError('Company not found!');
    }

    const user: any = await userService.findByIdWithGenderRole(auth.id);

    const leaveCountForYear = await leaveService.getTotalLeaveDaysFromYear(
        auth.id,
        activeCompanyInfo.workingYear
    );

    const remainingLeaveCount = user.leaveCount - leaveCountForYear;

    CommonResponse(res, true, StatusCodes.OK, '', remainingLeaveCount);
};

export {
    applyLeave,
    getAllLeaves,
    getLeaveById,
    approveLeave,
    rejectLeave,
    getLeaveCount,
    cancelLeave,
    updateLeave,
    getEligibleLeaves,
};
