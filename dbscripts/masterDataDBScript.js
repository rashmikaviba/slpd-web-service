// Drop collections if they already exist to ensure clean insertion
db.genders.drop();
db.identityTypes.drop();
db.companyInfo.drop();

// Insert master data for gender
db.gender.insertMany([
    {
        _id: 1,
        name: 'Male',
        status: 1,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
    },
    {
        _id: 2,
        name: 'Female',
        status: 1,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
    },
]);

// Insert master data for identity type
db.identityType.insertMany([
    {
        _id: 1,
        type: 'Passport',
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
    },
    {
        _id: 2,
        type: 'Driving License',
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
    },
    {
        _id: 3,
        type: 'National ID',
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
    },
]);

// Insert master data for company info
db.companyInfo.insertMany([
    {
        _id: 1,
        name: 'Sri Lanka Personal Drivers',
        address: 'Colombo 07',
        image: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
        workingYear: new Date().getFullYear(),
        workingMonth: new Date().getMonth() + 1,
        workingDate: new Date(Date().getFullYear(), Date().getMonth() + 1, 1),
        status: 1,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
    },
]);
