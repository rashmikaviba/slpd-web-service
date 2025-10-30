import { Request, Response } from 'express';
import reportService from './report.service';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import expensesService from '../expenses/expenses.service';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import TripExpensesResponseDto from '../expenses/dto/tripExpensesResponseDto';
import expensesUtil from '../expenses/expenses.util';
import CommonResponse from '../../util/commonResponse';
import { StatusCodes } from 'http-status-codes';
import ExpensesReportResponseDto from './dto/expensesReportResponseDto';
import reportUtil from './report.util';
import { DriverSalaryReportResponseDto } from './dto/driverSalaryReportResponseDto';
import MonthlyIncomeReportResponseDto from './dto/monthlyIncomeReportResponseDto';
import reportValidation from './report.validation';
import BadRequestError from '../../error/BadRequestError';
import vehicleService from '../vehicle/vehicle.service';
import { date } from 'joi';

// Monthly Trip report - Full trip report
const monthlyTripReport = async (req: Request, res: Response) => {
    const date = req.query.date as string;

    try {
        let selectedDate = date ? new Date(date) : new Date();
        let trips: any[] = await reportService.findAllTripsByDateAndStatusIn(
            selectedDate,
            [
                WellKnownTripStatus.PENDING,
                WellKnownTripStatus.START,
                WellKnownTripStatus.FINISHED,
            ]
        );

        if (trips.length > 0) {
            for (let trip of trips) {
                //  get expense by trip id and status active
                let expense: any =
                    await expensesService.findByTripIdAndStatusIn(
                        trip._id.toString(),
                        [WellKnownStatus.ACTIVE]
                    );

                let response: TripExpensesResponseDto | null = null;

                if (expense) {
                    // get only active expenses
                    let activeExpenses = expense.expenses.filter(
                        (exp: any) => exp.status === WellKnownStatus.ACTIVE
                    );

                    let totalExpensesAmount = activeExpenses.reduce(
                        (total: number, exp: any) => total + exp.amount,
                        0
                    );

                    expense.expenses = activeExpenses;
                    expense.tripExpensesAmount =
                        expense?.tripId?.estimatedExpense;
                    expense.totalTripExpensesAmount = totalExpensesAmount;
                    expense.remainingTripExpensesAmount =
                        expense?.tripExpensesAmount - totalExpensesAmount;

                    response =
                        expensesUtil.ExpensesModelToTripExpensesResponseDto(
                            expense
                        );
                }

                trip.expenses = response;
            }
        }

        CommonResponse(res, true, StatusCodes.OK, '', trips);
    } catch (error) {
        throw error;
    }
};

// Monthly expenses report
const monthlyExpensesReport = async (req: Request, res: Response) => {
    const date = req.query.date as string;

    try {
        let selectedDate = date ? new Date(date) : new Date();
        let trips: any[] = await reportService.findAllTripsByDateAndStatusIn(
            selectedDate,
            [
                WellKnownTripStatus.PENDING,
                WellKnownTripStatus.START,
                WellKnownTripStatus.FINISHED,
            ]
        );

        let monthlyExpenses: any[] = await reportService.findMonthlyExpensesByMonth(
            selectedDate,
        ) || [];

        let response: ExpensesReportResponseDto[] = [];
        if (trips.length > 0) {
            let tripIds = trips.map((trip: any) => trip._id.toString());

            const expensesData: any =
                await reportService.findAllExpensesByTripIds(tripIds);

            response =
                reportUtil.expensesModelsToExpensesReportResponseDtos(
                    expensesData
                );
        }

        if (monthlyExpenses.length > 0) {
            response = response.concat(
                reportUtil.monthlyExpenseModelsToExpensesReportResponseDto(
                    monthlyExpenses
                )
            );
        }

        response = response.concat(await vehicleMaintenanceForMonthlyExpense(selectedDate));

        CommonResponse(res, true, StatusCodes.OK, '', response);
    } catch (error) {
        throw error;
    }
};

