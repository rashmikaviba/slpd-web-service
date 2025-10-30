import mongoose from 'mongoose';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';

const vehicleMaintenanceSchema = new mongoose.Schema(
    {
        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vehicle',
            required: [true, 'Vehicle is required'],
        },

        maintenancePart: {
            type: String,
            required: [true, 'Maintenance Part is required'],
            maxlength: [100, 'Maintenance Part cannot be more than 100 characters'],
        },

        garage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            required: [true, 'Garage is required'],
        },

        maintenanceDate: {
            type: Date,
            required: [true, 'Maintenance Date is required'],
        },

        cost: {
            type: Number,
            required: [true, 'Cost is required'],
            default: 0,
        },

        note: {
            type: String,
            maxlength: [500, 'Note cannot be more than 500 characters'],
        },

        isMonthEndDone: {
            type: Boolean,
            default: false,
        },

        billImageUrls: {
            type: [String],
            default: [],
        },

        batchId: {
            type: Number,
            default: 0,
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

export default mongoose.model('VehicleMaintenance', vehicleMaintenanceSchema);
