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

export default { findAllByStatusIn, findByIdAndStatus, findByCustomId };
