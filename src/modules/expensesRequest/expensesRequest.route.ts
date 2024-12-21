import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import { approveExpensesRequest, requestMoreExpenses, rejectExpensesRequest, getExpenseExtension } from './expensesRequest.controller';

const ExpensesRequestRouter = Router();

// request expenses 
ExpensesRequestRouter.post(
    applicationRoutes.expensesRequest.save,
    authMiddleware.authorize([
        constants.USER.ROLES.DRIVER,
    ]),
    requestMoreExpenses
);

// approve expenses
ExpensesRequestRouter.put(
    applicationRoutes.expensesRequest.approveExpense,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    approveExpensesRequest
)

// reject expenses
ExpensesRequestRouter.put(
    applicationRoutes.expensesRequest.rejectExpense,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    rejectExpensesRequest
)

// get expense extension by id
ExpensesRequestRouter.get(
    applicationRoutes.expensesRequest.getExpenseExtensionById,
    authMiddleware.authorize([]),
    getExpenseExtension
)
export default ExpensesRequestRouter;