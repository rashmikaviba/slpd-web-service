import { Request, Response } from 'express';
import { startSession } from 'mongoose';

import userService from './user.service';
import authService from '../auth/auth.service';
import passwordHashUtil from '../../util/passwordHash.util';
import roleService from '../common/service/role.service';
import commonService from '../common/service/common.service';

import User from './user.model';
import Auth from '../auth/auth.model';
import userUtil from './user.util';

import BadRequestError from '../../error/BadRequestError';
import CommonResponse from '../../util/commonResponse';
import { StatusCodes } from 'http-status-codes';
import UserResponseDto from './dto/userResponseDto';
import NotFoundError from '../../error/NotFoundError';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import constants from '../../constant';

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
        bankId,
        branch,
        accountNumber,
        accountHolderName,
        accountHolderAddress,
        basicSalary,
        leaveCount,
        languages,
        role,
        isFreelanceDriver,
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
            bankId,
            branch,
            accountNumber,
            accountHolderName,
            accountHolderAddress,
            basicSalary,
            leaveCount,
            languages,
            isFreelanceDriver,
            role: roleData._id,
            createdBy: userAuth?.id,
            updatedBy: userAuth?.id,
        });

        // Create Auth
        const hashedPassword = await passwordHashUtil.hashPassword('12345');

        const auth = new Auth({
            userName,
            password: hashedPassword,
            user: user._id,
            role: roleData._id,
            createdBy: userAuth?.id,
            updatedBy: userAuth?.id,
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
const updateUser = async (req: Request, res: Response) => {
    const userId = req.params.id;
    const userAuth: any = req.auth;
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
        bankId,
        branch,
        accountNumber,
        accountHolderName,
        accountHolderAddress,
        basicSalary,
        leaveCount,
        languages,
        role,
        isFreelanceDriver,
    } = req.body;

    // validate userName
    const existingUsers = await userService.validateUserDataForUpdate(
        1,
        userName,
        userId
    );
    const existingEmails = await userService.validateUserDataForUpdate(
        2,
        email,
        userId
    );
    const existingNics = await userService.validateUserDataForUpdate(
        3,
        nic,
        userId
    );

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

        let user = await userService.findById(userId);

        if (!user) throw new NotFoundError('User not found!');

        user.fullName = fullName;
        user.userName = userName;
        user.gender = genderData._id;
        user.dateOfBirth = dateOfBirth;
        user.address = address;
        user.phoneNumber1 = phoneNumber1;
        user.phoneNumber2 = phoneNumber2;
        user.email = email;
        user.profileImageUrl = profileImageUrl;
        user.nic = nic;
        user.nicImageUrl = nicImageUrl;
        user.gsCertificateUrl = gsCertificateUrl;
        user.drivingLicenseUrl = drivingLicenseUrl;
        user.sltdaCertificateUrl = sltdaCertificateUrl;
        user.policeReportUrl = policeReportUrl;
        user.bankName = bankName;
        user.bankId = bankId;
        user.branch = branch;
        user.accountNumber = accountNumber;
        user.accountHolderName = accountHolderName;
        user.accountHolderAddress = accountHolderAddress;
        user.basicSalary = basicSalary;
        user.leaveCount = leaveCount;
        user.languages = languages;
        user.isFreelanceDriver = isFreelanceDriver;
        user.role = roleData._id;
        user.updatedBy = userAuth?.id;

        createdUser = await userService.Save(user, session);

        let auth = await authService.findByUserId(userId);

        if (!auth) throw new BadRequestError('User not found!');

        auth.userName = userName;
        auth.role = roleData._id;
        auth.updatedBy = userAuth?.id;

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
        StatusCodes.OK,
        'User updated successfully!',
        createdUser
    );
};

