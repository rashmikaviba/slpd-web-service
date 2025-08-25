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
            type: String,
            default: 0,
        },

        isPaymentCollected: {
            type: Boolean,
            default: false,
        },

        dateCount: {
            type: Number,
            required: [true, 'Date Count is required'],
        },

        requestedVehicle: {
            type: String,
            default: '',
        },

        totalCost: {
            type: Number,
            required: [true, 'Total Cost is required'],
        },

        totalCostLocalCurrency: {
            type: Number,
            required: [true, 'Total Cost Local Currency is required'],
            default: 0,
        },

        estimatedExpense: {
            type: Number,
            required: [true, 'Estimated Expense is required'],
        },

        specialRequirement: {
            type: String,
            maxlength: [
                500,
                'Special Requirement cannot be more than 500 characters',
            ],
        },

        paymentMode: {
            type: String,
            required: [true, 'Payment Mode is required'],
            default: 'Cash',
        },

        // Passenger Information
        // Name, Nationality, Age, Gender
        passengers: [
            {
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

                isPaymentByCompany: {
                    type: Boolean,
                    default: false,
                },

                isPaymentDone: {
                    type: Boolean,
                    default: false,
                },

                paymentAmount: {
                    type: Number,
                    default: 0,
                },

                paymentDate: {
                    type: Date,
                    default: null,
                },

                paymentRemark: {
                    type: String,
                    default: '',
                },

                updatedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    default: null,
                },

                paymentMode: {
                    type: String,
                    default: 0,
                },

                receiptImageUrl: {
                    type: String,
                    default: '',
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

                reachedDate: {
                    type: Date,
                    default: null,
                },

                calcDistance: {
                    type: Number,
                    default: 0,
                },

                startMilage: {
                    type: Number,
                    default: 0,
                },

                endMilage: {
                    type: Number,
                    default: 0,
                },

                location: {
                    type: Object,
                    default: null,
                },

                reachedBy: {
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

                isPaymentByCompany: {
                    type: Boolean,
                    default: false,
                },

                isPaymentDone: {
                    type: Boolean,
                    default: false,
                },

                paymentAmount: {
                    type: Number,
                    default: 0,
                },

                paymentDate: {
                    type: Date,
                    default: null,
                },

                paymentRemark: {
                    type: String,
                    default: '',
                },

                updatedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    default: null,
                },

                paymentMode: {
                    type: String,
                    default: 0,
                },

                receiptImageUrl: {
                    type: String,
                    default: '',
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

        isMonthEndDone: {
            type: Boolean,
            default: false,
        },

        batchId: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export default mongoose.model('Trip', tripSchema);
