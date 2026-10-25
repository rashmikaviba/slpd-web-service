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
    TripResponseDtoGetAll,
} from '../trip/dto/tripResponseDtos';
import tripService from '../trip/trip.service';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import tripUtil from '../trip/trip.util';
import expensesService from '../expenses/expenses.service';
import internalTripService from '../internalTrip/internalTrip.service';
import MonthlyExpenses from '../monthlyExpenses/monthlyExpenses.model';
import monthlyExpensesService from '../monthlyExpenses/monthlyExpenses.service';
import posService from '../pos/pos.service';
import vehicleMaintenanceService from '../vehicleMaintain/vehicleMaintenance.service';
import helperUtil from '../../util/helper.util';

const createNewDate = async (req: Request, res: Response) => {
    const auth: any = req.auth;
    const { month, year } = req.body;
    const correlationId = req.correlationId;

    // modified and saved below, so not the shared cached copy
    let lastCompanyInfo: any =
        await companyWorkingInfoService.getCompanyWorkingInfoFresh();

    const session = await startSession();
    let createdMonth = null;
    try {
        session.startTransaction();

        // generate batchId
        const batchId = await monthAuditService.generateBatchId();

        await monthEndDoneForLeave(
            lastCompanyInfo.workingMonth,
            lastCompanyInfo.workingYear,
            session,
            auth?.id,
            batchId,
            correlationId
        );

        await monthEndDoneForTrip(
            lastCompanyInfo.workingMonth,
            lastCompanyInfo.workingYear,
            session,
            auth?.id,
            batchId,
            correlationId
        );

        await monthEndDoneForInternalTrip(
            lastCompanyInfo.workingMonth,
            lastCompanyInfo.workingYear,
            session,
            auth?.id,
            batchId,
            correlationId
        );

        await monthEndDoneForMonthlyExpenses(
            lastCompanyInfo.workingMonth,
            lastCompanyInfo.workingYear,
            session,
            auth?.id,
            batchId,
            correlationId
        );

        await monthEndDoneForVehicleMaintenance(
            lastCompanyInfo.workingMonth,
            lastCompanyInfo.workingYear,
            session,
            auth?.id,
            batchId,
            correlationId
        );

        if (lastCompanyInfo) {
            lastCompanyInfo.status = WellKnownStatus.DELETED;
            lastCompanyInfo.updatedBy = auth.id;
            lastCompanyInfo.batchId = batchId;
            await companyWorkingInfoService.save(lastCompanyInfo, session);

            helperUtil.consoleLogMessage("info", `MONTH_AUDIT | Delete Company Working Info for Year: ${lastCompanyInfo.workingYear} | Month: ${lastCompanyInfo.workingMonth} | Deactivated By: ${auth?.id} | Correlation ID: ${correlationId}`);
        }

        const newCompanyInfo = new companyWorkingInfo({
            workingYear: year,
            workingMonth: month,
            workingDate: new Date(year, month - 1, 1),
            createdBy: auth.id,
            updatedBy: auth.id,
        });

        await companyWorkingInfoService.save(newCompanyInfo, session);
        helperUtil.consoleLogMessage("info", `MONTH_AUDIT | New Company Working Info Created: Year: ${year} | Month: ${month} | Created By: ${auth?.id} | Correlation ID: ${correlationId}`);

        // Crete mew monthly expenses
        const monthlyExpenses = new MonthlyExpenses({
            month: new Date(Date.UTC(year, month - 1, 1)),
            monthName: month,
            year: year,
            expenses: [],
            totalExpenses: 0,
            status: WellKnownStatus.ACTIVE,
            isMonthEndDone: false,
            batchId: 0,
            createdBy: auth.id,
            updatedBy: auth.id
        });


        await monthlyExpensesService.save(monthlyExpenses, session);
        helperUtil.consoleLogMessage("info", `MONTH_AUDIT | New Monthly Expenses Created for Year: ${year} | Month: ${month} | Created By: ${auth?.id} | Correlation ID: ${correlationId}`);

        const monthAuditNew = new monthAudit({
            newWorkingDate: new Date(year, month - 1, 1),
            batchId: batchId,
            createdBy: auth.id,
            updatedBy: auth.id,
        });

        createdMonth = await monthAuditService.save(monthAuditNew, session);
        helperUtil.consoleLogMessage("info", `MONTH_AUDIT | New Month Audit Created for Year: ${year} | Month: ${month} | Created By: ${auth?.id} | Correlation ID: ${correlationId}`);

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
    session: any,
    userId: string,
    batchId: number,
    correlationId: string
) => {
    const leaves: any[] =
        await leaveService.findAllIdsByMonthYearAndStatusIn(
            currYear,
            currMonth,
            [
                WellKnownLeaveStatus.APPROVED,
                WellKnownLeaveStatus.REJECTED,
                WellKnownLeaveStatus.PENDING,
                WellKnownLeaveStatus.CANCELLED,
            ]
        );

    await leaveService.markMonthEndDone(leaves.map((leave) => leave._id), userId, batchId, session);

    for (const leave of leaves) {
        helperUtil.consoleLogMessage("info", `MONTH_AUDIT | Leave Month End Done: Leave ID: ${leave._id} | Status: ${leave.status} | Month End Done By: ${userId} | Correlation ID: ${correlationId}`);
    }
};

const monthEndDoneForInternalTrip = async (
    currMonth: number,
    currYear: number,
    session: any,
    userId: string,
    batchId: number,
    correlationId: string
) => {
    const internalTrips: any[] =
        await internalTripService.findAllByEndMonthAndStatusIn(
            currMonth,
            currYear,
            [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]
        );

    await internalTripService.markMonthEndDone(internalTrips.map((internalTrip) => internalTrip._id), userId, batchId, session);

    for (const internalTrip of internalTrips) {
        helperUtil.consoleLogMessage("info", `MONTH_AUDIT | Internal Trip Month End Done: Internal Trip ID: ${internalTrip._id} | Month End Done By: ${userId} | Correlation ID: ${correlationId}`);
    }
};

const monthEndDoneForMonthlyExpenses = async (
    currMonth: number,
    currYear: number,
    session: any,
    userId: string,
    batchId: number,
    correlationId: string
) => {
    const monthlyExpenses: any[] = await monthlyExpensesService.findAllByEndMonthAndStatusIn(
        currMonth,
        currYear,
        [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]
    );

    await monthlyExpensesService.markMonthEndDone(monthlyExpenses.map((monthlyExpense) => monthlyExpense._id), userId, batchId, session);

    for (let monthlyExpense of monthlyExpenses) {
        helperUtil.consoleLogMessage("info", `MONTH_AUDIT | Monthly Expense Month End Done for Monthly Expense ID: ${monthlyExpense._id} | Month End Done By: ${userId} | Correlation ID: ${correlationId}`);
    }
};

const monthEndDoneForVehicleMaintenance = async (
    currMonth: number,
    currYear: number,
    session: any,
    userId: string,
    batchId: number,
    correlationId: string
) => {
    const vehicleMaintains: any[] = await vehicleMaintenanceService.findAllByEndMonthAndStatusIn(
        currMonth,
        currYear,
        [WellKnownStatus.ACTIVE,]
    );

    await vehicleMaintenanceService.markMonthEndDone(vehicleMaintains.map((vehicleMaintain) => vehicleMaintain._id), userId, batchId, session);

    for (let vehicleMaintain of vehicleMaintains) {
        helperUtil.consoleLogMessage("info", `MONTH_AUDIT | Vehicle Maintain Month End Done: Vehicle Maintain ID: ${vehicleMaintain._id} | Month End Done By: ${userId} | Correlation ID: ${correlationId}`);
    }
}

const monthEndDoneForTrip = async (
    currMonth: number,
    currYear: number,
    session: any,
    userId: string,
    batchId: number,
    correlationId: string
) => {
    const trips: any[] = await tripService.findAllIdsByEndMonthAndStatusIn(
        currMonth,
        currYear,
        [
            WellKnownTripStatus.PENDING,
            WellKnownTripStatus.START,
            WellKnownTripStatus.FINISHED,
            WellKnownTripStatus.CANCELED,
        ]
    );

    // expenses header and pos of the finished trips, found once instead of per trip
    const finishedTripIds: string[] = trips
        .filter((trip: any) => trip.status == WellKnownTripStatus.FINISHED)
        .map((trip: any) => trip._id.toString());
    const expenseHeaderIds = await expensesService.findAllIdsByTripIdsAndStatusIn(
        finishedTripIds,
        [WellKnownStatus.ACTIVE]
    );
    const posIds = await posService.findAllIdsByTripIdsAndStatusIn(
        finishedTripIds,
        [WellKnownStatus.ACTIVE]
    );

    // month end for expenses header, pos and trips
    await expensesService.markMonthEndDone(expenseHeaderIds, userId, batchId, session);
    await posService.markMonthEndDone(posIds, userId, batchId, session);
    await tripService.markMonthEndDone(trips.map((trip: any) => trip._id), userId, batchId, session);

    for (let trip of trips) {
        helperUtil.consoleLogMessage("info", `MONTH_AUDIT | Trip Month End Done: Trip ID: ${trip._id} | Status: ${trip.status} | Month End Done By: ${userId} | Correlation ID: ${correlationId}`);
    }
};

const getPendingLeaves = async (req: Request, res: Response) => {
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
        // users and leave totals are loaded once for all leaves instead of per leave
        const appliedUsers = await userService.findAllByIdsWithRole(
            superAdminLeaves
                .filter(
                    (leave: any) => leave.status == WellKnownLeaveStatus.PENDING
                )
                .map((leave: any) => leave.appliedUser._id)
        );

        const leavesWithUser: { leave: any; appliedUser: any }[] = [];
        for (const leave of superAdminLeaves) {
            if (leave.status == WellKnownLeaveStatus.PENDING) {
                const appliedUser: any = appliedUsers.get(
                    leave.appliedUser._id.toString()
                );

                if (
                    (appliedUser?.role?.id == constants.USER.ROLES.ADMIN ||
                        appliedUser?.role?.id ==
                        constants.USER.ROLES.TRIPMANAGER,
                        appliedUser?.role?.id ==
                        constants.USER.ROLES.FINANCEOFFICER)
                ) {
                    leavesWithUser.push({ leave, appliedUser });
                }
            }
        }

        const leaveTotals = await leaveService.getTotalLeaveDaysForUsers(
            leavesWithUser.map(({ appliedUser }) => appliedUser._id),
            activeCompanyInfo.workingYear
        );

        for (const { leave, appliedUser } of leavesWithUser) {
            leave.availableLeaveCount =
                appliedUser.leaveCount -
                (leaveTotals.get(appliedUser._id.toString()) as number);
        }
    }

    response = leaveUtil.leaveModelToLeaveResponseDtos(superAdminLeaves);

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

const getWorkingInformation = async (req: Request, res: Response) => {
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

    let trips = await tripService.findAllByEndMonthAndStatusIn(
        activeCompanyInfo.workingMonth,
        activeCompanyInfo.workingYear,
        [
            WellKnownTripStatus.PENDING,
            WellKnownTripStatus.START,
            WellKnownTripStatus.FINISHED,
        ]
    );

    await expensesService.applyDriverSalaryDone(trips);

    trips = trips.filter((trip: any) => {
        return trip.isDriverSalaryDone == false;
    });

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
