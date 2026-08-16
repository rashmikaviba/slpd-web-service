import mongoose from 'mongoose'
import { envConfig } from './environment.config'

const url: string = envConfig.MONGO_URL || ''

const connectDB = async () => {
    mongoose.set('strictQuery', true)

    if (!url) {
        throw new Error('MONGO_URL must be configured');
    }

    await mongoose
        .connect(url, {
            maxPoolSize: Number(envConfig.MONGO_MAX_POOL_SIZE || 100),
            serverSelectionTimeoutMS: 10_000,
        })
        .then(() => {
            console.log('MONGODB CONNECTED SUCCESSFULLY..!')
        })
        .catch((err) => {
            throw new Error(err)
        })
}

const disconnectDB = async () => mongoose.disconnect();

export { connectDB, disconnectDB }
