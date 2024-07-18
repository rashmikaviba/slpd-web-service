import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
require('express-async-errors');

import { envConfig } from './config/environment.config';
import { connectDB } from './config/database.config';

// Import errors
import errorHandlerMiddleware from './middleware/error.middleware';
import constants from './constant';

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import routes
import StoreRouter from './modules/store/store.route';

// use routes
app.use(constants.API.PREFIX.concat('/store'), StoreRouter);

app.use(errorHandlerMiddleware);

const start = async () => {
    const port = envConfig.PORT || 5000;
    try {
        app.listen(port, () => {
            console.log(`SERVER IS LISTENING ON PORT ${port}..!`);
            connectDB();
        });
    } catch (e) {
        console.log(e);
    }
};

start();
