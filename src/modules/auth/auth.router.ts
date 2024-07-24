import { Router } from 'express';
import { changePassword, resetPassword, userLogin } from './auth.controller';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';

const AuthRouter = Router();

AuthRouter.post(applicationRoutes.auth.login, userLogin);

AuthRouter.put(
    applicationRoutes.auth.resetPassword,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    resetPassword
);

AuthRouter.put(
    applicationRoutes.auth.changePassword,
    authMiddleware.authorize(),
    changePassword
);

export default AuthRouter;
