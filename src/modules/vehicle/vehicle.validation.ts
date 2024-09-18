import Joi from 'joi';

const vehicleSchema = Joi.object({
    vehicleType: Joi.number().required().messages({
        'any.required': 'Vehicle Type is required!',
        'number.base': 'Vehicle Type is invalid!',
    }),

    vehicleOwner: Joi.string().required().messages({
        'any.required': 'Vehicle Owner is required',
        'string.base': 'Vehicle Owner is invalid',
    }),

    registrationNumber: Joi.string().required().messages({
        'any.required': 'Registration Number is required',
        'string.base': 'Registration Number is invalid',
    }),

    capacity: Joi.number().required().messages({
        'any.required': 'Capacity is required',
        'number.base': 'Capacity is invalid',
    }),

    availableSeats: Joi.number().required().messages({
        'any.required': 'Available Seats is required',
        'number.base': 'Available Seats is invalid',
    }),

    gpsTracker: Joi.string().messages({
        'string.base': 'GPS Tracker is invalid',
    }),

    description: Joi.string().max(500).messages({
        'string.base': 'Reason is invalid',
        'string.max': 'Reason cannot be more than 500 characters',
    }),
});

export default { vehicleSchema };
