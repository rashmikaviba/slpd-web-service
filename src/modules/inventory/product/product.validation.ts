import Joi from 'joi';

const productSaveSchema = Joi.object({
    productName: Joi.string().required().messages({
        'any.required': 'Product Name is required',
        'string.base': 'Product Name is invalid',
    }),
    productShortCode: Joi.string().required().messages({
        'any.required': 'Product Short Code is required',
        'string.base': 'Product Short Code is invalid',
    }),
    measureUnit: Joi.number().required().messages({
        'any.required': 'Measure Unit is required',
        'number.base': 'Measure Unit is invalid',
    }),
    isReturnableProduct: Joi.boolean().required().messages({
        'any.required': 'Is Returnable Product is required',
        'boolean.base': 'Is Returnable Product is invalid',
    }),
    unitPrice: Joi.number().required().messages({
        'any.required': 'Unit Price is required',
        'number.base': 'Unit Price is invalid',
    }),
});

export default {
    productSaveSchema,
};