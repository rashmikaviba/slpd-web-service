// Define the current timestamp
const currentTimestamp = new Date();

// Drop collections if they already exist to ensure clean insertion
db.roles.drop();
// db.modules.drop();

// Insert master data for roles
db.roles.insertMany([
    {
        _id: 1,
        name: 'Super Admin',
        status: 1,
        modules: [],
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
    },
    {
        _id: 2,
        name: 'Admin',
        status: 1,
        modules: [],
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
    },
    {
        _id: 3,
        name: 'Driver',
        status: 1,
        modules: [],
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
    },
]);

// Insert master data for privileges
// db.modules.insertMany([
//     // Super Admin module
//     {
//         _id: 1,
//         name: 'Super Admin User Management',
//         status: 1,
//         createdAt: currentTimestamp,
//         updatedAt: currentTimestamp,
//     },
//     {
//         _id: 2,
//         name: 'Super Admin Leave Management',
//         status: 1,
//         createdAt: currentTimestamp,
//         updatedAt: currentTimestamp,
//     },
//     {
//         _id: 3,
//         name: 'Super Admin Month Audit',
//         status: 1,
//         createdAt: currentTimestamp,
//         updatedAt: currentTimestamp,
//     },
//     {
//         _id: 4,
//         name: 'Super Admin Report',
//         status: 1,
//         createdAt: currentTimestamp,
//         updatedAt: currentTimestamp,
//     },

//     // Admin module
//     {
//         _id: 5,
//         name: 'Admin Leave Management',
//         status: 1,
//         createdAt: currentTimestamp,
//         updatedAt: currentTimestamp,
//     },

//     // Driver module
//     {
//         _id: 6,
//         name: 'Driver Leave Management',
//         status: 1,
//         createdAt: currentTimestamp,
//         updatedAt: currentTimestamp,
//     },
//     {
//         _id: 7,
//         name: 'Driver Emergency Management',
//         status: 1,
//         createdAt: currentTimestamp,
//         updatedAt: currentTimestamp,
//     },
// ]);
