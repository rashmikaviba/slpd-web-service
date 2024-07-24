import { WellKnownStatus } from '../../../util/enums/well-known-status.enum';
import Role from '../model/role.model';

const findAllByStatusIn = async (status: number[]) => {
    return await Role.find({ status: { $in: status } });
};

const findByIdAndStatus = async (id: string, status: number) => {
    return await Role.findOne({ _id: id, status });
};

const findByCustomId = async (id: string) => {
    return await Role.findOne({ id: id, status: WellKnownStatus.ACTIVE });
};

// pass _id as string array
const findIdsByCustomIds = async (ids: string[]) => {
    const roles = await Role.find({
        id: { $in: ids },
        status: WellKnownStatus.ACTIVE,
    }).select('_id');

    return roles?.map((role) => role._id.toString()) || [];
};

export default {
    findAllByStatusIn,
    findByIdAndStatus,
    findByCustomId,
    findIdsByCustomIds,
};
