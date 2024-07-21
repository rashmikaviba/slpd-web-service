import { Router } from 'express';
import applicationRoutes from './applicationRoutes';
import StoreRouter from './modules/store/store.route';
import CommonRouter from './modules/common/route/common.route';

const router = Router();

// Use route modules
router.use(applicationRoutes.common.base, CommonRouter);
router.use(applicationRoutes.store.base, StoreRouter);

export default router;
