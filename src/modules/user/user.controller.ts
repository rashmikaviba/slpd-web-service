import { Request, Response } from 'express';
import { startSession } from 'mongoose';

import userService from './user.service';
import authService from '../auth/auth.service';
import passwordHashUtil from '../../util/passwordHash.util';
import roleService from '../common/service/role.service';
import commonService from '../common/service/common.service';

import User from './user.model';
import Auth from '../auth/auth.model';

import BadRequestError from '../../error/BadRequestError';
import CommonResponse from '../../util/commonResponse';
import { StatusCodes } from 'http-status-codes';

const saveUser = async (req: Request, res: Response) => {
    const {
        fullName,
        userName,
        gender,
        dateOfBirth,
        address,
        phoneNumber1,
        phoneNumber2,
        email,
        profileImageUrl,
        nic,
        nicImageUrl,
        gsCertificateUrl,
        drivingLicenseUrl,
        sltdaCertificateUrl,
        policeReportUrl,
        bankName,
        branch,
        accountNumber,
        accountHolderName,
        accountHolderAddress,
        basicSalary,
        leaveCount,
        languages,
        role,
    } = req.body;
    const userAuth: any = req.auth;

    // validate userName
    const existingUsers = await userService.validateUserData(1, userName);
    const existingEmails = await userService.validateUserData(2, email);
    const existingNics = await userService.validateUserData(3, nic);

    let error = '';
    if (existingUsers.length > 0) {
        error = 'User Name already exists!';
    } else if (existingEmails.length > 0) {
        error = 'Email already exists!';
    } else if (existingNics.length > 0) {
        error = 'NIC already exists!';
    }

    if (error) {
        throw new BadRequestError(error);
    }

    const roleData = await roleService.findByCustomId(role);
    const genderData = await commonService.findGenderByCustomId(gender);

    if (!roleData) throw new BadRequestError('Valid Role is required!');
    if (!genderData) throw new BadRequestError('Valid Gender is required!');

    // create user
    let createdUser = null;

    const session = await startSession();

    try {
        //start transaction in session
        session.startTransaction();

        // create user
        const user = new User({
            fullName,
            userName,
            gender: genderData._id,
            dateOfBirth,
            address,
            phoneNumber1,
            phoneNumber2,
            email,
            profileImageUrl,
            nic,
            nicImageUrl,
            gsCertificateUrl,
            drivingLicenseUrl,
            sltdaCertificateUrl,
            policeReportUrl,
            bankName,
            branch,
            accountNumber,
            accountHolderName,
            accountHolderAddress,
            basicSalary,
            leaveCount,
            languages,
            createdBy: userAuth.id,
            updatedBy: userAuth.id,
        });

        // Create Auth
        const hashedPassword = await passwordHashUtil.hashPassword('12345');

        const auth = new Auth({
            userName,
            password: hashedPassword,
            user: user._id,
            role: roleData._id,
            createdBy: userAuth.id,
            updatedBy: userAuth.id,
        });

        createdUser = await userService.Save(user, session);

        await authService.save(auth, session);

        //commit transaction
        await session.commitTransaction();
    } catch (e) {
        //abort transaction
        await session.abortTransaction();
        throw e;
    } finally {
        //end session
        session.endSession();
    }

    CommonResponse(
        res,
        true,
        StatusCodes.CREATED,
        'User created successfully!',
        createdUser
    );
};

// Update user by user id
const updateUser = async (req: Request, res: Response) => {};

// block user by user id
const blockUser = async (req: Request, res: Response) => {
    const userId = req.params.id;
    const userAuth: any = req.auth;

    let auth = await authService.findByUserId(userId);

    if (!auth) throw new BadRequestError('User not found!');

    if (auth.isBlocked) throw new BadRequestError('User already blocked!');

    auth.isBlocked = true;
    auth.updatedBy = userAuth.id;

    await authService.save(auth, null);

    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        'User blocked successfully!',
        null
    );
};

// unblock user by user id
const unblockUser = async (req: Request, res: Response) => {
    const userId = req.params.id;
    const userAuth: any = req.auth;

    let auth = await authService.findByUserId(userId);

    if (!auth) throw new BadRequestError('User not found!');

    if (!auth.isBlocked) throw new BadRequestError('User already unblocked!');

    auth.isBlocked = false;
    auth.updatedBy = userAuth.id;

    await authService.save(auth, null);

    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        'User unblocked successfully!',
        null
    );
};

export { saveUser, blockUser, unblockUser, updateUser };
