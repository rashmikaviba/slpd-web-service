import TripExpensesResponseDto from './dto/tripExpensesResponseDto';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';

// total amount of the active expense lines
const sumActiveExpenses = (expenses: any[]): number => {
    let activeExpenses = expenses.filter(
        (exp: any) => exp.status === WellKnownStatus.ACTIVE
    );

    return activeExpenses.reduce(
        (total: number, exp: any) => total + exp.amount,
        0
    );
};

const ExpensesModelToTripExpensesResponseDto = (
    expense: any
): TripExpensesResponseDto => {
    return {
        _id: expense._id,
        tripId: expense.tripId._id,
        expenses: expense.expenses,
        driverSalaries: expense.driverSalaries,
        isMonthEndDone: expense.isMonthEndDone,
        tripExpensesAmount: expense.tripExpensesAmount,
        totalTripExpensesAmount: expense.totalTripExpensesAmount,
        remainingTripExpensesAmount: expense.remainingTripExpensesAmount,
    };
};

// Keeps only the active expense lines on the document, adds the totals and maps it to the response DTO
const expenseWithTotalsToResponseDto = (expense: any): TripExpensesResponseDto => {
    // get only active expenses
    let activeExpenses = expense.expenses.filter(
        (exp: any) => exp.status === WellKnownStatus.ACTIVE
    );

    let totalExpensesAmount = sumActiveExpenses(activeExpenses);

    expense.expenses = activeExpenses;
    expense.tripExpensesAmount = expense?.tripId?.estimatedExpense;
    expense.totalTripExpensesAmount = totalExpensesAmount;
    expense.remainingTripExpensesAmount =
        expense?.tripExpensesAmount - totalExpensesAmount;

    return ExpensesModelToTripExpensesResponseDto(expense);
};

export default {
    ExpensesModelToTripExpensesResponseDto,
    expenseWithTotalsToResponseDto,
    sumActiveExpenses,
};
