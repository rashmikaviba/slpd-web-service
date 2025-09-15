import mongoose from 'mongoose';
import { WellKnownStatus } from '../../../util/enums/well-known-status.enum';

const garageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Garage Name is required'],
        maxlength: [100, 'Garage Name cannot be more than 100 characters'],
    },

    address: {
        type: String,
        maxlength: [300, 'Address cannot be more than 300 characters'],
    },

    city: {
        type: String,
        maxlength: [100, 'City cannot be more than 100 characters'],
    },

    contactNumber: {
        type: String,
        maxlength: [14, 'Contact Number cannot be more than 14 characters'],
    },

    googleMapUrl: {
        type: String,
        default: null,
    },

    specializations: [
        {
            id: {
                type: Number,
                required: [true, 'Specialization Id is required'],
            },
            name: {
                type: String,
                required: [true, 'Specialization Name is required'],
                maxlength: [
                    100,
                    'Specialization Name cannot be more than 100 characters',
                ],
            },
        }
    ],

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
},
    {
        timestamps: true,
        versionKey: false,
    }
);

export default mongoose.model('Garage', garageSchema);