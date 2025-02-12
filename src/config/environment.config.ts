import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
const envFilePath =
    process.env.NODE_ENV === 'production'
        ? path.resolve(__dirname, '../../.env.prod')
        : path.resolve(__dirname, '../../.env.dev');
dotenv.config({ path: envFilePath });

export const envConfig = {
    PORT: process.env.PORT,
    MONGO_URL: process.env.MONGO_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    SALT_ROUNDS: process.env.SALT_ROUNDS,
    BASE_URL: process.env.BASE_URL,
    CLIENT_URL: process.env.CLIENT_URL,
};
