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
export default {
    save,
    getTripSummaryByIdAndStatusIn,
    findAllTripSummaryByTripIdAndStatusIn,
};
