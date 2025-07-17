interface PosGetByIdReponseDto {
    _id: string;
    tripId: string;
    tripConfirmedNumber: string;
    products: PosProductDto[];
    totalAmount: number;
    isTripEndAuditDone: boolean;
    totalConsumedAmount: number;
    endAuditProducts: any[];
    status: number;
}


interface PosProductDto {
    _id: string;
    productName: string;
    product: string;
    isReturnableProduct: boolean;
    unitPrice: number;
    productUnitOfMeasure: number;
    enteredUnitOfMeasure: number;
    enteredQuantity: number;
    quantityWithSiUnitOfMeasure: number;
    status: number;
}

export {
    PosGetByIdReponseDto,
    PosProductDto
}