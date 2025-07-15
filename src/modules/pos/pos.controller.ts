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

    let product: any = await productService.findByIdAndStatusIn(productId, [
        WellKnownStatus.ACTIVE
    ]);

    if (!product) {
        throw new BadRequestError('Product is not found!');
    }

    let tripPosData: any = await posService.findByTripIdAndStatusIn(tripId, [
        WellKnownStatus.ACTIVE
    ])

    const session = await startSession();
    try {
        session.startTransaction();

        let posTransactionQtyWithSiUnit = fromMeasureUnitToSiMeasureUnit(unitOfMeasure, quantity);
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
                productId: productId,
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
                productId: productId,
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
        product.inventory -= posTransactionQtyWithSiUnit;
        let inventoryLogMsg = {
            inventoryLogType: WellKnownGrnLogType.POS_TRANSACTION,
            inventoryLogDate: new Date(),
            inventoryLogQuantity: posTransactionQtyWithSiUnit,
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

        let selectedPosData: any = tripPosData.products.find((item: any) => item._id == posId);

        if (!selectedPosData) {
            throw new BadRequestError('Pos transaction not found!');
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
        let product: any = await productService.findByIdAndStatusIn(selectedPosData.productId, [
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


        product.inventory += selectedPosData.quantityWithSiUnitOfMeasure;
        let inventoryLogMsg = {
            inventoryLogType: WellKnownGrnLogType.POS_TRANSACTION,
            inventoryLogDate: new Date(),
            inventoryLogQuantity: selectedPosData.quantityWithSiUnitOfMeasure,
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

// "/tripEndAudit/:tripId",
const tripEndPosAudit = async (req: Request, res: Response) => {
    const tripId = req.params.tripId;

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
        response.status = 0;
    } else {

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