import { WellKnownStatus } from '../../../util/enums/well-known-status.enum';
import companyWorkingInfo from '../model/companyWorkingInfo.model';

const getCompanyWorkingInfo = async () => {
    return await companyWorkingInfo
        .findOne({
            status: WellKnownStatus.ACTIVE,
        })
        .sort({ $natural: -1 })
        .populate('createdBy updatedBy');
};

const save = async (data: any, session: any) => {
    if (session) {
        return await data.save({ session });
    } else {
        return await data.save();
    }
};

export default { getCompanyWorkingInfo, save };
