import constants from '../../constant';
import cache from '../../util/cache';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import Trip from '../trip/trip.model';
import internalTrip from './internalTrip.model';

const save = async (body: any, session: any) => {
    const prifix = constants.CACHE.PREFIX.INTERNAL_TRIP;
    cache.clearCacheByPrefixs(prifix);

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
    const cacheKey = constants.CACHE.PREFIX.INTERNAL_TRIP + vehicleId;
    const cached = await cache.getCache(cacheKey) as any[];
    if (cached) return cached;

    const data: any[] = await internalTrip
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

    if (data) {
        cache.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

const findAllByEndMonthAndStatusIn = async (
    endMonth: number,
    currYear: number,
    status: number[]
) => {
    const cacheKey = constants.CACHE.PREFIX.INTERNAL_TRIP + endMonth + currYear + JSON.stringify(status);
    const cached = await cache.getCache(cacheKey) as any[];
    if (cached) return cached;

    let endDate = new Date();
    endDate.setFullYear(currYear);
    endDate.setMonth(endMonth);
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    let data: any[] = await internalTrip.find({
        createdAt: { $lt: endDate },
        status: { $in: status },
        isMonthEndDone: false,
    });

    if (data) {
        cache.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

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
