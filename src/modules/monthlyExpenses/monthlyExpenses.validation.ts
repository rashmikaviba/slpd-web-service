import Joi from 'joi';
import { endianness } from 'os';

const createNewExpensesSchema = Joi.object({
    expenseType: Joi.number().required().messages({
        'any.required': 'Expense type is required',
        'number.base': 'Expense type is invalid',
    }),
    date: Joi.date().required().messages({
        'any.required': 'Date is required',
        'date.base': 'Date is invalid',
    }),
    expenseTypeName: Joi.string().required().messages({
        'any.required': 'Expense type name is required',
        'string.base': 'Expense type name is invalid',
    }),
    description: Joi.string().required().messages({
        'any.required': 'Description is required',
        'string.base': 'Description is invalid',
    }),
    amount: Joi.number().required().messages({
        'any.required': 'Amount is required',
        'number.base': 'Amount is invalid',
    }),
});

const advanceSearchSchema = Joi.object({
    startMonth: Joi.date().required().messages({
        'any.required': 'Start Date is required!',
        'date.base': 'Start Date is invalid!',
    }),
    endMonth: Joi.date().required().messages({
        'any.required': 'End Date is required',
        'date.base': 'End Date is invalid',
    }),
});


export default {
    createNewExpensesSchema,
    advanceSearchSchema
}


