import { start } from 'repl';
import Trip from './trip.model';
import { isValidObjectId } from 'mongoose';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';

const save = async (trip: any, session: any) => {
    if (session) {
        return await trip.save({ session });
    } else {
        return await trip.save();
    }
};

const findByIdAndStatusIn = async (id: string, status: number[]) => {
    return Trip.findOne({ _id: id, status: { $in: status } });
    // .populate('createdBy updatedBy startedBy endedBy')
    // .populate({
    //     path: 'drivers.driver',
    //     model: 'User',
    // })
    // .populate({
    //     path: 'drivers.driverAssignedBy',
    //     model: 'User',
    // });
};

const findAllByStatusIn = async (
    status: number[],
    startDate: string,
    endDate: string
) => {
    let sDate = new Date(startDate);
    let eDate = new Date(endDate);

    sDate.setHours(0, 0, 0, 0); // Set time to midnight
    eDate.setHours(23, 59, 59, 999); // Set time to 23:59:59.999
    return Trip.find({
        status: { $in: status },
        $or: [
            { startDate: { $gte: sDate, $lte: eDate } },
            { endDate: { $gte: sDate, $lte: eDate } },
        ],
        // isMonthEndDone: false,
    })
        .populate('createdBy updatedBy startedBy endedBy')
        .populate({
            path: 'drivers.driver',
            model: 'User',
            match: { 'drivers.isActive': true },
        })
        .populate({
            path: 'vehicles.vehicle',
            model: 'Vehicle',
        })
        .sort({ startDate: 1 });
};

const findAllByDriverIdAndStatusIn = async (
    driverId: string,
    status: number[]
) => {
    return Trip.find({
        'drivers.driver': driverId,
        status: { $in: status },
        isMonthEndDone: false,
    })
        .populate('createdBy updatedBy startedBy endedBy')
        .populate({
            path: 'drivers.driver',
            model: 'User',
            match: { 'drivers.isActive': true },
        })
        .populate({
            path: 'vehicles.vehicle',
            model: 'Vehicle',
            match: { 'vehicles.isActive': true },
        })
        .sort({ startDate: 1 });
};

const generateTripId = async () => {
    //find max tripConfirmedNumber from trip collection and increment by 1
    const maxTripConfirmedNumber = await Trip.findOne()
        .sort('-tripConfirmedNumber')
        .limit(1);

    if (maxTripConfirmedNumber) {
        return maxTripConfirmedNumber.tripConfirmedNumber + 1;
    } else {
        return 1;
    }
};

const findTripPlacesByTripIdAndStatusIn = async (
    tripId: string,
    status: number[]
) => {
    return Trip.findOne({ _id: tripId, status: { $in: status } }).populate({
        path: 'places.reachedBy',
        model: 'User',
        match: { 'places.isReached': true },
        select: '_id fullName userName',
    });
};

// const findAllByStatusIn = async (status: number[]) => {
//     return Trip.find({ status: { $in: status } })
// .populate('createdBy updatedBy startedBy endedBy')
// .populate({
//     path: 'drivers.driver',
//     model: 'User',
//     match: { 'drivers.isActive': true },
// })
// .populate({
//     path: 'vehicles.vehicle',
//     model: 'Vehicle',
// })
// .sort({ startDate: 1 });
// };

const findAllByEndMonthAndStatusIn = async (
    endMonth: number,
    currYear: number,
    status: number[]
) => {
    let endDate = new Date();
    endDate.setFullYear(currYear);
    endDate.setMonth(endMonth);
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    return Trip.find({
        endDate: { $lt: endDate },
        status: { $in: status },
        isMonthEndDone: false,
    })
        .populate('createdBy updatedBy startedBy endedBy')
        .populate({
            path: 'drivers.driver',
            model: 'User',
            match: { 'drivers.isActive': true },
        })
        .populate({
            path: 'vehicles.vehicle',
            model: 'Vehicle',
        })
        .sort({ startDate: 1 });
};

const isTripConfirmedNumberExists = (
    tripConfirmedNumber: string,
    tripId: string
) => {
    const query: any = {
        tripConfirmedNumber,
        status: { $ne: WellKnownTripStatus.CANCELED },
    };

    if (tripId && isValidObjectId(tripId)) {
        query._id = { $ne: tripId };
    }

    return Trip.findOne(query);
};

export default {
    save,
    findByIdAndStatusIn,
    generateTripId,
    findAllByStatusIn,
    findAllByDriverIdAndStatusIn,
    findTripPlacesByTripIdAndStatusIn,
    findAllByEndMonthAndStatusIn,
    isTripConfirmedNumberExists,
};
