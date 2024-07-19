import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';

import { GetAllGenders } from './common.controller';

const CommonRouter = Router();

CommonRouter.get(applicationRoutes.common.getAllGenders, GetAllGenders);

export default CommonRouter;
