interface GrnSearchResponseDto {
    _id: string;
    grnNumberWithPrefix: string;
    grnDate: Date;
    grnRemarks: string;
    productsNames: string;
    status: number;
    statusName: string;
    createdBy: string;
    createdByName: string;
    approvedOrRejectedDate: Date;
    approvedOrRejectedBy: string;
    approvedOrRejectedByName: string;
    approvedRejectedRemarks: string;
}

export default GrnSearchResponseDto