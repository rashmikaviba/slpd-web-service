import { Router } from 'express';
import applicationRoutes from './applicationRoutes';
import StoreRouter from './modules/store/store.route';
import CommonRouter from './modules/common/route/common.route';
import UserRouter from './modules/user/user.router';
import AuthRouter from './modules/auth/auth.router';
import LeaveRouter from './modules/leave/leave.route';
import MonthAuditRouter from './modules/monthAudit/monthAudit.route';
import VehicleRouter from './modules/vehicle/vehicle.route';
import TripRouter from './modules/trip/trip.route';
import ReportRouter from './modules/report/report.route';
import ExpensesRouter from './modules/expenses/expenses.route';
import ExpensesRequestRouter from './modules/expensesRequest/expensesRequest.route';
import NotificationRouter from './modules/notification/notification.route';

const router = Router();

// Use route modules
router.use(applicationRoutes.common.base, CommonRouter);
router.use(applicationRoutes.store.base, StoreRouter);
router.use(applicationRoutes.user.base, UserRouter);
router.use(applicationRoutes.auth.base, AuthRouter);
router.use(applicationRoutes.leave.base, LeaveRouter);
router.use(applicationRoutes.monthAudit.base, MonthAuditRouter);
router.use(applicationRoutes.vehicle.base, VehicleRouter);
router.use(applicationRoutes.trip.base, TripRouter);
router.use(applicationRoutes.expenses.base, ExpensesRouter);
router.use(applicationRoutes.report.base, ReportRouter);
router.use(applicationRoutes.expensesRequest.base, ExpensesRequestRouter);
router.use(applicationRoutes.notification.base, NotificationRouter);

export default router;
