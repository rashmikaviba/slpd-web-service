const constants = {
    API: {
        PREFIX: '/api/v1',
    },

    USER: {
        ROLES: {
            SUPERADMIN: 1,
            ADMIN: 2,
            DRIVER: 3,
            FINANCEOFFICER: 4,
            TRIPMANAGER: 5,
            DRIVERASSISTANT: 6,
            TRIPASSISTANT: 7,
        },
    },

    NUMBERPREFIX: {
        GRN: 'GRN-',
    },

    CACHE: {
        PREFIX: {
            GENDER: 'gender-',
            ROLE: 'role-',
            USER: 'user-',
            VEHICLE: 'vehicle-',
            TRIP: 'trip-',
            COMPANY_WORKING_INFO: 'companyWorkingInfo',
            GARAGE: "garage-",
            AUTH: "auth-",
            PRODUCT: "product-",
            GRN: "grn-",
            VEHICLE_MAINTENANCE: "vehicleMaintenance-",
            LEAVE: "leave-",
            MONTHLY_EXPENSES: "monthlyExpenses-",
            EXPENSES_REQUEST: "expenseRequest-",
            EXPENSES: "expenses-",
            INTERNAL_TRIP: "internalTrip-",
            TRIP_SUMMARY: "tripSummary-",
            POS: "pos-"
        },
        DURATION: {
            ONE_DAY: 60 * 60 * 24,
            ONE_WEEK: 60 * 60 * 24 * 7,
            ONE_MONTH: 60 * 60 * 24 * 30,
        }
    }
};

export default constants;
