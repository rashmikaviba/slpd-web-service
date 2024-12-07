import Trip from "../trip/trip.model"
import Expenses from "../expenses/expenses.model";
import { WellKnownStatus } from "../../util/enums/well-known-status.enum";

const findAllTripsByDateAndStatusIn = async (date: Date, status: number[]) => {
    let monthStartDate = new Date(date.getFullYear(), date.getMonth(), 1);
    let monthEndDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);

    return await Trip.find({ endDate: { $gte: monthStartDate, $lt: monthEndDate }, status: { $in: status } }).lean();
}

const findAllExpensesByTripIds = async (tripIds: string[]) => {
    return await Expenses.find({ tripId: { $in: tripIds }, 'expenses.status': WellKnownStatus.ACTIVE, })
        .populate('tripId')
        .populate({
            path: 'expenses.createdBy expenses.updatedBy',
            model: 'User',
            select: 'fullName userName',
        })
        .lean();
}

const findAllDriverSalaryByTripIds = async (tripIds: string[]) => {
    return await Expenses.find({ tripId: { $in: tripIds }, driverSalary: { $ne: null } })
        .populate({
            path: 'tripId',
            populate: {
                path: 'drivers.driver',
                model: 'User',
                select: 'fullName userName', // Include only the required fields
                match: { 'drivers.isActive': true },
            },
        })
        .populate({
            path: 'driverSalary.createdBy driverSalary.updatedBy',
            model: 'User',
            select: 'fullName userName',
        })
        .select('tripId driverSalary')
        .lean();
}

export default {
    findAllTripsByDateAndStatusIn,
    findAllExpensesByTripIds,
    findAllDriverSalaryByTripIds
}