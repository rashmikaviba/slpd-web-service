import constants from '../../constant';
import cache from '../../util/cache';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import Expenses from './expenses.model';

const save = async (expenses: any, session: any) => {
    let prefix = constants.CACHE.PREFIX.EXPENSES;
    cache.clearCacheByPrefixs(prefix);
    if (session) {
        return await expenses.save({ session });
    } else {
        return await expenses.save();
    }
};

const findAndHardDeleteByTripId = async (tripId: string, session: any) => {
    let prefix = constants.CACHE.PREFIX.EXPENSES;
    cache.clearCacheByPrefixs(prefix);
    if (session) {
        return await Expenses.findOneAndDelete({ tripId: tripId }, { session });
    } else {
        return await Expenses.findOneAndDelete({ tripId: tripId });
    }
};

const findByTripIdAndStatusIn = async (tripId: string, status: number[]) => {
    return Expenses.findOne({
        tripId: tripId,
        status: { $in: status },
    }).populate('tripId');
};


const findByTripIdsInAndStatusIn = async (tripIds: string[], status: number[]) => {
    const cacheKey = constants.CACHE.PREFIX.EXPENSES + JSON.stringify(tripIds) + JSON.stringify(status);
    const cached = cache.getCache(cacheKey) as any[];
    if (cached) return cached;


    const data: any[] = await Expenses.find({
        tripId: { $in: tripIds },
        status: { $in: status },
    })

    if (data) {
        cache.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
}

// One query for many trips. Keeps the first match per trip, like findOne in findByTripIdAndStatusIn.
const findAllByTripIdsAndStatusIn = async (tripIds: string[], status: number[]) => {
    const byTripId = new Map<string, any>();
    if (tripIds.length === 0) return byTripId;

    const expenses: any[] = await Expenses.find({
        tripId: { $in: tripIds },
        status: { $in: status },
    }).populate({ path: 'tripId', select: '_id estimatedExpense' });

    for (const expense of expenses) {
        const key = String(expense.tripId?._id ?? expense.tripId);
        if (!byTripId.has(key)) byTripId.set(key, expense);
    }

    return byTripId;
};

// Month end: ids of the active expense header of each trip (first match per trip, like findOne).
const findAllIdsByTripIdsAndStatusIn = async (tripIds: string[], status: number[]) => {
    if (tripIds.length === 0) return [];

    const expenses: any[] = await Expenses.find({
        tripId: { $in: tripIds },
        status: { $in: status },
    })
        .select('_id tripId')
        .lean();

    const first = new Map<string, any>();
    for (const expense of expenses) {
        const key = String(expense.tripId);
        if (!first.has(key)) first.set(key, expense._id);
    }

    return Array.from(first.values());
};

// Month end: flag many expense headers in one write (same fields the per-document save set).
const markMonthEndDone = async (ids: any[], userId: string, batchId: number, session: any) => {
    if (ids.length === 0) return;
    cache.clearCacheByPrefixs(constants.CACHE.PREFIX.EXPENSES);
    await Expenses.updateMany({ _id: { $in: ids } }, { $set: { isMonthEndDone: true, batchId, updatedBy: userId } }, { session });
};

// Sets trip.isDriverSalaryDone: true only for started/finished trips whose active expense
// header has a salary row for every assigned driver.
const applyDriverSalaryDone = async (trips: any[]) => {
    const tripIds = trips
        .filter(
            (trip: any) =>
                trip.status === WellKnownTripStatus.START ||
                trip.status === WellKnownTripStatus.FINISHED
        )
        .map((trip: any) => trip._id.toString());

    const paidDriverIdsByTrip = new Map<string, Set<string>>();
    if (tripIds.length > 0) {
        const expenses: any[] = await Expenses.find({
            tripId: { $in: tripIds },
            status: { $in: [WellKnownStatus.ACTIVE] },
        })
            .select('tripId driverSalaries.driver')
            .lean();

        for (const expense of expenses) {
            const key = expense.tripId.toString();
            if (paidDriverIdsByTrip.has(key)) continue;
            paidDriverIdsByTrip.set(
                key,
                new Set((expense.driverSalaries || []).map((s: any) => s.driver?.toString()))
            );
        }
    }

    for (const trip of trips) {
        trip.isDriverSalaryDone = false;
        const paidDriverIds = paidDriverIdsByTrip.get(trip._id.toString());
        if (paidDriverIds && trip.drivers?.length > 0) {
            trip.isDriverSalaryDone = trip.drivers.every((d: any) =>
                paidDriverIds.has(d?.driver?._id?.toString())
            );
        }
    }
};

export default {
    findAllByTripIdsAndStatusIn,
    findAllIdsByTripIdsAndStatusIn,
    markMonthEndDone,
    applyDriverSalaryDone,
    save,
    findAndHardDeleteByTripId,
    findByTripIdAndStatusIn,
    findByTripIdsInAndStatusIn
};
