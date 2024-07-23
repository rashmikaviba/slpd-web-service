import { WellKnownStatus } from '../../../util/enums/well-known-status.enum';
import Gender from '../model/gender.model';

// get All genders by status in
const findAllGendersByStatusIn = async (status: number[]) => {
    return await Gender.find({ status: { $in: status } });
};

const findGenderByCustomId = async (id: number) => {
    return Gender.findOne({ id: id, status: WellKnownStatus.ACTIVE });
};

export default { findAllGendersByStatusIn, findGenderByCustomId };
