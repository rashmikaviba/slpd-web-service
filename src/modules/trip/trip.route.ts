import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import { saveTrip } from './trip.controller';

const TripRouter = Router();

TripRouter.post(
    applicationRoutes.trip.saveTrip,
    authMiddleware.authorize([
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
    ]),
    saveTrip
);

export default TripRouter;
