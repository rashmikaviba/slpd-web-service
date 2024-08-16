import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import { createNewDate } from './monthAudit.controller';

const MonthAuditRouter = Router();

MonthAuditRouter.post(
    applicationRoutes.monthAudit.createNewMonth,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    createNewDate
);

export default MonthAuditRouter;
