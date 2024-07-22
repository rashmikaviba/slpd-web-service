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
    },

    auth: {
        base: '/auth',
        login: '/login',
        resetPassword: '/resetPassword',
        changePassword: '/changePassword',
    },
};

export default applicationRoutes;