const vehicleMaintenanceForMonthlyExpense = async (selectedDate: Date): Promise<ExpensesReportResponseDto[]> => {
    let response: ExpensesReportResponseDto[] = [];

    let vehicleMaintenances: any[] = await reportService.findVehicleMaintenanceByDateAndStatusIn(selectedDate, [WellKnownStatus.ACTIVE]);

    if (vehicleMaintenances && vehicleMaintenances.length > 0) {
        for (const vehicleMaintenance of vehicleMaintenances) {
            if (vehicleMaintenance.vehicle == null) continue;
            if (vehicleMaintenance.garage == null) continue;
            if (vehicleMaintenance.vehicle.isFreelanceVehicle) continue;
            if (vehicleMaintenance.vehicle.isRentalVehicle && vehicleMaintenance.cost > 5000) continue;

            let typeName = "Company Vehicle Maintenance";
            let description = "";

            if (vehicleMaintenance.vehicle.isRentalVehicle) {
                typeName = "Rental Vehicle Maintenance";
            }

            description = `Vehicle : ${vehicleMaintenance?.vehicle?.registrationNumber}, Garage Name : ${vehicleMaintenance.garage.name}, Maintenance Part : ${vehicleMaintenance?.maintenancePart}`;

            // if (vehicleMaintenance.note) {
            //     description += `, Note : ${vehicleMaintenance?.note}`;
            // }

            const expenseObj: ExpensesReportResponseDto = {
                tripId: "",
                confirmationNumber: "",
                expenseId: vehicleMaintenance._id,
                typeId: 0,
                typeName: typeName,
                description: description,
                amount: vehicleMaintenance.cost,
                date: vehicleMaintenance?.maintenanceDate,
                createdDate: vehicleMaintenance?.createdAt,
                createdUser: `${vehicleMaintenance?.createdBy?.userName} (${vehicleMaintenance?.createdBy?.fullName})`,
                updatedDate: vehicleMaintenance?.updatedAt,
                updatedUser: `${vehicleMaintenance?.updatedBy?.userName} (${vehicleMaintenance?.updatedBy?.fullName})`,
            };

            response.push(expenseObj);
        }
    }


    return response;
};


// Monthly driver salary
const monthlyDriverSalary = async (req: Request, res: Response) => {
    const date = req.query.date as string;

    try {
        let selectedDate = date ? new Date(date) : new Date();
        let trips: any[] = await reportService.findAllTripsByDateAndStatusIn(
            selectedDate,
            [WellKnownTripStatus.FINISHED]
        );
        let response: DriverSalaryReportResponseDto[] = [];
        if (trips.length > 0) {
            let tripIds = trips.map((trip: any) => trip._id.toString());

            const driverSalaries: any =
                await reportService.findAllDriverSalaryByTripIds(tripIds);

            response =
                reportUtil.driverModelsToDriverSalaryReportResponseDtos(
                    driverSalaries
                );
        }

        CommonResponse(res, true, StatusCodes.OK, '', response);
    } catch (error) {
        throw error;
    }
};

// Monthly Income report
const monthlyIncomeReport = async (req: Request, res: Response) => {
    const date = req.query.date as string;

    try {
        let selectedDate = date ? new Date(date) : new Date();
        let trips: any[] = await reportService.findAllTripsByDateAndStatusIn(
            selectedDate,
            [WellKnownTripStatus.FINISHED, WellKnownTripStatus.START]
        );
        let response: MonthlyIncomeReportResponseDto[] = [];
        if (trips.length > 0) {
            let tripIds = trips.map((trip: any) => trip._id.toString());

            const expenses: any = await reportService.findAllExpensesByTripIds(
                tripIds
            );

            if (expenses.length > 0) {
                for (let expense of expenses) {
                    let calcTotals: any = await calculateIncome(expense);

                    let data: any = {
                        tripId: expense?.tripId?._id,
                        confirmationNumber:
                            expense?.tripId?.tripConfirmedNumber,
                        startDate: expense?.tripId?.startDate,
                        endDate: expense?.tripId?.endDate,
                        expenseId: expense?._id,
                        totalCost: expense?.tripId?.totalCost || 0,
                        totalCostLocalCurrency:
                            expense?.tripId?.totalCostLocalCurrency || 0,
                        totalIncomeLocalCurrency:
                            calcTotals.totalIncomeLocalCurrency,
                        estimatedExpense: expense?.tripId?.estimatedExpense,
                        remainingExpenses: calcTotals?.remainingExpenses,
                        totalExpense: calcTotals?.totalExpensesAmount,
                        totalDriverSalary: calcTotals?.totalDriverSalary,
                        isRemainingToDriver: expense?.driverSalaries.find(
                            (driver: any) =>
                                driver?.isRemainingToDriver === true
                        )
                            ? true
                            : false,
                        // expense?.driverSalary?.isRemainingToDriver === true
                        //     ? true
                        //     : false,
                        tripIncome: calcTotals?.totalIncome,
                    };

                    response.push(data);
                }
            }
        }

        CommonResponse(res, true, StatusCodes.OK, '', response);
    } catch (error) {
        throw error;
    }
};

