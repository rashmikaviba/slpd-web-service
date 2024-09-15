import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import { activeInactiveVehicle, deleteVehicleById, getAllVehicles, getVehicleById, saveVehicle, updateVehicle } from './vehicle.controller';

const VehicelRouter = Router();

// Save vehicle
VehicelRouter.post(
    applicationRoutes.vehicle.save,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    saveVehicle
);

// Update vehicle
VehicelRouter.put(
    applicationRoutes.vehicle.update,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    updateVehicle
);

// Get by id
VehicelRouter.get(
    applicationRoutes.vehicle.getById,
    authMiddleware.authorize([]),
    getVehicleById
);

// Get all
VehicelRouter.get(
    applicationRoutes.vehicle.getAll,
    authMiddleware.authorize([]),
    getAllVehicles
);

// delete by id
VehicelRouter.delete(
    applicationRoutes.vehicle.deleteById,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    deleteVehicleById
);

// activeInactiveVehicle
VehicelRouter.put(
    applicationRoutes.vehicle.activeInactiveVehicles,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN]),
    activeInactiveVehicle
);



export default VehicelRouter;


