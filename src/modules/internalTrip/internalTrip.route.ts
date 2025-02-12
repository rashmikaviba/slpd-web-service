import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import {
    deleteInternalTripById,
    getInternalTripById,
    getInternalTripByVehicle,
    saveInternalTrip,
    updateInternalTrip,
} from './internalTrip.controller';

const InternalTripRouter = Router();

InternalTripRouter.post(
    applicationRoutes.internalTrip.save,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    saveInternalTrip
);

InternalTripRouter.get(
    applicationRoutes.internalTrip.getById,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    getInternalTripById
);

InternalTripRouter.put(
    applicationRoutes.internalTrip.update,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    updateInternalTrip
);

InternalTripRouter.delete(
    applicationRoutes.internalTrip.deleteById,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    deleteInternalTripById
);

InternalTripRouter.get(
    applicationRoutes.internalTrip.getByVehicle,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.FINANCEOFFICER,
    ]),
    getInternalTripByVehicle
);

export default InternalTripRouter;
