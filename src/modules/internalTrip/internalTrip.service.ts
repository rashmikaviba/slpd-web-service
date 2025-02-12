import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import Trip from '../trip/trip.model';
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

// const validateVehicleForDateRange = async (
//     startDate: Date,
//     endDate: Date,
//     vehicleId: string,
//     internalTripId: string
// ) => {
//     let result: any[] = [];
//     if (internalTripId) {
//         result.push(
//             await internalTrip
//                 .findOne({
//                     vehicle: vehicleId,
//                     startDate: { $gte: startDate, $lt: endDate },
//                     status: WellKnownStatus.ACTIVE,
//                     _id: { $ne: internalTripId },
//                 })
//                 .lean()
//                 .exec()
//         );
//     } else {
//         result.push(
//             await internalTrip
//                 .findOne({
//                     vehicle: vehicleId,
//                     startDate: { $gte: startDate, $lt: endDate },
//                     status: WellKnownStatus.ACTIVE,
//                 })
//                 .lean()
//                 .exec()
//         );
//     }

//     result.push(
//         await Trip.find({
//             startDate: { $gte: startDate, $lt: endDate },
//             status: {
//                 $in: [
//                     WellKnownTripStatus.PENDING,
//                     WellKnownTripStatus.START,
//                     WellKnownTripStatus.FINISHED,
//                 ],
//             },
//             vehicles: {
//                 $elemMatch: {
//                     vehicle: { $in: vehicleId },
//                 },
//             },
//         })
//     );

//     return result.length > 0;
// };

const validateVehicleForDateRange = async (
    startDate: Date,
    endDate: Date,
    vehicleId: string,
    internalTripId: string
) => {
    let result: any[] = [];

    // Check in internalTrip collection
    let internalTripFilter: any = {
        vehicle: vehicleId,
        $or: [
            { startDate: { $gte: startDate, $lt: endDate } },
            { endDate: { $gte: startDate, $lt: endDate } },
            { startDate: { $lte: startDate }, endDate: { $gte: endDate } },
        ],
        status: WellKnownStatus.ACTIVE,
    };
    if (internalTripId) {
        internalTripFilter['_id'] = { $ne: internalTripId };
    }

    const existingInternalTrip = await internalTrip
        .findOne(internalTripFilter)
        .lean()
        .exec();
    if (existingInternalTrip) result.push(existingInternalTrip);

    // Check in Trip collection
    const existingTrips = await Trip.find({
        $or: [
            { startDate: { $gte: startDate, $lt: endDate } },
            { endDate: { $gte: startDate, $lt: endDate } },
            { startDate: { $lte: startDate }, endDate: { $gte: endDate } },
        ],
        status: {
            $in: [
                WellKnownTripStatus.PENDING,
                WellKnownTripStatus.START,
                WellKnownTripStatus.FINISHED,
            ],
        },
        vehicles: {
            $elemMatch: {
                vehicle: { $in: [vehicleId] }, // Ensure vehicleId is inside an array
            },
        },
    })
        .lean()
        .exec();

    if (existingTrips.length > 0) result.push(...existingTrips);

    return result.length > 0;
};

export default {
    save,
    findByIdAndStatusIn,
    findAllByVehicleId,
    findAllByEndMonthAndStatusIn,
    validateVehicleForDateRange,
};
