import constants from '../../constant';
import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';
import Leave from './leave.model';
import cacheUtil from '../../util/cache';

const checkUserAlreadyApplied = async (
    userId: string,
    fromDate: Date,
    toDate: Date
): Promise<Boolean> => {
    const overlappingLeaves = await Leave.find({
        appliedUser: userId,
        status: {
            $in: [WellKnownLeaveStatus.PENDING, WellKnownLeaveStatus.APPROVED],
        },
        $or: [
            { startDate: { $lte: toDate }, endDate: { $gte: fromDate } }, // Leave starts before the `toDate` and ends after the `fromDate`
            { startDate: { $gte: fromDate, $lte: toDate } }, // Leave starts within the date range
            { endDate: { $gte: fromDate, $lte: toDate } }, // Leave ends within the date range
        ],
    });

    return overlappingLeaves.length > 0;
};

const checkUserAlreadyAppliedForUpdate = async (
    userId: string,
    leaveId: string,
    fromDate: Date,
    toDate: Date
): Promise<Boolean> => {
    const overlappingLeaves = await Leave.find({
        appliedUser: userId,
        _id: { $ne: leaveId },
        status: {
            $in: [WellKnownLeaveStatus.PENDING, WellKnownLeaveStatus.APPROVED],
        },
        $or: [
            { startDate: { $lte: toDate }, endDate: { $gte: fromDate } }, // Leave starts before the `toDate` and ends after the `fromDate`
            { startDate: { $gte: fromDate, $lte: toDate } }, // Leave starts within the date range
            { endDate: { $gte: fromDate, $lte: toDate } }, // Leave ends within the date range
        ],
    });

    return overlappingLeaves.length > 0;
};

const save = async (leave: any, session: any) => {
    if (session) {
        return await leave.save({ session });
    } else {
        return await leave.save();
    }
};

const getTotalLeaveDaysFromYear = async (userId: string, year: number) => {
    const cacheKey = constants.CACHE.PREFIX.LEAVE + `totalLeaveDays-${userId}-${year}`;

    const cached = cacheUtil.getCache(cacheKey) as number;

    if (cached !== null && cached !== undefined) {
        return cached;
    }

    const totalLeaves = await Leave.find({
        appliedUser: userId,
        $and: [
            { startDate: { $gte: new Date(year, 0, 1) } },
            { endDate: { $lte: new Date(year, 11, 31) } },
        ],
        status: WellKnownLeaveStatus.APPROVED,
    })
        .select('dateCount')
        .lean();

    let totalLeaveCount = 0;
    totalLeaves.map((leave: any) => {
        totalLeaveCount += leave.dateCount;
    }) || 0;

    cacheUtil.setCache(cacheKey, totalLeaveCount, constants.CACHE.DURATION.THREE_MONTHS);

    return totalLeaveCount;
};

const findAllByUserIdYearAndStatus = async (
    userId: string,
    year: number,
    status: number[]
) => {
    if (userId) {
        return (await Leave.find({
            appliedUser: userId,
            $and: [
                { startDate: { $gte: new Date(year, 0, 1) } },
                { endDate: { $lte: new Date(year, 11, 31) } },
            ],
            status: { $in: status },
        })
            .sort({ status: 1, createdAt: -1 })
            .populate([
                {
                    path: 'appliedUser',
                    select: 'fullName leaveCount role',
                    populate: { path: 'role', select: 'id name' },
                },
                { path: 'approveBy', select: '_id fullName' },
                { path: 'rejectBy', select: '_id fullName' },
                { path: 'createdBy', select: '_id fullName' },
                { path: 'updatedBy', select: '_id fullName' },
            ])
            .lean()) as any[];
    } else {
        return (await Leave.find({
            $and: [
                { startDate: { $gte: new Date(year, 0, 1) } },
                { endDate: { $lte: new Date(year, 11, 31) } },
            ],
            status: { $in: status },
        })
            .sort({ status: 1, createdAt: -1 })
            .populate([
                {
                    path: 'appliedUser',
                    select: 'fullName leaveCount role',
                    populate: { path: 'role', select: 'id name' },
                },
                { path: 'approveBy', select: '_id fullName' },
                { path: 'rejectBy', select: '_id fullName' },
                { path: 'createdBy', select: '_id fullName' },
                { path: 'updatedBy', select: '_id fullName' },
            ])
            .lean()) as any[];
    }
};

