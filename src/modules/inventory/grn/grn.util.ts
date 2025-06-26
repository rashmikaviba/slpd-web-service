import { measureUnit } from "../../../util/data/measureUnitData";
import { WellKnownGrnStatus } from "../../../util/enums/well-known-grn-status.enum";
import helperUtil from "../../../util/helper.util";
import GrnResponseDto from "../dto/grnResponseDto";
import GrnSearchResponseDto from "../dto/grnSearchResponseDto";

const modelToGrnSearchResponseDto = (grn: any): GrnSearchResponseDto => {
    let grnResponse: GrnSearchResponseDto = {
        _id: grn._id,
        grnNumberWithPrefix: grn.grnNumberWithPrefix,
        grnDate: grn.grnDate,
        grnRemarks: grn.grnRemarks,
        productsNames: grn.products.length > 0 ? grn.products.map((product: any) => product.productId.productName).join(', ') : '',
        status: grn.status,
        statusName: helperUtil.getNameFromEnum(WellKnownGrnStatus, grn.status),
        createdBy: grn.createdBy._id,
        createdByName: grn.createdBy.userName,
        approvedOrRejectedDate: grn.status == WellKnownGrnStatus.APPROVED ? grn?.approvedDate : grn.status == WellKnownGrnStatus.REJECTED ? grn?.rejectedDate : null,
        approvedOrRejectedBy: grn.status == WellKnownGrnStatus.APPROVED ? grn?.approvedBy?._id : grn.status == WellKnownGrnStatus.REJECTED ? grn.rejectedBy?._id : null,
        approvedOrRejectedByName: grn.status == WellKnownGrnStatus.APPROVED ? grn?.approvedBy?.userName : grn.status == WellKnownGrnStatus.REJECTED ? grn?.rejectedBy?.userName : null,
        approvedRejectedRemarks: grn.approvedRejectedRemarks,
    }

    return grnResponse;
}

const modelToGrnResponseDto = (grn: any): GrnResponseDto => {

    let grnResponse: GrnResponseDto = {
        _id: grn._id,
        grnNumberWithPrefix: grn.grnNumberWithPrefix,
        grnDate: grn.grnDate,
        grnRemarks: grn.grnRemarks,
        approvedRejectedRemarks: grn.approvedRejectedRemarks,
        products: grn.products.map((product: any) => ({
            _id: product._id,
            productName: product.productId.productName,
            productId: product.productId._id,
            quantity: product.quantity,
            remarks: product.remarks,
            enteredMeasureUnitId: product.enteredMeasureUnitId,
            measureUnit: measureUnit.find(mu => mu.unitId === product.enteredMeasureUnitId),
        })),
        status: grn.status
    }

    return grnResponse;
}

const modelsToGrnSearchResponseDtos = (grns: any): GrnSearchResponseDto[] => {
    return grns.map((grn: any) => modelToGrnSearchResponseDto(grn));
}

export default { modelToGrnSearchResponseDto, modelsToGrnSearchResponseDtos, modelToGrnResponseDto };