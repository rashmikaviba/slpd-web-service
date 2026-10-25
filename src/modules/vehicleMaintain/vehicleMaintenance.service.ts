import constants from "../../constant";
import cacheUtil from "../../util/cache";
import vehiclemaintenanceModel from "./vehicleMaintenance.model";

const save = async (vehicleMaintain: any, session: any) => {
    let prefix = constants.CACHE.PREFIX.VEHICLE_MAINTENANCE;
    cacheUtil.clearCacheByPrefixs(prefix);
    if (session) {
        return await vehicleMaintain.save({ session });
    } else {
        return await vehicleMaintain.save();
    }
};

const findByIdAndStatusIn = async (id: string, statuses: Number[]) => {
    return await vehiclemaintenanceModel.findOne({ _id: id, status: { $in: statuses } });
}

const findByIdAndStatusInWithData = async (id: string, statuses: Number[]) => {
    return await vehiclemaintenanceModel.findOne({ _id: id, status: { $in: statuses } }).populate('vehicle garage createdBy updatedBy');
}

const findAllByMaintenanceDateAndStatusIn = async (
    statuses: Number[],
    startDate: string,
    endDate: string
) => {
    let cacheKey = constants.CACHE.PREFIX.VEHICLE_MAINTENANCE + startDate + endDate + JSON.stringify(statuses);
    const cached = cacheUtil.getCache(cacheKey) as any[];
    if (cached) return cached;

    let sDate = new Date(startDate);
    let eDate = new Date(endDate);

    sDate.setHours(0, 0, 0, 0); // Set time to midnight
    eDate.setHours(23, 59, 59, 999); // Set time to 23:59:59.999
    const data: any[] = await vehiclemaintenanceModel.find({
        status: { $in: statuses },
        maintenanceDate: { $gte: sDate, $lte: eDate },
    })
        .populate({ path: 'vehicle', select: '_id registrationNumber isRentalVehicle isFreelanceVehicle' })
        .populate({ path: 'garage', select: '_id name' })
        .populate({ path: 'createdBy updatedBy', select: '_id userName fullName' })
        .sort({ maintenanceDate: 1 });

    if (data) {
        cacheUtil.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

// Month end only: only the ids are needed to flag the maintenance records and log them.
const findAllByEndMonthAndStatusIn = async (
    endMonth: number,
    currYear: number,
    status: number[]
) => {
    let endDate = new Date();
    endDate.setFullYear(currYear);
    endDate.setMonth(endMonth);
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    endDate.setHours(23, 59, 59, 999);

    return vehiclemaintenanceModel.find({
        maintenanceDate: { $lt: endDate },
        status: { $in: status },
        isMonthEndDone: false,
    }).select('_id').sort({ startDate: 1 }).lean();
};

// Month end: flag many maintenance records in one write (same fields the per-document save set).
const markMonthEndDone = async (ids: any[], userId: string, batchId: number, session: any) => {
    if (ids.length === 0) return;
    cacheUtil.clearCacheByPrefixs(constants.CACHE.PREFIX.VEHICLE_MAINTENANCE);
    await vehiclemaintenanceModel.updateMany({ _id: { $in: ids } }, { $set: { isMonthEndDone: true, batchId, updatedBy: userId } }, { session });
};


export default {
    save,
    findByIdAndStatusIn,
    findAllByMaintenanceDateAndStatusIn,
    findByIdAndStatusInWithData,
    findAllByEndMonthAndStatusIn,
    markMonthEndDone
}