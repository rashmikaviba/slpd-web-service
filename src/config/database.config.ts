import mongoose from 'mongoose'
import { envConfig } from './environment.config'

const url: string = envConfig.MONGO_URL || ''

const connectDB = async () => {
    mongoose.set('strictQuery', true)

    await mongoose
        .connect(url)
        .then(() => {
            console.log('MONGODB CONNECTED SUCCESSFULLY..!')
        })
        .catch((err) => {
            throw new Error(err)
        })
}

export { connectDB }
