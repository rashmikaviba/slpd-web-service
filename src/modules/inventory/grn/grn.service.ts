import constants from "../../../constant";
import cacheUtil from "../../../util/cache";
import { WellKnownGrnStatus } from "../../../util/enums/well-known-grn-status.enum";
import GRN from "./grn.model";

const getNextGrnNumber = async () => {
    const grn = await GRN.findOne().sort({ grnNumber: -1 });
    const nextGrnNumber = grn ? grn.grnNumber + 1 : 1;
    return nextGrnNumber;
}

const save = async (grn: any, session: any) => {
    let prefix = constants.CACHE.PREFIX.GRN;
    cacheUtil.clearCacheByPrefixs(prefix);

    if (session) {
        return await grn.save({ session });
    } else {
        return await grn.save();
    }
}

const findByIdAndStatusIn = async (id: string, status: number[]) => {
    return await GRN.findOne({
        _id: id,
        status: { $in: status },
    });
}

const advanceSearch = async (startDate: string, endDate: string, status: number) => {

    const cacheKey = constants.CACHE.PREFIX.GRN + startDate + endDate + status;
    const cached = await cacheUtil.getCache(cacheKey);
    if (cached) return cached;

    let statusArray = [];
    if (status === -1) {
        statusArray = [
            WellKnownGrnStatus.PENDING,
            WellKnownGrnStatus.APPROVED,
            WellKnownGrnStatus.REJECTED
        ];
    } else {
        statusArray.push(status);
    }

    let sDate = new Date(startDate);
    let eDate = new Date(endDate);

    sDate.setHours(0, 0, 0, 0);           // start of the day
    eDate.setHours(23, 59, 59, 999);      // end of the day

    const data = await GRN.find({
        grnDate: { $gte: sDate, $lte: eDate },
        status: { $in: statusArray }
    }).populate({
        path: 'products.productId',
        select: 'productName'
    })
        .populate({
            path: 'createdBy',
            select: 'userName'
        })
        .populate({
            path: 'approvedBy',
            select: 'userName'
        })
        .populate({
            path: 'rejectedBy',
            select: 'userName'
        });

    if (data) {
        cacheUtil.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

const findByIdAndStatusInWithData = async (id: string, status: number[]) => {
    return await GRN.findOne({
        _id: id,
        status: { $in: status },
    }).populate({
        path: 'products.productId',
        model: 'InventoryProduct',
    });
}

export default {
    getNextGrnNumber,
    save,
    findByIdAndStatusIn,
    advanceSearch,
    findByIdAndStatusInWithData
}