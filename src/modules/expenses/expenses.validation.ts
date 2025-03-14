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

    description: Joi.string().max(500).allow(null).allow('').messages({
        'string.max': 'Description should not be more than 500 characters',
        'string.base': 'Description is invalid',
    }),

    date: Joi.date().required().messages({
        'any.required': 'Date is required',
        'date.base': 'Date is invalid',
    }),

    receiptUrl: Joi.string().allow(null).allow('').optional().messages({
        'string.base': 'Receipt URL is invalid',
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

    description: Joi.string().max(500).allow(null).allow('').messages({
        'string.max': 'Description should not be more than 500 characters',
        'string.base': 'Description is invalid',
    }),

    date: Joi.date().required().messages({
        'any.required': 'Date is required',
        'date.base': 'Date is invalid',
    }),

    receiptUrl: Joi.string().allow(null).allow('').optional().messages({
        'string.base': 'Receipt URL is invalid',
    }),
});

const saveDriverSalarySchema = Joi.object({
    driver: Joi.string().required().messages({
        'any.required': 'Driver Id is required',
        'string.base': 'Driver Id is invalid',
    }),
    salaryPerDay: Joi.number().required().messages({
        'any.required': 'Salary Per Day is required',
        'number.base': 'Salary Per Day is invalid',
    }),

    noOfDays: Joi.number().required().messages({
        'any.required': 'No of Days is required',
        'number.base': 'No of Days is invalid',
    }),

    totalAddition: Joi.number().messages({
        'number.base': 'Total Addition is invalid',
    }),

    totalDeduction: Joi.number().messages({
        'number.base': 'Total Deduction is invalid',
    }),

    isRemainingToDriver: Joi.boolean().messages({
        'boolean.base': 'Is Remaining To Driver is invalid',
    }),
});

export default {
    saveExpenseSchema,
    updateExpenseSchema,
    saveDriverSalarySchema,
};