const findByIdAndStatusIn = async (id: string, status: number[]) => {
    return await Leave.findOne({
        _id: id,
        status: { $in: status },
    }).populate('appliedUser approveBy rejectBy createdBy updatedBy');
};


const countByYearUserIdAndStatusIn = async (
    userId: string,
    year: number,
    status: number[]
) => {

    let match: any = {
        status: { $in: status },
        $and: [
            { startDate: { $gte: new Date(year, 0, 1) } },
            { endDate: { $lte: new Date(year, 11, 31) } },
        ],
    };

    if (userId) {
        match.appliedUser = userId;
    }

    let leaveCount = (await Leave.find(match).select('dateCount').lean()).reduce((acc, leave) => acc + leave.dateCount, 0);

    return leaveCount;
};


const monthYearFilter = (year: number, month: number, status: number[]) => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    return {
        status: { $in: status },
        startDate: {
            $gte: monthStart,
            $lte: monthEnd,
        },
    };
};

// Month end: only the ids and status are needed to flag the leaves and log them.
const findAllIdsByMonthYearAndStatusIn = async (
    year: number,
    month: number,
    status: number[]
) => {
    return (await Leave.find(monthYearFilter(year, month, status))
        .select('_id status')
        .lean()) as any[];
};

// Month end: flag many leaves in one write (same fields the per-document save set).
const markMonthEndDone = async (ids: any[], userId: string, batchId: number, session: any) => {
    if (ids.length === 0) return;
    await Leave.updateMany({ _id: { $in: ids } }, { $set: { isMonthEndDone: true, batchId, updatedBy: userId } }, { session });
};

const findAllLeavesByMonthYearAndStatusIn = async (
    year: number,
    month: number,
    status: number[]
) => {
    return (await Leave.find(monthYearFilter(year, month, status)).populate([
        {
            path: 'appliedUser',
            populate: { path: 'role' }, // Populates the role inside appliedUser
        },
        { path: 'approveBy' },
        { path: 'rejectBy' },
        { path: 'createdBy' },
        { path: 'updatedBy' },
    ])) as any[];
};


const clearTotalLeaveDaysCache = async (userId: string, year: number) => {
    const cacheKey = constants.CACHE.PREFIX.LEAVE + `totalLeaveDays-${userId}-${year}`;
    cacheUtil.deleteCache(cacheKey);
}

// Same numbers and cache entries as getTotalLeaveDaysFromYear, but one query for all cache misses.
const getTotalLeaveDaysForUsers = async (userIds: string[], year: number) => {
    const totals = new Map<string, number>();
    const missing: string[] = [];

    for (const userId of new Set(userIds.map((id) => id.toString()))) {
        const cached = cacheUtil.getCache(constants.CACHE.PREFIX.LEAVE + `totalLeaveDays-${userId}-${year}`) as number;

        if (cached !== null && cached !== undefined) {
            totals.set(userId, cached);
        } else {
            missing.push(userId);
        }
    }

    if (missing.length > 0) {
        const leaves = await Leave.find({
            appliedUser: { $in: missing },
            $and: [
                { startDate: { $gte: new Date(year, 0, 1) } },
                { endDate: { $lte: new Date(year, 11, 31) } },
            ],
            status: WellKnownLeaveStatus.APPROVED,
        })
            .select('appliedUser dateCount')
            .lean();

        for (const userId of missing) totals.set(userId, 0);
        for (const leave of leaves) {
            const userId = String(leave.appliedUser);
            totals.set(userId, (totals.get(userId) || 0) + leave.dateCount);
        }

        for (const userId of missing) {
            cacheUtil.setCache(
                constants.CACHE.PREFIX.LEAVE + `totalLeaveDays-${userId}-${year}`,
                totals.get(userId) as number,
                constants.CACHE.DURATION.THREE_MONTHS
            );
        }
    }

    return totals;
};

export default {
    getTotalLeaveDaysForUsers,
    checkUserAlreadyApplied,
    save,
    getTotalLeaveDaysFromYear,
    findAllByUserIdYearAndStatus,
    findByIdAndStatusIn,
    countByYearUserIdAndStatusIn,
    findAllLeavesByMonthYearAndStatusIn,
    findAllIdsByMonthYearAndStatusIn,
    markMonthEndDone,
    checkUserAlreadyAppliedForUpdate,
    clearTotalLeaveDaysCache
};
