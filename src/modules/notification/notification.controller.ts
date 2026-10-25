import { Request, Response } from 'express';
import constants from '../../constant';
import CommonResponse from '../../util/commonResponse';
import { StatusCodes } from 'http-status-codes';
import notificationService from './notification.service';
import notificationUtil from './notification.util';

const getAllNotifications = async (req: Request, res: Response) => {
    const auth = req.auth;
    let response: any = [];

    if (
        auth.role === constants.USER.ROLES.SUPERADMIN ||
        auth.role === constants.USER.ROLES.ADMIN ||
        auth.role === constants.USER.ROLES.FINANCEOFFICER ||
        auth.role === constants.USER.ROLES.TRIPMANAGER
    ) {
        // the four lookups are independent: run them together, keep the same order
        const [expenseRequests, vehicleRenewals, trips, leaves] = await Promise.all([
            getPendingExpenseExtensionRequests(),
            getVehicleRenewalRequests(),
            getPendingAndDriverVehicleNotAssignedTrips(),
            getPendingLeaves(),
        ]);

        response = [...response, ...expenseRequests, ...vehicleRenewals, ...trips, ...leaves];
    }

    response.sort((a: any, b: any) => {
        return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    });

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

const getPendingExpenseExtensionRequests = async () => {
    const pendingExpenseExtensionRequests =
        await notificationService.getPendingExpenseRequest();

    return notificationUtil.modelsToExpensesExtensionResponseDto(
        pendingExpenseExtensionRequests
    );
};

const getVehicleRenewalRequests = async () => {
    const pendingVehicleRenewalRequests =
        await notificationService.findVehicleRenewalBy7DaysBefore();

    return notificationUtil.modelsToInsuranceInsuranceRenewalResponseDtos(
        pendingVehicleRenewalRequests
    );
};

const getPendingAndDriverVehicleNotAssignedTrips = async () => {
    const result = await notificationService.findTripsBy3DaysBefore();

    return notificationUtil.modelsToPendingTripResponseDtos(result);
};

const getPendingLeaves = async () => {
    const result = await notificationService.findPendingLeaveBy3DaysBefore();

    return notificationUtil.modelsToPendingLeaveResponseDtos(result);
};

export { getAllNotifications };
