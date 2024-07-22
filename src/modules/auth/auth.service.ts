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
    return await Auth.find({ userName, status: WellKnownStatus.ACTIVE });
};

export default { save, findByUserName };
