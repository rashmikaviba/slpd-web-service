import Joi from 'joi';

const tripSummarySchema = Joi.object({
    tripId: Joi.string().required().messages({
        'any.required': 'tripId is required',
        'string.base': 'tripId is invalid',
    }),

    date: Joi.date().required().messages({
        'any.required': 'Date is required',
        'date.base': 'Date is invalid',
    }),

    startTime: Joi.date().required().messages({
        'any.required': 'Start Time is required',
        'date.base': 'Start Time is invalid',
    }),

    endTime: Joi.date().required().messages({
        'any.required': 'End Time is required',
        'date.base': 'End Time is invalid',
    }),

    startingKm: Joi.number().required().messages({
        'any.required': 'Starting Km is required',
        'number.base': 'Starting Km is invalid',
    }),

    endingKm: Joi.number().required().messages({
        'any.required': 'Ending Km is required',
        'number.base': 'Ending Km is invalid',
    }),

    totalKm: Joi.number().required().messages({
        'any.required': 'Total Km is required',
        'number.base': 'Total Km is invalid',
    }),

    fuel: Joi.number().default(0).messages({
        'number.base': 'Fuel is invalid',
    }),

    description: Joi.string().max(500).allow(null).allow('').messages({
        'string.max': 'Description should not be more than 500 characters',
        'string.base': 'Description is invalid',
    }),
});

export default { tripSummarySchema };
