import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';
import Leave from './leave.model';

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

const save = async (leave: any, session: any) => {
    if (session) {
        return await leave.save({ session });
    } else {
        return await leave.save();
    }
};

// const getTotalLeaveDaysFromYear = async (userId: string, year: number) => {
//     const totalLeaves = await Leave.aggregate([
//         { $match: { appliedUser: userId } },
//         {
//             $match: {
//                 $or: [
//                     { startDate: { $gte: new Date(year, 0, 1) } },
//                     { endDate: { $lte: new Date(year, 11, 31) } },
//                 ],
//             },
//         },
//         { $group: { _id: null, totalLeaveCount: { $sum: '$dateCount' } } },
//     ]);

//     return totalLeaves.length ? totalLeaves[0].totalLeaveCount : 0;
// };

const getTotalLeaveDaysFromYear = async (userId: string, year: number) => {
    const totalLeaves = await Leave.find({
        appliedUser: userId,
        $or: [
            { startDate: { $gte: new Date(year, 0, 1) } },
            { endDate: { $lte: new Date(year, 11, 31) } },
        ],
        status: WellKnownLeaveStatus.APPROVED,
    });

    let totalLeaveCount = 0;
    totalLeaves.map((leave: any) => {
        totalLeaveCount += leave.dateCount;
    }) || 0;

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
            $or: [
                { startDate: { $gte: new Date(year, 0, 1) } },
                { endDate: { $lte: new Date(year, 11, 31) } },
            ],
            status: { $in: status },
        })
            .sort({ status: 1 })
            .populate(
                'appliedUser approveBy rejectBy createdBy updatedBy'
            )) as any[];
    } else {
        return (await Leave.find({
            $or: [
                { startDate: { $gte: new Date(year, 0, 1) } },
                { endDate: { $lte: new Date(year, 11, 31) } },
            ],
            status: { $in: status },
        })
            .sort({ status: 1 })
            .populate(
                'appliedUser approveBy rejectBy createdBy updatedBy'
            )) as any[];
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
    if (userId) {
        return (
            (await Leave.countDocuments({
                appliedUser: userId,
                status: { $in: status },
                $or: [
                    { startDate: { $gte: new Date(year, 0, 1) } },
                    { endDate: { $lte: new Date(year, 11, 31) } },
                ],
            })) || 0
        );
    } else {
        return (
            (await Leave.countDocuments({
                status: { $in: status },
                $or: [
                    { startDate: { $gte: new Date(year, 0, 1) } },
                    { endDate: { $lte: new Date(year, 11, 31) } },
                ],
            })) || 0
        );
    }
};

const countByMonthYearUserIdAndStatusIn = async (
    userId: string,
    year: number,
    month: number,
    status: number[]
) => {
    if (userId) {
        return (
            (await Leave.countDocuments({
                appliedUser: userId,
                status: { $in: status },
                $or: [
                    { startDate: { $gte: new Date(year, month, 1) } },
                    { endDate: { $lte: new Date(year, month, 31) } },
                ],
            })) || 0
        );
    } else {
        return (
            (await Leave.countDocuments({
                status: { $in: status },
                $or: [
                    { startDate: { $gte: new Date(year, month, 1) } },
                    { endDate: { $lte: new Date(year, month, 31) } },
                ],
            })) || 0
        );
    }
};

const findAllLeavesByMonthYearAndStatusIn = async (
    year: number,
    month: number,
    status: number[]
) => {
    return (await Leave.find({
        status: { $in: status },
        $or: [
            { startDate: { $gte: new Date(year, month, 1) } },
            { endDate: { $lte: new Date(year, month, 31) } },
        ],
    })) as any[];
};

export default {
    checkUserAlreadyApplied,
    save,
    getTotalLeaveDaysFromYear,
    findAllByUserIdYearAndStatus,
    findByIdAndStatusIn,
    countByYearUserIdAndStatusIn,
    countByMonthYearUserIdAndStatusIn,
    findAllLeavesByMonthYearAndStatusIn,
};
