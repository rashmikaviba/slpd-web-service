import { Router } from "express";
import applicationRoutes from "../../../applicationRoutes";
import authMiddleware from "../../../middleware/auth.middleware";
import constants from "../../../constant";

import { saveProduct, updateProduct, getProductById, deleteProductById, getAllProducts, activeInactiveProduct, getProductAuditLog } from "./product.controller";

const ProductRoute = Router();

ProductRoute.post(
    applicationRoutes.inventory.product.save,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN]),
    saveProduct
)

ProductRoute.put(
    applicationRoutes.inventory.product.update,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN]),
    updateProduct
)

ProductRoute.put(
    applicationRoutes.inventory.product.activeInactive,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN]),
    activeInactiveProduct
)

ProductRoute.get(
    applicationRoutes.inventory.product.getById,
    authMiddleware.authorize([]),
    getProductById
)

ProductRoute.delete(
    applicationRoutes.inventory.product.deleteById,
    authMiddleware.authorize([constants.USER.ROLES.SUPERADMIN, constants.USER.ROLES.ADMIN]),
    deleteProductById
)
ProductRoute.get(
    applicationRoutes.inventory.product.getAll,
    authMiddleware.authorize([]),
    getAllProducts
)


ProductRoute.get(
    applicationRoutes.inventory.product.getProductAuditLog,
    authMiddleware.authorize([]),
    getProductAuditLog
)


export default ProductRoute;




