import { PosGetByIdReponseDto, PosProductDto } from "./dto/posGetByIdReponseDto";

const modelToPosGetByIdReponseDto = (pos: any): PosGetByIdReponseDto => {
    let productdtos: PosProductDto[] = [];

    pos.products.forEach((product: any) => {
        productdtos.push({
            _id: product._id,
            productName: product.product?.productName,
            product: product.product?._id,
            isReturnableProduct: product.isReturnableProduct,
            unitPrice: product.unitPrice,
            productUnitOfMeasure: product.productUnitOfMeasure,
            enteredUnitOfMeasure: product.enteredUnitOfMeasure,
            enteredQuantity: product.enteredQuantity,
            quantityWithSiUnitOfMeasure: product.quantityWithSiUnitOfMeasure,
            status: product.status
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