import Role from '../model/role.model';

const findAllByStatusIn = async (status: number[]) => {
    return await Role.find({ status: { $in: status } });
};

const findByIdAndStatus = async (id: string, status: number) => {
    return await Role.findOne({ _id: id, status });
};

export default { findAllByStatusIn, findByIdAndStatus };
