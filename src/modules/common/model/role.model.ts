import mongoose from 'mongoose';
import { WellKnownStatus } from '../../../util/enums/well-known-status.enum';

const roleSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            required: [true, 'Id is required'],
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
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

// Indexes for the filters used by the services (non-unique, no behaviour change)
roleSchema.index({ id: 1 });

export default mongoose.model('Role', roleSchema);
