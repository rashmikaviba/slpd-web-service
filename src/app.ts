import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
require('express-async-errors');

import { envConfig } from './config/environment.config';
import { connectDB } from './config/database.config';

import mapping from './mapping';

// Import errors
import constants from './constant';
import errorHandlerMiddleware from './middleware/error.middleware';
import NotFoundError from './error/NotFoundError';
import runDBBackup from './config/dbBackups.config';
import { accessLogMiddleware, responseLogMiddleware } from './middleware/auditLog.middleware';

import { app, server } from './config/soket.config';
import cache from './util/cache';
// const app: Express = express();

const corsOptions = {
    origin: envConfig.CLIENT_URL,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the uploads directory
const uploadsPath =
    process.env.NODE_ENV === 'production'
        ? '/app/src/uploads' // Adjust path for compiled production
        : path.join(__dirname, 'uploads');; // Use this for development

app.use('/uploads', express.static(uploadsPath));

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
        server.listen(port, () => {
            console.log(`SERVER IS LISTENING ON PORT ${port}..!`);
            connectDB();
            runDBBackup();

            // shedule task for every 20 seconds
            setInterval(() => {
                console.log("cache keys :" + cache.getCacheKeys());
            }, 10000);
        });
    } catch (e) {
        console.log(e);
    }
};

start();
