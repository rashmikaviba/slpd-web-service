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

    if (leaveCountForYear >= appliedAdmin.leaveCount) {
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

        leaveUpdate = {
            ...leave,
            status: WellKnownLeaveStatus.APPROVED,
            approveBy: userAuth.id,
            updatedBy: userAuth.id,
            approveDate: new Date(),
            approveRemark: remark,
        };

        await leaveService.save(leaveUpdate, session);

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
        leaveUpdate
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
    ]);

    if (!leave) throw new NotFoundError('Leave not found!');

    const session = await startSession();
    let leaveUpdate = null;
    try {
        session.startTransaction();

        leaveUpdate = {
            ...leave,
            status: WellKnownLeaveStatus.REJECTED,
            rejectBy: userAuth.id,
            updatedBy: userAuth.id,
            rejectDate: new Date(),
            rejectReason: remark,
        };

        await leaveService.save(leaveUpdate, session);

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
        leaveUpdate
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

        leaveUpdate = {
            ...leave,
            status: WellKnownLeaveStatus.CANCELLED,
            updatedBy: userAuth.id,
        };

        await leaveService.save(leaveUpdate, session);

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
        leaveUpdate
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
            approveLeaveCount = await leaveService.countByYearUserIdAndStatusIn(
                '',
                activeCompanyInfo.workingYear,
                [WellKnownLeaveStatus.APPROVED]
            );

            rejectLeaveCount = await leaveService.countByYearUserIdAndStatusIn(
                '',
                activeCompanyInfo.workingYear,
                [WellKnownLeaveStatus.REJECTED]
            );

            pendingLeaveCount = await leaveService.countByYearUserIdAndStatusIn(
                '',
                activeCompanyInfo.workingYear,
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
    };

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

export {
    applyLeave,
    getAllLeaves,
    getLeaveById,
    approveLeave,
    rejectLeave,
    getLeaveCount,
    cancelLeave,
};
