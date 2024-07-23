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

const SaveUser = async (req: Request, res: Response) => {
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
            role: roleData._id,
        });

        // Create Auth
        let password = userName + '123';
        const hashedPassword = await passwordHashUtil.hashPassword(password);

        const auth = new Auth({
            userName,
            password: hashedPassword,
            user: user._id,
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

export { SaveUser };
