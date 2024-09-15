import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import {
    activeInactiveVehicle,
    deleteVehicleById,
    getAllVehicles,
    getVehicleById,
    saveVehicle,
    updateVehicle,
} from './vehicle.controller';

const VehicleRouter = Router();

// Save vehicle
VehicleRouter.post(
    applicationRoutes.vehicle.save,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    saveVehicle
);

// Update vehicle
VehicleRouter.put(
    applicationRoutes.vehicle.update,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    updateVehicle
);

// Get by id
VehicleRouter.get(
    applicationRoutes.vehicle.getById,
    authMiddleware.authorize([]),
    getVehicleById
);

// Get all
VehicleRouter.get(
    applicationRoutes.vehicle.getAll,
    authMiddleware.authorize([]),
    getAllVehicles
);

// delete by id
VehicleRouter.delete(
    applicationRoutes.vehicle.deleteById,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    deleteVehicleById
);

// activeInactiveVehicle
VehicleRouter.put(
    applicationRoutes.vehicle.activeInactiveVehicles,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    activeInactiveVehicle
);

export default VehicleRouter;
