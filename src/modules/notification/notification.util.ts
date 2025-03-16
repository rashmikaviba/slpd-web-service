import { WellKnownNotificationType } from '../../util/enums/well-known-notification-type.enum';
import ExpensesExtensionResponseDto from './dto/expensesExtensionResponseDto';
import InsuranceInsuranceRenewalResponseDto from './dto/InsuranceInsuranceRenewalResponseDto';
import PendingLeaveResponseDto from './dto/PendingleaveResponseDto';
import PendingTripResponseDto from './dto/pendingTripResponseDto';

const modelToExpensesExtensionResponseDto = (
    expenseRequest: any
): ExpensesExtensionResponseDto => {
    return {
        _id: expenseRequest._id,
        tripId: expenseRequest?.tripId?._id || '',
        type: WellKnownNotificationType.ExpenseExtensionRequest,
        typeName: 'Expense Extension Request',
        description: expenseRequest?.description || '',
        requestedAmount: expenseRequest?.requestedAmount || 0,
        requestedUserId: expenseRequest?.createdBy?._id || '',
        requestedUserName:
            expenseRequest?.createdBy?.fullName +
                ' ' +
                `(${expenseRequest?.createdBy?.userName})` || '',
        tripConfirmedNumber: expenseRequest?.tripId?.tripConfirmedNumber,
        createdAt: expenseRequest?.createdAt,
    };
};

const modelsToExpensesExtensionResponseDto = (
    expenseRequests: any[]
): ExpensesExtensionResponseDto[] => {
    return expenseRequests.map((expenseRequest) =>
        modelToExpensesExtensionResponseDto(expenseRequest)
    );
};

const modelToInsuranceInsuranceRenewalResponseDto = (
    notificationData: any
): InsuranceInsuranceRenewalResponseDto => {
    return {
        _id: notificationData._id,
        type: notificationData?.insuranceRenewalFlag
            ? WellKnownNotificationType.VehicleInsuranceRenewal
            : notificationData?.licenseRenewalFlag
            ? WellKnownNotificationType.VehicleLicenseRenewal
            : 0,
        expiryDate: notificationData?.insuranceRenewalFlag
            ? notificationData?.insuranceRenewalDate
            : notificationData?.licenseRenewalFlag
            ? notificationData?.licenseRenewalDate
            : new Date(),
        typeName: notificationData?.insuranceRenewalFlag
            ? 'Insurance Renewal'
            : notificationData?.licenseRenewalFlag
            ? 'License Renewal'
            : '',
        vehicleName: notificationData?.registrationNumber || '',
        createdAt: notificationData?.insuranceRenewalFlag
            ? setMidnightDate(notificationData?.insuranceRenewalDate, 7)
            : notificationData?.licenseRenewalFlag
            ? setMidnightDate(notificationData?.licenseRenewalDate, 7)
            : new Date(new Date().setHours(0, 0, 0, 0)),
        description: '',
    };
};

const modelsToInsuranceInsuranceRenewalResponseDtos = (
    notifications: any[]
): InsuranceInsuranceRenewalResponseDto[] => {
    return notifications.map((notification) =>
        modelToInsuranceInsuranceRenewalResponseDto(notification)
    );
};

const modelToPendingTripResponseDto = (trip: any): PendingTripResponseDto => {
    return {
        _id: trip._id,
        type: WellKnownNotificationType.PendingTrip,
        tripConfirmedNumber: trip?.tripConfirmedNumber,
        typeName: 'Driver and Vehicle assign',
        description: '',
        startDate: trip.startDate, // trip start date
        createdAt: setMidnightDate(trip.startDate, 3),
    };
};

const modelsToPendingTripResponseDtos = (
    trips: any[]
): PendingTripResponseDto[] => {
    return trips.map((trip) => modelToPendingTripResponseDto(trip));
};

const modelToPendingLeaveResponseDto = (
    leave: any
): PendingLeaveResponseDto => {
    return {
        _id: leave._id, // leave request id
        type: WellKnownNotificationType.PendingLeave,
        appliedBy: leave.appliedUser.fullName || '',
        typeName: 'Approve or Reject Leave',
        description: '',
        startDate: leave.startDate,
        createdAt: setMidnightDate(leave.startDate, 3),
    };
};

const modelsToPendingLeaveResponseDtos = (
    leaves: any[]
): PendingLeaveResponseDto[] => {
    return leaves.map((leave) => modelToPendingLeaveResponseDto(leave));
};

const setMidnightDate = (date: any, beforeDateCount: number): Date => {
    let d = new Date(date);
    d.setDate(d.getDate() - beforeDateCount);
    d.setHours(0, 0, 0, 0);
    return d;
};

export default {
    modelToExpensesExtensionResponseDto,
    modelsToExpensesExtensionResponseDto,
    modelToInsuranceInsuranceRenewalResponseDto,
    modelsToInsuranceInsuranceRenewalResponseDtos,
    modelToPendingTripResponseDto,
    modelsToPendingTripResponseDtos,
    modelToPendingLeaveResponseDto,
    modelsToPendingLeaveResponseDtos,
};
