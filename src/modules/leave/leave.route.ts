import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import {
    applyLeave,
    getAllLeaves,
    getLeaveById,
    approveLeave,
    rejectLeave,
    getLeaveCount,
    cancelLeave,
    updateLeave,
} from './leave.controller';

const LeaveRouter = Router();

LeaveRouter.post(
    applicationRoutes.leave.applyLeave,
    authMiddleware.authorize([
        constants.USER.ROLES.DRIVER,
        constants.USER.ROLES.ADMIN,
    ]),
    applyLeave
);

LeaveRouter.get(
    applicationRoutes.leave.getAllLeaves,
    authMiddleware.authorize(),
    getAllLeaves
);

LeaveRouter.get(
    applicationRoutes.leave.getLeaveById,
    authMiddleware.authorize(),
    getLeaveById
);

LeaveRouter.put(
    applicationRoutes.leave.approveLeave,
    authMiddleware.authorize(constants.USER.ROLES.SUPERADMIN),
    approveLeave
);

LeaveRouter.put(
    applicationRoutes.leave.rejectLeave,
    authMiddleware.authorize(constants.USER.ROLES.SUPERADMIN),
    rejectLeave
);

LeaveRouter.put(
    applicationRoutes.leave.cancelLeave,
    authMiddleware.authorize(),
    cancelLeave
);

LeaveRouter.post(
    applicationRoutes.leave.getLeaveCount,
    authMiddleware.authorize(),
    getLeaveCount
);

LeaveRouter.put(
    applicationRoutes.leave.updateLeave,
    authMiddleware.authorize(),
    updateLeave
);

export default LeaveRouter;
