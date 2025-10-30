import Joi from 'joi';

const vehicleMonthlyPaymentMaintanceSchema = Joi.object({
    month: Joi.string().required().messages({
        'any.required': 'Month is required',
        'string.base': 'Month is invalid',
    }),
    vehicle: Joi.string().required().messages({
        'any.required': 'Vehicle is required',
        'string.base': 'Vehicle is invalid',
    }),
    rentalFor30Days: Joi.number().required().messages({
        'any.required': 'Rental For 30 Days is required',
        'number.base': 'Rental For 30 Days is invalid',
    }),

    workedDaysCount: Joi.number().required().messages({
        'any.required': 'Worked Days Count is required',
        'number.base': 'Worked Days Count is invalid',
    }),
})

export default {
    vehicleMonthlyPaymentMaintanceSchema,
};
