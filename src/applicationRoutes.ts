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
        getDriversForTrip: '/getDriversForTrip',
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
        updateHotelActivityPayment: '/updateHotelActivityPayment/:id',
        undoTripStatus: '/:id/undoStatus/:status',
        getTripForPrint: '/tripForPrint/:id',
        getTripHotelsAndActivities: '/hotelsAndActivities/:id',

        // checklist routes
        saveCheckList: '/checkList/:id',
        getCheckList: '/checkList/:id',

        // places routes
        getPlacesByTrip: '/places/:id',
        markAsReached: '/:tripId/markAsReached/:placeId',

        // summary report
        getDestinationSummary: '/destinationSummary/:id',
    },

    tripSummary: {
        base: '/tripSummary',
        save: '/',
        getAllByTrip: '/trip/:tripId',
        getById: '/:id',
        update: '/:id',
        deleteById: '/:id',
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

    expenseRequest: {
        base: '/expenseRequest',
        save: '/',
        approveExpense: '/approve/:id',
        rejectExpense: '/reject/:id',
        getExpenseRequestById: '/:id',
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
    },

    internalTrip: {
        base: '/internalTrip',
        save: '/',
        getByVehicle: '/getByVehicle/:id',
        getById: '/:id',
        update: '/:id',
        deleteById: '/:id',
    },
};

export default applicationRoutes;
