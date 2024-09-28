import mongoose from 'mongoose';
import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';

const tripSchema = new mongoose.Schema(
    {
        // General Information
        // start Date, end Date, passenger count,
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

        totalCost: {
            type: Number,
            required: [true, 'Total Cost is required'],
        },

        estimatedExpense: {
            type: Number,
            required: [true, 'Estimated Expense is required'],
        },

        // Passenger Information
        // Name, Nationality, Age, Gender
        passengers: [
            {
                id: {
                    type: String,
                    required: [true, 'Id is required'],
                },

                name: {
                    type: String,
                    required: [true, 'Name is required'],
                },
                nationality: {
                    type: String,
                    required: [true, 'Nationality is required'],
                },
                age: {
                    type: Number,
                    required: [true, 'Age is required'],
                },
                gender: {
                    type: String,
                    required: [true, 'Gender is required'],
                },
            },
        ],

        // Flight Information
        // Arrival Date, Arrival Time, Arrival Flight Number, Departure Date, Departure Time, Departure Flight Number
        arrivalInfo: {
            arrivalDate: {
                type: Date,
            },
            arrivalTime: {
                type: Date,
            },
            arrivalFlightNumber: {
                type: String,
            },
        },

        departureInfo: {
            departureDate: {
                type: Date,
            },
            departureTime: {
                type: Date,
            },
            departureFlightNumber: {
                type: String,
            },
        },

        //Pickup & Drop Information
        // pickup Date, pickup Time, pickUp city Name, address, drop off Date, drop off Time, drop off city Name, address
        pickUpInfo: {
            pickupDate: {
                type: Date,
            },
            pickupTime: {
                type: Date,
            },
            pickupCity: {
                type: String,
            },
            pickupAddress: {
                type: String,
            },
        },

        dropOffInfo: {
            dropOffDate: {
                type: Date,
            },
            dropOffTime: {
                type: Date,
            },
            dropOffCity: {
                type: String,
            },
            dropOffAddress: {
                type: String,
            },
        },

        // Contact Information
        // Email, Phone Number
        email: {
            type: String,
            required: [true, 'Email is required'],
            maxlength: [100, 'Email cannot be more than 100 characters'],
            validate: {
                validator: function (v: string) {
                    return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(
                        v
                    );
                },
                message: 'Please enter a valid email',
            },
        },

        phoneNumber: {
            type: String,
            maxlength: [20, 'Phone Number cannot be more than 20 characters'],
        },

        // driver information
        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },

        driverAssignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },

        isDriverAssigned: {
            type: Boolean,
            default: false,
        },

        // general information
        status: {
            type: Number,
            required: [true, 'Status is required'],
            default: WellKnownLeaveStatus.PENDING,
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

export default mongoose.model('Trip', tripSchema);
