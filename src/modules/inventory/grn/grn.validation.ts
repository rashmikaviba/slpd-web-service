import Joi from 'joi';

const grnSaveSchema = Joi.object({
    grnRemarks: Joi.string().max(500).allow(null).allow('').messages({
        'string.max': 'GRN Remarks should not be more than 500 characters',
        'string.base': 'GRN Remarks is invalid',
    }),

    products: Joi.array().items(Joi.object({
        _id: Joi.string().required().messages({
            'any.required': 'Id is required',
            'string.base': 'Id is invalid',
        }),
        productId: Joi.string().required().messages({
            'any.required': 'Product is required',
            'string.base': 'Product is invalid',
        }),
        enteredMeasureUnitId: Joi.number().required().messages({
            'any.required': 'Unit is required',
            'number.base': 'Unit is invalid',
        }),
        quantity: Joi.number().required().messages({
            'any.required': 'Quantity is required',
            'number.base': 'Quantity is invalid',
        }),
        remarks: Joi.string().max(500).allow(null).allow('').messages({
            'string.max': 'Remarks should not be more than 500 characters',
            'string.base': 'Remarks is invalid',
        }),
    }))
});

const grnApproveRejectSchema = Joi.object({
    remark: Joi.string().max(500).allow(null).allow('').messages({
        'string.max': 'GRN Remarks should not be more than 500 characters',
        'string.base': 'GRN Remarks is invalid',
    }),
});

const advanceSearchSchema = Joi.object({
    startDate: Joi.date().required().messages({
        'any.required': 'Start Date is required!',
        'date.base': 'Start Date is invalid!',
    }),
    endDate: Joi.date().required().messages({
        'any.required': 'End Date is required',
        'date.base': 'End Date is invalid',
    }),
    status: Joi.number().required().messages({
        'any.required': 'Status is required',
        'number.base': 'Status is invalid',
    }),
});


export default {
    grnSaveSchema,
    grnApproveRejectSchema,
    advanceSearchSchema
};