import mongoose from 'mongoose';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';

const expensesSchema = new mongoose.Schema(
    {
        // Trip information
        //tripId
        tripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Trip',
            required: [true, 'Trip is required'],
        },
        // expense information
        // expenses [type, amount, description, date, createdBy, lastModifiedBy, receiptUrl, status, createdAt, updatedAt]
        expenses: [
            {
                typeId: {
                    type: Number,
                    required: [true, 'Type is required'],
                },
                typeName: {
                    type: String,
                },

                amount: {
                    type: Number,
                    required: [true, 'Amount is required'],
                },

                description: {
                    type: String,
                    maxlength: [
                        500,
                        'Description cannot be more than 500 characters',
                    ],
                },

                date: {
                    type: Date,
                    required: [true, 'Date is required'],
                },

                receiptUrl: {
                    type: String,
                },

                status: {
                    type: Number,
                    required: [true, 'Status is required'],
                    default: WellKnownStatus.ACTIVE,
                },

                createdBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },

                updatedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },

                createdAt: {
                    type: Date,
                    default: Date.now,
                },

                updatedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        // month audit information
        // isMonthEndDone
        isMonthEndDone: {
            type: Boolean,
            default: false,
        },

        // driver salary information
        // salaryPerDay, NoOfDays, TotalSalary, otherExpenses, createdBy, lastModifiedBy, createdAt, updatedAt
        driverSalary: {
            salaryPerDay: {
                type: Number,
            },

            noOfDays: {
                type: Number,
            },

            totalSalary: {
                type: Number,
            },

            otherExpenses: {
                type: Number,
            },

            createdBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },

            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },

            createdAt: {
                type: Date,
                default: Date.now,
            },

            updatedAt: {
                type: Date,
                default: Date.now,
            },
        },

        // additional information
        // status. createdBy, lastModifiedBy, createdAt, updatedAt

        status: {
            type: Number,
            default: WellKnownStatus.ACTIVE,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export default mongoose.model('Expenses', expensesSchema);
