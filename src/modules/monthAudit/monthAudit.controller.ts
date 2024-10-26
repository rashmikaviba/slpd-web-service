import { Request, Response } from 'express';
import companyWorkingInfo from '../common/model/companyWorkingInfo.model';
import { startSession } from 'mongoose';
import companyWorkingInfoService from '../common/service/companyWorkingInfo.service';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import monthAudit from './monthAudit.model';
import monthAuditService from './monthAudit.service';
import leaveService from '../leave/leave.service';
import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';
import userService from '../user/user.service';
import constants from '../../constant';
import LeaveResponseDto from '../leave/dto/leaveResponseDto';
import BadRequestError from '../../error/BadRequestError';
import leaveUtil from '../leave/leave.util';
import CommonResponse from '../../util/commonResponse';
import { StatusCodes } from 'http-status-codes';
import WorkingInfoResponseDto from './dto/workingInfoResponseDto';
import monthAuditUtil from './monthAudit.util';
import {
    TripPlaceResponseDto,
    TripResponseDtoGetAll,
} from '../trip/dto/tripResponseDtos';
import tripService from '../trip/trip.service';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import tripUtil from '../trip/trip.util';

const createNewDate = async (req: Request, res: Response) => {
    const auth: any = req.auth;
    const { month, year } = req.body;

    let lastCompanyInfo: any =
        await companyWorkingInfoService.getCompanyWorkingInfo();

    const session = await startSession();
    let createdMonth = null;
    try {
        session.startTransaction();

        await monthEndDoneForLeave(
            lastCompanyInfo.workingMonth,
            lastCompanyInfo.workingYear,
            session
        );

        await monthEndDoneForTrip(
            lastCompanyInfo.workingMonth,
            lastCompanyInfo.workingYear,
            session
        );

        if (lastCompanyInfo) {
            lastCompanyInfo.status = WellKnownStatus.DELETED;

            await companyWorkingInfoService.save(lastCompanyInfo, session);
        }

        const newCompanyInfo = new companyWorkingInfo({
            workingYear: year,
            workingMonth: month,
            workingDate: new Date(year, month - 1, 1),
            createdBy: auth.id,
            updatedBy: auth.id,
        });

        await companyWorkingInfoService.save(newCompanyInfo, session);

        const monthAuditNew = new monthAudit({
            newWorkingDate: new Date(year, month - 1, 1),
            createdBy: auth.id,
            updatedBy: auth.id,
        });

        createdMonth = await monthAuditService.save(monthAuditNew, session);

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
        `Month Audit successfully done and System date move to ${month}/${year}!`,
        createdMonth
    );
};

const monthEndDoneForLeave = async (
    currMonth: number,
    currYear: number,
    session: any
) => {
    const leaves: any[] =
        await leaveService.findAllLeavesByMonthYearAndStatusIn(
            currYear,
            currMonth,
            [
                WellKnownLeaveStatus.APPROVED,
                WellKnownLeaveStatus.REJECTED,
                WellKnownLeaveStatus.PENDING,
                WellKnownLeaveStatus.CANCELLED,
            ]
        );

    for (const leave of leaves) {
        leave.isMonthEndDone = true;
        await leaveService.save(leave, session);
    }
};

const monthEndDoneForTrip = async (
    currMonth: number,
    currYear: number,
    session: any
) => {
    const trips: any[] = await tripService.findAllByEndMonthAndStatusIn(
        currMonth,
        currYear,
        [
            WellKnownTripStatus.PENDING,
            WellKnownTripStatus.START,
            WellKnownTripStatus.FINISHED,
            WellKnownTripStatus.CANCELED,
        ]
    );

    for (const trip of trips) {
        trip.isMonthEndDone = true;
        await tripService.save(trip, session);
    }
};

const getPendingLeaves = async (req: Request, res: Response) => {
    const auth: any = req.auth;

    let response: LeaveResponseDto[] = [];

    const activeCompanyInfo: any =
        await companyWorkingInfoService.getCompanyWorkingInfo();

    if (!activeCompanyInfo) {
        throw new BadRequestError('No active company information found!');
    }

    const superAdminLeaves =
        await leaveService.findAllLeavesByMonthYearAndStatusIn(
            activeCompanyInfo.workingYear,
            activeCompanyInfo.workingMonth,
            [WellKnownLeaveStatus.PENDING]
        );

    if (superAdminLeaves.length > 0) {
        for (const leave of superAdminLeaves) {
            if (leave.status == WellKnownLeaveStatus.PENDING) {
                const appliedUser: any =
                    await userService.findByIdWithGenderRole(
                        leave.appliedUser._id
                    );

                if (
                    (appliedUser?.role?.id == constants.USER.ROLES.ADMIN ||
                        appliedUser?.role?.id ==
                            constants.USER.ROLES.TRIPMANAGER,
                    appliedUser?.role?.id ==
                        constants.USER.ROLES.FINANCEOFFICER)
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

    response = leaveUtil.leaveModelToLeaveResponseDtos(superAdminLeaves);

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

const getWorkingInformation = async (req: Request, res: Response) => {
    const auth: any = req.auth;

    let response: WorkingInfoResponseDto = Object.create(null);

    let lastCompanyInfo: any =
        await companyWorkingInfoService.getCompanyWorkingInfo();

    if (!lastCompanyInfo) {
        throw new BadRequestError('No active company information found!');
    }

    response =
        monthAuditUtil.companyWorkingInfoToWorkingInfoResponseDto(
            lastCompanyInfo
        );

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

const getTripInfoForWorkingMonth = async (req: Request, res: Response) => {
    let response: TripResponseDtoGetAll[] = [];
    const activeCompanyInfo: any =
        await companyWorkingInfoService.getCompanyWorkingInfo();

    if (!activeCompanyInfo) {
        throw new BadRequestError('No active company information found!');
    }

    const trips = await tripService.findAllByEndMonthAndStatusIn(
        activeCompanyInfo.workingMonth,
        activeCompanyInfo.workingYear,
        [WellKnownTripStatus.PENDING, WellKnownTripStatus.START]
    );

    if (trips?.length > 0) {
        response = tripUtil.tripModelArrToTripResponseDtoGetAlls(trips);
    }

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

export {
    createNewDate,
    getPendingLeaves,
    getWorkingInformation,
    getTripInfoForWorkingMonth,
};
