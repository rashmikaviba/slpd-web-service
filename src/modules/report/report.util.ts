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
                confirmationNumber: expense?.tripId?.tripConfirmedNumber,
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

const monthlyExpenseModelsToExpensesReportResponseDto = (expense: any[]): ExpensesReportResponseDto[] => {
    let response: ExpensesReportResponseDto[] = [];

    if (expense.length > 0) {
        for (let expenseInfo of expense) {
            response.push({
                tripId: '',
                confirmationNumber: '',
                expenseId: expenseInfo._id.toString() || '',
                typeId: expenseInfo.expenseType,
                typeName: expenseInfo?.expenseTypeName || '',
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

const driverModelToDriverSalaryReportResponseDto = (
    driver: any,
    driverSalary: any
): any => {
    let response: DriverSalaryReportResponseDto = Object.create(null);

    if (driver) {
        response = {
            tripId: driver.tripId._id.toString() || '',
            tripConfirmationNumber: driver?.tripId?.tripConfirmedNumber,
            driverId: driverSalary?.driver?._id.toString() || '',
            driverName:
                `${driverSalary?.driver?.userName} (${driverSalary?.driver?.fullName})` ||
                '',
            salaryPerDay: driverSalary?.salaryPerDay || 0,
            remainingExpenses: driverSalary?.remainingExpenses || 0,
            totalDeduction: driverSalary?.totalDeduction || 0,
            totalAddition: driverSalary?.totalAddition || 0,
            totalSalary: driverSalary?.totalSalary || 0,
            noOfDays: driverSalary?.noOfDays || 0,
            isRemainingToDriver: driverSalary?.isRemainingToDriver || false,
            createdDate: driverSalary?.createdAt,
            createdUser: `${driverSalary?.createdBy?.userName} (${driverSalary?.createdBy?.fullName})`,
            updatedDate: driverSalary?.updatedAt,
            updatedUser: `${driverSalary?.updatedBy?.userName} (${driverSalary?.updatedBy?.fullName})`,
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
            for (let driverSalary of driver.driverSalaries) {
                let driverInfo = driverModelToDriverSalaryReportResponseDto(
                    driver,
                    driverSalary
                );
                response.push(driverInfo);
            }
        }
    }

    return response;
};

export default {
    expensesModelToExpensesReportResponseDto,
    expensesModelsToExpensesReportResponseDtos,
    driverModelToDriverSalaryReportResponseDto,
    driverModelsToDriverSalaryReportResponseDtos,
    monthlyExpenseModelsToExpensesReportResponseDto
};
