import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';

import { envConfig } from './config/environment.config';
import { connectDB } from './config/database.config';

// Import errors
import errorHandlerMiddleware from './middleware/error.middleware';

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

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
