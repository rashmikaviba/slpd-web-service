import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import {
    saveTrip,
    updateTrip,
    cancelTrip,
    getTripById,
    getAllTripsByRole,
    assignDriverAndVehicle,
    saveCheckListAnswers,
    getCheckListAnswers,
} from './trip.controller';

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

TripRouter.put(
    applicationRoutes.trip.update,
    authMiddleware.authorize([
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
    ]),
    updateTrip
);

TripRouter.delete(
    applicationRoutes.trip.deleteById,
    authMiddleware.authorize([
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
    ]),
    cancelTrip
);

TripRouter.get(
    applicationRoutes.trip.getTripById,
    authMiddleware.authorize([]),
    getTripById
);

TripRouter.get(
    applicationRoutes.trip.getAllTrips,
    authMiddleware.authorize([]),
    getAllTripsByRole
);

TripRouter.put(
    applicationRoutes.trip.assignDriver,
    authMiddleware.authorize([
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
    ]),
    assignDriverAndVehicle
);

TripRouter.post(
    applicationRoutes.trip.saveCheckList,
    authMiddleware.authorize([constants.USER.ROLES.DRIVER]),
    saveCheckListAnswers
);

TripRouter.get(
    applicationRoutes.trip.getCheckList,
    authMiddleware.authorize([]),
    getCheckListAnswers
);

export default TripRouter;
