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

        CommonResponse(res, true, StatusCodes.OK, '', response);
    } catch (error) {
        throw error;
    }
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
    if (expense.driverSalaries) {
        let driverTotalSalary = expense.driverSalaries.reduce(
            (total: number, exp: any) => total + exp.totalSalary,
            0
        );
        totalIncome = totalIncome - driverTotalSalary;
        data.totalDriverSalary = driverTotalSalary;
    } else {
        totalIncome = totalIncome - totalExpensesAmount;
    }
    data.totalIncome = totalIncome;
    return data;
};

export {
    monthlyTripReport,
    monthlyExpensesReport,
    monthlyDriverSalary,
    monthlyIncomeReport,
};
