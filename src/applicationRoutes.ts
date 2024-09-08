import constants from './constant';

const applicationRoutes = {
    common: {
        base: '/common',
        getAllGenders: '/gender',
        getAllRoles: '/role',
    },

    store: {
        base: '/store',
        uploadFile: '/upload',
        uploadMultipleFiles: '/uploadMultiple',
    },

    user: {
        base: '/user',
        save: '/',
        getAll: '/',
        getById: '/:id',
        update: '/:id',
        deleteById: '/:id',
        blockUser: '/block/:id',
        unblockUser: '/unblock/:id',
        validateUser: '/validateUser',
    },

    auth: {
        base: '/auth',
        login: '/login',
        resetPassword: '/resetPassword/:id',
        changePassword: '/changePassword',
        refreshAuth: '/refreshAuth',
    },

    leave: {
        base: '/leave',
        getAllLeaves: '/', // get all leaves for super admin
        getLeaveById: '/:id', // get leave by id
        applyLeave: '/apply', // apply leave for user
        getAllUserLeave: '/user', // get all leaves for user
        approveLeave: '/approve/:id', // approve leave by id for super admin
        cancelLeave: '/cancel/:id', // cancel leave by id
        rejectLeave: '/reject/:id', // reject leave by id for super admin
        getLeaveCount: '/leaveCount', // get leave count for admin
        updateLeave: '/update/:id',
        getAvailableLeaves: '/eligibleLeaves',
    },

    monthAudit: {
        base: '/monthAudit',
        getPendingLeaves: '/pendingLeaves',
        createNewMonth: '/createNewMonth',
        getWorkingInfo: '/workingInfo',
    },
};

export default applicationRoutes;
