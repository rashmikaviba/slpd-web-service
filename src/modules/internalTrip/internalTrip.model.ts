import mongoose from 'mongoose';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';

const internalTripSchema = new mongoose.Schema(
    {
        startDate: {
            type: Date,
            required: [true, 'Start Date is required'],
        },

        endDate: {
            type: Date,
            required: [true, 'End Date is required'],
        },

        dateCount: {
            type: Number,
            required: [true, 'Date Count is required'],
        },

        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vehicle',
            required: [true, 'Vehicle is required'],
        },

        meterReading: {
            type: Number,
            default: 0,
        },

        calcDistance: {
            type: Number,
            default: 0,
        },

        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Driver is required'],
        },

        reason: {
            type: String,
            required: [true, 'Reason is required'],
            maxlength: [500, 'Reason cannot be more than 500 characters'],
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
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export default mongoose.model('InternalTrip', internalTripSchema);
