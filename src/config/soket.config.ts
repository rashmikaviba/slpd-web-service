import { Server } from 'socket.io';
import express, { Express } from 'express';

import http from 'http';
import { envConfig } from './environment.config';

import jwtUtil from '../util/jwt.util';
import Auth from '../modules/auth/auth.model';
import { WellKnownStatus } from '../util/enums/well-known-status.enum';

const app: Express = express();

const server = http.createServer(app);

const allowedOrigins = (envConfig.CLIENT_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
    },
});

io.use(async (socket, next) => {
    const header = socket.handshake.headers.authorization;
    const suppliedToken = socket.handshake.auth?.token || header;
    const token = typeof suppliedToken === 'string'
        ? suppliedToken.replace(/^Bearer\s+/i, '')
        : '';

    if (!token) return next(new Error('Authentication required'));

    try {
        const payload: any = jwtUtil.verifyToken(token);
        const auth = await Auth.findOne({
            _id: payload.authId,
            status: WellKnownStatus.ACTIVE,
            isBlocked: false,
        }).select('_id role user').populate('role', 'id').lean() as any;

        if (!auth || !auth.user || auth.user.toString() !== payload.id || auth.role?.id !== payload.role) {
            return next(new Error('Authentication invalid'));
        }

        socket.data.auth = { authId: auth._id.toString(), userId: payload.id, role: auth.role.id };
        return next();
    } catch {
        return next(new Error('Authentication invalid'));
    }
});

io.on('connection', (socket) => {
    socket.join(`role:${socket.data.auth.role}`);
});

export const getActiveSocketIdsByRoles = async (roles: number[]): Promise<string[]> => {
    const socketIds = await Promise.all(roles.map((role) => io.in(`role:${role}`).allSockets()));
    return [...new Set(socketIds.flatMap((ids) => [...ids]))];
};

export { app, io, server };
