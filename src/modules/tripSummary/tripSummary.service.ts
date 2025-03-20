import Trip from '../trip/trip.model';
import TripSummary from './tripSummary.model';

const save = async (tripSummary: any, session: any) => {
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
    return await TripSummary.find({
        tripId: tripId,
        status: { $in: status },
    });
};

const findTripByIdAndStatusIn = async (id: string, status: number[]) => {
    return Trip.findOne({ _id: id, status: { $in: status } })
        .populate('createdBy updatedBy startedBy endedBy')
        .populate({
            path: 'drivers.driver',
            model: 'User',
        })
        .populate({
            path: 'drivers.driverAssignedBy',
            model: 'User',
        })
        .populate({
            path: 'vehicles.vehicle',
            model: 'Vehicle',
        });
};
export default {
    save,
    getTripSummaryByIdAndStatusIn,
    findAllTripSummaryByTripIdAndStatusIn,
    findTripByIdAndStatusIn,
};
