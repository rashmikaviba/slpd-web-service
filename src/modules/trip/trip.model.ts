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

        tripConfirmedNumber: {
            type: Number,
            default: 0,
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
                // id: {
                //     type: String,
                //     required: [true, 'Id is required'],
                // },
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

        activities: [
            {
                // id: {
                //     type: String,
                //     required: [true, 'Id is required'],
                // },
                date: {
                    type: Date,
                },

                description: {
                    type: String,
                },

                adultCount: {
                    type: Number,
                },

                childCount: {
                    type: Number,
                },

                totalCost: {
                    type: Number,
                },
            },
        ],

        places: [
            {
                // id: {
                //     type: String,
                //     required: [true, 'Id is required'],
                // },
                description: {
                    type: String,
                    required: [true, 'Description is required'],
                },

                dates: [
                    {
                        type: Date,
                        required: [true, 'Dates is required'],
                    },
                ],

                isReached: {
                    type: Boolean,
                    default: false,
                },

                index: {
                    type: Number,
                    default: 0,
                },

                changedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    default: null,
                },

                updatedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    default: null,
                },
            },
        ],

        hotels: [
            {
                // id: {
                //     type: String,
                //     required: [true, 'Id is required'],
                // },

                dates: {
                    type: String,
                    required: [true, 'Dates is required'],
                },

                hotelName: {
                    type: String,
                    required: [true, 'Hotel Name is required'],
                },

                city: {
                    type: String,
                    required: [true, 'City is required'],
                },
            },
        ],

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

        contactPerson: {
            type: String,
            maxlength: [
                100,
                'Contact Person cannot be more than 100 characters',
            ],
        },

        // driver information
        // driver: {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: 'User',
        // },

        // driverAssignedBy: {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: 'User',
        // },

        drivers: [
            {
                driver: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },

                driverAssignedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },

                isActive: {
                    type: Boolean,
                    default: true,
                },
            },
        ],

        // vehicle information
        vehicles: [
            {
                vehicle: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Vehicle',
                    default: null,
                    required: [true, 'Vehicle is required'],
                },

                isActive: {
                    type: Boolean,
                    default: true,
                },

                vehicleAssignedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    default: null,
                },
            },
        ],

        checkListAnswers: {
            type: Object,
            default: null,
        },

        checkListCheckBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
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

        startedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        endedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export default mongoose.model('Trip', tripSchema);
