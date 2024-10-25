import { start } from 'repl';
import Trip from './trip.model';

const save = async (trip: any, session: any) => {
    if (session) {
        return await trip.save({ session });
    } else {
        return await trip.save();
    }
};

const findByIdAndStatusIn = async (id: string, status: number[]) => {
    return Trip.findOne({ _id: id, status: { $in: status } });
    // .populate('createdBy updatedBy startedBy endedBy')
    // .populate({
    //     path: 'drivers.driver',
    //     model: 'User',
    // })
    // .populate({
    //     path: 'drivers.driverAssignedBy',
    //     model: 'User',
    // });
};

const findAllByStatusIn = async (status: number[]) => {
    return Trip.find({ status: { $in: status } })
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

const findAllByDriverIdAndStatusIn = async (
    driverId: string,
    status: number[]
) => {
    return Trip.find({ 'drivers.driver': driverId, status: { $in: status } })
        .populate('createdBy updatedBy startedBy endedBy')
        .populate({
            path: 'drivers.driver',
            model: 'User',
            match: { 'drivers.isActive': true },
        })
        .populate({
            path: 'vehicles.vehicle',
            model: 'Vehicle',
            match: { 'vehicles.isActive': true },
        })
        .sort({ startDate: 1 });
};

const generateTripId = async () => {
    //find max tripConfirmedNumber from trip collection and increment by 1
    const maxTripConfirmedNumber = await Trip.findOne()
        .sort('-tripConfirmedNumber')
        .limit(1);

    if (maxTripConfirmedNumber) {
        return maxTripConfirmedNumber.tripConfirmedNumber + 1;
    } else {
        return 1;
    }
};

const findTripPlacesByTripIdAndStatusIn = async (
    tripId: string,
    status: number[]
) => {
    return Trip.findOne({ _id: tripId, status: { $in: status } }).populate({
        path: 'places.reachedBy',
        model: 'User',
        match: { 'places.isReached': true },
    });
};

export default {
    save,
    findByIdAndStatusIn,
    generateTripId,
    findAllByStatusIn,
    findAllByDriverIdAndStatusIn,
    findTripPlacesByTripIdAndStatusIn,
};
