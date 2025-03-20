import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import {
    saveTripSummary,
    getAllSummaryByTrip,
    getTrpSummaryById,
    updateTripSummary,
    deleteTripSummary,
} from './tripSummary.controller';

const TripSummaryRouter = Router();

TripSummaryRouter.post(
    applicationRoutes.tripSummary.save,
    authMiddleware.authorize([
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.FINANCEOFFICER,
        constants.USER.ROLES.DRIVER,
    ]),
    saveTripSummary
);

TripSummaryRouter.get(
    applicationRoutes.tripSummary.getAllByTrip,
    authMiddleware.authorize([]),
    getAllSummaryByTrip
);

TripSummaryRouter.get(
    applicationRoutes.tripSummary.getById,
    authMiddleware.authorize([]),
    getTrpSummaryById
);

TripSummaryRouter.put(
    applicationRoutes.tripSummary.update,
    authMiddleware.authorize([
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.FINANCEOFFICER,
        constants.USER.ROLES.DRIVER,
    ]),
    updateTripSummary
);

TripSummaryRouter.delete(
    applicationRoutes.tripSummary.deleteById,
    authMiddleware.authorize([
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.FINANCEOFFICER,
        constants.USER.ROLES.DRIVER,
    ]),
    deleteTripSummary
);

export default TripSummaryRouter;
