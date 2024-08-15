import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import { applyLeave, getAllLeaves } from './leave.controller';

const LeaveRouter = Router();

// leave: {
//     base: '/leave',
//     getAllLeaves: '/', // get all leaves for super admin
//     getLeaveById: '/:id', // get leave by id
//     applyLeave: '/apply', // apply leave for user
//     approveLeave: '/approve/:id', // approve leave by id for super admin
//     rejectLeave: '/reject/:id', // reject leave by id for super admin
//     getLeaveCount: '/count', // get leave count for admin
// },

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
export default LeaveRouter;
