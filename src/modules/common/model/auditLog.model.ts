import mongoose from 'mongoose';
import { WellKnownStatus } from '../../../util/enums/well-known-status.enum';
import { WellKnownAuditLogType } from '../../../util/enums/well-known-audit-log-type.enum';

const AuditLogSchema = new mongoose.Schema(
    {
        auditType: {
            type: Number,
            required: [true, 'Audit Type is required'],
            enum: {
                values: Object.values(WellKnownAuditLogType),
                message: 'Invalid Audit Type',
            },
        },

        description: {
            type: String,
        },

        object: {
            type: Object,
        },

        changedObject: {
            type: Object,
        },

        action: {
            type: Number,
            required: [true, 'Action is required'],
        },

        status: {
            type: Number,
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

export default mongoose.model('AuditLog', AuditLogSchema);
