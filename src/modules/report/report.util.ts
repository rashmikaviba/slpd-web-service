import { DriverSalaryReportResponseDto } from './dto/driverSalaryReportResponseDto';
import ExpensesReportResponseDto from './dto/expensesReportResponseDto';

const expensesModelToExpensesReportResponseDto = (
    expense: any
): ExpensesReportResponseDto[] => {
    let response: ExpensesReportResponseDto[] = [];

    if (expense) {
        for (let expenseInfo of expense.expenses) {
            response.push({
                tripId: expense.tripId._id.toString() || '',
                confirmationNumber: `DK-${expense?.tripId?.tripConfirmedNumber
                    .toString()
                    .padStart(3, '0')}`,
                expenseId: expenseInfo._id.toString() || '',
                typeId: expenseInfo.typeId,
                typeName: expenseInfo?.typeName || '',
                amount: expenseInfo?.amount || 0,
                description: expenseInfo?.description || '',
                date: expenseInfo?.date,
                createdDate: expenseInfo?.createdAt,
                createdUser: `${expenseInfo?.createdBy?.userName} (${expenseInfo?.createdBy?.fullName})`,
                updatedDate: expenseInfo?.updatedAt,
                updatedUser: `${expenseInfo?.updatedBy?.userName} (${expenseInfo?.updatedBy?.fullName})`,
            });
        }
    }

    return response;
};

const expensesModelsToExpensesReportResponseDtos = (
    expenses: any[]
): ExpensesReportResponseDto[] => {
    let response: ExpensesReportResponseDto[] = [];

    if (expenses.length > 0) {
        for (let expense of expenses) {
            let expenseInfo = expensesModelToExpensesReportResponseDto(expense);
            response = response.concat(expenseInfo);
        }
    }

    return response;
};

const driverModelToDriverSalaryReportResponseDto = (driver: any): any => {
    let response: DriverSalaryReportResponseDto = Object.create(null);

    if (driver) {
        response = {
            tripId: driver.tripId._id.toString() || '',
            tripConfirmationNumber: `DK-${driver?.tripId?.tripConfirmedNumber
                .toString()
                .padStart(3, '0')}`,
            driverId: driver?.tripId?.drivers[0]?.driver?._id.toString() || '',
            driverName:
                `${driver?.tripId?.drivers[0]?.driver?.userName} (${driver?.tripId?.drivers[0]?.driver?.fullName})` ||
                '',
            salaryPerDay: driver?.driverSalary?.salaryPerDay || 0,
            remainingExpenses: driver?.driverSalary?.remainingExpenses || 0,
            totalDeduction: driver?.driverSalary?.totalDeduction || 0,
            totalAddition: driver?.driverSalary?.totalAddition || 0,
            totalSalary: driver?.driverSalary?.totalSalary || 0,
            noOfDays: driver?.driverSalary?.noOfDays || 0,
            isRemainingToDriver:
                driver?.driverSalary?.isRemainingToDriver || false,
            createdDate: driver?.driverSalary?.createdAt,
            createdUser: `${driver?.driverSalary?.createdBy?.userName} (${driver?.driverSalary?.createdBy?.fullName})`,
            updatedDate: driver?.driverSalary?.updatedAt,
            updatedUser: `${driver?.driverSalary?.updatedBy?.userName} (${driver?.driverSalary?.updatedBy?.fullName})`,
        };
    }

    return response;
};

const driverModelsToDriverSalaryReportResponseDtos = (
    drivers: any[]
): DriverSalaryReportResponseDto[] => {
    let response: DriverSalaryReportResponseDto[] = [];

    if (drivers.length > 0) {
        for (let driver of drivers) {
            let driverInfo = driverModelToDriverSalaryReportResponseDto(driver);
            response.push(driverInfo);
        }
    }

    return response;
};

export default {
    expensesModelToExpensesReportResponseDto,
    expensesModelsToExpensesReportResponseDtos,
    driverModelToDriverSalaryReportResponseDto,
    driverModelsToDriverSalaryReportResponseDtos,
};
