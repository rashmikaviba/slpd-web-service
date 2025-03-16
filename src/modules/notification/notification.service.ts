import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import { ExpenseRequest } from '../expenseRequest/expenseRequest.model';
import Leave from '../leave/leave.model';
import Trip from '../trip/trip.model';
import Vehicle from '../vehicle/vehicle.model';

const getPendingExpenseRequest = async () => {
    return await ExpenseRequest.find({
        status: WellKnownLeaveStatus.PENDING,
    }).populate('tripId createdBy');
};

const findVehicleRenewalBy7DaysBefore = async () => {
    let result: any[] = [];
    let date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(0, 0, 0, 0);

    const vehicles = await Vehicle.find({
        $or: [
            { insuranceRenewalDate: { $lte: date } },
            { licenseRenewalDate: { $lte: date } },
        ],
        isFreelanceVehicle: false,
        status: { $ne: WellKnownStatus.DELETED },
    }).lean();

    if (vehicles.length > 0) {
        vehicles.forEach((vehicle: any) => {
            if (vehicle.insuranceRenewalDate <= date) {
                result.push({
                    ...vehicle,
                    insuranceRenewalFlag: true,
                });
            }

            if (vehicle.licenseRenewalDate <= date) {
                result.push({
                    ...vehicle,
                    licenseRenewalFlag: true,
                });
            }
        });
    }

    return result;
};

const findTripsBy3DaysBefore = async () => {
    let date = new Date();
    date.setDate(date.getDate() + 3);
    date.setHours(0, 0, 0, 0); // Set time to midnight

    let today = new Date();
    today.setHours(0, 0, 0, 0);

    const trips = await Trip.find({
        startDate: { $lte: date },
        endDate: { $gte: today },
        $or: [
            { drivers: { $exists: true, $eq: [] } }, // No drivers assigned
            { 'drivers.isActive': false }, // Drivers are not active
            { vehicles: { $exists: true, $eq: [] } }, // No vehicles assigned
            { 'vehicles.isActive': false }, // Vehicles are not active
        ],
        status: WellKnownTripStatus.PENDING,
    }).lean();

    return trips || [];
};

const findPendingLeaveBy3DaysBefore = async () => {
    let date = new Date();
    date.setDate(date.getDate() + 3);
    date.setHours(0, 0, 0, 0); // Set time to midnight

    let today = new Date();
    today.setHours(0, 0, 0, 0);

    const leaves = await Leave.find({
        startDate: { $lte: date },
        endDate: { $gte: today },
        status: WellKnownLeaveStatus.PENDING,
    })
        .populate('appliedUser')
        .lean();

    return leaves || [];
};

export default {
    getPendingExpenseRequest,
    findVehicleRenewalBy7DaysBefore,
    findTripsBy3DaysBefore,
    findPendingLeaveBy3DaysBefore,
};
