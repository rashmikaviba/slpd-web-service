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

    capacity: Joi.number().required().default(0).messages({
        'any.required': 'Capacity is required',
        'number.base': 'Capacity is invalid',
    }),

    availableSeats: Joi.number().required().messages({
        'any.required': 'Available Seats is required',
        'number.base': 'Available Seats is invalid',
    }),

    gpsTracker: Joi.string().allow(null).allow('').messages({
        'string.base': 'GPS Tracker is invalid',
    }),

    description: Joi.string().allow(null).allow('').max(500).messages({
        'string.base': 'Reason is invalid',
        'string.max': 'Reason cannot be more than 500 characters',
    }),

    licenseRenewalDate: Joi.date().allow(null).allow('').messages({
        'date.base': 'License Renewal Date is invalid',
    }),

    insuranceRenewalDate: Joi.date().allow(null).allow('').messages({
        'date.base': 'Insurance Renewal Date is invalid',
    }),

    gearOil: Joi.string().allow(null).allow('').max(200).messages({
        'string.base': 'Gear Oil is invalid',
        'string.max': 'Gear Oil cannot be more than 200 characters',
    }),

    airFilter: Joi.string().allow(null).allow('').max(200).messages({
        'string.base': 'Air Filter is invalid',
        'string.max': 'Air Filter cannot be more than 200 characters',
    }),

    oilFilter: Joi.string().allow(null).allow('').max(200).messages({
        'string.base': 'Air Filter is invalid',
        'string.max': 'Air Filter cannot be more than 200 characters',
    }),

    initialMileage: Joi.number().required().default(0).messages({
        'any.required': 'Initial Mileage is required',
        'number.base': 'Initial Mileage is invalid',
    }),

    isFreelanceVehicle: Joi.boolean().default(false),
    isRentalVehicle: Joi.boolean().default(false),

    rentalFor30Days: Joi.number()
        .when(Joi.object({
            isFreelanceVehicle: Joi.valid(true)
        }).unknown(), {
            then: Joi.number().required().messages({
                'any.required': 'Rental For 30 Days is required for freelance vehicles',
                'number.base': 'Rental For 30 Days must be a number',
            }),
        })
        .when(Joi.object({
            isRentalVehicle: Joi.valid(true)
        }).unknown(), {
            then: Joi.number().required().messages({
                'any.required': 'Rental For 30 Days is required for rental vehicles',
                'number.base': 'Rental For 30 Days must be a number',
            }),
        })
        .messages({
            'number.base': 'Rental For 30 Days must be a number',
        }),
});

export default { vehicleSchema };
