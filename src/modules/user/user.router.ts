import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import {
    blockUser,
    getAllUsers,
    getUserById,
    saveUser,
    unblockUser,
    updateUser,
} from './user.controller';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';

const UserRouter = Router();

UserRouter.post(
    applicationRoutes.user.save,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    saveUser
);

UserRouter.put(
    applicationRoutes.user.update,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    updateUser
);

UserRouter.put(
    applicationRoutes.user.blockUser,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    blockUser
);

UserRouter.put(
    applicationRoutes.user.unblockUser,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    unblockUser
);

UserRouter.get(
    applicationRoutes.user.getAll,
    authMiddleware.authorize(),
    getAllUsers
);

UserRouter.get(
    applicationRoutes.user.getById,
    authMiddleware.authorize(),
    getUserById
);

export default UserRouter;
