import { Request, Response } from 'express';
import constants from '../../constant';
import CommonResponse from '../../util/commonResponse';
import { StatusCodes } from 'http-status-codes';
import notificationService from './notification.service';
import ExpensesExtensionResponseDto from './dto/expensesExtensionResponseDto';
import notificationUtil from './notification.util';

const getAllNotifications = async (req: Request, res: Response) => {
    const auth = req.auth;
    let response: any = [];

    if (auth.role === constants.USER.ROLES.SUPERADMIN) {
        response = [
            ...response,
            ...(await getPendingExpenseExtensionRequests()),
            ...(await getVehicleRenewalRequests()),
            ...(await getPendingAndDriverVehicleNotAssignedTrips()),
            ...(await getPendingLeaves()),
        ];
    } else if (auth.role === constants.USER.ROLES.ADMIN) {
        response = [
            ...response,
            ...(await getPendingExpenseExtensionRequests()),
            ...(await getVehicleRenewalRequests()),
            ...(await getPendingAndDriverVehicleNotAssignedTrips()),
            ...(await getPendingLeaves()),
        ];
    } else if (auth.role === constants.USER.ROLES.DRIVER) {
    } else if (auth.role === constants.USER.ROLES.FINANCEOFFICER) {
        response = [
            ...response,
            ...(await getPendingExpenseExtensionRequests()),
            ...(await getVehicleRenewalRequests()),
            ...(await getPendingAndDriverVehicleNotAssignedTrips()),
            ...(await getPendingLeaves()),
        ];
    } else if (auth.role === constants.USER.ROLES.TRIPMANAGER) {
        response = [
            ...response,
            ...(await getPendingExpenseExtensionRequests()),
            ...(await getVehicleRenewalRequests()),
            ...(await getPendingAndDriverVehicleNotAssignedTrips()),
            ...(await getPendingLeaves()),
        ];
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
