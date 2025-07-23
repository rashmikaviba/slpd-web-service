import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { startSession } from "mongoose";

import { WellKnownStatus } from "../../util/enums/well-known-status.enum";

import BadRequestError from "../../error/BadRequestError";
import NotFoundError from "../../error/NotFoundError";
import CommonResponse from "../../util/commonResponse";
import tripService from "../trip/trip.service";
import { WellKnownTripStatus } from "../../util/enums/well-known-trip-status.enum";
import posService from "./pos.service";
import posValidation from "./pos.validation";
import Pos from "./pos.model";
import productService from "../inventory/product/product.service";
import { measureUnit } from "../../util/data/measureUnitData";
import { WellKnownGrnLogType } from "../../util/enums/well-known-grn-log-type.enum";
import { PosGetByIdReponseDto } from "./dto/posGetByIdReponseDto";
import posUtils from "./pos.utils";
import InternalServerError from "../../error/InternalServerError";


const saveProductForPos = async (req: Request, res: Response) => {
    const tripId: any = req.params.tripId;
    const { productId, quantity, unitOfMeasure } = req.body;
    const auth = req.auth;

    // Validate request body
    const { error } = posValidation.savePosProductSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    // need to check trip status as started
    const trip = await tripService.findByIdAndStatusIn(tripId, [
        WellKnownTripStatus.PENDING,
        WellKnownTripStatus.START,
        WellKnownTripStatus.FINISHED,
        WellKnownTripStatus.START,
    ])

    if (!trip) {
        throw new BadRequestError('Trip not found!');
    } else if (trip.status !== WellKnownTripStatus.START) {
        throw new BadRequestError('You can not save pos transaction, because trip is not in started status!');
    }

    let posTransactionQtyWithSiUnit = fromMeasureUnitToSiMeasureUnit(unitOfMeasure, quantity);

    let product: any = await productService.findByIdAndStatusIn(productId, [
        WellKnownStatus.ACTIVE
    ]);

    if (!product) {
        throw new BadRequestError('Product is not found!');
    } else if (product.inventory < posTransactionQtyWithSiUnit) {
        throw new BadRequestError('You can not save pos transaction, because product inventory is not enough!');
    }

    let tripPosData: any = await posService.findByTripIdAndStatusIn(tripId, [
        WellKnownStatus.ACTIVE
    ])

    const session = await startSession();
    try {
        session.startTransaction();

        if (!tripPosData) {

            // create new pos object to
            let newPosModel = new Pos(
                {
                    tripId: tripId,
                    products: [],
                    totalAmount: 0,
                    isTripEndAuditDone: false,
                    endAuditProducts: [],
                    totalConsumedAmount: 0,
                    createdBy: auth.id,
                    updatedBy: auth.id
                }
            );

            let newProduct = {
                product: productId,
                isReturnableProduct: product.isReturnableProduct,
                unitPrice: product.unitPrice,
                productUnitOfMeasure: product.measureUnit,
                enteredUnitOfMeasure: unitOfMeasure,
                enteredQuantity: quantity,
                quantityWithSiUnitOfMeasure: posTransactionQtyWithSiUnit,
                status: WellKnownStatus.ACTIVE,
                createdBy: auth.id,
                updatedBy: auth.id,
            }

            newPosModel.products.push(newProduct);
            newPosModel.totalAmount += fromMeasureUnitToOtherMeasureUnit(unitOfMeasure, product.measureUnit, quantity) * product.unitPrice;

            tripPosData = await posService.save(newPosModel, session);

        } else {

            let newProduct = {
                product: productId,
                isReturnableProduct: product.isReturnableProduct,
                unitPrice: product.unitPrice,
                productUnitOfMeasure: product.measureUnit,
                enteredUnitOfMeasure: unitOfMeasure,
                enteredQuantity: quantity,
                quantityWithSiUnitOfMeasure: posTransactionQtyWithSiUnit,
                status: WellKnownStatus.ACTIVE,
                createdBy: auth.id,
                updatedBy: auth.id,
            }

            tripPosData.products.push(newProduct);
            tripPosData.totalAmount = 0;
            tripPosData.products.forEach((product: any) => {
                if (product.status == WellKnownStatus.ACTIVE) {
                    tripPosData.totalAmount += fromMeasureUnitToOtherMeasureUnit(product.enteredUnitOfMeasure, product.productUnitOfMeasure, product.enteredQuantity) * product.unitPrice;
                }
            })

            tripPosData = await posService.save(tripPosData, session);
        }

        let productMeasureUnit: any = measureUnit.find((item: any) => item.unitId === product.measureUnit);
        let siUnitCode = "";
        if (productMeasureUnit.isSaveWithSiUnit) {
            const siUnit = measureUnit.find((item: any) => item.isSiUnit && item.categoryId === productMeasureUnit.categoryId);
            siUnitCode = siUnit != null ? siUnit?.code : "";
        } else {
            siUnitCode = productMeasureUnit.code || ""
        }

        // remove product from inventory
        let beforeTransactionInventory = product.inventory;
        product.inventory -= posTransactionQtyWithSiUnit;
        let inventoryLogMsg = {
            inventoryLogType: WellKnownGrnLogType.POS_TRANSACTION,
            inventoryLogDate: new Date(),
            inventoryLogQuantity: posTransactionQtyWithSiUnit,
            beforeTransactionInventory: beforeTransactionInventory,
            afterTransactionInventory: product.inventory,
            inventoryLogProductId: product._id,
            inventoryLogCreatedBy: auth.id,
            message: `Inventory updated: ${posTransactionQtyWithSiUnit}${siUnitCode} removed from product "${product.productName}" via POS transaction to trip "${trip.tripConfirmedNumber}".`
        }

        product.inventoryLogs.push(inventoryLogMsg)
        product = await productService.save(product, session);

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Pos transaction saved successfully!',
            tripPosData
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

// voidProduct: '/voidPosProduct/:id/trip/:tripId',
const voidProductInPos = async (req: Request, res: Response) => {
    const tripId = req.params.tripId;
    const posId = req.params.id;
    const auth = req.auth;

    // need to check trip status as started
    const trip = await tripService.findByIdAndStatusIn(tripId, [
        WellKnownTripStatus.PENDING,
        WellKnownTripStatus.START,
        WellKnownTripStatus.FINISHED,
        WellKnownTripStatus.START,
    ])

    if (!trip) {
        throw new BadRequestError('Trip not found!');
    } else if (trip.status !== WellKnownTripStatus.START) {
        throw new BadRequestError('You can not void pos transaction, because trip is not in started status!');
    }

    let tripPosData: any = await posService.findByTripIdAndStatusIn(tripId, [
        WellKnownStatus.ACTIVE
    ])

    const session = await startSession();
    try {
        session.startTransaction();

        let selectedPosData: any = tripPosData.products.find((item: any) => item._id.toString() === posId);

        if (!selectedPosData) {
            throw new BadRequestError('Pos transaction not found to void!');
        }

        selectedPosData.status = WellKnownStatus.DELETED;
        selectedPosData.updatedBy = auth.id;
        selectedPosData.updatedAt = new Date();

        tripPosData.totalAmount = 0;
        tripPosData.products.forEach((product: any) => {
            if (product.status == WellKnownStatus.ACTIVE) {
                tripPosData.totalAmount += fromMeasureUnitToOtherMeasureUnit(product.enteredUnitOfMeasure, product.productUnitOfMeasure, product.enteredQuantity) * product.unitPrice;
            }
        })

        tripPosData = await posService.save(tripPosData, session);

        // Add inventory log
        let product: any = await productService.findByIdAndStatusIn(selectedPosData.product, [
            WellKnownStatus.ACTIVE
        ]);

        if (!product) {
            throw new BadRequestError('Product not found!');
        }

        let productMeasureUnit: any = measureUnit.find((item: any) => item.unitId === product?.measureUnit);
        let siUnitCode = "";
        if (productMeasureUnit.isSaveWithSiUnit) {
            const siUnit = measureUnit.find((item: any) => item.isSiUnit && item.categoryId === productMeasureUnit.categoryId);
            siUnitCode = siUnit != null ? siUnit?.code : "";
        } else {
            siUnitCode = productMeasureUnit.code || ""
        }


        let beforeTransactionInventory = product.inventory;
        product.inventory += selectedPosData.quantityWithSiUnitOfMeasure;
        let inventoryLogMsg = {
            inventoryLogType: WellKnownGrnLogType.POS_TRANSACTION,
            inventoryLogDate: new Date(),
            inventoryLogQuantity: selectedPosData.quantityWithSiUnitOfMeasure,
            beforeTransactionInventory: beforeTransactionInventory,
            afterTransactionInventory: product.inventory,
            inventoryLogProductId: product._id,
            inventoryLogCreatedBy: auth.id,
            message: `Inventory updated: ${selectedPosData.quantityWithSiUnitOfMeasure}${siUnitCode} added to product "${product.productName}" via voiding POS transaction in trip "${tripPosData?.tripId?.tripConfirmedNumber}".`
        }

        product.inventoryLogs.push(inventoryLogMsg)
        product = await productService.save(product, session);

        await session.commitTransaction();

        return CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Pos transaction void successfully!',
            tripPosData
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

const tripEndPosAudit = async (req: Request, res: Response) => {
    const { tripId, auditRecords } = req.body;
    const auth = req.auth;

    // Validate request body
    const { error } = posValidation.tripEndAuditShema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    let tripPosData: any = await posService.findByTripIdAndStatusInWIthProducts(tripId, [
        WellKnownStatus.ACTIVE
    ])

    if (!tripPosData) {
        throw new BadRequestError('Pos transaction not found for given trip!');
    }

    const session = await startSession();
    try {
        session.startTransaction();

        let products: any[] = tripPosData?.products;
        let endAuditProducts: any[] = [];
        let gettedProductsFromDb: any[] = [];

        for (let auditRecord of auditRecords) {

            let selectedPosTransaction = products.find((item: any) => item._id.toString() == auditRecord.id);

            if (!selectedPosTransaction) {
                throw new BadRequestError('Pos transaction not found for given trip!');
            }

            let isReturnableProduct = selectedPosTransaction.isReturnableProduct;

            let product: any = null;

            if (gettedProductsFromDb.find((item: any) => item._id.toString() == selectedPosTransaction?.product?._id.toString())) {
                product = gettedProductsFromDb.find((item: any) => item._id.toString() == selectedPosTransaction.product?._id.toString());
            } else {
                product = await productService.findByIdAndStatusIn(selectedPosTransaction.product, [
                    WellKnownStatus.ACTIVE
                ])
            }

            if (!product) {
                throw new BadRequestError('Product not found!');
            }

            let returnedQuantityWithSiUnitOfMeasure = fromMeasureUnitToSiMeasureUnit(auditRecord.returnUnitOfMeasure, auditRecord.returnQuantity);

            let productMeasureUnit: any = measureUnit.find((item: any) => item.unitId === product?.measureUnit);
            let siUnitCode = "";
            if (productMeasureUnit.isSaveWithSiUnit) {
                const siUnit = measureUnit.find((item: any) => item.isSiUnit && item.categoryId === productMeasureUnit.categoryId);
                siUnitCode = siUnit != null ? siUnit?.code : "";
            } else {
                siUnitCode = productMeasureUnit.code || ""
            }

            if (selectedPosTransaction.quantityWithSiUnitOfMeasure < returnedQuantityWithSiUnitOfMeasure) {
                throw new BadRequestError(`Return quantity is more than available quantity for product "${product.productName}"!`);
            }

            if (isReturnableProduct) {
                if (selectedPosTransaction.quantityWithSiUnitOfMeasure == returnedQuantityWithSiUnitOfMeasure) {

                    let obj = {
                        product: selectedPosTransaction.product._id,
                        transactionId: selectedPosTransaction._id,
                        isReturnableProduct: selectedPosTransaction.isReturnableProduct,
                        isReturned: auditRecord.isReturned,
                        notReturnedReson: auditRecord.notReturnedReason,
                        returnedquantity: auditRecord.returnQuantity,
                        returnedUnitOfMeasure: auditRecord.returnUnitOfMeasure,
                        returnedQuantityWithSiUnitOfMeasure: returnedQuantityWithSiUnitOfMeasure,
                        createdBy: auth.id,
                        createdAt: new Date()
                    }

                    endAuditProducts.push(obj);

                    // Genarate Log Message to increase inventory
                    let beforeTransactionInventory = product.inventory;
                    product.inventory += returnedQuantityWithSiUnitOfMeasure;

                    let inventoryLogMsg = {
                        inventoryLogType: WellKnownGrnLogType.POS_TRANSACTION_RETURN,
                        inventoryLogDate: new Date(),
                        inventoryLogQuantity: returnedQuantityWithSiUnitOfMeasure,
                        beforeTransactionInventory: beforeTransactionInventory,
                        afterTransactionInventory: product.inventory,
                        inventoryLogProductId: product._id,
                        inventoryLogCreatedBy: auth.id,
                        message: `Inventory Updated : ${returnedQuantityWithSiUnitOfMeasure}${siUnitCode} added to product "${product.productName}" via return of POS transaction in trip "${tripPosData?.tripId?.tripConfirmedNumber}".`
                    }

                    product.inventoryLogs.push(inventoryLogMsg)
                    product = await productService.save(product, session);

                } else {

                    let obj = {
                        product: selectedPosTransaction.product._id,
                        transactionId: selectedPosTransaction._id,
                        isReturnableProduct: selectedPosTransaction.isReturnableProduct,
                        isReturned: auditRecord.isReturned,
                        notReturnedReson: auditRecord.notReturnedReason,
                        returnedquantity: auditRecord.returnQuantity,
                        returnedUnitOfMeasure: auditRecord.returnUnitOfMeasure,
                        returnedQuantityWithSiUnitOfMeasure: returnedQuantityWithSiUnitOfMeasure,
                        createdBy: auth.id,
                        createdAt: new Date()
                    }

                    endAuditProducts.push(obj);

                    // Genarate Log Message to increase inventory
                    let beforeTransactionInventory = product.inventory;
                    product.inventory += returnedQuantityWithSiUnitOfMeasure;

                    let inventoryLogMsg = {
                        inventoryLogType: WellKnownGrnLogType.POS_TRANSACTION_RETURN,
                        inventoryLogDate: new Date(),
                        inventoryLogQuantity: returnedQuantityWithSiUnitOfMeasure,
                        beforeTransactionInventory: beforeTransactionInventory,
                        afterTransactionInventory: product.inventory,
                        inventoryLogProductId: product._id,
                        inventoryLogCreatedBy: auth.id,
                        message: `Inventory Updated : ${returnedQuantityWithSiUnitOfMeasure}${siUnitCode} added to product and ${selectedPosTransaction.quantityWithSiUnitOfMeasure - returnedQuantityWithSiUnitOfMeasure}${siUnitCode} left in product  "${product.productName}" via return of POS transaction in trip "${tripPosData?.tripId?.tripConfirmedNumber}". Reason for not return: ${auditRecord?.notReturnedReason || "N/A"}`
                    }

                    product.inventoryLogs.push(inventoryLogMsg)
                    product = await productService.save(product, session);
                }
            } else {
                if (returnedQuantityWithSiUnitOfMeasure > 0) {

                    let obj = {
                        product: selectedPosTransaction.product._id,
                        transactionId: selectedPosTransaction._id,
                        isReturnableProduct: selectedPosTransaction.isReturnableProduct,
                        isReturned: auditRecord.isReturned,
                        notReturnedReson: auditRecord.notReturnedReson,
                        returnedquantity: auditRecord.returnQuantity,
                        returnedUnitOfMeasure: auditRecord.returnUnitOfMeasure,
                        returnedQuantityWithSiUnitOfMeasure: returnedQuantityWithSiUnitOfMeasure,
                        createdBy: auth.id,
                        createdAt: new Date()
                    }

                    endAuditProducts.push(obj);

                    // Genarate Log Message to increase inventory
                    let beforeTransactionInventory = product.inventory;
                    product.inventory += returnedQuantityWithSiUnitOfMeasure;

                    let inventoryLogMsg = {
                        inventoryLogType: WellKnownGrnLogType.POS_TRANSACTION_RETURN,
                        inventoryLogDate: new Date(),
                        inventoryLogQuantity: returnedQuantityWithSiUnitOfMeasure,
                        beforeTransactionInventory: beforeTransactionInventory,
                        afterTransactionInventory: product.inventory,
                        inventoryLogProductId: product._id,
                        inventoryLogCreatedBy: auth.id,
                        message: `Inventory Updated : ${returnedQuantityWithSiUnitOfMeasure}${siUnitCode} added to product "${product.productName}" via return product of POS transaction in trip "${tripPosData?.tripId?.tripConfirmedNumber}".`
                    }

                    product.inventoryLogs.push(inventoryLogMsg)

                    product = await productService.save(product, session);
                } else {
                    let obj = {
                        product: selectedPosTransaction.product._id,
                        transactionId: selectedPosTransaction._id,
                        isReturnableProduct: selectedPosTransaction.isReturnableProduct,
                        isReturned: auditRecord.isReturned,
                        notReturnedReson: auditRecord.notReturnedReson,
                        returnedquantity: auditRecord.returnQuantity,
                        returnedUnitOfMeasure: auditRecord.returnUnitOfMeasure,
                        returnedQuantityWithSiUnitOfMeasure: returnedQuantityWithSiUnitOfMeasure,
                        createdBy: auth.id,
                        createdAt: new Date()
                    }

                    endAuditProducts.push(obj);
                }
            }

            if (gettedProductsFromDb.find((item: any) => item._id.toString() === selectedPosTransaction.product.toString())) {
                gettedProductsFromDb.splice(gettedProductsFromDb.findIndex((item: any) => item._id.toString() === selectedPosTransaction.product.toString()), 1);
                gettedProductsFromDb.push(product);
            } else {
                gettedProductsFromDb.push(product);
            }
        }

        if (endAuditProducts.length > 0) {
            tripPosData.endAuditProducts = endAuditProducts;
            tripPosData.isTripEndAuditDone = true;

            tripPosData = await posService.save(tripPosData, session);

            await session.commitTransaction();

            CommonResponse(res, true, StatusCodes.OK, 'Trip end pos audit done successfully!', tripPosData);
        } else {
            throw new InternalServerError('Something went wrong while end trip pos audit!');
        }

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }

}

const getPosByTrip = async (req: Request, res: Response) => {
    const tripId = req.params.tripId;
    let response: PosGetByIdReponseDto = {} as PosGetByIdReponseDto;

    let tripPosData: any = await posService.findByTripIdAndStatusInWIthProducts(tripId, [
        WellKnownStatus.ACTIVE
    ])

    if (!tripPosData) {
        let trip = await tripService.findByIdAndStatusIn(tripId, [
            WellKnownTripStatus.PENDING,
            WellKnownTripStatus.START,
            WellKnownTripStatus.FINISHED,
        ])

        if (!trip) {
            throw new BadRequestError('Trip not found!');
        }

        response.tripId = tripId;
        response.products = [];
        response.tripConfirmedNumber = trip?.tripConfirmedNumber;
        response.isTripEndAuditDone = false;
        response.status = 0;
    } else {
        response = posUtils.modelToPosGetByIdReponseDto(tripPosData);
    }

    return CommonResponse(res, true, StatusCodes.OK, '', response);
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


export { saveProductForPos, voidProductInPos, tripEndPosAudit, getPosByTrip };