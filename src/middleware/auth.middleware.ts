import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import UnauthorizedError from '../error/UnauthorizedError';
import ForbiddenError from '../error/ForbiddenError';
import jwtUtil from '../util/jwt.util';
import roleService from '../modules/common/service/role.service';
import authService from '../modules/auth/auth.service';

declare global {
    namespace Express {
        interface Request {
            auth?: any;
        }
    }
}

const authorize = (rolesArray: any = []) => {
    if (!rolesArray) rolesArray = [];

    return async (req: Request, res: Response, next: NextFunction) => {
        const authHeader: any = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('Authentication invalid!');
        }

        const token = jwtUtil.extractToken(authHeader);

        if (token) {
            let payload: any = null;

            try {
                payload = jwtUtil.verifyToken(token);
            } catch (error) {
                if (error instanceof jwt.TokenExpiredError)
                    throw new UnauthorizedError('Your session is expired!');

                return next(
                    new ForbiddenError(
                        `You're unauthorized to access this resource!`
                    )
                );
            }

            // user is not blocked user
            let userAuth = await authService.findById(payload.authId);

            if (!userAuth) {
                return next(new UnauthorizedError('Authentication invalid!'));
            } else if (userAuth.isBlocked) {
                return next(
                    new UnauthorizedError(
                        `Your account is blocked, Please contact admin!`
                    )
                );
            }

            // if (!userAuth || userAuth.isBlocked) {
            //     return next(
            //         new UnauthorizedError(
            //             `You're unauthorized to access this resource!`
            //         )
            //     );
            // }

            if (rolesArray.length) {
                const roleIds = await roleService.findIdsByCustomIds(
                    rolesArray
                );

                if (!roleIds.includes(payload.role)) {
                    return next(
                        new ForbiddenError(
                            `You're unauthorized to access this resource!`
                        )
                    );
                }
            }

            req.auth = payload;
            return next();
        } else {
            return next(
                new UnauthorizedError(
                    "You're unauthorized to access this resource!"
                )
            );
        }
    };
};

export default { authorize };
