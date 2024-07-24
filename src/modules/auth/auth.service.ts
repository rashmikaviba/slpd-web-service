import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import Auth from './auth.model';

const save = async (auth: any, session: any) => {
    if (session) {
        return await auth.save({ session });
    } else {
        return await auth.save();
    }
};

const findByUserName = async (userName: string) => {
    return await Auth.findOne({
        userName,
        status: WellKnownStatus.ACTIVE,
    }).populate('user role');
};

// find by id and status not delete
const findById = async (id: string) => {
    return await Auth.findOne({
        _id: id,
        status: WellKnownStatus.ACTIVE,
    });
};

const findByUserId = async (userId: string) => {
    return await Auth.findOne({
        user: userId,
        status: WellKnownStatus.ACTIVE,
    });
};

export default { save, findByUserName, findById, findByUserId };
