interface DriverSalaryReportResponseDto {
    tripId: string;
    tripConfirmationNumber: string;
    driverId: string;
    driverName: string;
    salaryPerDay: number;
    remainingExpenses: number;
    totalDeduction: number;
    totalAddition: number;
    totalSalary: number;
    noOfDays: number;
    isRemainingToDriver: boolean;
    createdDate: Date;
    createdUser: string;
    updatedDate: Date;
    updatedUser: string;
}

export { DriverSalaryReportResponseDto };