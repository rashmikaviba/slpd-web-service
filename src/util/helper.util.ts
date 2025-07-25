import BadRequestError from "../error/BadRequestError";
import { measureUnit } from "./data/measureUnitData";

// return the name of the enum value
const getNameFromEnum = (enumValue: any, value: any): string => {
    return enumValue[value];
};

// check if the value is in the enum value
const isValueInEnum = (enumValue: any, value: any): boolean => {
    return Object.values(enumValue).includes(value);
};


const fromMeasureUnitToSiMeasureUnit = (fromUnitId: number, quantity: number) => {
    let quantityInSiUnit = 0;

    let fromUnit = measureUnit.find((item: any) => item.unitId === fromUnitId);

    if (fromUnit?.isSaveWithSiUnit) {
        if (fromUnit?.isSiUnit) {
            quantityInSiUnit = quantity;
        } else {
            quantityInSiUnit = quantity * fromUnit?.conversionToSi
        }
    } else {
        quantityInSiUnit = quantity
    }

    return quantityInSiUnit;
}

const fromMeasureUnitToOtherMeasureUnit = (fromUnitId: number, toUnitId: number, quantity: number) => {
    let quantityInOtherUnit = 0;

    let fromUnit = measureUnit.find((item: any) => item.unitId === fromUnitId);
    let toUnit = measureUnit.find((item: any) => item.unitId === toUnitId);


    if (fromUnit?.categoryId != toUnit?.categoryId) {
        throw new BadRequestError("Invalid Measure Unit Conversion!");
    }

    if (fromUnit?.conversionToSi && toUnit?.conversionToSi) {
        let fromQuantityInSiUnit = fromMeasureUnitToSiMeasureUnit(fromUnitId, quantity);

        quantityInOtherUnit = fromQuantityInSiUnit / toUnit?.conversionToSi;
    } else {
        quantityInOtherUnit = quantity;
    }

    return quantityInOtherUnit;
}

const fromSiMeasureUnitToOtherMeasureUnit = (fromUnitId: number, toUnitId: number, siQuantity: number) => {
    let quantityInOtherUnit = 0;

    let fromUnit = measureUnit.find((item: any) => item.unitId === fromUnitId);
    let toUnit = measureUnit.find((item: any) => item.unitId === toUnitId);


    if (fromUnit?.categoryId != toUnit?.categoryId) {
        throw new BadRequestError("Invalid Measure Unit Conversion!");
    }

    if (fromUnit && toUnit) {
        if (toUnit?.isSiUnit) {
            quantityInOtherUnit = siQuantity;
        } else {
            quantityInOtherUnit = siQuantity / toUnit?.conversionToSi;
        }
    }

    return quantityInOtherUnit;
}

export default {
    getNameFromEnum,
    isValueInEnum,
    fromMeasureUnitToSiMeasureUnit,
    fromMeasureUnitToOtherMeasureUnit,
    fromSiMeasureUnitToOtherMeasureUnit
};
