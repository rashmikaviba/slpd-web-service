import mongoose from 'mongoose';
import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';

const leaveSchema = new mongoose.Schema(
    {
        // General Information
        startDate: {
            type: Date,
            required: [true, 'Start Date is required'],
        },

        endDate: {
            type: Date,
            required: [true, 'End Date is required'],
        },

        dateCount: {
            type: Number,
            required: [true, 'Date Count is required'],
        },

        reason: {
            type: String,
            required: [true, 'Reason is required'],
            maxlength: [500, 'Reason cannot be more than 500 characters'],
        },

        status: {
            type: Number,
            required: [true, 'Status is required'],
            default: WellKnownLeaveStatus.PENDING,
        },

        appliedUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },

        // approve rejected information
        approveBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        approveDate: {
            type: Date,
        },

        approveRemark: {
            type: String,
            maxlength: [500, 'Remark cannot be more than 500 characters'],
        },

        rejectBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        rejectDate: {
            type: Date,
        },

        rejectReason: {
            type: String,
            maxlength: [500, 'Reason cannot be more than 500 characters'],
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },

        isMonthEndDone: {
            type: Boolean,
            default: false,
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

export default mongoose.model('Leave', leaveSchema);
