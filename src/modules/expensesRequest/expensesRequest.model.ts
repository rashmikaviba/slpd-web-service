import { WellKnownLeaveStatus } from './../../util/enums/well-known-leave-status.enum';
import mongoose from 'mongoose';

const expensesRequestSchema = new mongoose.Schema(
    {
        tripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Trip',
            required: [true, 'Trip is required'],
        },

        requestedAmount: {
            type: Number,
            required: [true, 'Requested Amount is required'],
        },

        description: {
            type: String,
            maxlength: [
                500,
                'Description cannot be more than 500 characters',
            ],
        },

        approvedAmount: {
            type: Number,
            default: 0,
        },

        rejectRemark: {
            type: String,
            default: null,
            maxlength: [
                500,
                'Reject Remarks cannot be more than 500 characters',
            ],
        },

        status: {
            type: Number,
            default: WellKnownLeaveStatus.PENDING,
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

export const ExpensesRequest = mongoose.model('ExpensesRequest', expensesRequestSchema);