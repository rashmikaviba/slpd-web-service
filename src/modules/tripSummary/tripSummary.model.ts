import mongoose from 'mongoose';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';

const tripSummarySchema = new mongoose.Schema(
    {
        tripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Trip',
            required: [true, 'Trip is required'],
        },

        date: {
            type: Date,
            required: [true, 'Date is required'],
        },

        startingTime: {
            type: Date,
            required: [true, 'Starting Time is required'],
        },

        endingTime: {
            type: Date,
        },

        startingKm: {
            type: Number,
            required: [true, 'Starting Km is required'],
        },

        endingKm: {
            type: Number,
        },

        totalKm: {
            type: Number,
        },

        fuel: {
            type: Number,
            default: 0,
        },

        description: {
            type: String,
            maxlength: [500, 'Description cannot be more than 500 characters'],
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

        isMonthEndDone: {
            type: Boolean,
            default: false,
        },

        batchId: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export default mongoose.model('TripSummary', tripSummarySchema);
