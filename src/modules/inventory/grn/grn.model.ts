import { WellKnownGrnStatus } from './../../../util/enums/well-known-grn-status.enum';
import mongoose from 'mongoose';

const InventoryGRNSchema = new mongoose.Schema({
    grnNumber: {
        type: Number,
        required: [true, 'GRN Number is required'],
    },

    grnNumberWithPrefix: {
        type: String,
        required: [true, 'GRN Number is required'],
    },

    grnDate: {
        type: Date,
        required: [true, 'GRN Date is required'],
    },

    grnRemarks: {
        type: String,
        maxlength: [500, 'GRN Remarks cannot be more than 500 characters'],
    },

    products: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: [true, 'Product is required'],
        },

        enteredMeasureUnitId: {
            type: Number,
            required: [true, 'Unit is required'],
        },

        actualMeasureUnitId: {
            type: Number,
            required: [true, 'Unit is required'],
        },

        siConvertedQuantity: {
            type: Number,
        },

        quantity: {
            type: Number,
            required: [true, 'Quantity is required'],
        },

        remarks: {
            type: String,
            maxlength: [500, 'Remarks cannot be more than 500 characters'],
        }
    }],

    status: {
        type: Number,
        default: WellKnownGrnStatus.PENDING,
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    approvedDate: {
        type: Date,
        default: null
    },

    rejectedDate: {
        type: Date,
        default: null
    },

    approvedRejectedRemarks: {
        type: String,
        maxlength: [500, 'Reason cannot be more than 500 characters'],
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

}, {
    timestamps: true,
    versionKey: false,
})

export default mongoose.model('GRN', InventoryGRNSchema);