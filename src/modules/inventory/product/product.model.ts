import mongoose from 'mongoose';
import { WellKnownStatus } from '../../../util/enums/well-known-status.enum';

const InventoryProductSchema = new mongoose.Schema(
    {
        productName: {
            type: String,
            required: [true, 'Product Name is required'],
        },

        productShortCode: {
            type: String,
            required: [true, 'Product Short Code is required'],
        },

        measureUnit: {
            type: Number,
            required: [true, 'Measure Unit is required'],
        },

        isReturnableProduct: {
            type: Boolean,
            required: [true, 'Is Returnable Product is required'],
        },

        unitPrice: {
            type: Number,
            required: [true, 'Unit Price is required'],
        },

        description: {
            type: String,
            maxlength: [500, 'Description cannot be more than 500 characters'],
        },

        inventory: {
            type: Number,
            default: 0,
        },

        inventoryLogs: [
            {
                inventoryLogType: {
                    type: Number,
                },

                inventoryLogDate: {
                    type: Date,
                },

                inventoryLogQuantity: {
                    type: Number,
                },

                inventoryLogProductId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'InventoryProduct',
                },

                inventoryLogCreatedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },

                message: {
                    type: String,
                },
            }
        ],

        status: {
            type: Number,
            required: [true, 'Status is required'],
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
});

export default mongoose.model('InventoryProduct', InventoryProductSchema);