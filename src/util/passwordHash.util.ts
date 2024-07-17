import bcrypt from 'bcryptjs';
import { envConfig } from '../config/environment.config';

const hashPassword = async (password: string) => {
    let salt = await bcrypt.genSalt(parseInt(envConfig.SALT_ROUNDS || '10'));
    return await bcrypt.hash(password, salt);
};

const comparePassword = async (password: string, hash: string) => {
    return await bcrypt.compare(password, hash);
};

export default { hashPassword, comparePassword };
