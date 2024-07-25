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

const validateUserDataForUpdate = async (
    type: number,
    data: string,
    id: string
) => {
    switch (type) {
        case 1:
            return await User.find({
                userName: data,
                _id: { $ne: id },
                status: WellKnownStatus.ACTIVE,
            }).exec();
        case 2:
            return await User.find({
                email: data,
                _id: { $ne: id },
                status: WellKnownStatus.ACTIVE,
            }).exec();
        case 3:
            return await User.find({
                nic: data,
                _id: { $ne: id },
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

const findByIdWithGenderRole = async (id: string) => {
    return await User.findOne({
        _id: id,
        status: WellKnownStatus.ACTIVE,
    }).populate([
        {
            path: 'gender',
            select: '_id name id',
        },
        {
            path: 'role',
            select: '_id name id',
        },
        {
            path: 'createdBy',
            select: '_id fullName',
        },
        {
            path: 'updatedBy',
            select: '_id fullName',
        },
    ]);
};

const findAll = async () => {
    return await User.find({
        status: WellKnownStatus.ACTIVE,
    });
};

const findAllWithGenderRole = async () => {
    return await User.find({
        status: WellKnownStatus.ACTIVE,
    }).populate([
        {
            path: 'gender',
            select: '_id name id',
        },
        {
            path: 'role',
            select: '_id name id',
        },
        {
            path: 'createdBy',
            select: '_id fullName',
        },
        {
            path: 'updatedBy',
            select: '_id fullName',
        },
    ]);
};

export default {
    Save,
    validateUserData,
    validateUserDataForUpdate,
    findById,
    findByIdWithGenderRole,
    findAll,
    findAllWithGenderRole,
};
