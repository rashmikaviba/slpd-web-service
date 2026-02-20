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

const findAll = async () => {
    return await User.find({
        status: WellKnownStatus.ACTIVE,
    });
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
        for (let index = 0; index < users.length; index++) {
            let element: any = users[index];
            let auth: any = await Auth.findOne({
                user: element._id,
                status: WellKnownStatus.ACTIVE,
            });

            element.isBlock = auth.isBlocked;
        }
    }

    if (users.length > 0) {
        cacheUtil.setCache(cacheKey, users, constants.CACHE.DURATION.ONE_WEEK);
    }

    return users;
};

const findAllByRoleId = async (roleId: string) => {
    const cacheKey = constants.CACHE.PREFIX.USER + roleId;
    const cached = await cacheUtil.getCache(cacheKey) as any[];
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
        internalTripDrivers = await InternalTrip.find({
            $or: [
                { startDate: { $gte: startDate, $lt: endDate } },
                { endDate: { $gte: startDate, $lt: endDate } },
                { startDate: { $lte: startDate }, endDate: { $gte: endDate } },
            ],
            status: WellKnownStatus.ACTIVE,
        })
            .select('driver')
            .lean()
            .then((trips) => trips.map((trip) => trip.driver.toString()));

        normalTripDrivers = await Trip.find({
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
            );
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

export default {
    Save,
    validateUserData,
    validateUserDataForUpdate,
    findById,
    findByIdWithGenderRole,
    findAll,
    findAllWithGenderRole,
    findAllByRoleId,
    findDriversByNotInInternalTripsAndNormalTrips,
};
