import { WellKnownStatus } from "../../util/enums/well-known-status.enum";
import Pos from "./pos.model";

const save = async (pos: any, session: any) => {
    if (session) {
        return await pos.save({ session });
    } else {
        return await pos.save();
    }
};

const findByTripIdAndStatusIn = async (tripId: string, status: number[]) => {
    return await Pos.findOne({
        tripId: tripId,
        status: { $in: status },
    }).populate({
        path: 'tripId',
        select: '_id tripConfirmedNumber status'
    });
}

const findByTripIdAndStatusInWIthProducts = async (tripId: string, status: number[]) => {
    const pos: any = await Pos.findOne({
        tripId: tripId,
        status: { $in: status },
    }).populate({
        path: 'tripId',
        select: '_id tripConfirmedNumber status'
    }).populate({
        path: 'products.product',
        model: 'InventoryProduct',
        select: '_id productName isReturnableProduct',
    });

    if (pos) {
        pos.products = pos.products.filter((p: any) => p?.status === WellKnownStatus.ACTIVE);
    }

    return pos;
}

// Month end: ids of the active POS transaction of each trip (first match per trip, like findOne).
const findAllIdsByTripIdsAndStatusIn = async (tripIds: string[], status: number[]) => {
    if (tripIds.length === 0) return [];

    const list: any[] = await Pos.find({
        tripId: { $in: tripIds },
        status: { $in: status },
    })
        .select('_id tripId')
        .lean();

    const first = new Map<string, any>();
    for (const pos of list) {
        const key = String(pos.tripId);
        if (!first.has(key)) first.set(key, pos._id);
    }

    return Array.from(first.values());
};

// Month end: flag many POS transactions in one write (same fields the per-document save set).
const markMonthEndDone = async (ids: any[], userId: string, batchId: number, session: any) => {
    if (ids.length === 0) return;
    await Pos.updateMany({ _id: { $in: ids } }, { $set: { isMonthEndDone: true, batchId, updatedBy: userId } }, { session });
};

export default {
    findAllIdsByTripIdsAndStatusIn,
    markMonthEndDone,
    save,
    findByTripIdAndStatusIn,
    findByTripIdAndStatusInWIthProducts
}