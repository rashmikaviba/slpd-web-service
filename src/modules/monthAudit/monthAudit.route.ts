import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import { createNewDate, getPendingLeaves, getWorkingInformation } from './monthAudit.controller';

const MonthAuditRouter = Router();

MonthAuditRouter.post(
    applicationRoutes.monthAudit.createNewMonth,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    createNewDate
);

MonthAuditRouter.get(
    applicationRoutes.monthAudit.getPendingLeaves,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    getPendingLeaves
);

MonthAuditRouter.get(
    applicationRoutes.monthAudit.getWorkingInfo,
    authMiddleware.authorize([]),
    getWorkingInformation
)

export default MonthAuditRouter;
