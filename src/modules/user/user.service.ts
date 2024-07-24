import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import User from './user.model';

const Save = async (user: any, session: any) => {
    if (session) {
        return await user.save({ session });
    } else {
        return await user.save({ session });
    }
};

const validateUserData = async (type: number, data: string): Promise<any[]> => {
    switch (type) {
        case 1:
            return await User.find({
                userName: data,
                status: WellKnownStatus.ACTIVE,
            }).exec();
        case 2:
            return await User.find({
                email: data,
                status: WellKnownStatus.ACTIVE,
            }).exec();
        case 3:
            return await User.find({
                nic: data,
                status: WellKnownStatus.ACTIVE,
            }).exec();
        default:
            return [];
    }
};

const findById = async (id: string) => {
    return await User.findOne({
        _id: id,
        status: WellKnownStatus.ACTIVE,
    });
};

export default { Save, validateUserData, findById };
