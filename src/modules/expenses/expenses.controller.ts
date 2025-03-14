import { Request, Response } from 'express';
import BadRequestError from '../../error/BadRequestError';
import expensesValidation from './expenses.validation';
import tripService from '../trip/trip.service';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import expensesService from './expenses.service';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import Expenses from './expenses.model';
import { StatusCodes } from 'http-status-codes';
import CommonResponse from '../../util/commonResponse';
import TripExpensesResponseDto from './dto/tripExpensesResponseDto';
import expensesUtils from './expenses.util';

const saveExpense = async (req: Request, res: Response) => {
    const tripId: any = req.params.tripId;
    const body: any = req.body;
    const auth: any = req.auth;

    const { error } = expensesValidation.saveExpenseSchema.validate(body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    try {
        // check trip expanses available
        const trip: any = await tripService.findByIdAndStatusIn(tripId, [
            WellKnownTripStatus.START,
        ]);

        if (!trip) {
            throw new BadRequestError(
                'No trip found or trip not in started status!'
            );
        }

        let expense: any = await expensesService.findByTripIdAndStatusIn(
            tripId,
            [WellKnownStatus.ACTIVE]
        );

        if (!expense) {
            expense = new Expenses();
            expense.tripId = tripId;
            expense.expenses = [];
            expense.createdBy = auth.id;
            expense.updatedBy = auth.id;
            expense.driverSalary = null;

            await expensesService.save(expense, null);
        } else if (expense?.isMonthEndDone) {
            throw new BadRequestError(
                'Cannot add new expense after month end!'
            );
        }

        // save expense
        let newExpense: any = {
            typeId: body.typeId,
            typeName: body.typeName,
            amount: body.amount,
            description: body.description,
            date: body.date,
            receiptUrl: body.receiptUrl,
            status: WellKnownStatus.ACTIVE,
            createdBy: auth.id,
            updatedBy: auth.id,
        };

        expense.expenses.push(newExpense);

        await expensesService.save(expense, null);

        CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Expense saved successfully!',
            null
        );
    } catch (error) {
        throw error;
    }
};

