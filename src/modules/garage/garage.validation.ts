import Joi from 'joi';

export const garageRequestSchema = Joi.object({
    name: Joi.string().max(100).required().messages({
        'any.required': 'Garage Name is required',
        'string.max': 'Garage Name cannot be more than 100 characters',
    }),

    address: Joi.string().max(300).allow('', null).messages({
        'string.max': 'Address cannot be more than 300 characters',
    }),

    city: Joi.string().max(100).allow('', null).messages({
        'string.max': 'City cannot be more than 100 characters',
    }),

    contactNumber: Joi.string().max(14).allow('', null).messages({
        'string.max': 'Contact Number cannot be more than 14 characters',
    }),

    googleMapUrl: Joi.string().allow('', null).messages({
        'string.base': 'Google Map URL must be a string',
    }),

    specializations: Joi.array()
        .items(
            Joi.object({
                id: Joi.number().required().messages({
                    'any.required': 'Specialization Id is required',
                    'number.base': 'Specialization Id must be a number',
                }),
                name: Joi.string().max(100).required().messages({
                    'any.required': 'Specialization Name is required',
                    'string.max': 'Specialization Name cannot be more than 100 characters',
                }),
            })
        )
        .min(1)
        .required()
        .messages({
            'array.min': 'At least one specialization is required',
            'any.required': 'Specializations are required',
        }),

    description: Joi.string().max(500).allow('', null).messages({
        'string.max': 'Description cannot be more than 500 characters',
    }),
});


export default { garageRequestSchema };
