import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import InternalTrip from '../internalTrip/internalTrip.model';
import Trip from '../trip/trip.model';
import Vehicle from './vehicle.model';

const save = async (vehicle: any, session: any) => {
    if (session) {
        return await vehicle.save({ session });
    } else {
        return await vehicle.save();
    }
};

const findByRegistrationNumAndStatusIn = async (
    registrationNumber: string,
    status: number[]
) => {
    return await Vehicle.findOne({
        registrationNumber,
        status: { $in: status },
    });
};

const findByRegNumAndStatusInAndIdNot = async (
    id: string,
    registrationNumber: string,
    status: number[]
) => {
    return await Vehicle.findOne({
        _id: { $ne: id },
        status: { $in: status },
        registrationNumber,
    });
};

const findByIdAndStatusIn = async (id: string, status: number[]) => {
    return Vehicle.findOne({ _id: id, status: { $in: status } }).populate(
        'createdBy updatedBy'
    );
};

const findAllAndStatusIn = async (status: number[]) => {
    return Vehicle.find({ status: { $in: status } })
        .populate('createdBy updatedBy')
        .sort({ createdAt: -1 });
};

const findByGpsTrackerAndStatusIn = async (
    gpsTracker: string,
    status: number[]
) => {
    return await Vehicle.findOne({ gpsTracker, status: { $in: status } });
};

const findByIdNotAndGpsTrackerAndStatusIn = async (
    id: string,
    gpsTracker: string,
    status: number[]
) => {
    return await Vehicle.findOne({
        _id: { $ne: id },
        gpsTracker,
        status: { $in: status },
    });
};

const findVehiclesBySheetCountAndNotInInternalTripsAndNormalTrips = async (
    count: number,
    startDate: any,
    endDate: any,
    tripId: string
) => {
    let internalTripVehicles: string[] = [];
    let normalTripVehicles: string[] = [];
    if (startDate && endDate) {
        internalTripVehicles = await InternalTrip.find({
            $or: [
                { startDate: { $gte: startDate, $lt: endDate } },
                { endDate: { $gte: startDate, $lt: endDate } },
                { startDate: { $lte: startDate }, endDate: { $gte: endDate } },
            ],
            status: WellKnownStatus.ACTIVE,
        })
            .select('vehicle')
            .lean()
            .then((trips) => trips.map((trip) => trip.vehicle.toString()));

        normalTripVehicles = await Trip.find({
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
            .select('vehicles.vehicle vehicles.isActive')
            .lean()
            .then((trips) =>
                trips.flatMap((trip) =>
                    trip.vehicles
                        .filter((vehicleObj: any) => vehicleObj.isActive)
                        .map((vehicleObj: any) =>
                            vehicleObj?.vehicle.toString()
                        )
                )
            );
    }

    let excludedVehicles = [...internalTripVehicles, ...normalTripVehicles];
    return await Vehicle.find({
        availableSeats: { $gte: count },
        status: WellKnownStatus.ACTIVE,
        _id: { $nin: excludedVehicles },
    }).lean();
};

export default {
    save,
    findByRegistrationNumAndStatusIn,
    findByRegNumAndStatusInAndIdNot,
    findByIdAndStatusIn,
    findAllAndStatusIn,
    findByGpsTrackerAndStatusIn,
    findByIdNotAndGpsTrackerAndStatusIn,
    findVehiclesBySheetCountAndNotInInternalTripsAndNormalTrips,
};
