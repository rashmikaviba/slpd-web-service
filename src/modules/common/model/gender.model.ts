import mongoose from 'mongoose';
import { WellKnownStatus } from '../../../util/enums/well-known-status.enum';

const genderSchema = new mongoose.Schema(
    {
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

export default mongoose.model('Gender', genderSchema);
