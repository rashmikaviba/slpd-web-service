import Garage from './garage.model';

const save = async (garage: any, session: any) => {
    if (session) {
        return await garage.save({ session });
    } else {
        return await garage.save();
    }
};

const findByIdAndStatusIn = async (id: string, status: number[]) => {
    return Garage.findOne({ _id: id, status: { $in: status } })
}

const findAllAndStatusIn = async (status: number[]) => {
    return await Garage.find({ status: { $in: status } })
        .populate({ path: "createdBy", select: "username fullName" })
        .populate({ path: "updatedBy", select: "username fullName" })
        .sort({ createdAt: -1 })
        .exec();
};


export default { save, findByIdAndStatusIn, findAllAndStatusIn };