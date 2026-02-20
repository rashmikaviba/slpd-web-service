import constants from '../../constant';
import cacheUtil from '../../util/cache';
import Garage from './garage.model';

const save = async (garage: any, session: any) => {
    let prefix = constants.CACHE.PREFIX.GARAGE;

    cacheUtil.clearCacheByPrefixs(prefix);
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
    const key = constants.CACHE.PREFIX.GARAGE + JSON.stringify(status);
    const cached = await cacheUtil.getCache(key);
    if (cached) return cached;


    const data: any = await Garage.find({ status: { $in: status } })
        .populate({ path: "createdBy", select: "username fullName" })
        .populate({ path: "updatedBy", select: "username fullName" })
        .sort({ createdAt: -1 })
        .exec();

    if (data) {
        cacheUtil.setCache(key, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};


export default { save, findByIdAndStatusIn, findAllAndStatusIn };