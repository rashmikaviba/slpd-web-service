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



const tripEndAuditShema = Joi.object({
    tripId: Joi.string().required().messages({
        'any.required': 'tripId is required',
        'string.base': 'tripId is invalid',
    }),

    auditRecords: Joi.array().items(Joi.object({
        id: Joi.string().required().messages({
            'any.required': 'id is required',
            'string.base': 'id is invalid',
        }),
        returnQuantity: Joi.number().required().messages({
            'number.base': 'returnQuantity is invalid',
            'any.required': 'returnQuantity is required',
        }),
        returnUnitOfMeasure: Joi.number().required().messages({
            'number.base': 'returnUnitOfMeasure is invalid',
            'any.required': 'returnUnitOfMeasure is required',
        }),
        isReturned: Joi.boolean().required().messages({
            'boolean.base': 'isReturned is invalid',
            'any.required': 'isReturned is required',
        }),
        notReturnedReason: Joi.string().allow(null).allow('').messages({
            'string.base': 'notReturnedReason is invalid',
        }),
    }))
})


export default {
    savePosProductSchema, tripEndAuditShema
};