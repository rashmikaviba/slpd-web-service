import jwt from 'jsonwebtoken';
import { envConfig } from '../config/environment.config';

const JWT_SECRET: string = envConfig.JWT_SECRET || '';

const generateToken = (auth: any) => {
    const maxAge = 60 * 60 * 24 * 2;

    let tokenPayload = {
        id: auth.user._id,
        userName: auth.userName,
        role: auth.role.id,
        authId: auth._id,
    };

    let token = jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: maxAge,
        issuer: 'cybertronix.com',
    });

    return `Bearer ${token}`;
};

const extractToken = (token: string) => {
    let tokenArray = token.split(' ');
    return tokenArray[1] || '';
};

const verifyToken = (token: string) => {
    return jwt.verify(token, JWT_SECRET, {
        issuer: 'cybertronix.com',
    });
};

export default { generateToken, extractToken, verifyToken };
