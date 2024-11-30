import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';

import {
    saveExpense,
    updateExpense,
    deleteExpense,
    getExpenseByTripId,
    getExpenseByTripIdAndExpenseId,
    saveDriverSalary,
} from './expenses.controller';

const ExpensesRouter = Router();

// Save expense
ExpensesRouter.post(
    applicationRoutes.expenses.save,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.DRIVER,
    ]),
    saveExpense
);

// Update expense
ExpensesRouter.put(
    applicationRoutes.expenses.update,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.DRIVER,
    ]),
    updateExpense
);

// Delete expense
ExpensesRouter.delete(
    applicationRoutes.expenses.deleteById,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.DRIVER,
    ]),
    deleteExpense
);

// getExpenseById
ExpensesRouter.get(
    applicationRoutes.expenses.getAllExpensesByTrip,
    authMiddleware.authorize([]),
    getExpenseByTripId
);

// Get getExpensesById
ExpensesRouter.get(
    applicationRoutes.expenses.getExpensesById,
    authMiddleware.authorize([]),
    getExpenseByTripIdAndExpenseId
);

// '/saveSalary/:tripId',
ExpensesRouter.post(
    applicationRoutes.expenses.saveDriverSalary,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
    ]),
    saveDriverSalary
);
export default ExpensesRouter;
