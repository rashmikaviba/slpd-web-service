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
        .populate({
            path: 'createdBy updatedBy startedBy endedBy',
            select: '_id fullName',
        })
        .populate({
            path: 'drivers.driver',
            model: 'User',
            match: { 'drivers.isActive': true },
            select: '_id fullName userName',
        })
        .populate({
            path: 'vehicles.vehicle',
            model: 'Vehicle',
            select: '_id registrationNumber licenseRenewalDate insuranceRenewalDate',
        })
        .sort({ startDate: 1 })
        .lean();
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
        .populate({
            path: 'createdBy updatedBy startedBy endedBy',
            select: '_id fullName',
        })
        .populate({
            path: 'drivers.driver',
            model: 'User',
            match: { 'drivers.isActive': true },
            select: '_id fullName userName',
        })
        .populate({
            path: 'vehicles.vehicle',
            model: 'Vehicle',
            match: { 'vehicles.isActive': true },
            select: '_id registrationNumber licenseRenewalDate insuranceRenewalDate',
        })
        .sort({ startDate: 1 })
        .lean();
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

const monthEndFilter = (endMonth: number, currYear: number, status: number[]) => {
    let endDate = new Date();
    endDate.setFullYear(currYear);
    endDate.setMonth(endMonth);
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    return {
        endDate: { $lt: endDate },
        status: { $in: status },
        isMonthEndDone: false,
    };
};

// Month end: only the ids and status are needed to flag the trips and log them.
const findAllIdsByEndMonthAndStatusIn = async (
    endMonth: number,
    currYear: number,
    status: number[]
) => {
    return (await Trip.find(monthEndFilter(endMonth, currYear, status))
        .select('_id status')
        .sort({ startDate: 1 })
        .lean()) as any[];
};

// Month end: flag many trips in one write (same fields the per-document save set).
const markMonthEndDone = async (ids: any[], userId: string, batchId: number, session: any) => {
    if (ids.length === 0) return;
    await Trip.updateMany({ _id: { $in: ids } }, { $set: { isMonthEndDone: true, batchId, updatedBy: userId } }, { session });
};

const findAllByEndMonthAndStatusIn = async (
    endMonth: number,
    currYear: number,
    status: number[]
) => {
    return Trip.find(monthEndFilter(endMonth, currYear, status))
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


const findAllByStatusInAndOnlyFromEndDate = async (
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
            { endDate: { $gte: sDate, $lte: eDate } },
        ],
        // isMonthEndDone: false,
    })
        .populate({
            path: 'createdBy updatedBy startedBy endedBy',
            select: '_id fullName',
        })
        .populate({
            path: 'drivers.driver',
            model: 'User',
            match: { 'drivers.isActive': true },
            select: '_id fullName userName',
        })
        .populate({
            path: 'vehicles.vehicle',
            model: 'Vehicle',
            select: '_id registrationNumber licenseRenewalDate insuranceRenewalDate',
        })
        .sort({ startDate: 1 })
        .lean();
};

export default {
    save,
    findByIdAndStatusIn,
    findAllByStatusIn,
    findAllByDriverIdAndStatusIn,
    findTripPlacesByTripIdAndStatusIn,
    findAllByEndMonthAndStatusIn,
    findAllIdsByEndMonthAndStatusIn,
    markMonthEndDone,
    isTripConfirmedNumberExists,
    findAllByStatusInAndOnlyFromEndDate
};
