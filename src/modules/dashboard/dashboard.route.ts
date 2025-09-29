import { Router } from "express";
import applicationRoutes from "../../applicationRoutes";
import authMiddleware from "../../middleware/auth.middleware";
import constants from "../../constant";
import { getDashboardInventorySummary, getDashboardData, getMonthlyIncomeExpense } from "./dashboard.controller";

const DashboardRouter = Router();

DashboardRouter.get(applicationRoutes.dashboard.getInventorySummary,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN]),
    getDashboardInventorySummary);

DashboardRouter.get(applicationRoutes.dashboard.getDashboardData,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN]),
    getDashboardData);

DashboardRouter.get(applicationRoutes.dashboard.getMonthlyIncomeExpense,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN]),
    getMonthlyIncomeExpense);
export default DashboardRouter;
