import jwt from 'jsonwebtoken';
import { envConfig } from '../config/environment.config';

const JWT_SECRET: string = envConfig.JWT_SECRET || '';

const generateToken = (user: any) => {
    const maxAge = 60 * 60 * 24 * 2;

    const tokenPayload = {
        _id: user._id,
        email: user.email,
        role: user.role,
    };

    return jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: maxAge,
        issuer: 'cybertronix.com',
    });
};

const extractToken = (token: string) => {
    let tokenArray = token.split(' ');
    return tokenArray[1] || '';
};

const verifyToken = (token: string) => {
    return jwt.verify(token, JWT_SECRET);
};

export default { generateToken, extractToken, verifyToken };
