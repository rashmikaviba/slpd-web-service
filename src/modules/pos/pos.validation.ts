import Joi from 'joi';

const savePosProductSchema = Joi.object({
    productId: Joi.string().required().messages({
        'any.required': 'productId is required',
        'string.base': 'productId is invalid',
    }),

    quantity: Joi.number().required().messages({
        'any.required': 'quantity is required',
        'number.base': 'quantity is invalid',
    }),

    unitOfMeasure: Joi.number().required().messages({
        'any.required': 'unitOfMeasure is required',
        'number.base': 'unitOfMeasure is invalid',
    }),
});


export default {
    savePosProductSchema
};