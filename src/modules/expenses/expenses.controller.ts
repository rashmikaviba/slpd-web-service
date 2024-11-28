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

        await expensesService.save(expense, expenseId);

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

export {
    saveExpense,
    updateExpense,
    deleteExpense,
    getExpenseByTripId,
    getExpenseByTripIdAndExpenseId,
};
