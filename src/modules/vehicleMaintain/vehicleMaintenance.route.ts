import { Router } from "express";
import applicationRoutes from "../../applicationRoutes";
import authMiddleware from "../../middleware/auth.middleware";
import constants from "../../constant";
import { deleteVehicleMaintenance, getAllVehicleMaintenances, getVehicleMaintenanceById, saveVehicleMaintenance, updateVehicleMaintenance, getVehicleMaintenanceInvoice } from "./vehicleMaintenance.controller";


const VehicleMaintenanceRouter = Router();

const ACCESS_ROLES = [constants.USER.ROLES.ADMIN, constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.TRIPMANAGER, constants.USER.ROLES.FINANCEOFFICER, constants.USER.ROLES.DRIVERASSISTANT, constants.USER.ROLES.TRIPASSISTANT];

VehicleMaintenanceRouter.post(applicationRoutes.vehicleMaintenance.save,
    authMiddleware.authorize(ACCESS_ROLES), saveVehicleMaintenance);

VehicleMaintenanceRouter.put(applicationRoutes.vehicleMaintenance.update,
    authMiddleware.authorize(ACCESS_ROLES), updateVehicleMaintenance);

VehicleMaintenanceRouter.delete(applicationRoutes.vehicleMaintenance.deleteById,
    authMiddleware.authorize(ACCESS_ROLES), deleteVehicleMaintenance);

VehicleMaintenanceRouter.get(applicationRoutes.vehicleMaintenance.getById,
    authMiddleware.authorize([]), getVehicleMaintenanceById);

VehicleMaintenanceRouter.get(applicationRoutes.vehicleMaintenance.getAll,
    authMiddleware.authorize([]), getAllVehicleMaintenances);

VehicleMaintenanceRouter.get(applicationRoutes.vehicleMaintenance.maintainInvoice,
    authMiddleware.authorize([]), getVehicleMaintenanceInvoice);

export default VehicleMaintenanceRouter;