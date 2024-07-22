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

        status: {
            type: Number,
            required: [true, 'Status is required'],
            default: WellKnownStatus.ACTIVE,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export default mongoose.model('Auth', authSchema);
