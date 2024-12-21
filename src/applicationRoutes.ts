import constants from './constant';

const applicationRoutes = {
    common: {
        base: '/common',
        getAllGenders: '/gender',
        getAllRoles: '/role',
        getCommonData: '/data',
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
        getUsersByRole: '/userByRole/:id',
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
        getTripForWorkingMonth: '/pendingTrip',
    },

    vehicle: {
        base: '/vehicle',
        save: '/',
        getAll: '/',
        getById: '/:id',
        update: '/:id',
        deleteById: '/:id',
        activeInactiveVehicles: '/activeInactive/:id',
        getByPassengersCount: '/passengerCount/:count',
    },

    trip: {
        base: '/trip',
        saveTrip: '/',
        getAllTrips: '/',
        getTripById: '/:id',
        update: '/:id',
        deleteById: '/:id',
        assignDriver: '/assignDriver/:id',
        changeTripStatus: '/:id/status/:status',
        undoTripStatus: '/:id/undoStatus/:status',
        getTripForPrint: '/tripForPrint/:id',

        // checklist routes
        saveCheckList: '/checkList/:id',
        getCheckList: '/checkList/:id',

        // places routes
        getPlacesByTrip: '/places/:id',
        markAsReached: '/:tripId/markAsReached/:placeId',
    },

    expenses: {
        base: '/expense',
        save: '/:tripId',
        update: '/:tripId/:expenseId',
        deleteById: '/:tripId/:expenseId',
        getAllExpensesByTrip: '/:tripId',
        getExpensesById: '/:tripId/:expenseId',
        saveDriverSalary: '/saveSalary/:tripId',
    },

    expensesRequest: {
        base: '/expenseRequest',
        save: '/',
        approveExpense: '/approve/:id',
        rejectExpense: '/reject/:id',
        getExpenseExtensionById: '/:id',
    },

    notification: {
        base: '/notification',
        getAllNotifications: '/',
    },

    report: {
        base: '/report',
        monthlyTripReport: '/monthlyTripReport',
        monthlyExpensesReport: '/monthlyExpensesReport',
        monthlyDriverSalary: '/monthlyDriverSalary',
        monthlyIncomeReport: '/monthlyIncomeReport',
    }
};

export default applicationRoutes;
