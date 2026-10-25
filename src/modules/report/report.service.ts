import Trip from '../trip/trip.model';
import Expenses from '../expenses/expenses.model';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import MonthlyExpenses from '../monthlyExpenses/monthlyExpenses.model';
import vehicleMaintenanceModel from '../vehicleMaintain/vehicleMaintenance.model';

const findAllTripsByDateAndStatusIn = async (date: Date, status: number[]) => {
    let monthStartDate = new Date(date.getFullYear(), date.getMonth(), 1);
    let monthEndDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);

    return await Trip.find({
        endDate: { $gte: monthStartDate, $lt: monthEndDate },
        status: { $in: status },
    }).lean();
};

const findAllExpensesByTripIds = async (tripIds: string[]) => {
    const expenses = await Expenses.find({ tripId: { $in: tripIds } })
        .populate({
            path: 'tripId',
            select: '_id tripConfirmedNumber startDate endDate totalCost totalCostLocalCurrency estimatedExpense',
        })
        .populate({
            path: 'expenses.createdBy expenses.updatedBy',
            model: 'User',
            select: 'fullName userName',
        })
        .lean();

    expenses.forEach((expenseDoc: any) => {
        expenseDoc.expenses = expenseDoc.expenses.filter(
            (exp: any) => exp.status === WellKnownStatus.ACTIVE
        );
    });

    return expenses;
};

const findMonthlyExpensesByMonth = async (date: Date) => {
    let monthStartDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1))

    let monthlyExpenses = await MonthlyExpenses.findOne({
        month: monthStartDate,
    }).populate({
        path: 'expenses.createdBy',
        model: 'User',
        select: 'fullName userName',
    }).lean();

    return monthlyExpenses?.expenses.filter((exp: any) => exp.status === WellKnownStatus.ACTIVE) || [];
};

const findAllDriverSalaryByTripIds = async (tripIds: string[]) => {
    return await Expenses.find({
        tripId: { $in: tripIds },
        driverSalaries: { $ne: [] },
    })
        .populate({
            path: 'driverSalaries',
            populate: {
                path: '_id createdBy updatedBy driver',
                model: 'User',
                select: 'fullName userName',
            },
        })
        .populate({ path: 'tripId', select: '_id tripConfirmedNumber' })
        .select('tripId driverSalaries')
        .lean();
};

const findVehicleMaintenanceByDateAndStatusIn = async (date: Date, status: number[]) => {
    let monthStartDate = new Date(date.getFullYear(), date.getMonth(), 1);
    let monthEndDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);

    return await vehicleMaintenanceModel.find({
        maintenanceDate: { $gte: monthStartDate, $lt: monthEndDate },
        status: { $in: status },
    }).populate({ path: 'vehicle', select: '_id registrationNumber isRentalVehicle isFreelanceVehicle' })
        .populate({ path: 'garage', select: '_id name' })
        .populate({ path: 'createdBy updatedBy', select: '_id userName fullName' })
        .lean();
};

const findVehicleMaintenanceByDateAndStatusInAndVehicle = async (date: Date, status: number[], vehicleId: string) => {
    let monthStartDate = new Date(date.getFullYear(), date.getMonth(), 1);
    let monthEndDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);

    return await vehicleMaintenanceModel.find({
        maintenanceDate: { $gte: monthStartDate, $lt: monthEndDate },
        status: { $in: status },
        vehicle: vehicleId
    }).populate('vehicle garage createdBy updatedBy').lean();
};


export default {
    findAllTripsByDateAndStatusIn,
    findAllExpensesByTripIds,
    findAllDriverSalaryByTripIds,
    findMonthlyExpensesByMonth,
    findVehicleMaintenanceByDateAndStatusIn,
    findVehicleMaintenanceByDateAndStatusInAndVehicle
};
