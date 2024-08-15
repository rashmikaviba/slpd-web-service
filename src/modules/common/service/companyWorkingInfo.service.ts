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

const save = async (data: any) => {
    let toSave = new companyWorkingInfo(data);
    return await toSave.save();
};

export default { getCompanyWorkingInfo, save };
