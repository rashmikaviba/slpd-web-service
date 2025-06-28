import mongoose from 'mongoose';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';

const monthlyExpensesSchema = new mongoose.Schema(
    {
        month: {
            type: Date,
            required: true,
        },

        year: {
            type: Number,
            required: [true, 'Year is required'],

        },
        monthName: {
            type: Number,
            required: [true, 'Month is required'],
        },

        expenses: [{
            expenseType: {
                type: String,
                required: [true, 'Expense type is required'],
            },

            expenseTypeName: {
                type: String,
                required: [true, 'Expense type name is required'],
            },

            date: {
                type: Date,
                required: [true, 'Date is required'],
            },

            description: {
                type: String,
                required: [true, 'Description is required'],
                maxlength: [500, 'Description cannot exceed 500 characters'],
            },

            amount: {
                type: Number,
                required: [true, 'Amount is required'],
            },

            status: {
                type: Number,
                required: [true, 'Status is required'],
                default: WellKnownStatus.ACTIVE,
            },

            createdAt: {
                type: Date,
                default: Date.now,
            },

            updatedAt: {
                type: Date,
                default: Date.now,
            },

            createdBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },

            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
        }],

        totalExpenses: {
            type: Number,
            default: 0,
        },

        status: {
            type: Number,
            required: true,
            default: WellKnownStatus.ACTIVE,
        },

        isMonthEndDone: {
            type: Boolean,
            default: false,
        },

        batchId: {
            type: Number,
            default: 0,
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

export default mongoose.model('MonthlyExpenses', monthlyExpensesSchema);
