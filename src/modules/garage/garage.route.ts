import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import {
    createGarage,
    updateGarage,
    deleteGarage,
    getAllGarages,
    getGarageById,
    activeInactiveGarage
} from './garage.controller';

const GarageRouter = Router();

GarageRouter.post(applicationRoutes.garage.save,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.DRIVERASSISTANT
    ]),
    createGarage
)

GarageRouter.get(applicationRoutes.garage.getAll,
    authMiddleware.authorize([]),
    getAllGarages
)

GarageRouter.get(applicationRoutes.garage.getById,
    authMiddleware.authorize([]),
    getGarageById
)

GarageRouter.put(applicationRoutes.garage.update,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.DRIVERASSISTANT
    ]),
    updateGarage
)

GarageRouter.delete(applicationRoutes.garage.deleteById,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.DRIVERASSISTANT
    ]),
    deleteGarage
);

GarageRouter.put(applicationRoutes.monthlyExpenses.activeInactiveGarage,
    authMiddleware.authorize([
        constants.USER.ROLES.SUPERADMIN,
        constants.USER.ROLES.ADMIN,
        constants.USER.ROLES.TRIPMANAGER,
        constants.USER.ROLES.DRIVERASSISTANT
    ]),
    activeInactiveGarage
)

export default GarageRouter;