import vehiclemaintenanceModel from "./vehicleMaintenance.model";

const save = async (vehicleMaintain: any, session: any) => {
    if (session) {
        return await vehicleMaintain.save({ session });
    } else {
        return await vehicleMaintain.save();
    }
};

const findByIdAndStatusIn = async (id: string, statuses: Number[]) => {
    return await vehiclemaintenanceModel.findOne({ _id: id, status: { $in: statuses } });
}

const findByIdAndStatusInWithData = async (id: string, statuses: Number[]) => {
    return await vehiclemaintenanceModel.findOne({ _id: id, status: { $in: statuses } }).populate('vehicle garage createdBy updatedBy');
}

const findAllByMaintenanceDateAndStatusIn = async (
    statuses: Number[],
    startDate: string,
    endDate: string
) => {
    let sDate = new Date(startDate);
    let eDate = new Date(endDate);

    sDate.setHours(0, 0, 0, 0); // Set time to midnight
    eDate.setHours(23, 59, 59, 999); // Set time to 23:59:59.999
    return await vehiclemaintenanceModel.find({
        status: { $in: statuses },
        maintenanceDate: { $gte: sDate, $lte: eDate },
    })
        .populate('vehicle garage createdBy updatedBy')
        .sort({ maintenanceDate: 1 });
};

export default {
    save,
    findByIdAndStatusIn,
    findAllByMaintenanceDateAndStatusIn,
    findByIdAndStatusInWithData
}