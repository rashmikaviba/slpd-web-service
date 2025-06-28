import { Request, Response } from "express";
import monthlyExpensesService from "./monthlyExpenses.service";
import { WellKnownStatus } from "../../util/enums/well-known-status.enum";
import BadRequestError from "../../error/BadRequestError";
import NotFoundError from "../../error/NotFoundError";
import monthlyExpensesValidation from "./monthlyExpenses.validation";
import { startSession } from "mongoose";
import CommonResponse from "../../util/commonResponse";
import { StatusCodes } from "http-status-codes";
import monthlyExpensesUtil from "./monthlyExpenses.util";
import MonthlyExpensesResponseDto from "./dto/monthlyExpensesResponseDto";

const saveMonthlyExpense = async (req: Request, res: Response) => {
    const id = req.params.id;
    const auth = req.auth;
    const {
        expenseType,
        expenseTypeName,
        description,
        amount,
        date
    } = req.body;

    // Validate request body
    const { error } = monthlyExpensesValidation.createNewExpensesSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    let monthlyExpense = await monthlyExpensesService.findByIdAndStatusIn(id, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

    if (!monthlyExpense) {
        throw new NotFoundError('Monthly expense not found!');
    } else if (monthlyExpense.isMonthEndDone) {
        throw new BadRequestError('Cannot update monthly expense after month end!');
    }

    const session = await startSession();
    try {
        session.startTransaction();

        let newExpense = {
            expenseType: expenseType,
            expenseTypeName: expenseTypeName,
            date: date,
            description: description,
            amount: amount,
            status: WellKnownStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: auth.id,
            updatedBy: auth.id
        }

        monthlyExpense.expenses.push(newExpense);

        let totalExpenses = monthlyExpense?.expenses.reduce(
            (total: number, exp: any) => exp.status === WellKnownStatus.ACTIVE ? total + exp.amount : total,
            0
        ) || 0;


        monthlyExpense.totalExpenses = totalExpenses;
        monthlyExpense.updatedBy = auth.id;

        await monthlyExpensesService.save(monthlyExpense, session);

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Monthly expense saved successfully!',
            monthlyExpense
        );
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const updateMonthlyExpense = async (req: Request, res: Response) => {
    const id = req.params.id;
    const expenseId = req.params.expenseId;
    const auth = req.auth;
    const {
        expenseType,
        expenseTypeName,
        description,
        amount,
        date
    } = req.body;

    // Validate request body
    const { error } = monthlyExpensesValidation.createNewExpensesSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    let monthlyExpense = await monthlyExpensesService.findByIdAndStatusIn(id, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

    if (!monthlyExpense) {
        throw new NotFoundError('Monthly expense not found!');
    } else if (monthlyExpense.isMonthEndDone) {
        throw new BadRequestError('Cannot update monthly expense after month end!');
    }

    const session = await startSession();
    try {
        session.startTransaction();

        let selectedExpense = monthlyExpense.expenses.find((exp: any) => exp._id.toString() === expenseId);

        if (!selectedExpense) {
            throw new NotFoundError('Expense not found in this monthly expense!');
        }

        selectedExpense.expenseType = expenseType;
        selectedExpense.expenseTypeName = expenseTypeName;
        selectedExpense.description = description;
        selectedExpense.amount = amount;
        selectedExpense.date = date;
        selectedExpense.updatedAt = new Date();
        selectedExpense.updatedBy = auth.id;

        let totalExpenses = monthlyExpense?.expenses.reduce(
            (total: number, exp: any) => exp.status === WellKnownStatus.ACTIVE ? total + exp.amount : total,
            0
        ) || 0;

        monthlyExpense.totalExpenses = totalExpenses;
        monthlyExpense.updatedBy = auth.id;

        await monthlyExpensesService.save(monthlyExpense, session);

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Expense updated successfully!',
            monthlyExpense
        );
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const deleteMonthlyExpense = async (req: Request, res: Response) => {
    const id = req.params.id;
    const expenseId = req.params.expenseId;
    const auth = req.auth;

    let monthlyExpense = await monthlyExpensesService.findByIdAndStatusIn(id, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

    if (!monthlyExpense) {
        throw new NotFoundError('Monthly expense not found!');
    } else if (monthlyExpense.isMonthEndDone) {
        throw new BadRequestError('Cannot update monthly expense after month end!');
    }

    const session = await startSession();
    try {
        session.startTransaction();

        let selectedExpense = monthlyExpense.expenses.find((exp: any) => exp._id.toString() === expenseId);

        if (!selectedExpense) {
            throw new NotFoundError('Expense not found in this monthly expense!');
        }

        selectedExpense.status = WellKnownStatus.DELETED;
        selectedExpense.updatedAt = new Date();
        selectedExpense.updatedBy = auth.id;

        let totalExpenses = monthlyExpense?.expenses.reduce(
            (total: number, exp: any) => exp.status === WellKnownStatus.ACTIVE ? total + exp.amount : total,
            0
        ) || 0;

        monthlyExpense.totalExpenses = totalExpenses;
        monthlyExpense.updatedBy = auth.id;

        await monthlyExpensesService.save(monthlyExpense, session);

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Expense deleted successfully!',
            monthlyExpense
        );
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const advanceSearchMonthlyExpense = async (req: Request, res: Response) => {
    const { startMonth, endMonth } = req.body;

    // Validate request body
    const { error } = monthlyExpensesValidation.advanceSearchSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    let monthlyExpenses: any = await monthlyExpensesService.advanceSearch(startMonth, endMonth);

    let response: MonthlyExpensesResponseDto[] = [];

    if (monthlyExpenses && monthlyExpenses.length > 0) {
        response = monthlyExpensesUtil.modelToMonthlyExpensesResponseDtoList(monthlyExpenses);
    }

    return CommonResponse(
        res,
        true,
        StatusCodes.OK,
        '',
        response
    );
};

const getMonthlyExpenseById = async (req: Request, res: Response) => {
    const id = req.params.id;

    let monthlyExpense: any = await monthlyExpensesService.findByIdAndStatusIn(id, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

    if (monthlyExpense) {
        monthlyExpense.expenses = monthlyExpense.expenses.filter((exp: any) => exp.status !== WellKnownStatus.DELETED);
        monthlyExpense.expenses.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return CommonResponse(
        res,
        true,
        StatusCodes.OK,
        '',
        monthlyExpense
    );
};

export {
    saveMonthlyExpense,
    updateMonthlyExpense,
    deleteMonthlyExpense,
    advanceSearchMonthlyExpense,
    getMonthlyExpenseById
}