import { measureUnit } from "../../util/data/measureUnitData";
import helperUtil from "../../util/helper.util";
import InventorySummaryResponseDto from "./dto/inventorySummaryResponseDto";

const modelToInventorySummeryResponse = (product: any): InventorySummaryResponseDto => {
    let productResponseDto: InventorySummaryResponseDto = {
        _id: product._id,
        productName: product.productName,
        productShortCode: product.productShortCode,
        measureUnitDetails: measureUnit.find((item: any) => item.unitId === product.measureUnit),
        inventory: helperUtil.fromSiToMeasureUnit(product.measureUnit, product.inventory),
    }

    return productResponseDto;
}

const modelsToInventorySummeryResponseDtos = (products: any): InventorySummaryResponseDto[] => {

    let productResponseDtos: InventorySummaryResponseDto[] = [];

    products.forEach((product: any) => {
        productResponseDtos.push(modelToInventorySummeryResponse(product));
    });

    return productResponseDtos;
};



export default {
    modelToInventorySummeryResponse, modelsToInventorySummeryResponseDtos
}