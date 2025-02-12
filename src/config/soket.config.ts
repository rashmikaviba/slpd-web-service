import { Server } from 'socket.io';
import express, { Express, Request, Response } from 'express';

import http from 'http';
import { envConfig } from './environment.config';

const app: Express = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [envConfig.CLIENT_URL as string],
        methods: ['GET', 'POST'],
    },
});

export const getActiveSocketIdsByRoles = (roles: number[]): string[] => {
    // Filter keys in the useSocketMap by roles
    const matchingKeys = Object.keys(useSocketMap).filter((key) =>
        roles.some((role) => key.startsWith(role.toString()))
    );

    // Map the matching keys to their corresponding socket IDs
    return matchingKeys.map((key) => useSocketMap[key]);
};

// to store the socket id of the user with role id
const useSocketMap: any = {};

// socket connection and disconnection
io.on('connection', (socket) => {
    const userWithRoleId: any = socket.handshake.query.userWithRoleId;

    if (userWithRoleId !== undefined && userWithRoleId !== 'undefined') {
        useSocketMap[userWithRoleId] = socket.id;
    }

    socket.on('disconnect', () => {
        delete useSocketMap[userWithRoleId];
    });
});

export { app, io, server };
