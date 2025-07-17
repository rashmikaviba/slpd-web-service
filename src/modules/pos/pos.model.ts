
import mongoose from 'mongoose';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';

const PosSchema = new mongoose.Schema({
    tripId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Trip',
        required: [true, 'Trip is required'],
    },

    products: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'InventoryProduct',
                required: [true, 'Product is required'],
            },

            isReturnableProduct: {
                type: Boolean,
                default: false
            },

            unitPrice: {
                type: Number,
                default: 0
            },

            productUnitOfMeasure: {
                type: Number,
                default: 0
            },

            enteredUnitOfMeasure: {
                type: Number,
                default: 0
            },

            enteredQuantity: {
                type: Number,
                default: 0
            },

            quantityWithSiUnitOfMeasure: {
                type: Number,
                default: 0
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

            createdAt: {
                type: Date,
                default: Date.now,
            },

            updatedAt: {
                type: Date,
                default: Date.now,
            },
        }
    ],

    totalAmount: {
        type: Number,
        default: 0
    },

    isTripEndAuditDone: {
        type: Boolean,
        default: false
    },

    endAuditProducts: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: [true, 'Product is required'],
            },

            isReturnableProduct: {
                type: Boolean,
                default: false
            },

            notReturnedReson: {
                type: String,
                default: ''
            },

            enteredQuantity: {
                type: Number,
                default: 0
            },

            quantityWithSiUnitOfMeasure: {
                type: Number,
                default: 0
            },

            consumedQuantity: {
                type: Number,
                default: 0
            },

            consumedQuantityWithSiUnitOfMeasure: {
                type: Number,
                default: 0
            },

            createdBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },

            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },

            createdAt: {
                type: Date,
                default: Date.now,
            },

            updatedAt: {
                type: Date,
                default: Date.now,
            },
        }
    ],

    totalConsumedAmount: {
        type: Number,
        default: 0
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

}, {
    timestamps: true,
    versionKey: false,
})

export default mongoose.model('Pos', PosSchema);