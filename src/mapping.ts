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
import ExpensesRequestRouter from './modules/expenseRequest/expenseRequest.route';
import NotificationRouter from './modules/notification/notification.route';
import InternalTripRouter from './modules/internalTrip/internalTrip.route';
import TripSummaryRouter from './modules/tripSummary/tripSummary.route';
import ProductRoute from './modules/inventory/product/product.route';
import GrnRouter from './modules/inventory/grn/grn.route';
import MonthlyExpensesRouter from './modules/monthlyExpenses/monthlyExpenses.route';
import PosRouter from './modules/pos/pos.route';
import GarageRouter from './modules/vehicleMaintain/garage/garage.route';

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
router.use(applicationRoutes.expenseRequest.base, ExpensesRequestRouter);
router.use(applicationRoutes.notification.base, NotificationRouter);
router.use(applicationRoutes.internalTrip.base, InternalTripRouter);
router.use(applicationRoutes.tripSummary.base, TripSummaryRouter);
router.use(applicationRoutes.inventory.product.base, ProductRoute);
router.use(applicationRoutes.inventory.grn.base, GrnRouter);
router.use(applicationRoutes.monthlyExpenses.base, MonthlyExpensesRouter);
router.use(applicationRoutes.pos.base, PosRouter);
router.use(applicationRoutes.garage.base, GarageRouter);

export default router;
