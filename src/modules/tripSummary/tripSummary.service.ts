import constants from '../../constant';
import cache from '../../util/cache';
import Trip from '../trip/trip.model';
import TripSummary from './tripSummary.model';

const save = async (tripSummary: any, session: any) => {
    const prifix = constants.CACHE.PREFIX.TRIP_SUMMARY;
    cache.clearCacheByPrefixs(prifix);
    if (session) {
        return await tripSummary.save({ session });
    } else {
        return await tripSummary.save();
    }
};

const getTripSummaryByIdAndStatusIn = async (id: any, status: any) => {
    return await TripSummary.findOne({
        _id: id,
        status: { $in: status },
    }).populate('tripId');
};

const findAllTripSummaryByTripIdAndStatusIn = async (
    tripId: any,
    status: any
) => {
    const cacheKey = constants.CACHE.PREFIX.TRIP_SUMMARY + tripId + JSON.stringify(status);
    const cached = cache.getCache(cacheKey) as any[];
    if (cached) return cached;

    const data: any[] = await TripSummary.find({
        tripId: tripId,
        status: { $in: status },
    }).lean();

    if (data) {
        cache.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
};

const findTripByIdAndStatusIn = async (id: string, status: number[]) => {
    return Trip.findOne({ _id: id, status: { $in: status } })
        .populate({
            path: 'createdBy updatedBy startedBy endedBy',
            select: '_id fullName',
        })
        .populate({
            path: 'drivers.driver',
            model: 'User',
            select: '_id fullName userName',
        })
        .populate({
            path: 'drivers.driverAssignedBy',
            model: 'User',
            select: '_id fullName',
        })
        .populate({
            path: 'vehicles.vehicle',
            model: 'Vehicle',
            select: '_id registrationNumber licenseRenewalDate insuranceRenewalDate',
        })
        .lean();
};
export default {
    save,
    getTripSummaryByIdAndStatusIn,
    findAllTripSummaryByTripIdAndStatusIn,
    findTripByIdAndStatusIn,
};
