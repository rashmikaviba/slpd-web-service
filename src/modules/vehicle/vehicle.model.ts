import mongoose from 'mongoose';
import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';

const vehicleSchema = new mongoose.Schema(
    {
        // General Information
        vehicleType: {
            type: Number,
            required: [true, 'Start Date is required'],
        },

        vehicleOwner: {
            type: String,
            required: [true, 'Vehicle Owner is required'],
        },

        registrationNumber: {
            type: String,
            required: [true, 'Registration Number is required'],
        },

        gpsTracker: {
            type: String,
        },

        capacity: {
            type: Number,
            required: [true, 'Capacity is required'],
        },

        availableSeats: {
            type: Number,
            required: [true, 'Available Seats is required'],
        },

        licenseRenewalDate: {
            type: Date,
        },

        insuranceRenewalDate: {
            type: Date,
        },

        gearOil: {
            type: String,
            maxlength: [200, 'Gear Oil cannot be more than 200 characters'],
        },

        airFilter: {
            type: String,
            maxlength: [200, 'Air Filter cannot be more than 200 characters'],
        },

        oilFilter: {
            type: String,
            maxlength: [200, 'Oil Filter cannot be more than 200 characters'],
        },

        initialMileage: {
            type: Number,
            required: [true, 'Initial Mileage is required'],
            default: 0,
        },

        currentMileage: {
            type: Number,
            default: 0,
        },

        description: {
            type: String,
            maxlength: [500, 'Description cannot be more than 500 characters'],
        },

        isFreelanceVehicle: {
            type: Boolean,
            default: false,
        },

        rentalFor30Days: {
            type: Number,
            default: 0,
        },

        isRentalVehicle: {
            type: Boolean,
            default: false,
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
