import { Request, Response } from 'express';
import authService from './auth.service';
import BadRequestError from '../../error/BadRequestError';
import passwordHashUtil from '../../util/passwordHash.util';
import jwtUtil from '../../util/jwt.util';
import CommonResponse from '../../util/commonResponse';
import { StatusCodes } from 'http-status-codes';
import UnauthorizedError from '../../error/UnauthorizedError';

const userLogin = async (req: Request, res: Response) => {
    const { userName, password } = req.body;

    const existAuth: any = await authService.findByUserName(userName);

    if (!existAuth) throw new BadRequestError('Invalid username!');

    if (existAuth?.isBlocked)
        throw new BadRequestError('User is blocked, Please contact admin!');

    const isPasswordMatch: boolean = await passwordHashUtil.comparePassword(
        password,
        existAuth.password
    );

    if (!isPasswordMatch) throw new BadRequestError('Invalid password!');

    const token = jwtUtil.generateToken(existAuth);

    const response = {
        token: token,
        user: existAuth?.user,
        role: existAuth.role?.id,
        modules: [],
    };

    CommonResponse(res, true, StatusCodes.OK, 'Login Successful!', response);
};

// reset password to default password as  123
const resetPassword = async (req: Request, res: Response) => {
    const userId = req.params.id;
    const userAuth: any = req.auth;

    let auth = await authService.findByUserId(userId);

    if (!auth) throw new BadRequestError('User not found!');

    let hashedPassword = await passwordHashUtil.hashPassword('12345');

    auth.password = hashedPassword;
    auth.updatedBy = userAuth.id;

    await authService.save(auth, null);

    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        'User password reset successfully as default password!',
        null
    );
};

const changePassword = async (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body;
    const userAuth: any = req.auth;

    let auth = await authService.findById(userAuth.authId);

    if (!auth) throw new BadRequestError('User not found!');

    const isPasswordMatch: boolean = await passwordHashUtil.comparePassword(
        oldPassword,
        auth.password
    );

    if (!isPasswordMatch) throw new BadRequestError('Invalid old password!');

    let hashedPassword = await passwordHashUtil.hashPassword(newPassword);

    auth.password = hashedPassword;

    await authService.save(auth, null);

    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        'Password changed successfully!',
        null
    );
};

const refreshUserAuth = async (req: Request, res: Response) => {
    const userAuth: any = req.auth;
    const { password } = req.body;

    let auth = await authService.findById(userAuth.authId);

    if (!auth) throw new UnauthorizedError('Invalid authentication request!');

    const isPasswordMatch: boolean = await passwordHashUtil.comparePassword(
        password,
        auth.password
    );

    if (!isPasswordMatch) throw new BadRequestError('Invalid password!');

    const token = jwtUtil.generateToken(auth);

    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        'Session refresh successful!',
        token
    );
};

export { userLogin, resetPassword, changePassword, refreshUserAuth };
