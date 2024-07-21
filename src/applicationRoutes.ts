import constants from './constant';

const applicationRoutes = {
    common: {
        base: '/common',
        getAllGenders: '/gender',
    },

    store: {
        base: '/store',
        uploadFile: '/upload',
        uploadMultipleFiles: '/uploadMultiple',
    },
};

export default applicationRoutes;
