import { measureUnit } from "../../../util/data/measureUnitData";
import { WellKnownStatus } from "../../../util/enums/well-known-status.enum";
import helperUtil from "../../../util/helper.util";
import ProductResponseDto from "../dto/productResponseDto";

const modelToProductResponseDto = (product: any): ProductResponseDto => {

    let productResponseDto: ProductResponseDto = {
        _id: product._id,
        productName: product.productName,
        productShortCode: product.productShortCode,
        measureUnit: product.measureUnit,
        measureUnitDetails: measureUnit.find((item: any) => item.unitId === product.measureUnit),
        isReturnableProduct: product.isReturnableProduct,
        unitPrice: product.unitPrice,
        // inventory: product.inventory,
        inventory: fromSiMeasureUnitToOtherMeasureUnit(product.measureUnit, product.inventory),
        status: product.status,
        statusName: helperUtil.getNameFromEnum(WellKnownStatus, product.status),
        createdBy: product.createdBy?._id || "",
        updatedBy: product.updatedBy?._id || "",
        createdUser: product.createdUser?.userName || "",
        updatedByUser: product.updatedByUser?.userName || "",
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
    }

    return productResponseDto;
};

const modelsToProductResponseDtos = (products: any): ProductResponseDto[] => {

    let productResponseDtos: ProductResponseDto[] = [];

    products.forEach((product: any) => {
        productResponseDtos.push(modelToProductResponseDto(product));
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

export default { modelToProductResponseDto, modelsToProductResponseDtos };