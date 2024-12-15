import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import { monthlyDriverSalary, monthlyExpensesReport, monthlyIncomeReport, monthlyTripReport } from './report.controller';

const ReportRouter = Router();

ReportRouter.get(
    applicationRoutes.report.monthlyTripReport,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    monthlyTripReport
);

ReportRouter.get(
    applicationRoutes.report.monthlyExpensesReport,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.FINANCEOFFICER,
        constants.USER.ROLES.TRIPMANAGER,
    ]),
    monthlyExpensesReport
);

ReportRouter.get(
    applicationRoutes.report.monthlyDriverSalary,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.FINANCEOFFICER,
        constants.USER.ROLES.TRIPMANAGER,
    ]),
    monthlyDriverSalary
);

ReportRouter.get(
    applicationRoutes.report.monthlyIncomeReport,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.FINANCEOFFICER,
        constants.USER.ROLES.TRIPMANAGER,
    ]),
    monthlyIncomeReport
);

export default ReportRouter;