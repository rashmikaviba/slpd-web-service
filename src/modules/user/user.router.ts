import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import { SaveUser } from './user.controller';

const UserRouter = Router();

UserRouter.post(applicationRoutes.user.save, SaveUser);

export default UserRouter;