const updateExpense = async (req: Request, res: Response) => {
    const tripId: any = req.params.tripId;
    const expenseId: any = req.params.expenseId;
    const body: any = req.body;
    const auth: any = req.auth;

    const { error } = expensesValidation.updateExpenseSchema.validate(body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    try {
        // check trip expanses available
        const trip: any = await tripService.findByIdAndStatusIn(tripId, [
            WellKnownTripStatus.START,
        ]);

        if (!trip) {
            throw new BadRequestError(
                'No trip found or trip not in started status!'
            );
        }

        let expense: any = await expensesService.findByTripIdAndStatusIn(
            tripId,
            [WellKnownStatus.ACTIVE]
        );

        if (!expense) {
            throw new BadRequestError('No expense header found for this trip!');
        } else if (expense?.isMonthEndDone) {
            throw new BadRequestError('Cannot update expense after month end!');
        }

        // find expense by id and update
        let updatedExpense: any = expense.expenses.find(
            (exp: any) => exp.id === expenseId
        );

        if (!updatedExpense) {
            throw new BadRequestError('Expense not found!');
        }

        updatedExpense.typeId = body.typeId;
        updatedExpense.typeName = body.typeName;
        updatedExpense.amount = body.amount;
        updatedExpense.description = body.description;
        updatedExpense.date = body.date;
        updatedExpense.receiptUrl = body.receiptUrl;
        updatedExpense.updatedBy = auth.id;
        updatedExpense.updatedAt = new Date();

        await expensesService.save(expense, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Expense updated successfully!',
            null
        );
    } catch (error) {
        throw error;
    }
};

const deleteExpense = async (req: Request, res: Response) => {
    const tripId: any = req.params.tripId;
    const expenseId: any = req.params.expenseId;
    const auth: any = req.auth;

    try {
        // check trip expanses available
        const trip: any = await tripService.findByIdAndStatusIn(tripId, [
            WellKnownTripStatus.START,
        ]);

        if (!trip) {
            throw new BadRequestError(
                'No trip found or trip not in started status!'
            );
        }

        let expense: any = await expensesService.findByTripIdAndStatusIn(
            tripId,
            [WellKnownStatus.ACTIVE]
        );

        if (!expense) {
            throw new BadRequestError('No expense header found for this trip!');
        } else if (expense?.isMonthEndDone) {
            throw new BadRequestError('Cannot delete expense after month end!');
        }

        // find expense by id and update
        let updatedExpense: any = expense.expenses.find(
            (exp: any) => exp.id === expenseId
        );

        if (!updatedExpense) {
            throw new BadRequestError('Expense not found!');
        }

        updatedExpense.status = WellKnownStatus.DELETED;
        updatedExpense.updatedBy = auth.id;
        updatedExpense.updatedAt = new Date();

        await expensesService.save(expense, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Expense deleted successfully!',
            null
        );
    } catch (error) {
        throw error;
    }
};

const getExpenseByTripId = async (req: Request, res: Response) => {
    const tripId: any = req.params.tripId;

    try {
        let expense: any = await expensesService.findByTripIdAndStatusIn(
            tripId,
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
                expensesUtils.ExpensesModelToTripExpensesResponseDto(expense);
        }

        CommonResponse(res, true, StatusCodes.OK, '', response);

        // _id: string;
        // tripId: string;
        // expenses: any[];
        // driverSalary: any;
        // isMonthEndDone: boolean;
        // tripExpensesAmount: number;
        // totalTripExpensesAmount: number;
        // remainingTripExpensesAmount: number;
    } catch (error) {
        throw error;
    }
};

const getExpenseByTripIdAndExpenseId = async (req: Request, res: Response) => {
    const tripId: any = req.params.tripId;
    const expenseId: any = req.params.expenseId;

    try {
        let expense: any = await expensesService.findByTripIdAndStatusIn(
            tripId,
            [WellKnownStatus.ACTIVE]
        );

        let response: any = null;

        if (expense) {
            let expenseData: any = expense.expenses.find(
                (exp: any) =>
                    exp.id === expenseId &&
                    exp.status === WellKnownStatus.ACTIVE
            );

            if (expenseData) {
                response = expenseData;
            }
        }

        CommonResponse(res, true, StatusCodes.OK, '', response);
    } catch (error) {
        throw error;
    }
};

const saveDriverSalary = async (req: Request, res: Response) => {
    const tripId: any = req.params.tripId;
    const auth: any = req.auth;
    const body: any = req.body;

    const { error } = expensesValidation.saveDriverSalarySchema.validate(body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    try {
        let trip = await tripService.findByIdAndStatusIn(tripId, [
            WellKnownTripStatus.FINISHED,
        ]);

        if (!trip) {
            throw new BadRequestError('Trip not found!');
        }

        let expense: any = await expensesService.findByTripIdAndStatusIn(
            tripId,
            [WellKnownStatus.ACTIVE]
        );

        if (!expense) {
            throw new BadRequestError('No expense header found for this trip!');
        }

        // check driver available in trip
        let driver = trip.drivers.find(
            (driver: any) => driver.driver.toString() === body.driver
        );

        if (!driver) {
            throw new BadRequestError('Driver not found in trip!');
        }

        let expenseDriverSalary: any =
            expense
                .toObject()
                ?.driverSalaries.find(
                    (driverSalary: any) =>
                        driverSalary.driver.toString() === body.driver
                ) || null;
        if (!expenseDriverSalary) {
            let driverSalary: any = {};
            driverSalary.driver = body.driver;
            driverSalary.salaryPerDay = body.salaryPerDay;
            driverSalary.noOfDays = body.noOfDays;
            driverSalary.totalSalary = calculateDriverSalary(
                expense?.tripId,
                expense.expenses,
                body.salaryPerDay,
                body.noOfDays,
                body.totalAddition,
                body.totalDeduction,
                body.isRemainingToDriver
            );
            driverSalary.totalAddition = body.totalAddition;
            driverSalary.totalDeduction = body.totalDeduction;
            driverSalary.remainingExpenses = calcRemainingExpenses(
                expense?.tripId,
                expense.expenses
            );
            driverSalary.isRemainingToDriver = body.isRemainingToDriver;
            driverSalary.createdBy = auth.id;
            driverSalary.updatedBy = auth.id;
            driverSalary.createdAt = new Date();
            driverSalary.updatedAt = new Date();

            expense.driverSalaries.push(driverSalary);
        } else {
            let index = expense.driverSalaries.findIndex(
                (driverSalary: any) =>
                    driverSalary.driver.toString() === body.driver
            );
            expenseDriverSalary.salaryPerDay = body.salaryPerDay;
            expenseDriverSalary.noOfDays = body.noOfDays;
            expenseDriverSalary.totalSalary = calculateDriverSalary(
                expense?.tripId,
                expense.expenses,
                body.salaryPerDay,
                body.noOfDays,
                body.totalAddition,
                body.totalDeduction,
                body.isRemainingToDriver
            );
            expenseDriverSalary.totalAddition = body.totalAddition;
            expenseDriverSalary.totalDeduction = body.totalDeduction;
            expenseDriverSalary.remainingExpenses = calcRemainingExpenses(
                expense?.tripId,
                expense.expenses
            );
            expenseDriverSalary.isRemainingToDriver = body.isRemainingToDriver;
            expenseDriverSalary.updatedBy = auth.id;
            expenseDriverSalary.updatedAt = new Date();

            expense.driverSalaries[index] = expenseDriverSalary;
        }

        await expensesService.save(expense, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Driver salary saved successfully!',
            null
        );
    } catch (error) {
        throw error;
    }
};

const calculateDriverSalary = (
    trip: any,
    expenses: any,
    salaryPerDay: number,
    noOfDays: number,
    totalAddition: number,
    totalDeduction: number,
    isRemainingToDriver: boolean
): number => {
    let totalSalary: number = 0;
    let activeExpenses = expenses.filter(
        (exp: any) => exp.status === WellKnownStatus.ACTIVE
    );

    let totalExpensesAmount = activeExpenses.reduce(
        (total: number, exp: any) => total + exp.amount,
        0
    );

    let remainingExpenseAmount =
        trip?.estimatedExpense - totalExpensesAmount || 0;

    if (salaryPerDay > 0 && noOfDays > 0) {
        totalSalary += salaryPerDay * noOfDays;
    }

    if (totalAddition > 0) {
        totalSalary += totalAddition;
    }

    if (totalDeduction > 0) {
        totalSalary -= totalDeduction;
    }

    if (remainingExpenseAmount > 0) {
        if (isRemainingToDriver) {
            totalSalary -= remainingExpenseAmount;
        }
    } else {
        totalSalary += Math.abs(remainingExpenseAmount);
    }

    return totalSalary;
};

const calcRemainingExpenses = (trip: any, expenses: any) => {
    let activeExpenses = expenses.filter(
        (exp: any) => exp.status === WellKnownStatus.ACTIVE
    );

    let totalExpensesAmount = activeExpenses.reduce(
        (total: number, exp: any) => total + exp.amount,
        0
    );

    let remainingExpenseAmount =
        trip?.estimatedExpense - totalExpensesAmount || 0;

    return remainingExpenseAmount;
};

export {
    saveExpense,
    updateExpense,
    deleteExpense,
    getExpenseByTripId,
    getExpenseByTripIdAndExpenseId,
    saveDriverSalary,
};
