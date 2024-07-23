import { Router } from 'express';
import applicationRoutes from './applicationRoutes';
import StoreRouter from './modules/store/store.route';
import CommonRouter from './modules/common/route/common.route';
import UserRouter from './modules/user/user.router';
import AuthRouter from './modules/auth/auth.router';

const router = Router();

// Use route modules
router.use(applicationRoutes.common.base, CommonRouter);
router.use(applicationRoutes.store.base, StoreRouter);
router.use(applicationRoutes.user.base, UserRouter);
router.use(applicationRoutes.auth.base, AuthRouter);

export default router;
