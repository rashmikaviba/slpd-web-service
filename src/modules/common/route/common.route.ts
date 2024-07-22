import { Router } from 'express';
import applicationRoutes from '../../../applicationRoutes';

import { GetAllGenders, GetAllRoles } from '../controller/common.controller';

const CommonRouter = Router();

CommonRouter.get(applicationRoutes.common.getAllGenders, GetAllGenders);

CommonRouter.get(applicationRoutes.common.getAllRoles, GetAllRoles);

export default CommonRouter;
