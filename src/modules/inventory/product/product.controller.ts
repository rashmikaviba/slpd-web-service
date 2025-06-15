import { Request, Response } from "express";
import { StatusCodes } from 'http-status-codes';

import { WellKnownStatus } from "../../../util/enums/well-known-status.enum";
import BadRequestError from "../../../error/BadRequestError";
import NotFoundError from "../../../error/NotFoundError";
import CommonResponse from "../../../util/commonResponse";

import InventoryProduct from "./product.model";
import productValidation from "./product.validation";
import productService from "./product.service";
import { startSession } from "mongoose";
import ProductResponseDto from "../dto/productResponseDto";
import productUtil from "./product.util";

const saveProduct = async (req: Request, res: Response) => {
    const {
        productName,
        productShortCode,
        isReturnableProduct,
        measureUnit,
        unitPrice
    } = req.body;

    const auth = req.auth;

    // Validate request body
    const { error } = productValidation.productSaveSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    const duplicate: any = await productService.isShortCodeOrProductNameExists(productShortCode, productName, "");
    if (duplicate) {
        if (
            duplicate.shortCodeDuplicate && duplicate.shortCodeDuplicate.productShortCode.toLowerCase() === productShortCode.toLowerCase()
        ) {
            throw new BadRequestError('Product short code cannot be duplicate!');
        }
        if (duplicate.productDuplicate && duplicate.productDuplicate.productName.toLowerCase() === productName.toLowerCase()) {
            throw new BadRequestError('Product name cannot be duplicate!');
        }
    }

    const session = await startSession();
    try {
        session.startTransaction();

        let product = new InventoryProduct(
            {
                productName: productName,
                productShortCode: productShortCode,
                measureUnit: measureUnit,
                isReturnableProduct: isReturnableProduct,
                unitPrice: unitPrice,
                createdBy: auth.id,
                updatedBy: auth.id,
                status: WellKnownStatus.ACTIVE
            }
        );

        await productService.save(product, session);

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Product saved successfully!',
            product
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const updateProduct = async (req: Request, res: Response) => {
    const { id } = req.params;
    const auth = req.auth;
    const {
        productName,
        productShortCode,
        isReturnableProduct,
        measureUnit,
        unitPrice
    } = req.body;

    // Validate request body
    const { error } = productValidation.productSaveSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    let product = await productService.findByIdAndStatusIn(id, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

    if (!product) {
        throw new NotFoundError('Product not found for update!');
    }

    const duplicate: any = await productService.isShortCodeOrProductNameExists(productShortCode, productName, id);
    if (duplicate) {
        if (
            duplicate.shortCodeDuplicate && duplicate.shortCodeDuplicate.productShortCode.toLowerCase() === productShortCode.toLowerCase()
        ) {
            throw new BadRequestError('Product short code cannot be duplicate!');
        }
        if (duplicate.productDuplicate && duplicate.productDuplicate.productName.toLowerCase() === productName.toLowerCase()) {
            throw new BadRequestError('Product name cannot be duplicate!');
        }
    }

    const session = await startSession();
    try {
        session.startTransaction();

        product.productName = productName;
        product.productShortCode = productShortCode;
        product.isReturnableProduct = isReturnableProduct;
        product.unitPrice = unitPrice;
        product.updatedBy = auth.id;

        await productService.save(product, session);

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Product updated successfully!',
            product
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const getProductById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const auth = req.auth;

    let product = await productService.findByIdAndStatusIn(id, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

    CommonResponse(res, true, StatusCodes.OK, '', product);
};

const activeInactiveProduct = async (req: Request, res: Response) => {
    const { id } = req.params;
    const auth = req.auth;

    let product = await productService.findByIdAndStatusIn(id, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

    if (!product) {
        throw new NotFoundError('Product not found for update!');
    }

    const session = await startSession();
    try {
        session.startTransaction();

        let message = "";
        if (product.status === WellKnownStatus.ACTIVE) {
            product.status = WellKnownStatus.INACTIVE;
            message = "Product inactivated successfully!";
        } else {
            product.status = WellKnownStatus.ACTIVE;
            message = "Product activated successfully!";
        }

        product.updatedBy = auth.id;

        await productService.save(product, session);

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.OK,
            message,
            product
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const deleteProductById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const auth = req.auth;

    let product = await productService.findByIdAndStatusIn(id, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

    if (!product) {
        throw new NotFoundError('Product not found for update!');
    }

    const session = await startSession();
    try {
        session.startTransaction();

        product.status = WellKnownStatus.DELETED;
        product.updatedBy = auth.id;

        await productService.save(product, session);

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.OK,
            "Product deleted successfully!",
            product
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const getAllProducts = async (req: Request, res: Response) => {
    const isWithInactive = req.query.isWithInactive === 'true' ? true : false;

    let response: ProductResponseDto[] = [];
    let products: any[] = []

    if (isWithInactive) {
        products = await productService.findAllAndByStatusIn([WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);
    } else {
        products = await productService.findAllAndByStatusIn([WellKnownStatus.ACTIVE]);
    }

    response = productUtil.modelsToProductResponseDtos(products);

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

const getProductAuditLog = async (req: Request, res: Response) => {
    const { id } = req.params;

    const productLogs = await productService.findProductsLogByProductId(id);

    CommonResponse(res, true, StatusCodes.OK, '', productLogs);
}

export {
    saveProduct, updateProduct, getProductById, deleteProductById, getAllProducts, activeInactiveProduct, getProductAuditLog
}