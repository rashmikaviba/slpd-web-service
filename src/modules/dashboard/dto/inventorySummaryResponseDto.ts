interface InventorySummaryResponseDto {
    _id: string;
    productName: string;
    productShortCode: string;
    measureUnitDetails: any;
    inventory: number;
}

export default InventorySummaryResponseDto;