import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import { saveProductForPos, voidProductInPos, tripEndPosAudit, getPosByTrip } from './pos.controller';

const PosRouter = Router();


PosRouter.post(
    applicationRoutes.pos.save,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN, constants.USER.ROLES.TRIPMANAGER, constants.USER.ROLES.FINANCEOFFICER]),
    saveProductForPos
)

PosRouter.delete(
    applicationRoutes.pos.voidProduct,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN, constants.USER.ROLES.TRIPMANAGER, constants.USER.ROLES.FINANCEOFFICER]),
    voidProductInPos
)

PosRouter.put(
    applicationRoutes.pos.tripEndAudit,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN, constants.USER.ROLES.TRIPMANAGER, constants.USER.ROLES.FINANCEOFFICER]),
    tripEndPosAudit
)

PosRouter.get(
    applicationRoutes.pos.getPosByTrip,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN, constants.USER.ROLES.TRIPMANAGER, constants.USER.ROLES.FINANCEOFFICER]),
    getPosByTrip
)



export default PosRouter;

