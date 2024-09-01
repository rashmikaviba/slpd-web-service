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

export default mongoose.model('CompanyWorkingInfo', CompanyWorkingInfoSchema);
