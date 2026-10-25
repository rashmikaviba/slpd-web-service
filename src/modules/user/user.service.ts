import constants from '../../constant';
import cacheUtil from '../../util/cache';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import Auth from '../auth/auth.model';
import InternalTrip from '../internalTrip/internalTrip.model';
import Trip from '../trip/trip.model';
import User from './user.model';

const Save = async (user: any, session: any) => {
    const prefixes = Object.values(constants.CACHE.PREFIX).join(",");
    cacheUtil.clearCacheByPrefixs(prefixes);

    if (session) {
        return await user.save({ session });
    } else {
        return await user.save({ session });
    }
};

const validateUserData = async (type: number, data: string): Promise<any[]> => {
    switch (type) {
        case 1:
            return await User.find({
                userName: data,
                status: WellKnownStatus.ACTIVE,
            }).exec();
        case 2:
            return await User.find({
                email: data,
                status: WellKnownStatus.ACTIVE,
            }).exec();
        case 3:
            return await User.find({
                nic: data,
                status: WellKnownStatus.ACTIVE,
            }).exec();
        default:
            return [];
    }
};

const validateUserDataForUpdate = async (
    type: number,
    data: string,
    id: string
) => {
    switch (type) {
        case 1:
            return await User.find({
                userName: data,
                _id: { $ne: id },
                status: WellKnownStatus.ACTIVE,
            }).exec();
        case 2:
            return await User.find({
                email: data,
                _id: { $ne: id },
                status: WellKnownStatus.ACTIVE,
            }).exec();
        case 3:
            return await User.find({
                nic: data,
                _id: { $ne: id },
                status: WellKnownStatus.ACTIVE,
            }).exec();
        default:
            return [];
    }
};

const findById = async (id: string) => {
    return await User.findOne({
        _id: id,
        status: WellKnownStatus.ACTIVE,
    });
};

const findByIdWithGenderRole = async (id: string) => {
    return await User.findOne({
        _id: id,
        status: WellKnownStatus.ACTIVE,
    }).populate([
        {
            path: 'gender',
            select: '_id name id',
        },
        {
            path: 'role',
            select: '_id name id',
        },
        {
            path: 'createdBy',
            select: '_id fullName',
        },
        {
            path: 'updatedBy',
            select: '_id fullName',
        },
    ]);
};

const findAllWithGenderRole = async () => {
    const cacheKey = constants.CACHE.PREFIX.USER + 'findAllWithGenderRole';
    const cached = cacheUtil.getCache(cacheKey) as any[];
    if (cached) return cached;

    let users: any[] = await User.find({
        status: WellKnownStatus.ACTIVE,
    })
        .populate([
            {
                path: 'gender',
                select: '_id name id',
            },
            {
                path: 'role',
                select: '_id name id',
            },
            {
                path: 'createdBy',
                select: '_id fullName',
            },
            {
                path: 'updatedBy',
                select: '_id fullName',
            },
        ])
        .sort({ createdAt: -1 });

    if (users.length > 0) {
        // blocked flags for all users in one query
        const auths: any[] = await Auth.find({
            user: { $in: users.map((user: any) => user._id) },
            status: WellKnownStatus.ACTIVE,
        })
            .select('user isBlocked')
            .lean();

        const authByUser = new Map<string, any>();
        for (const auth of auths) {
            const key = auth.user.toString();
            if (!authByUser.has(key)) authByUser.set(key, auth);
        }

        for (const element of users as any[]) {
            element.isBlock = authByUser.get(element._id.toString()).isBlocked;
        }
    }

    if (users.length > 0) {
        cacheUtil.setCache(cacheKey, users, constants.CACHE.DURATION.ONE_WEEK);
    }

    return users;
};

const findAllByRoleId = async (roleId: string) => {
    const cacheKey = constants.CACHE.PREFIX.USER + roleId;
    const cached = cacheUtil.getCache(cacheKey) as any[];
    if (cached.length > 0) return cached;

    let users: any[] = await Auth.find({
        role: roleId,
        status: WellKnownStatus.ACTIVE,
        isBlocked: false,
    }).populate('user');

    users = users.map((user: any) => {
        return user.user;
    });

    if (users.length > 0) {
        cacheUtil.setCache(cacheKey, users, constants.CACHE.DURATION.ONE_WEEK);
    }

    return users || [];
};

const findDriversByNotInInternalTripsAndNormalTrips = async (
    roleId: string,
    startDate: any,
    endDate: any,
    tripId: string
) => {
    let internalTripDrivers: string[] = [];
    let normalTripDrivers: string[] = [];
    if (startDate && endDate) {
        [internalTripDrivers, normalTripDrivers] = await Promise.all([
            InternalTrip.find({
                $or: [
                    { startDate: { $gte: startDate, $lt: endDate } },
                    { endDate: { $gte: startDate, $lt: endDate } },
                    { startDate: { $lte: startDate }, endDate: { $gte: endDate } },
                ],
                status: WellKnownStatus.ACTIVE,
            })
                .select('driver')
                .lean()
                .then((trips) => trips.map((trip) => trip.driver.toString())),

            Trip.find({
                $or: [
                    { startDate: { $gte: startDate, $lt: endDate } },
                    { endDate: { $gte: startDate, $lt: endDate } },
                    { startDate: { $lte: startDate }, endDate: { $gte: endDate } },
                ],
                _id: { $ne: tripId },
                status: {
                    $in: [WellKnownTripStatus.PENDING, WellKnownTripStatus.START],
                },
            })
                .select('drivers.driver drivers.isActive')
                .lean()
                .then((trips) =>
                    trips.flatMap((trip) =>
                        trip.drivers
                            .filter((driverObj: any) => driverObj.isActive)
                            .map((driverObj: any) => driverObj?.driver.toString())
                    )
                ),
        ]);
    }

    const excludedUsers = [...internalTripDrivers, ...normalTripDrivers];

    let users: any = await Auth.find({
        role: roleId,
        status: WellKnownStatus.ACTIVE,
        isBlocked: false,
        user: { $nin: excludedUsers },
    }).populate('user');

    users = users.map((user: any) => {
        return user.user;
    });

    return users || [];
};

// Active users (with role) for many ids in one query, keyed by id.
const findAllByIdsWithRole = async (ids: string[]) => {
    const byId = new Map<string, any>();
    if (ids.length === 0) return byId;

    const users: any[] = await User.find({
        _id: { $in: ids },
        status: WellKnownStatus.ACTIVE,
    }).populate({
        path: 'role',
        select: '_id name id',
    });

    for (const user of users) byId.set(user._id.toString(), user);

    return byId;
};

export default {
    findAllByIdsWithRole,
    Save,
    validateUserData,
    validateUserDataForUpdate,
    findById,
    findByIdWithGenderRole,
    findAllWithGenderRole,
    findAllByRoleId,
    findDriversByNotInInternalTripsAndNormalTrips,
};
