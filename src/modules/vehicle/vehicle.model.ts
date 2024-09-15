import mongoose from 'mongoose';
import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';

const vehicleSchema = new mongoose.Schema(
    {
        // General Information
        vehicleType: {
            type: Number,
            required: [true, 'Start Date is required'],
        },

        registrationNumber : {
            type: String,
            required: [true, 'Registration Number is required'],
        },

        gpsTracker: {
            type: String,
        },

        capacity : {
            type: Number,
            required: [true, 'Capacity is required'],
        },

        availableSeats : {
            type: Number,
            required: [true, 'Available Seats is required'],
        },

        description: {
            type: String,
            maxlength: [500, 'Description cannot be more than 500 characters'],
        },

        status: {
            type: Number,
            required: [true, 'Status is required'],
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

export default mongoose.model('Vehicle', vehicleSchema);
