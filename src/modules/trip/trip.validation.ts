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
    contactPerson: Joi.string().required().messages({
        'any.required': 'Contact Person is required',
        'string.base': 'Contact Person is invalid',
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
                _id: Joi.string().required().messages({
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

    activities: Joi.array()
        .items(
            Joi.object({
                _id: Joi.string().required().messages({
                    'any.required': 'Id is required',
                    'string.base': 'Id is invalid',
                }),
                date: Joi.date().messages({
                    'any.required': 'Date is required',
                    'date.base': 'Date is invalid',
                }),
                description: Joi.string().messages({
                    'any.required': 'Description is required',
                    'string.base': 'Description is invalid',
                }),
                adultCount: Joi.number().messages({
                    'any.required': 'Adult Count is required',
                    'number.base': 'Adult Count is invalid',
                }),
                childCount: Joi.number().messages({
                    'any.required': 'Child Count is required',
                    'number.base': 'Child Count is invalid',
                }),
                totalCost: Joi.number().messages({
                    'any.required': 'Total Cost is required',
                    'number.base': 'Total Cost is invalid',
                }),
            })
        )
        .messages({
            'array.base': 'Activities are invalid',
        }),

    hotels: Joi.array()
        .items(
            Joi.object({
                _id: Joi.string().required().messages({
                    'any.required': 'Id is required',
                    'string.base': 'Id is invalid',
                }),
                dates: Joi.string().required().messages({
                    'any.required': 'Dates is required',
                    'string.base': 'Dates is invalid',
                }),
                hotelName: Joi.string().required().messages({
                    'any.required': 'Hotel Name is required',
                    'string.base': 'Hotel Name is invalid',
                }),
                city: Joi.string().required().messages({
                    'any.required': 'City is required',
                    'string.base': 'City is invalid',
                }),
            })
        )
        .messages({
            'array.base': 'Hotels are invalid',
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
    })
        .allow(null)
        .optional(),

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
    })
        .allow(null)
        .optional(),

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
    })
        .allow(null)
        .optional(),

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
    })
        .allow(null)
        .optional(),

    places: Joi.array()
        .required()
        .items(
            Joi.object({
                _id: Joi.string().required().messages({
                    'any.required': 'Id is required',
                    'string.base': 'Id is invalid',
                }),
                description: Joi.string().required().messages({
                    'any.required': 'Place is required',
                    'string.base': 'Place is invalid',
                }),
                dates: Joi.array().required().messages({
                    'any.required': 'Dates is required',
                    'array.base': 'Dates is invalid',
                }),

                isReached: Joi.boolean().messages({
                    'boolean.base': 'isReached is invalid',
                }),

                index: Joi.number().required().messages({
                    'any.required': 'Index is required',
                    'number.base': 'Index is invalid',
                }),
            })
        )
        .messages({
            'array.base': 'Places are invalid',
            'any.required': 'Places are required',
        }),
});

const assignDriverVehicleSchema = Joi.object({
    driverId: Joi.string().messages({
        'string.base': 'Driver Id is invalid',
    }),
    vehicleId: Joi.string().messages({
        'string.base': 'Vehicle Id is invalid',
    }),
});

const checkListAnswerSchema = Joi.object({
    1: Joi.number().messages({
        'number.base': 'Answer is invalid',
    }),
    2: Joi.number().messages({
        'number.base': 'Answer is invalid',
    }),
    3: Joi.number().messages({
        'number.base': 'Answer is invalid',
    }),
    4: Joi.number().messages({
        'number.base': 'Answer is invalid',
    }),
    5: Joi.number().messages({
        'number.base': 'Answer is invalid',
    }),
    6: Joi.number().messages({
        'number.base': 'Answer is invalid',
    }),
    7: Joi.number().messages({
        'number.base': 'Answer is invalid',
    }),
    8: Joi.number().messages({
        'number.base': 'Answer is invalid',
    }),
    9: Joi.number().messages({
        'number.base': 'Answer is invalid',
    }),

    isTermsConditionsChecked1: Joi.boolean().required().messages({
        'boolean.base': 'terms and conditions is invalid',
        'any.required': 'terms and conditions is required',
    }),

    isTermsConditionsChecked2: Joi.boolean().required().messages({
        'boolean.base': 'terms and conditions is invalid',
        'any.required': 'terms and conditions is required',
    }),
});

const markPlaceSchema = Joi.object({
    location: Joi.object({
        lat: Joi.number().messages({
            'number.base': 'lat is invalid',
        }),
        lng: Joi.number().messages({
            'number.base': 'lng is invalid',
        }),
    }),
});

export default {
    tripSchema,
    assignDriverVehicleSchema,
    checkListAnswerSchema,
    markPlaceSchema,
};
