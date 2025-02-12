import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import internalTrip from './internalTrip.model';

const save = async (body: any, session: any) => {
    if (session) {
        return await body.save({ session });
    } else {
        return await body.save();
    }
};

const findByIdAndStatusIn = async (id: any, status: any) => {
    return await internalTrip.findOne({ _id: id, status: { $in: status } });
};

const findAllByVehicleId = async (vehicleId: any) => {
    return await internalTrip
        .find({
            vehicle: vehicleId,
            status: WellKnownStatus.ACTIVE,
        })
        .populate({
            path: 'driver',
            select: '_id fullName',
        })
        .populate({
            path: 'createdBy',
            select: '_id userName',
        })
        .populate({
            path: 'updatedBy',
            select: '_id userName',
        })
        .sort({ startDate: -1 });
};

const findAllByEndMonthAndStatusIn = async (
    endMonth: number,
    currYear: number,
    status: number[]
) => {
    let endDate = new Date();
    endDate.setFullYear(currYear);
    endDate.setMonth(endMonth);
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    return internalTrip.find({
        createdAt: { $lt: endDate },
        status: { $in: status },
        isMonthEndDone: false,
    });
};
export default {
    save,
    findByIdAndStatusIn,
    findAllByVehicleId,
    findAllByEndMonthAndStatusIn,
};
