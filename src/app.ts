import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
require('express-async-errors');

import { envConfig } from './config/environment.config';
import { connectDB, disconnectDB } from './config/database.config';

import mapping from './mapping';

// Import errors
import constants from './constant';
import errorHandlerMiddleware from './middleware/error.middleware';
import NotFoundError from './error/NotFoundError';
import runDBBackup from './config/dbBackups.config';
import { accessLogMiddleware, responseLogMiddleware } from './middleware/auditLog.middleware';

import { app, server } from './config/soket.config';
// const app: Express = express();


const allowedOrigins = (envConfig.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS'));
    },
};

if (envConfig.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: envConfig.REQUEST_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: envConfig.REQUEST_BODY_LIMIT || '1mb' }));


let isReady = false;
app.get('/health/live', (_req, res) => res.status(200).json({ status: 'ok' }));
app.get('/health/ready', (_req, res) => {
    res.status(isReady ? 200 : 503).json({ status: isReady ? 'ready' : 'not-ready' });
});

app.use(rateLimit({
    windowMs: Number(envConfig.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    limit: Number(envConfig.RATE_LIMIT_MAX || 300),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again later.' },
}));

// Serve static files from the uploads directory
const uploadsPath =
    process.env.NODE_ENV === 'production'
        ? '/app/src/uploads' // Adjust path for compiled production
        : path.join(__dirname, 'uploads');; // Use this for development

app.use('/uploads', express.static(uploadsPath, { maxAge: '1d', fallthrough: false }));

// Middleware for logging access and response
app.use(accessLogMiddleware);
app.use(responseLogMiddleware);


// use routes mapping
app.use(constants.API.PREFIX, mapping);

// Not found route
app.use('*', (req: Request, res: Response) => {
    throw new NotFoundError(`Can't find ${req.originalUrl} on this server!`);
});

app.use(errorHandlerMiddleware);

const start = async () => {
    const port = envConfig.PORT || 5000;
    try {
        if (!envConfig.JWT_SECRET) {
            throw new Error('JWT_SECRET must be configured');
        }
        await connectDB();
        isReady = true;
        server.listen(port, () => {
            console.log(`SERVER IS LISTENING ON PORT ${port}..!`);
            runDBBackup();
        });
    } catch (e) {
        console.log(e);
    }
};

start();

const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`);
    isReady = false;
    server.close(async () => {
        await disconnectDB();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 30_000).unref();
};

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
