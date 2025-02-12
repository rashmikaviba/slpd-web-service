import mongoose from 'mongoose';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';

const monthAuditSchema = new mongoose.Schema(
    {
        newWorkingDate: {
            type: Date,
            required: true,
        },

        status: {
            type: Number,
            required: true,
            default: WellKnownStatus.ACTIVE,
        },

        batchId: {
            type: Number,
            default: 0,
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

export default mongoose.model('MonthAudit', monthAuditSchema);
