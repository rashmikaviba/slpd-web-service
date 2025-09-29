import { Request, Response } from "express"
import { WellKnownStatus } from "../../util/enums/well-known-status.enum"
import productService from "../inventory/product/product.service"
import InventorySummaryResponseDto from "./dto/inventorySummaryResponseDto";
import dashboardUtil from "./dashboard.util";
import CommonResponse from "../../util/commonResponse";
import { StatusCodes } from "http-status-codes";
import { WellKnownTripStatus } from "../../util/enums/well-known-trip-status.enum";
import expensesService from "../expenses/expenses.service";
import tripService from "../trip/trip.service";
import vehicleService from "../vehicle/vehicle.service";
import userService from "../user/user.service";
import constants from "../../constant";
import roleService from "../common/service/role.service";
import monthlyExpensesService from "../monthlyExpenses/monthlyExpenses.service";

const getDashboardInventorySummary = async (req: Request, res: Response) => {
    let products = await productService.findAllAndByStatusIn([WellKnownStatus.ACTIVE]) || [];

    let response: InventorySummaryResponseDto[] = [];
    if (products.length > 0) {
        response = dashboardUtil.modelsToInventorySummeryResponseDtos(products);

        response.sort((a, b) => a.inventory - b.inventory);
    }

    CommonResponse(res, true, StatusCodes.OK, '', response);
}

const getDashboardData = async (req: Request, res: Response) => {
    try {
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;

        const todayDateString = new Date().toISOString().split("T")[0];

        let trips = await tripService.findAllByStatusInAndOnlyFromEndDate(
            [WellKnownTripStatus.FINISHED],
            startDate,
            endDate
        );

        const [finishedTripsCount, totalIncome, monthlyExpensesTotal] = await Promise.all([
            getFinishedTripsCount(startDate, endDate, trips),
            getIncomeForDateRange(startDate, endDate, trips),
            getExpensesForDateRange(startDate, endDate, trips)
        ]);

        const response = {
            finishedTripsCount: finishedTripsCount ?? 0,
            totalIncome: totalIncome ?? 0,
            totalExpenses: monthlyExpensesTotal ?? 0
        };

        CommonResponse(res, true, StatusCodes.OK, "", response);
    } catch (err) {
        CommonResponse(res, false, StatusCodes.INTERNAL_SERVER_ERROR, "Error fetching dashboard data", null);
    }
};

const getAvailableDriversAndVehiclesCount = async (
    startDate: string,
    endDate: string
): Promise<{ availableDriversCount: number; availableVehiclesCount: number }> => {

    const role: any = await roleService.findByCustomId(constants.USER.ROLES.DRIVER.toString());

    const [trips, vehicles, drivers] = await Promise.all([
        tripService.findAllByStatusIn([WellKnownTripStatus.PENDING, WellKnownTripStatus.START], startDate, endDate),
        vehicleService.findAllAndStatusIn([WellKnownStatus.ACTIVE]),
        userService.findAllByRoleId(role._id)
    ]);

    const totalVehiclesCount = vehicles?.length ?? 0;
    const totalDriversCount = drivers?.length ?? 0;

    const assignedDriverIds = new Set<string>();
    const assignedVehicleIds = new Set<string>();

    for (const trip of trips) {
        for (const driverObj of trip.drivers ?? []) {
            if (driverObj.isActive && driverObj.driver?._id) {
                assignedDriverIds.add(driverObj.driver._id.toString());
            }
        }

        for (const vehicleObj of trip.vehicles ?? []) {
            if (vehicleObj.isActive && vehicleObj.vehicle?._id) {
                assignedVehicleIds.add(vehicleObj.vehicle._id.toString());
            }
        }
    }

    let availableDriversCount = Math.max(0, totalDriversCount - assignedDriverIds.size);
    let availableVehiclesCount = Math.max(0, totalVehiclesCount - assignedVehicleIds.size);

    return { availableDriversCount, availableVehiclesCount };
};

const getFinishedTripsCount = async (startDate: string, endDate: string, trips: any[]): Promise<number> => {
    // let trips = await tripService.findAllByStatusIn(
    //     [WellKnownTripStatus.FINISHED],
    //     startDate,
    //     endDate
    // );

    await Promise.all(
        trips.map(async (trip: any) => {
            trip.isDriverSalaryDone = false;
            if (
                trip.status === WellKnownTripStatus.FINISHED
            ) {
                const expense =
                    await expensesService.findByTripIdAndStatusIn(
                        trip._id.toString(),
                        [WellKnownStatus.ACTIVE]
                    );
                if (expense) {
                    trip.isDriverSalaryDone =
                        expense.toObject()?.driverSalaries.length > 0 ||
                        false;
                }
            }
        })
    );

    return trips.length;
}

