import { measureUnit } from "../../util/data/measureUnitData";
import InventorySummaryResponseDto from "./dto/inventorySummaryResponseDto";

const modelToInventorySummeryResponse = (product: any): InventorySummaryResponseDto => {
    let productResponseDto: InventorySummaryResponseDto = {
        _id: product._id,
        productName: product.productName,
        productShortCode: product.productShortCode,
        measureUnitDetails: measureUnit.find((item: any) => item.unitId === product.measureUnit),
        inventory: fromSiMeasureUnitToOtherMeasureUnit(product.measureUnit, product.inventory),
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


const fromSiMeasureUnitToOtherMeasureUnit = (toUnitId: number, siQuantity: number) => {
    let quantityInOtherUnit = 0;

    let toUnit = measureUnit.find((item: any) => item.unitId === toUnitId);


    if (toUnit) {
        if (toUnit?.isSiUnit) {
            quantityInOtherUnit = siQuantity;
        } else {
            quantityInOtherUnit = siQuantity / toUnit?.conversionToSi;
        }
    }

    return quantityInOtherUnit;
}


export default {
    modelToInventorySummeryResponse, modelsToInventorySummeryResponseDtos
}