interface ProductResponseDto {
    _id: string;
    productName: string;
    productShortCode: string;
    measureUnit: number;
    measureUnitDetails: any;
    isReturnableProduct: boolean;
    description: string;
    unitPrice: number;
    inventory: number;
    status: number;
    statusName: string;
    createdBy: string;
    updatedBy: string;
    createdUser: string;
    updatedByUser: string;
    createdAt: Date;
    updatedAt: Date;
}

export default ProductResponseDto;