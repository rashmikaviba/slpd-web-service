import { Router } from "express"
import applicationRoutes from "../../../applicationRoutes"
import constants from "../../../constant"
import authMiddleware from "../../../middleware/auth.middleware"
import { saveGrn, updatedGrn, approveGrn, rejectGrn, cancelGrn, getGrnById, grnAdvanceSearch, getNextGrnNumber } from "./grn.controller"

const GrnRouter = Router()

GrnRouter.post(
    applicationRoutes.inventory.grn.save,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN, constants.USER.ROLES.FINANCEOFFICER, constants.USER.ROLES.TRIPMANAGER]),
    saveGrn
)

GrnRouter.post(
    applicationRoutes.inventory.grn.advanceSearch,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN, constants.USER.ROLES.FINANCEOFFICER, constants.USER.ROLES.TRIPMANAGER]),
    grnAdvanceSearch
)

GrnRouter.put(
    applicationRoutes.inventory.grn.update,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN, constants.USER.ROLES.FINANCEOFFICER, constants.USER.ROLES.TRIPMANAGER]),
    updatedGrn
)

GrnRouter.put(
    applicationRoutes.inventory.grn.approveGrn,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN]),
    approveGrn
)

GrnRouter.put(
    applicationRoutes.inventory.grn.rejectGrn,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN]),
    rejectGrn
)

GrnRouter.delete(
    applicationRoutes.inventory.grn.cancelById,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN]),
    cancelGrn
)

GrnRouter.get(
    applicationRoutes.inventory.grn.getById,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN, constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN, constants.USER.ROLES.FINANCEOFFICER, constants.USER.ROLES.TRIPMANAGER]),
    getGrnById
)

GrnRouter.get(
    applicationRoutes.inventory.grn.getNextGrnNumber,
    authMiddleware.authorize([]),
    getNextGrnNumber
)

export default GrnRouter