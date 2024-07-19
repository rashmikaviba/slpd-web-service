import Gender from './model/gender.model';

// get All genders by status in
const findAllGendersByStatusIn = async (status: number[]) => {
    return Gender.find({ status: { $in: status } });
};

export default { findAllGendersByStatusIn };
