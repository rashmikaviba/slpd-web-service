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

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the uploads directory
const uploadsPath =
    process.env.NODE_ENV === 'production'
        ? '../../src/uploads' // Adjust path for compiled production
        : 'uploads';     // Use this for development
console.log('Serving uploads from:', uploadsPath);
app.use('/uploads', express.static(path.join(__dirname, uploadsPath)));

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
        app.listen(port, () => {
            console.log(`SERVER IS LISTENING ON PORT ${port}..!`);
            connectDB();
            runDBBackup();
        });
    } catch (e) {
        console.log(e);
    }
};

start();