const calculateIncome = async (expense: any) => {
    let data = {
        totalExpensesAmount: 0,
        totalDriverSalary: 0,
        totalIncome: 0,
        remainingExpenses: 0,
    };
    // calculate expense amount
    let activeExpenses = expense.expenses.filter(
        (exp: any) => exp.status === WellKnownStatus.ACTIVE
    );

    let totalExpensesAmount = activeExpenses.reduce(
        (total: number, exp: any) => total + exp.amount,
        0
    );

    let remainingExpenses =
        expense?.tripId?.estimatedExpense - totalExpensesAmount;

    data.totalExpensesAmount = totalExpensesAmount;
    data.remainingExpenses = remainingExpenses;

    // calculate driver salary
    // calculate total income
    let totalIncome = expense?.tripId?.totalCostLocalCurrency || 0;
    if (expense.driverSalaries.length > 0) {
        let driverTotalSalary = expense.driverSalaries.reduce(
            (total: number, exp: any) => total + exp.totalSalary,
            0
        );
        totalIncome = totalIncome - driverTotalSalary;
        data.totalDriverSalary = driverTotalSalary;
    }

    totalIncome = totalIncome - totalExpensesAmount;

    data.totalIncome = totalIncome;
    return data;
};

const vehicleMonthlyPaymentMaintance = async (req: Request, res: Response) => {
    try {
        const {
            month,
            vehicle,
            rentalFor30Days,
            workedDaysCount,
        } = req.body;
        const auth = req.auth;

        // Validate request body
        const { error } = reportValidation.vehicleMonthlyPaymentMaintanceSchema.validate(req.body);
        if (error) {
            throw new BadRequestError(error.message);
        }

        let vehicleData = await vehicleService.findByIdAndStatusIn(vehicle, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

        if (!vehicleData) {
            throw new BadRequestError('Invalid vehicle!');
        }

        if (!vehicleData.isFreelanceVehicle && !vehicleData.isRentalVehicle) {
            throw new BadRequestError('This vehicle is not freelance or rental vehicle!');
        }
        let selectedDate = month ? new Date(month) : new Date();

        let vehicleMaintenanceData = await reportService.findVehicleMaintenanceByDateAndStatusInAndVehicle(selectedDate, [WellKnownStatus.ACTIVE], vehicle);

        CommonResponse(res, true, StatusCodes.OK, '', vehiclePaymentReportResponse(vehicleMaintenanceData, vehicleData, rentalFor30Days, workedDaysCount, selectedDate));
    } catch (error) {
        throw error;
    }
};

const vehiclePaymentReportResponse = (vehicleMaintenanceData: any, vehicleData: any, rentalFor30Days: number, workedDaysCount: number, selectedDate: Date) => {
    let valuePerDay = rentalFor30Days / 30;
    let totalVehicleMaintenance = 0;
    let effectiveMaintenanceCost = 0;

    for (let vehicleMaintenance of vehicleMaintenanceData) {
        totalVehicleMaintenance += vehicleMaintenance.cost;

        if (vehicleData.isFreelanceVehicle) {
            effectiveMaintenanceCost += vehicleMaintenance.cost;
        } else if (vehicleData.isRentalVehicle && vehicleMaintenance.cost > 5000) {
            effectiveMaintenanceCost += vehicleMaintenance.cost;
        }
    }

    let response = {
        vehicleMaintenances: vehicleMaintenanceData,
        vehicle: vehicleData,
        rentalFor30Days,
        workedDaysCount,
        valuePerDay,
        totalVehicleMaintenance,
        effectiveMaintenanceCost,
        netTotal: valuePerDay * workedDaysCount,
        grossTotal: (valuePerDay * workedDaysCount) - effectiveMaintenanceCost,
        selectedDate
    };

    return response;
};


export {
    monthlyTripReport,
    monthlyExpensesReport,
    monthlyDriverSalary,
    monthlyIncomeReport,
    vehicleMonthlyPaymentMaintance
};
