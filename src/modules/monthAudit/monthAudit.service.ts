import MonthAudit from './monthAudit.model';

const save = async (monthAudi: any, session: any) => {
    if (session) {
        return await monthAudi.save({ session });
    } else {
        return await monthAudi.save();
    }
};

const generateBatchId = async () => {
    const count = await MonthAudit.countDocuments();

    return count + 1;
};

export default { save, generateBatchId };
