import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
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

const findVehiclesBySheetCount = async (count: number) => {
    return await Vehicle.find({
        availableSeats: { $gte: count },
        status: WellKnownStatus.ACTIVE,
    });
};

export default {
    save,
    findByRegistrationNumAndStatusIn,
    findByRegNumAndStatusInAndIdNot,
    findByIdAndStatusIn,
    findAllAndStatusIn,
    findByGpsTrackerAndStatusIn,
    findByIdNotAndGpsTrackerAndStatusIn,
    findVehiclesBySheetCount,
};
