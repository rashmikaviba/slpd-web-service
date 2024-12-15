interface TripExpensesResponseDto {
    _id: string;
    tripId: string;
    expenses: any[];
    driverSalary: any;
    isMonthEndDone: boolean;
    tripExpensesAmount: number;
    totalTripExpensesAmount: number;
    remainingTripExpensesAmount: number;
}

export default TripExpensesResponseDto;
