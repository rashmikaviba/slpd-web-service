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
    changeTripStatus,
    getPlacesByTripId,
    markPlaceAsReached,
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

TripRouter.put(
    applicationRoutes.trip.saveCheckList,
    authMiddleware.authorize([constants.USER.ROLES.DRIVER]),
    saveCheckListAnswers
);

TripRouter.get(
    applicationRoutes.trip.getCheckList,
    authMiddleware.authorize([]),
    getCheckListAnswers
);

TripRouter.put(
    applicationRoutes.trip.changeTripStatus,
    authMiddleware.authorize([
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.DRIVER,
    ]),
    changeTripStatus
);

TripRouter.get(
    applicationRoutes.trip.getPlacesByTrip,
    authMiddleware.authorize([]),
    getPlacesByTripId
);

TripRouter.put(
    applicationRoutes.trip.markAsReached,
    authMiddleware.authorize([constants.USER.ROLES.DRIVER]),
    markPlaceAsReached
);

export default TripRouter;
