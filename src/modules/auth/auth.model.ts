import mongoose from 'mongoose';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';

const authSchema = new mongoose.Schema(
    {
        userName: {
            type: String,
            required: [true, 'Username is required'],
        },

        password: {
            type: String,
            required: [true, 'Password is required'],
        },

        isBlocked: {
            type: Boolean,
            default: false,
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },

        role: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Role',
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

// Indexes for the filters used by the services (non-unique, no behaviour change)
authSchema.index({ userName: 1, status: 1 });
authSchema.index({ user: 1, status: 1 });
authSchema.index({ role: 1, status: 1, isBlocked: 1 });

export default mongoose.model('Auth', authSchema);
