import Joi from 'joi';

const internalTripSchema = Joi.object({
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

    vehicle: Joi.string().required().messages({
        'any.required': 'Vehicle is required',
        'string.base': 'Vehicle is invalid',
    }),

    meterReading: Joi.number().required().messages({
        'any.required': 'Meter Reading is required',
        'number.base': 'Meter Reading is invalid',
    }),

    driver: Joi.string().required().messages({
        'any.required': 'Driver is required',
        'string.base': 'Driver is invalid',
    }),

    reason: Joi.string().min(1).max(500).required().messages({
        'any.required': 'Reason is required',
        'string.base': 'Reason is invalid',
        'string.max': 'Reason cannot be more than 500 characters',
    }),
});

export default { internalTripSchema };
