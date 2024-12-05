import { Request, Response } from "express";
import reportService from "./report.service";
import { WellKnownTripStatus } from "../../util/enums/well-known-trip-status.enum";
import expensesService from "../expenses/expenses.service";
import { WellKnownStatus } from "../../util/enums/well-known-status.enum";
import TripExpensesResponseDto from "../expenses/dto/tripExpensesResponseDto";
import expensesUtil from "../expenses/expenses.util";
import CommonResponse from "../../util/commonResponse";
import { StatusCodes } from "http-status-codes";
import ExpensesReportResponseDto from "./dto/expensesReportResponseDto";
import reportUtil from "./report.util";
import { DriverSalaryReportResponseDto } from "./dto/driverSalaryReportResponseDto";

// Monthly Trip report - Full trip report
const monthlyTripReport = async (req: Request, res: Response) => {
    const date = req.query.date as string;

    try {
        let selectedDate = date ? new Date(date) : new Date();
        let trips: any[] = await reportService.findAllTripsByDateAndStatusIn(selectedDate, [WellKnownTripStatus.PENDING, WellKnownTripStatus.START, WellKnownTripStatus.FINISHED]);


        if (trips.length > 0) {
            for (let trip of trips) {
                //  get expense by trip id and status active
                let expense: any = await expensesService.findByTripIdAndStatusIn(
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
                    expense.tripExpensesAmount = expense?.tripId?.estimatedExpense;
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
        let trips: any[] = await reportService.findAllTripsByDateAndStatusIn(selectedDate, [WellKnownTripStatus.PENDING, WellKnownTripStatus.START, WellKnownTripStatus.FINISHED]);
        let response: ExpensesReportResponseDto[] = []
        if (trips.length > 0) {
            let tripIds = trips.map((trip: any) => trip._id.toString());

            const expensesData: any = await reportService.findAllExpensesByTripIds(tripIds);

            response = reportUtil.expensesModelsToExpensesReportResponseDtos(expensesData);
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
        let trips: any[] = await reportService.findAllTripsByDateAndStatusIn(selectedDate, [WellKnownTripStatus.FINISHED]);
        let response: DriverSalaryReportResponseDto[] = []
        if (trips.length > 0) {
            let tripIds = trips.map((trip: any) => trip._id.toString());

            const driverSalaries: any = await reportService.findAllDriverSalaryByTripIds(tripIds);

            response = reportUtil.driverModelsToDriverSalaryReportResponseDtos(driverSalaries);
        }

        CommonResponse(res, true, StatusCodes.OK, '', response);
    } catch (error) {
        throw error;
    }
};

// Monthly Income report
const monthlyIncomeReport = async (req: Request, res: Response) => { };

export {
    monthlyTripReport,
    monthlyExpensesReport,
    monthlyDriverSalary,
    monthlyIncomeReport
}