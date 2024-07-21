import AuditLog from '../model/auditLog.model';

const save = async (auditLog: any, transaction: any) => {
    if (transaction) {
        return await AuditLog.create(auditLog, { session: transaction });
    } else {
        return await AuditLog.create(auditLog);
    }
};

const findAllByType = async (
    fromDate: Date,
    toDate: Date,
    auditType: number
) => {
    return await AuditLog.find({
        createdAt: {
            $gte: fromDate,
            $lte: toDate,
        },
        auditType,
    });
    ``;
};

export default {
    save,
    findAllByType,
};
