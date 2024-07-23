// Define the current timestamp
const currentTimestamp = new Date();

// Drop collections if they already exist to ensure clean insertion
db.genders.drop();
db.companyInfo.drop();
db.companyWorkingInfos.drop();

// Insert master data for gender
db.genders.insertMany([
    {
        id: 1,
        name: 'Male',
        status: 1,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
    },
    {
        id: 2,
        name: 'Female',
        status: 1,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
    },
]);

const year = currentTimestamp.getFullYear();
const month = currentTimestamp.getMonth() + 1;
const workingDate = new Date(year, month, 1);
// Insert master data for company info
db.companyWorkingInfos.insertMany([
    {
        workingYear: year,
        workingMonth: month,
        workingDate: workingDate,
        status: 1,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
    },
]);
