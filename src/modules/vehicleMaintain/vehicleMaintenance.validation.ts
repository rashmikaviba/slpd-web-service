import Joi from 'joi';

const saveVehicleMaintenanceSchema = Joi.object({
    vehicle: Joi.string().required().messages({
        'any.required': 'Vehicle is required',
        'string.base': 'Vehicle is invalid',
    }),

    maintenancePart: Joi.string().max(100).required().messages({
        'any.required': 'Maintenance Part is required',
        'string.base': 'Maintenance Part is invalid',
        'string.max': 'Maintenance Part cannot be more than 100 characters',
    }),

    garage: Joi.string().required().messages({
        'any.required': 'Garage is required',
        'string.base': 'Garage is invalid',
    }),

    maintenanceDate: Joi.date().required().messages({
        'any.required': 'Maintenance Date is required',
        'date.base': 'Maintenance Date is invalid',
    }),

    cost: Joi.number().required().messages({
        'any.required': 'Cost is required',
        'number.base': 'Cost is invalid',
    }),

    note: Joi.string().max(500).allow(null).allow('').messages({
        'string.base': 'Note is invalid',
        'string.max': 'Note cannot be more than 500 characters',
    }),

    billImageUrls: Joi.array().allow(null).items(Joi.string().messages({
        'string.base': 'Bill Image URL is invalid',
    })).messages({
        'array.base': 'Bill Image URLs must be an array',
    }),
});

export default {
    saveVehicleMaintenanceSchema,
};
