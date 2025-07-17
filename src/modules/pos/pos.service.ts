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
        select: '_id productName',
    });

    if (pos) {
        pos.products = pos.products.filter((p: any) => p?.status === WellKnownStatus.ACTIVE);
    }

    return pos;
}

export default {
    save,
    findByTripIdAndStatusIn,
    findByTripIdAndStatusInWIthProducts
}