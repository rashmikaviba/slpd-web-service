import Joi from 'joi';

const createNewMonthSchema = Joi.object({
    month: Joi.date().required().messages({
        'any.required': 'Month is required!',
        'date.base': 'Month is invalid!',
    }),
    year: Joi.number().required().messages({
        'any.required': 'Year is required',
        'number.base': 'Year is invalid',
    }),
});
