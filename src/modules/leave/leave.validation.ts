import Joi from 'joi';

const leaveSchema = Joi.object({
    startDate: Joi.date().required().messages({
        'any.required': 'Start Date is required!',
        'date.base': 'Start Date is invalid!',
    }),
    endDate: Joi.date().required().messages({
        'any.required': 'End Date is required',
        'date.base': 'End Date is invalid',
    }),
    dateCount: Joi.number().min(1).required().messages({
        'any.required': 'Date Count is required',
        'number.base': 'Date Count is invalid',
        'number.min': 'Date Count cannot be less than 1',
    }),
    reason: Joi.string().min(1).max(500).required().messages({
        'any.required': 'Reason is required',
        'string.base': 'Reason is invalid',
        'string.min': 'Reason cannot be less than 1 characters',
        'string.max': 'Reason cannot be more than 500 characters',
    }),
});

export default { leaveSchema };
