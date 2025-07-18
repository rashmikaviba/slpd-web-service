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
    id: string;
    productName: string;
    product: string;
    productMeasureUnitDetails: any;
    isReturnableProduct: boolean;
    unitPrice: number;
    productUnitOfMeasure: number;
    productUnitOfMeasureCode: string;
    enteredUnitOfMeasure: number;
    enteredUnitOfMeasureCode: string;
    enteredQuantity: number;
    quantityWithSiUnitOfMeasure: number;
    status: number;
    createdAt: Date;
}

export {
    PosGetByIdReponseDto,
    PosProductDto
}