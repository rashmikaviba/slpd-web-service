import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import {
    approveExpensesRequest,
    requestMoreExpenses,
    rejectExpensesRequest,
    getExpenseExtension,
} from './expenseRequest.controller';

const ExpensesRequestRouter = Router();

// request expenses
ExpensesRequestRouter.post(
    applicationRoutes.expenseRequest.save,
    authMiddleware.authorize([constants.USER.ROLES.DRIVER]),
    requestMoreExpenses
);

// approve expenses
ExpensesRequestRouter.put(
    applicationRoutes.expenseRequest.approveExpense,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    approveExpensesRequest
);

// reject expenses
ExpensesRequestRouter.put(
    applicationRoutes.expenseRequest.rejectExpense,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    rejectExpensesRequest
);

// get expense extension by id
ExpensesRequestRouter.get(
    applicationRoutes.expenseRequest.getExpenseRequestById,
    authMiddleware.authorize([]),
    getExpenseExtension
);
export default ExpensesRequestRouter;
