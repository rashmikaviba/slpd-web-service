import Joi from 'joi';

const saveExpenseRequestSchema = Joi.object({
    typeId: Joi.number().required().messages({
        'any.required': 'Type is required',
        'number.base': 'Type is invalid',
    }),

    requestedAmount: Joi.number().required().messages({
        'any.required': 'Requested Amount is required',
        'number.base': 'Requested Amount is invalid',
    }),

    description: Joi.string().max(500).allow(null).allow('').messages({
        'string.max': 'Description should not be more than 500 characters',
        'string.base': 'Description is invalid',
    }),
});

const approveExpenseRequestSchema = Joi.object({
    approvedAmount: Joi.number().required().messages({
        'any.required': 'Approved Amount is required',
        'number.base': 'Approved Amount is invalid',
    }),
});

const rejectExpenseRequestSchema = Joi.object({
    rejectRemark: Joi.string().max(500).allow(null).allow('').messages({
        'string.max': 'Reject Remarks should not be more than 500 characters',
        'string.base': 'Reject Remarks is invalid',
    }),
});

export default { saveExpenseRequestSchema, approveExpenseRequestSchema, rejectExpenseRequestSchema };