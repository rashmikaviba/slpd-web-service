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
    MONGO_MAX_POOL_SIZE: process.env.MONGO_MAX_POOL_SIZE,
    REQUEST_BODY_LIMIT: process.env.REQUEST_BODY_LIMIT,
    UPLOAD_MAX_FILE_SIZE_MB: process.env.UPLOAD_MAX_FILE_SIZE_MB,
    UPLOAD_MAX_FILE_COUNT: process.env.UPLOAD_MAX_FILE_COUNT,
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
    TRUST_PROXY: process.env.TRUST_PROXY,
};
