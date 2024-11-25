import Joi from 'joi';

const saveExpenseSchema = Joi.object({
    typeId: Joi.number().required().messages({
        'any.required': 'Type is required',
        'number.base': 'Type is invalid',
    }),

    typeName: Joi.string(),

    amount: Joi.number().required().messages({
        'any.required': 'Amount is required',
        'number.base': 'Amount is invalid',
    }),

    description: Joi.string().max(500).messages({
        'string.max': 'Description should not be more than 500 characters',
        'string.base': 'Description is invalid',
    }),

    date: Joi.date().required().messages({
        'any.required': 'Date is required',
        'date.base': 'Date is invalid',
    }),

    receiptUrl: Joi.string().uri().allow(null).optional().messages({
        'string.base': 'Receipt URL is invalid',
        'string.uri': 'Receipt URL is invalid',
    }),
});

const updateExpenseSchema = Joi.object({
    typeId: Joi.number().required().messages({
        'any.required': 'Type is required',
        'number.base': 'Type is invalid',
    }),

    typeName: Joi.string(),

    amount: Joi.number().required().messages({
        'any.required': 'Amount is required',
        'number.base': 'Amount is invalid',
    }),

    description: Joi.string().max(500).messages({
        'string.max': 'Description should not be more than 500 characters',
        'string.base': 'Description is invalid',
    }),

    date: Joi.date().required().messages({
        'any.required': 'Date is required',
        'date.base': 'Date is invalid',
    }),

    receiptUrl: Joi.string().uri().allow(null).optional().messages({
        'string.base': 'Receipt URL is invalid',
        'string.uri': 'Receipt URL is invalid',
    }),
});

export default { saveExpenseSchema, updateExpenseSchema };
