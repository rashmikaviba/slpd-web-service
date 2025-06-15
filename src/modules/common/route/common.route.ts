import { Router } from 'express';
import applicationRoutes from '../../../applicationRoutes';

import {
    GetAllGenders,
    GetAllRoles,
    GetDataByType,
    GetAllMeasureUnits
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

CommonRouter.get(
    applicationRoutes.common.getAllMeasureUnits,
    authMiddleware.authorize([]),
    GetAllMeasureUnits
);

export default CommonRouter;
