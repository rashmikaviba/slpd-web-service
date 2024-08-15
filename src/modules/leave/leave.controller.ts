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

export { applyLeave, getAllLeaves };
