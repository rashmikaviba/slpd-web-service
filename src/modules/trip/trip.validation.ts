import Joi from 'joi';

const tripSchema = Joi.object({
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
    totalCost: Joi.number().required().messages({
        'any.required': 'Total Cost is required',
        'number.base': 'Total Cost is invalid',
    }),
    estimatedExpense: Joi.number().required().messages({
        'any.required': 'Estimated Expense is required',
        'number.base': 'Estimated Expense is invalid',
    }),

    // Passenger Information
    // Name, Nationality, Age, Gender
    passengers: Joi.array()
        .items(
            Joi.object({
                id: Joi.string().required().messages({
                    'any.required': 'Id is required',
                    'string.base': 'Id is invalid',
                }),
                name: Joi.string().required().messages({
                    'any.required': 'Name is required',
                    'string.base': 'Name is invalid',
                }),
                nationality: Joi.string().required().messages({
                    'any.required': 'Nationality is required',
                    'string.base': 'Nationality is invalid',
                }),
                age: Joi.number().required().messages({
                    'any.required': 'Age is required',
                    'number.base': 'Age is invalid',
                }),
                gender: Joi.string().required().messages({
                    'any.required': 'Gender is required',
                    'string.base': 'Gender is invalid',
                }),
            })
        )
        .required()
        .min(1)
        .messages({
            'any.required': 'Passengers are required',
            'array.base': 'Passengers are invalid',
            'array.min': 'Passengers are required',
        }),

    // contact information
    email: Joi.string().email().required().messages({
        'any.required': 'Email is required',
        'string.email': 'Email is invalid',
        'string.base': 'Email is invalid',
    }),

    phoneNumber: Joi.string().required().messages({
        'any.required': 'Phone Number is required',
        'string.base': 'Phone Number is invalid',
    }),

    arrivalInfo: Joi.object({
        arrivalDate: Joi.date().messages({
            'date.base': 'Arrival Date is invalid',
        }),

        arrivalTime: Joi.date().messages({
            'date.base': 'Arrival Time is invalid',
        }),

        arrivalFlightNumber: Joi.string().messages({
            'string.base': 'Arrival Flight Number is invalid',
        }),
    }),

    departureInfo: Joi.object({
        departureDate: Joi.date().messages({
            'date.base': 'Departure Date is invalid',
        }),

        departureTime: Joi.date().messages({
            'date.base': 'Departure Time is invalid',
        }),

        departureFlightNumber: Joi.string().messages({
            'string.base': 'Departure Flight Number is invalid',
        }),
    }),

    pickUpInfo: Joi.object({
        pickupDate: Joi.date().messages({
            'date.base': 'Pickup Date is invalid',
        }),

        pickupTime: Joi.date().messages({
            'date.base': 'Pickup Time is invalid',
        }),

        pickupCity: Joi.string().messages({
            'string.base': 'Pickup City is invalid',
        }),

        pickupAddress: Joi.string().messages({
            'string.base': 'Pickup Address is invalid',
        }),
    }),

    dropOffInfo: Joi.object({
        dropOffDate: Joi.date().messages({
            'date.base': 'DropOff Date is invalid',
        }),

        dropOffTime: Joi.date().messages({
            'date.base': 'DropOff Time is invalid',
        }),

        dropOffCity: Joi.string().messages({
            'string.base': 'DropOff City is invalid',
        }),

        dropOffAddress: Joi.string().messages({
            'string.base': 'DropOff Address is invalid',
        }),
    }),
});

export default { tripSchema };
