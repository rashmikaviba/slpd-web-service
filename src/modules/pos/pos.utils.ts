import { measureUnit } from "../../util/data/measureUnitData";
import helperUtil from "../../util/helper.util";
import { PosGetByIdReponseDto, PosProductDto } from "./dto/posGetByIdReponseDto";

const modelToPosGetByIdReponseDto = (pos: any): PosGetByIdReponseDto => {
    let productdtos: PosProductDto[] = [];


    pos.products.forEach((product: any) => {
        let selectedAudit = null;
        let consiumedQuantityWithSiUnit = 0;
        let siUnitId = 0;
        if (pos.isTripEndAuditDone) {
            selectedAudit = pos.endAuditProducts.find((audit: any) => audit.transactionId.toString() === product._id.toString());
            if (selectedAudit) {
                consiumedQuantityWithSiUnit = product.product.isReturnableProduct ? product.quantityWithSiUnitOfMeasure
                    : product.quantityWithSiUnitOfMeasure - selectedAudit.returnedQuantityWithSiUnitOfMeasure;

                let productMeasureUnit: any = measureUnit.find((item: any) => item.unitId === product.productUnitOfMeasure);
                if (productMeasureUnit.isSaveWithSiUnit) {
                    siUnitId = measureUnit.find((item: any) => item.isSiUnit && item.categoryId === productMeasureUnit.categoryId)?.unitId || 0;
                } else {
                    siUnitId = productMeasureUnit.unitId;
                }

            }
        }

        productdtos.push({
            id: product._id,
            productName: product.product?.productName,
            product: product.product?._id,
            isReturnableProduct: product.isReturnableProduct,
            unitPrice: product.unitPrice,
            productUnitOfMeasure: product.productUnitOfMeasure,
            enteredUnitOfMeasure: product.enteredUnitOfMeasure,
            enteredQuantity: product.enteredQuantity,
            quantityWithSiUnitOfMeasure: product.quantityWithSiUnitOfMeasure,
            status: product.status,
            productUnitOfMeasureCode: measureUnit.find(mu => mu.unitId === product.productUnitOfMeasure)?.code || "",
            enteredUnitOfMeasureCode: measureUnit.find(mu => mu.unitId === product.enteredUnitOfMeasure)?.code || "",
            productMeasureUnitDetails: measureUnit.find(mu => mu.unitId === product.productUnitOfMeasure),
            returnedQuantity: pos.isTripEndAuditDone ? selectedAudit?.returnedquantity || 0 : 0,
            returnedUnitOfMeasure: pos.isTripEndAuditDone ? selectedAudit?.returnedUnitOfMeasure || 0 : 0,
            returnedUnitOfMeasureCode: pos.isTripEndAuditDone ? measureUnit.find(mu => mu.unitId === selectedAudit?.returnedUnitOfMeasure)?.code || "" : "",
            returnedQuantityWithSiUnitOfMeasure: pos.isTripEndAuditDone ? selectedAudit?.returnedQuantityWithSiUnitOfMeasure || 0 : 0,
            consiumedQuantity: pos.isTripEndAuditDone ? helperUtil.fromSiMeasureUnitToOtherMeasureUnit(siUnitId, product.enteredUnitOfMeasure, consiumedQuantityWithSiUnit) : 0,
            notReturnedReason: pos.isTripEndAuditDone ? selectedAudit?.notReturnedReson || "" : "",
            createdAt: product.createdAt
        })
    })

    return {
        _id: pos._id,
        tripId: pos?.tripId?._id,
        tripConfirmedNumber: pos?.tripId?.tripConfirmedNumber,
        products: productdtos,
        totalAmount: pos.totalAmount,
        isTripEndAuditDone: pos.isTripEndAuditDone,
        totalConsumedAmount: pos.totalConsumedAmount,
        endAuditProducts: pos.endAuditProducts,
        status: pos.status
    }
}


export default {
    modelToPosGetByIdReponseDto
}