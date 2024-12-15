import { Router } from 'express';
import applicationRoutes from '../../../applicationRoutes';

import {
    GetAllGenders,
    GetAllRoles,
    GetDataByType,
} from '../controller/common.controller';
import authMiddleware from '../../../middleware/auth.middleware';

const CommonRouter = Router();

CommonRouter.get(applicationRoutes.common.getAllGenders, GetAllGenders);

CommonRouter.get(applicationRoutes.common.getAllRoles, GetAllRoles);

CommonRouter.get(
    applicationRoutes.common.getCommonData,
    authMiddleware.authorize([]),
    GetDataByType
);

export default CommonRouter;
