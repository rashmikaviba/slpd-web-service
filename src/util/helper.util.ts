// return the name of the enum value
const getNameFromEnum = (enumValue: any, value: any): string => {
    return enumValue[value];
};

// check if the value is in the enum value
const isValueInEnum = (enumValue: any, value: any): boolean => {
    return Object.values(enumValue).includes(value);
};

export default {
    getNameFromEnum,
    isValueInEnum,
};
