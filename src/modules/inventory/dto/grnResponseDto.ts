interface GrnResponseDto {
    _id: string;
    grnNumberWithPrefix: string;
    grnDate: Date;
    grnRemarks: string;
    products: GrnProductDto[];
    approvedRejectedRemarks?: string;
    status: number;
}

interface GrnProductDto {
    _id: string;
    productName: string;
    productId: string;
    quantity: number;
    remarks: string;
    enteredMeasureUnitId: string;
    measureUnit: string;
}

export default GrnResponseDto;