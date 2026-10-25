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
import constants from "../../constant";
import monthlyExpensesService from "../monthlyExpenses/monthlyExpenses.service";
import vehicleMaintenanceService from "../vehicleMaintain/vehicleMaintenance.service";
import cacheUtil from "../../util/cache";
import companyWorkingInfoService from "../common/service/companyWorkingInfo.service";

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

const getFinishedTripsCount = async (startDate: string, endDate: string, trips: any[]): Promise<number> => {

    // The old per-trip isDriverSalaryDone loop was removed: nothing reads that flag
    // here, the count is just the number of finished trips.
    return trips.length;
}

const getIncomeForDateRange = async (startDate: string, endDate: string, trips: any[]): Promise<number> => {

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

    // monthly expenses range
    let startFirstDate = new Date(startDate);
    startFirstDate = new Date(startFirstDate.getFullYear(), startFirstDate.getMonth(), 1);
    startFirstDate.setHours(0, 0, 0, 0);

    let endLastDate = new Date(endDate);
    endLastDate = new Date(endLastDate.getFullYear(), endLastDate.getMonth() + 1, 0);
    endLastDate.setHours(23, 59, 59, 999);

    // the three lookups are independent: run them together
    const [tripExpenses, monthlyExpenses, vehicleMaintenances]: any[] = await Promise.all([
        // Get Expenses for the trip Ids and driver salaries
        tripIds.size != 0
            ? expensesService.findByTripIdsInAndStatusIn(Array.from(tripIds), [WellKnownStatus.ACTIVE])
            : undefined,
        monthlyExpensesService.advanceSearch(startFirstDate, endLastDate),
        vehicleMaintenanceService.findAllByMaintenanceDateAndStatusIn([WellKnownStatus.ACTIVE], startDate, endDate),
    ]);

    if (tripIds.size != 0) {
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
    let monthlyExpensesTotal = 0;

    monthlyExpenses?.forEach((monthlyExpense: any) => {
        monthlyExpense.expenses.forEach((expense: any) => {
            if (expense.date >= new Date(startDate) && expense.date <= new Date(endDate) && expense.status === WellKnownStatus.ACTIVE) {
                monthlyExpensesTotal += expense.amount || 0;
            }
        });
    });

    // vehicle maintenance expenses 
    let vehicleMaintenanceExpensesTotal = 0;

    for (let vehicleMaintenance of vehicleMaintenances) {
        // if company vehicle addto expense
        // if frelance vehicle ignore
        // if rental vehicle addto expense if cost < 5000
        if (vehicleMaintenance.vehicle == null) continue;
        if (vehicleMaintenance.vehicle.isFreelanceVehicle) continue;
        if (vehicleMaintenance.vehicle.isRentalVehicle && vehicleMaintenance.cost > 5000) continue;

        vehicleMaintenanceExpensesTotal += vehicleMaintenance.cost || 0;
    }

    return totalExpenses + monthlyExpensesTotal + vehicleMaintenanceExpensesTotal;
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

        // read lazily and once: only needed when a month is not cached yet
        let workingInfoPromise: Promise<any> | undefined;
        const getWorkingInfo = () =>
            (workingInfoPromise ??= companyWorkingInfoService.getCompanyWorkingInfo());

        const loadMonth = async (i: number) => {
            let startDate = new Date(Date.UTC(currentYear, i - 1, 1))
                .toISOString()
                .split("T")[0];
            let endDate = new Date(Date.UTC(currentYear, i, 0))
                .toISOString()
                .split("T")[0];

            const cacheKey = `monthlyIncomeExpense_${currentYear}_${i}`;
            const cached: any = cacheUtil.getCache(cacheKey);

            if (cached) {
                let monthData = monthlyData.find(m => m.monthIndex === i);
                if (monthData) {
                    monthData.income = cached.income;
                    monthData.expenses = cached.expenses;
                }

            } else {
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

                    const workingInfo = await getWorkingInfo();
                    if (workingInfo && new Date(startDate) < new Date(workingInfo.workingDate)) {
                        cacheUtil.setCache(cacheKey, { income: totalIncome ?? 0, expenses: totalExpenses ?? 0 }, constants.CACHE.DURATION.ONE_YEAR);
                    }
                }
            }
        };

        // months are independent (each writes only its own row)
        const months: Promise<void>[] = [];
        for (let i = 1; i <= Math.min(12, currentMonth); i++) {
            months.push(loadMonth(i));
        }
        await Promise.all(months);

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