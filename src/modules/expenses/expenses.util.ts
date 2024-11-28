import TripExpensesResponseDto from './dto/tripExpensesResponseDto';

const ExpensesModelToTripExpensesResponseDto = (
    expense: any
): TripExpensesResponseDto => {
    return {
        _id: expense._id,
        tripId: expense.tripId._id,
        expenses: expense.expenses,
        driverSalary: expense.driverSalary,
        isMonthEndDone: expense.isMonthEndDone,
        tripExpensesAmount: expense.tripExpensesAmount,
        totalTripExpensesAmount: expense.totalTripExpensesAmount,
        remainingTripExpensesAmount: expense.remainingTripExpensesAmount,
    };
};

export default { ExpensesModelToTripExpensesResponseDto };