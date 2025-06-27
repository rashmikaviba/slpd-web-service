import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import { saveMonthlyExpense, updateMonthlyExpense, deleteMonthlyExpense, advanceSearchMonthlyExpense, getMonthlyExpenseById } from './monthlyExpenses.controller';

const MonthlyExpensesRouter = Router();

// advance search expense
MonthlyExpensesRouter.post(
    applicationRoutes.monthlyExpenses.advanceSearch,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    advanceSearchMonthlyExpense
);

// Save expense
MonthlyExpensesRouter.post(
    applicationRoutes.monthlyExpenses.save,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    saveMonthlyExpense
);

// get expense by id
MonthlyExpensesRouter.get(
    applicationRoutes.monthlyExpenses.getById,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    getMonthlyExpenseById
);

// Update expense
MonthlyExpensesRouter.put(
    applicationRoutes.monthlyExpenses.update,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    updateMonthlyExpense
);

// Delete expense
MonthlyExpensesRouter.delete(
    applicationRoutes.monthlyExpenses.deleteById,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    deleteMonthlyExpense
);

export default MonthlyExpensesRouter;

