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


// SI quantity -> quantity in `toUnitId` (no category check, unlike fromSiMeasureUnitToOtherMeasureUnit)
const fromSiToMeasureUnit = (toUnitId: number, siQuantity: number) => {
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

// code of the SI unit stock is kept in for a product measured in `unitId`
// (the unit's own code when the product is not saved with an SI unit)
const getSiUnitCode = (unitId: number): string => {
    let productMeasureUnit: any = measureUnit.find((item: any) => item.unitId === unitId);
    let siUnitCode = "";
    if (productMeasureUnit.isSaveWithSiUnit) {
        const siUnit = measureUnit.find((item: any) => item.isSiUnit && item.categoryId === productMeasureUnit.categoryId);
        siUnitCode = siUnit != null ? siUnit?.code : "";
    } else {
        siUnitCode = productMeasureUnit.code || ""
    }

    return siUnitCode;
}

type LogType = "info" | "error" | "warn" | "debug" | "success";

const consoleLogMessage = (
    type: LogType,
    message?: string,
    data?: any
) => {
    const timestamp = new Date().toISOString();
    const msgPart = message ? ` | ${message}` : "";
    const dataPart = data ? ` | ${JSON.stringify(data)}` : "";

    switch (type) {
        case "error":
            console.error(`${timestamp} | ERROR${msgPart}${dataPart}`);
            break;
        case "warn":
            console.warn(`${timestamp} | WARN${msgPart}${dataPart}`);
            break;
        case "debug":
            console.debug(`${timestamp} | DEBUG${msgPart}${dataPart}`);
            break;
        case "info":
            console.info(`${timestamp} | INFO${msgPart}${dataPart}`);
            break;
        case "success":
            console.info(`${timestamp} | SUCCESS${msgPart}${dataPart}`);
            break;
    }
};

export default {
    getNameFromEnum,
    isValueInEnum,
    fromMeasureUnitToSiMeasureUnit,
    fromMeasureUnitToOtherMeasureUnit,
    fromSiMeasureUnitToOtherMeasureUnit,
    fromSiToMeasureUnit,
    getSiUnitCode,
    consoleLogMessage
};