const getIncomeForDateRange = async (startDate: string, endDate: string, trips: any[]): Promise<number> => {
    // let trips = await tripService.findAllByStatusIn(
    //     [WellKnownTripStatus.FINISHED],
    //     startDate,
    //     endDate
    // );

    let totalIncome = 0;
    trips.forEach((trip: any) => {
        totalIncome += trip.totalCostLocalCurrency || 0;
    });

    return totalIncome;
}


const getExpensesForDateRange = async (startDate: string, endDate: string, trips: any[]): Promise<number> => {
    // Trip Ids for the date range 
    let tripIds = new Set<string>();

    trips.forEach((trip: any) => {
        tripIds.add(trip._id.toString());
    });

    let totalExpenses = 0;

    if (tripIds.size != 0) {
        // Get Expenses for the trip Ids and driver salaries
        let tripExpenses: any = await expensesService.findByTripIdsInAndStatusIn(
            Array.from(tripIds),
            [WellKnownStatus.ACTIVE]
        );

        tripExpenses.forEach((tripExpense: any) => {
            tripExpense?.expenses.forEach((expense: any) => {
                if (expense.status === WellKnownStatus.ACTIVE) {
                    totalExpenses += expense.amount || 0;

                }
            });

            tripExpense?.driverSalaries.forEach((salary: any) => {
                totalExpenses += salary.totalSalary || 0;
            });
        });
    }

    // monthly expenses
    let startFirstDate = new Date(startDate);
    startFirstDate = new Date(startFirstDate.getFullYear(), startFirstDate.getMonth(), 1);
    startFirstDate.setHours(0, 0, 0, 0);

    let endLastDate = new Date(endDate);
    endLastDate = new Date(endLastDate.getFullYear(), endLastDate.getMonth() + 1, 0);
    endLastDate.setHours(23, 59, 59, 999);

    let monthlyExpenses: any = await monthlyExpensesService.advanceSearch(startFirstDate, endLastDate);
    let monthlyExpensesTotal = 0;

    monthlyExpenses?.forEach((monthlyExpense: any) => {
        monthlyExpense.expenses.forEach((expense: any) => {
            if (expense.date >= new Date(startDate) && expense.date <= new Date(endDate) && expense.status === WellKnownStatus.ACTIVE) {
                monthlyExpensesTotal += expense.amount || 0;
            }
        });
    });


    return totalExpenses + monthlyExpensesTotal;
}

const getMonthlyIncomeExpense = async (req: Request, res: Response) => {
    try {

        const year = req.query.year as string;

        let currentYear = new Date().getFullYear();
        let currentMonth = new Date().getMonth() + 1;

        if (Number(year) != currentYear) {
            currentMonth = 12;
            currentYear = Number(year);
        } else {
            currentYear = Number(year);
        }
        let monthlyData = [
            { monthIndex: 1, month: 'January', income: 0, expenses: 0 },
            { monthIndex: 2, month: 'February', income: 0, expenses: 0 },
            { monthIndex: 3, month: 'March', income: 0, expenses: 0 },
            { monthIndex: 4, month: 'April', income: 0, expenses: 0 },
            { monthIndex: 5, month: 'May', income: 0, expenses: 0 },
            { monthIndex: 6, month: 'June', income: 0, expenses: 0 },
            { monthIndex: 7, month: 'July', income: 0, expenses: 0 },
            { monthIndex: 8, month: 'August', income: 0, expenses: 0 },
            { monthIndex: 9, month: 'September', income: 0, expenses: 0 },
            { monthIndex: 10, month: 'October', income: 0, expenses: 0 },
            { monthIndex: 11, month: 'November', income: 0, expenses: 0 },
            { monthIndex: 12, month: 'December', income: 0, expenses: 0 },
        ];

        for (let i = 1; i <= 12; i++) {
            let startDate = new Date(Date.UTC(currentYear, i - 1, 1))
                .toISOString()
                .split("T")[0];
            let endDate = new Date(Date.UTC(currentYear, i, 0))
                .toISOString()
                .split("T")[0];

            if (i <= currentMonth) {
                let trips = await tripService.findAllByStatusInAndOnlyFromEndDate(
                    [WellKnownTripStatus.FINISHED],
                    startDate,
                    endDate
                );

                let totalIncome = await getIncomeForDateRange(startDate, endDate, trips);
                let totalExpenses = await getExpensesForDateRange(startDate, endDate, trips);

                let monthData = monthlyData.find(m => m.monthIndex === i);
                if (monthData) {
                    monthData.income = totalIncome ?? 0;
                    monthData.expenses = totalExpenses ?? 0;
                }
            } else {
                break;
            }
        }

        CommonResponse(res, true, StatusCodes.OK, "", monthlyData);

    } catch (error) {
        CommonResponse(res, false, StatusCodes.INTERNAL_SERVER_ERROR, "Error fetching dashboard data", null);
    }
}

export {
    getDashboardInventorySummary,
    getDashboardData,
    getMonthlyIncomeExpense
}