// block user by user id
const blockUser = async (req: Request, res: Response) => {
    const userId = req.params.id;
    const userAuth: any = req.auth;

    let auth = await authService.findByUserId(userId);

    if (!auth) throw new NotFoundError('User not found!');

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

    if (!auth) throw new NotFoundError('User not found!');

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

const getAllUsers = async (req: Request, res: Response) => {
    let response: any[] = [];
    const userAuth: any = req.auth;
    const users = await userService.findAllWithGenderRole();

    let filteredUsers = users.filter(
        (user) => user._id.toString() !== userAuth?.id
    );

    // map user to user response dto
    if (filteredUsers.length > 0) {
        response = userUtil.userModelToUserResponseDtos(filteredUsers);
    }

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

const getUserById = async (req: Request, res: Response) => {
    const userId = req.params.id;

    let response: any = null;

    const user = await userService.findByIdWithGenderRole(userId);

    if (user) {
        response = userUtil.userModelToUserResponseDto(user);
    } else {
        throw new NotFoundError('User not found!');
    }

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

const checkUserName = async (req: Request, res: Response) => {
    const userId = req.query.id as string;
    const userName = req.query.userName as string;
    const email = req.query.email as string;
    const nic = req.query.nic as string;

    let result = true;
    let message = '';

    if (userId) {
        const existingUsers = await userService.validateUserDataForUpdate(
            1,
            userName,
            userId
        );
        const existingEmails = await userService.validateUserDataForUpdate(
            2,
            email,
            userId
        );
        const existingNics = await userService.validateUserDataForUpdate(
            3,
            nic,
            userId
        );

        if (existingUsers.length > 0) {
            result = false;
            message = 'Username already exists, please try another username!';
        } else if (existingEmails.length > 0) {
            result = false;
            message = 'Email already exists, please try another email!';
        } else if (existingNics.length > 0) {
            result = false;
            message = 'NIC already exists, please try another NIC!';
        }
    } else {
        const existingUsers = await userService.validateUserData(1, userName);
        const existingEmails = await userService.validateUserData(2, email);
        const existingNics = await userService.validateUserData(3, nic);

        if (existingUsers.length > 0) {
            result = false;
            message = 'Username already exists, please try another username!';
        } else if (existingEmails.length > 0) {
            result = false;
            message = 'Email already exists, please try another email!';
        } else if (existingNics.length > 0) {
            result = false;
            message = 'NIC already exists, please try another NIC!';
        }
    }

    CommonResponse(res, true, StatusCodes.OK, message, result);
};

const deleteUser = async (req: Request, res: Response) => {
    const userId = req.params.id;
    const userAuth: any = req.auth;

    let auth: any = await authService.findByUserId(userId);
    let user: any = await userService.findById(userId);

    if (!auth || !user) throw new NotFoundError('User not found!');

    const session = await startSession();

    try {
        //start transaction in session
        session.startTransaction();

        auth.status = WellKnownStatus.DELETED;
        auth.updatedBy = userAuth.id;

        user.status = WellKnownStatus.DELETED;
        user.updatedBy = userAuth.id;

        await userService.Save(user, session);

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
        StatusCodes.OK,
        'User deleted successfully!',
        null
    );
};

const getAllUsersByRole = async (req: Request, res: Response) => {
    const userAuth: any = req.auth;
    const roleId = req.params.id;

    const role: any = await roleService.findByCustomId(roleId);

    let users: any[] = [];
    if (role) {
        users = await userService.findAllByRoleId(role?._id);
    }
    CommonResponse(res, true, StatusCodes.OK, '', users);
};

const getDriversForTrip = async (req: Request, res: Response) => {
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const tripId: string = (req.query.tripId as string) || '';

    const role: any = await roleService.findByCustomId(
        constants.USER.ROLES.DRIVER.toString()
    );
    let users: any[] = [];

    users = await userService.findDriversByNotInInternalTripsAndNormalTrips(
        role?._id,
        startDate,
        endDate,
        tripId
    );

    CommonResponse(res, true, StatusCodes.OK, '', users);
};

export {
    saveUser,
    blockUser,
    unblockUser,
    updateUser,
    getAllUsers,
    getUserById,
    checkUserName,
    deleteUser,
    getAllUsersByRole,
    getDriversForTrip,
};
