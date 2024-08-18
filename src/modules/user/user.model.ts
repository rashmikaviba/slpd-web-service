import mongoose from 'mongoose';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';

const userSchema = new mongoose.Schema(
    {
        // General Information, full Name, userName, Gender, Date of Birth, Address, Phone Number, Email
        // Identity Information NIc, NIC Image, GS certificate, Driving License, sltda certificate, police clearance
        // Bank account information, Bank Name, Branch, Account Number, Account Holder Name, Address under the account
        // Infor for HR Basic Salary, Leave Count
        // Infor for Admin, Role, Status, Created By, Updated By

        // General Information
        fullName: {
            type: String,
            maxlength: [120, 'Full Name cannot be more than 120 characters'],
            required: [true, 'Full Name is required'],
        },

        userName: {
            type: String,
            maxlength: [50, 'Username cannot be more than 50 characters'],
            required: [true, 'Username is required'],
        },

        gender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Gender',
        },

        dateOfBirth: {
            type: Date,
        },

        address: {
            type: String,
            maxlength: [200, 'Address cannot be more than 200 characters'],
        },

        phoneNumber1: {
            type: String,
        },

        phoneNumber2: {
            type: String,
        },

        email: {
            type: String,
            required: [true, 'Email is required'],
            maxlength: [100, 'Email cannot be more than 100 characters'],
            validate: {
                validator: (value: string) => {
                    return /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
                        value
                    );
                },
                message: (props: any) => `${props.value} is not a valid email`,
            },
        },

        profileImageUrl: {
            type: String,
        },

        // Identity Information
        nic: {
            type: String,
            maxlength: [20, 'NIC cannot be more than 20 characters'],
            required: [true, 'NIC is required'],
        },

        nicImageUrl: {
            type: String,
        },

        gsCertificateUrl: {
            type: String,
        },

        drivingLicenseUrl: {
            type: String,
        },

        sltdaCertificateUrl: {
            type: String,
        },

        policeReportUrl: {
            type: String,
        },

        // Bank Account Information
        bankName: {
            type: String,
            maxlength: [100, 'Bank Name cannot be more than 100 characters'],
        },

        bankId: {
            type: Number,
            required: [true, 'Bank Id is required'],
        },

        branch: {
            type: String,
            maxlength: [100, 'Branch cannot be more than 100 characters'],
        },

        accountNumber: {
            type: String,
            maxlength: [50, 'Account Number cannot be more than 50 characters'],
        },

        accountHolderName: {
            type: String,
            maxlength: [
                120,
                'Account Holder Name cannot be more than 120 characters',
            ],
        },

        accountHolderAddress: {
            type: String,
            maxlength: [
                200,
                'Account Holder Address cannot be more than 200 characters',
            ],
        },

        // Information for HR
        basicSalary: {
            type: Number,
        },

        leaveCount: {
            type: Number,
        },

        // special information
        languages: {
            type: [String],
        },

        role: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Role',
        },

        // Information for Admin
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
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export default mongoose.model('User', userSchema);
