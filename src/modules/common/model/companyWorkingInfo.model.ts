import mongoose from 'mongoose';
import { WellKnownStatus } from '../../../util/enums/well-known-status.enum';

const CompanyWorkingInfoSchema = new mongoose.Schema(
    {
        workingYear: { type: Number, required: true },
        workingMonth: { type: Number, required: true },
        workingDate: { type: Date, required: true },
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

// Indexes for the filters used by the services (non-unique, no behaviour change)
CompanyWorkingInfoSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('CompanyWorkingInfo', CompanyWorkingInfoSchema);
