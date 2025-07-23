import { WellKnownGrnLogType } from './../../../util/enums/well-known-grn-log-type.enum';
import { Request, Response } from "express";
import { StatusCodes } from 'http-status-codes';
import { startSession } from "mongoose";

import { WellKnownStatus } from "../../../util/enums/well-known-status.enum";
import { WellKnownGrnStatus } from "../../../util/enums/well-known-grn-status.enum";
import constants from "../../../constant";
import { measureUnit } from "../../../util/data/measureUnitData";

import productService from "../product/product.service";
import grnService from "./grn.service";
import grnValidation from "./grn.validation";
import Grn from "./grn.model";
import grnUtil from './grn.util';

import BadRequestError from "../../../error/BadRequestError";
import NotFoundError from "../../../error/NotFoundError";
import CommonResponse from "../../../util/commonResponse";
import GrnSearchResponseDto from '../dto/grnSearchResponseDto';


const saveGrn = async (req: Request, res: Response) => {
    const { grnRemarks, products } = req.body;
    const auth = req.auth;

    // Validate request body
    const { error } = grnValidation.grnSaveSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    let nextGrnNumber = await grnService.getNextGrnNumber();
    let grnNumberWithPrefix = constants.NUMBERPREFIX.GRN + nextGrnNumber.toString().padStart(3, '0');

    let toBeSavedProducts: any[] = []
    if (products.length > 0) {

        for (let product of products) {
            let selectedProduct = await productService.findByIdAndStatusIn(product.productId, [WellKnownStatus.ACTIVE]);

            if (selectedProduct) {
                let obj: any = {
                    productId: selectedProduct._id,
                    enteredMeasureUnitId: product.enteredMeasureUnitId,
                    actualMeasureUnitId: selectedProduct.measureUnit,
                    siConvertedQuantity: fromMeasureUnitToSiMeasureUnit(product.enteredMeasureUnitId, product.quantity),
                    quantity: product.quantity,
                    remarks: product.remarks,
                }

                toBeSavedProducts.push(obj);
            } else {
                throw new NotFoundError('Selected product not found!');
            }
        }

    } else {
        throw new BadRequestError('Please add at least one product to proceed!');
    }

    const session = await startSession();
    try {
        session.startTransaction();

        let grn = new Grn(
            {
                grnNumber: nextGrnNumber,
                grnNumberWithPrefix: grnNumberWithPrefix,
                grnDate: new Date(),
                grnRemarks: grnRemarks,
                products: toBeSavedProducts,
                status: WellKnownGrnStatus.PENDING,
                createdBy: auth.id,
                updatedBy: auth.id
            }
        )

        await grnService.save(grn, session);

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Good Receipt Note saved successfully!',
            grn
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

const updatedGrn = async (req: Request, res: Response) => {
    const id = req.params.id;
    const { grnRemarks, products } = req.body;
    const auth = req.auth;

    // Validate request body
    const { error } = grnValidation.grnSaveSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    let grn: any = await grnService.findByIdAndStatusIn(id, [WellKnownGrnStatus.PENDING]);

    if (!grn) {
        throw new NotFoundError('Pending Good Receipt Note not found for update!');
    }

    let toBeSavedProducts: any[] = []
    if (products.length > 0) {

        for (let product of products) {
            let selectedProduct = await productService.findByIdAndStatusIn(product.productId, [WellKnownStatus.ACTIVE]);

            if (selectedProduct) {
                let obj: any = {
                    productId: selectedProduct._id,
                    enteredMeasureUnitId: product.enteredUnitId,
                    actualMeasureUnitId: selectedProduct.measureUnit,
                    siConvertedQuantity: fromMeasureUnitToSiMeasureUnit(product.enteredMeasureUnitId, product.quantity),
                    remarks: product.remarks,
                }

                toBeSavedProducts.push(obj);
            } else {
                throw new NotFoundError('Selected product not found!');
            }
        }
    } else {
        throw new BadRequestError('Please add at least one product to proceed!');
    }

    const session = await startSession();

    try {
        session.startTransaction();

        grn.grnRemarks = grnRemarks;
        grn.products = toBeSavedProducts;
        grn.updatedBy = auth.id;

        await grnService.save(grn, session);

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Good Receipt Note updated successfully!',
            grn
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

const approveGrn = async (req: Request, res: Response) => {
    const id = req.params.id;
    const auth = req.auth;
    const { remark } = req.body;

    // Validate request body
    const { error } = grnValidation.grnApproveRejectSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    let grn: any = await grnService.findByIdAndStatusIn(id, [WellKnownGrnStatus.PENDING]);

    if (!grn) {
        throw new NotFoundError('Pending Good Receipt Note not found for approval!');
    }

    const session = await startSession();

    try {
        session.startTransaction();

        grn.approvedBy = auth.id;
        grn.approvedDate = new Date();
        grn.updatedBy = auth.id;
        grn.approvedRejectedRemarks = remark;
        grn.status = WellKnownGrnStatus.APPROVED;

        await grnService.save(grn, session);

        // update product inventory and inventoryLogs one by one
        for (let product of grn.products) {
            let selectedProduct = await productService.findByIdAndStatusIn(product.productId, [WellKnownStatus.ACTIVE]);
            if (selectedProduct) {
                let beforeTransactionInventory = selectedProduct.inventory;
                selectedProduct.inventory = selectedProduct.inventory + product.siConvertedQuantity;
                selectedProduct.updatedBy = auth.id;

                let productMeasureUnit: any = measureUnit.find((item: any) => item.unitId === selectedProduct.measureUnit);
                let siUnitCode = "";
                if (productMeasureUnit.isSaveWithSiUnit) {
                    const siUnit = measureUnit.find((item: any) => item.isSiUnit && item.categoryId === productMeasureUnit.categoryId);
                    siUnitCode = siUnit != null ? siUnit?.code : "";
                } else {
                    siUnitCode = productMeasureUnit.code || ""
                }

                // updated product inventoryLogs
                let inventoryLogMsg = {
                    inventoryLogType: WellKnownGrnLogType.GRN_APPROVED,
                    inventoryLogDate: new Date(),
                    inventoryLogQuantity: product.siConvertedQuantity,
                    inventoryLogProductId: product.productId,
                    beforeTransactionInventory: beforeTransactionInventory,
                    afterTransactionInventory: selectedProduct.inventory,
                    inventoryLogCreatedBy: auth.id,
                    message: `Inventory updated: ${product.siConvertedQuantity}${siUnitCode} added for product "${selectedProduct.productName}" via approved GRN ${grn.grnNumberWithPrefix}.`
                }

                selectedProduct.inventoryLogs.push(inventoryLogMsg);

                await productService.save(selectedProduct, session);
            }
        }

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Good Receipt Note approved successfully!',
            grn
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

const rejectGrn = async (req: Request, res: Response) => {
    const id = req.params.id;
    const auth = req.auth;
    const { remark } = req.body;

    // Validate request body
    const { error } = grnValidation.grnApproveRejectSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    let grn: any = await grnService.findByIdAndStatusIn(id, [WellKnownGrnStatus.PENDING]);

    if (!grn) {
        throw new NotFoundError('Pending Good Receipt Note not found for rejection!');
    }

    const session = await startSession();

    try {
        session.startTransaction();

        grn.rejectedBy = auth.id;
        grn.rejectedDate = new Date();
        grn.updatedBy = auth.id;
        grn.approvedRejectedRemarks = remark;
        grn.status = WellKnownGrnStatus.REJECTED;

        await grnService.save(grn, session);

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Good Receipt Note rejected successfully!',
            grn
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

const cancelGrn = async (req: Request, res: Response) => {
    const id = req.params.id;
    const auth = req.auth;

    let grn: any = await grnService.findByIdAndStatusIn(id, [WellKnownGrnStatus.PENDING]);

    if (!grn) {
        throw new NotFoundError('Pending Good Receipt Note not found for cancel!');
    }

    const session = await startSession();

    try {
        session.startTransaction();

        grn.updatedBy = auth.id;
        grn.status = WellKnownGrnStatus.CANCELLED;

        await grnService.save(grn, session);

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Good Receipt Note cancelled successfully!',
            grn
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

const getGrnById = async (req: Request, res: Response) => {
    const id = req.params.id;

    let grn: any = await grnService.findByIdAndStatusInWithData(id, [WellKnownGrnStatus.PENDING, WellKnownGrnStatus.APPROVED, WellKnownGrnStatus.REJECTED, WellKnownGrnStatus.CANCELLED]);

    if (!grn) {
        throw new NotFoundError('Good Receipt Note not found!');
    }

    return CommonResponse(res, true, StatusCodes.OK, '', grnUtil.modelToGrnResponseDto(grn));
}

const grnAdvanceSearch = async (req: Request, res: Response) => {
    const { startDate, endDate, status } = req.body;

    // Validate request body
    const { error } = grnValidation.advanceSearchSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    let grns: any = await grnService.advanceSearch(startDate, endDate, status);

    let response: GrnSearchResponseDto[] = []

    if (grns.length > 0) {
        response = grnUtil.modelsToGrnSearchResponseDtos(grns);
    }

    return CommonResponse(res, true, StatusCodes.OK, '', response);
}

const getNextGrnNumber = async (req: Request, res: Response) => {
    let nextGrnNumber = await grnService.getNextGrnNumber();

    let grnNumberWithPrefix = constants.NUMBERPREFIX.GRN + nextGrnNumber.toString().padStart(3, '0')

    CommonResponse(res, true, StatusCodes.OK, '', grnNumberWithPrefix);
}

const fromMeasureUnitToSiMeasureUnit = (fromUnitId: number, quantity: number) => {
    let quantityInSiUnit = 0;

    let fromUnit = measureUnit.find((item: any) => item.unitId === fromUnitId);

    if (fromUnit?.isSaveWithSiUnit) {
        if (fromUnit?.isSiUnit) {
            quantityInSiUnit = quantity;
        } else {
            quantityInSiUnit = quantity * fromUnit?.conversionToSi
        }
    } else {
        quantityInSiUnit = quantity
    }

    return quantityInSiUnit;
}

const fromMeasureUnitToOtherMeasureUnit = (fromUnitId: number, toUnitId: number, quantity: number) => {
    let quantityInOtherUnit = 0;

    let fromUnit = measureUnit.find((item: any) => item.unitId === fromUnitId);
    let toUnit = measureUnit.find((item: any) => item.unitId === toUnitId);


    if (fromUnit?.categoryId != toUnit?.categoryId) {
        throw new BadRequestError("Invalid Measure Unit Conversion!");
    }

    if (fromUnit?.conversionToSi && toUnit?.conversionToSi) {
        let fromQuantityInSiUnit = fromMeasureUnitToSiMeasureUnit(fromUnitId, quantity);

        quantityInOtherUnit = fromQuantityInSiUnit / toUnit?.conversionToSi;
    } else {
        quantityInOtherUnit = quantity;
    }

    return quantityInOtherUnit;
}

const fromSiMeasureUnitToOtherMeasureUnit = (fromUnitId: number, toUnitId: number, siQuantity: number) => {
    let quantityInOtherUnit = 0;

    let fromUnit = measureUnit.find((item: any) => item.unitId === fromUnitId);
    let toUnit = measureUnit.find((item: any) => item.unitId === toUnitId);


    if (fromUnit?.categoryId != toUnit?.categoryId) {
        throw new BadRequestError("Invalid Measure Unit Conversion!");
    }

    if (fromUnit && toUnit) {
        if (toUnit?.isSiUnit) {
            quantityInOtherUnit = siQuantity;
        } else {
            quantityInOtherUnit = siQuantity / toUnit?.conversionToSi;
        }
    }

    return quantityInOtherUnit;
}

export {
    saveGrn, updatedGrn, approveGrn, rejectGrn, cancelGrn, getGrnById, grnAdvanceSearch, getNextGrnNumber
}