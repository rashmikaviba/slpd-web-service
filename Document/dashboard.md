# Dashboard

Read-only aggregation endpoints for the admin dashboard: low-stock inventory summary, KPI tiles for a date range (finished trip count, income, expenses), and a 12-month income/expense series for a year. No writes; nothing is persisted except an in-memory cache of closed months for the yearly series. Shared concepts (auth middleware, `CommonResponse`, cache util, roles, enums) are described in [README.md](README.md).

## Files

| File | Responsibility |
|---|---|
| `src/modules/dashboard/dashboard.route.ts` | Registers 3 GET routes, all `authorize([SUPERADMIN, ADMIN])`. |
| `src/modules/dashboard/dashboard.controller.ts` | All logic: handlers plus private helpers `getFinishedTripsCount`, `getIncomeForDateRange`, `getExpensesForDateRange`, `getAvailableDriversAndVehiclesCount` (unused). |
| `src/modules/dashboard/dashboard.util.ts` | Product → `InventorySummaryResponseDto` mapping and SI-unit → product-unit conversion. |
| `src/modules/dashboard/dto/inventorySummaryResponseDto.ts` | DTO interface for the inventory summary. |
| `src/modules/dashboard/dashboard.service.ts` | Empty file (0 lines). The module has no own service; it calls other modules' services. |

## Endpoints

Base path: `/api/v1/dashboard` (`applicationRoutes.dashboard`). No Joi validation schemas exist for this module.

| Method | Path | Roles allowed | Validation schema | Handler |
|---|---|---|---|---|
| GET | `/api/v1/dashboard/inventorySummary` | SUPERADMIN (1), ADMIN (2) | none | `getDashboardInventorySummary` |
| GET | `/api/v1/dashboard/getDashboardstats` | SUPERADMIN (1), ADMIN (2) | none (query read raw) | `getDashboardData` |
| GET | `/api/v1/dashboard/monthlyIncomeExpense` | SUPERADMIN (1), ADMIN (2) | none (query read raw) | `getMonthlyIncomeExpense` |

## Endpoint logic

### GET `/inventorySummary` — `getDashboardInventorySummary` (dashboard.controller.ts:20)

Request: no params/query/body.

1. `productService.findAllAndByStatusIn([WellKnownStatus.ACTIVE])` → all `InventoryProduct` docs with `status ∈ [1]`, projection `{ inventoryLogs: 0 }`, `createdBy`/`updatedBy` populated with `userName` only. Cached under key `product-[1]` (`CACHE.PREFIX.PRODUCT + JSON.stringify([1])`) for ONE_WEEK. `|| []` guards a falsy result.
2. If at least one product: map every product through `dashboardUtil.modelsToInventorySummeryResponseDtos` (see Utilities), then sort ascending by converted `inventory` (lowest stock first).
3. `CommonResponse(res, true, 200, '', response)`.

No try/catch: any error goes to the global error middleware (via `express-async-errors`).

Response `data`: array of
| Field | Source |
|---|---|
| `_id` | `product._id` |
| `productName` | `product.productName` |
| `productShortCode` | `product.productShortCode` |
| `measureUnitDetails` | Entry from `util/data/measureUnitData.ts` `measureUnit` where `unitId === product.measureUnit` (object `{unitId, code, name, isSaveWithSiUnit, isSiUnit, isAllowDecimal, categoryId, conversionToSi}`), or `undefined` (omitted in JSON) if no match |
| `inventory` | `product.inventory` (stored in SI unit) converted to the product's unit — see `fromSiMeasureUnitToOtherMeasureUnit` |

### GET `/getDashboardstats` — `getDashboardData` (dashboard.controller.ts:33)

Request query (not validated): `startDate`, `endDate` — date strings, expected `YYYY-MM-DD`.

1. Load trips once: `tripService.findAllByStatusInAndOnlyFromEndDate([FINISHED(4)], startDate, endDate)`:
   - `Trip.find({ status: {$in:[4]}, $or: [{ endDate: { $gte: sDate, $lte: eDate } }] })` where `sDate = new Date(startDate)` set to local 00:00:00.000 and `eDate = new Date(endDate)` set to local 23:59:59.999.
   - Populates `createdBy updatedBy startedBy endedBy`, `drivers.driver` (User, with `match: {'drivers.isActive': true}`), `vehicles.vehicle` (Vehicle). Sorted `startDate` asc. Not cached, not lean.
   - i.e. a trip belongs to the range by its **end date** only.
2. In parallel (`Promise.all`):
   - `getFinishedTripsCount(startDate, endDate, trips)` → `trips.length` (see helper; it also performs per-trip DB work whose result is discarded).
   - `getIncomeForDateRange(...)` → Σ `trip.totalCostLocalCurrency || 0`.
   - `getExpensesForDateRange(...)` → total expenses (formula below).
3. Response `{ finishedTripsCount, totalIncome, totalExpenses }`, each `?? 0`; `CommonResponse(res, true, 200, "", response)`.
4. Any thrown error (including Mongoose CastError when `startDate`/`endDate` is missing/invalid → `Invalid Date`) is caught and returns `CommonResponse(res, false, 500, "Error fetching dashboard data", null)`.

Response `data`:
| Field | Meaning |
|---|---|
| `finishedTripsCount` | Number of FINISHED trips whose `endDate` is in [startDate 00:00, endDate 23:59:59.999] (server local time). |
| `totalIncome` | Σ `totalCostLocalCurrency` of those trips. |
| `totalExpenses` | Trip expenses + driver salaries + monthly (company) expenses + eligible vehicle maintenance — see "Business rules". |

### GET `/monthlyIncomeExpense` — `getMonthlyIncomeExpense` (dashboard.controller.ts:226)

Request query (not validated): `year` — numeric string.

1. `currentYear = now.getFullYear()`, `currentMonth = now.getMonth() + 1`.
2. If `Number(year) != currentYear` → `currentMonth = 12` (compute all 12 months), `currentYear = Number(year)`; else `currentYear = Number(year)` (compute months 1..current month only).
3. Initialise `monthlyData` = 12 entries `{ monthIndex: 1..12, month: 'January'..'December', income: 0, expenses: 0 }`.
4. For `i = 1..12`:
   - `startDate = YYYY-MM-01` of month i (from `Date.UTC(currentYear, i-1, 1)` → ISO date part); `endDate` = last day of month i (`Date.UTC(currentYear, i, 0)`).
   - If `i > currentMonth` → `break` (remaining months stay 0).
   - Cache key `monthlyIncomeExpense_${currentYear}_${i}` (raw string, **not** a `CACHE.PREFIX` constant). If `cacheUtil.getCache(key)` is truthy → copy `cached.income`/`cached.expenses` into the month entry.
   - Else:
     - `trips = tripService.findAllByStatusInAndOnlyFromEndDate([FINISHED], startDate, endDate)` (same query as above).
     - `income = getIncomeForDateRange(...)`, `expenses = getExpensesForDateRange(...)` (sequential, not parallel).
     - Set month entry `income = income ?? 0`, `expenses = expenses ?? 0`.
     - `workingInfo = companyWorkingInfoService.getCompanyWorkingInfo()` (latest ACTIVE `CompanyWorkingInfo`, cached under `companyWorkingInfo` for ONE_MONTH). If it exists and `new Date(startDate) < new Date(workingInfo.workingDate)` — i.e. the month is before the currently open working month (already month-end closed) — `cacheUtil.setCache(key, { income, expenses }, ONE_YEAR)`.
5. `CommonResponse(res, true, 200, "", monthlyData)`.
6. On any error → `CommonResponse(res, false, 500, "Error fetching dashboard data", null)`. A missing/non-numeric `year` produces `NaN` → `toISOString()` throws `RangeError` → this 500.

Response `data`: array of 12 `{ monthIndex: number, month: string, income: number, expenses: number }`, January..December.

## Service layer

`dashboard.service.ts` is empty. External service calls used:

| Call | Query | Cache |
|---|---|---|
| `productService.findAllAndByStatusIn(status)` (inventory/product/product.service.ts:47) | `InventoryProduct.find({status:{$in}}, {inventoryLogs:0})`, populate `createdBy`,`updatedBy` (`userName`) | key `product-<JSON status>`, ONE_WEEK |
| `tripService.findAllByStatusInAndOnlyFromEndDate(status, start, end)` (trip/trip.service.ts:166) | `Trip.find({status:{$in}, endDate in [start 00:00 local, end 23:59:59.999 local]})`, populates as above, sort `startDate` asc | none |
| `expensesService.findByTripIdAndStatusIn(tripId, status)` (expenses/expenses.service.ts:25) | `Expenses.findOne({tripId, status:{$in}}).populate('tripId')` | none |
| `expensesService.findByTripIdsInAndStatusIn(tripIds, status)` (expenses/expenses.service.ts:33) | `Expenses.find({tripId:{$in}, status:{$in}})` | key `expenses-<JSON tripIds><JSON status>`, ONE_WEEK; cleared by expenses save (prefix `expenses-`) |
| `monthlyExpensesService.advanceSearch(startMonth, endMonth)` (monthlyExpenses/monthlyExpenses.service.ts:50) | `MonthlyExpenses.find({month:{$gte:startMonth,$lte:endMonth}})` (no status filter), populate `createdBy updatedBy` | key `monthlyExpenses-AdvanceSearch-<Date.toString()><Date.toString()>`, ONE_WEEK; cleared by monthly expense save |
| `vehicleMaintenanceService.findAllByMaintenanceDateAndStatusIn(statuses, start, end)` (vehicleMaintain/vehicleMaintenance.service.ts:23) | `VehicleMaintenance.find({status:{$in}, maintenanceDate in [start 00:00 local, end 23:59:59.999 local]})`, populate `vehicle garage createdBy updatedBy`, sort `maintenanceDate` asc | key `vehicleMaintenance-<start><end><JSON statuses>`, ONE_WEEK; cleared by maintenance save |
| `companyWorkingInfoService.getCompanyWorkingInfo()` (common/service/companyWorkingInfo.service.ts:6) | `CompanyWorkingInfo.findOne({status:ACTIVE}).sort({$natural:-1})` | key `companyWorkingInfo`, ONE_MONTH |
| Unused helper only: `roleService.findByCustomId`, `tripService.findAllByStatusIn`, `vehicleService.findAllAndStatusIn`, `userService.findAllByRoleId` | — | — |

## Controller helpers

### `getFinishedTripsCount(startDate, endDate, trips)` (dashboard.controller.ts:103)
For every trip (in parallel): sets `trip.isDriverSalaryDone = false`; if `trip.status === FINISHED` → `expensesService.findByTripIdAndStatusIn(trip._id, [ACTIVE])`; if an expense doc exists and the trip has drivers, `isDriverSalaryDone = every trip driver's populated `driver._id` is in the set of `expense.driverSalaries[].driver``. Returns `trips.length`. The `isDriverSalaryDone` flag is never read by the caller (one extra query per trip, result discarded).

### `getIncomeForDateRange(startDate, endDate, trips)` (dashboard.controller.ts:141)
Returns `Σ (trip.totalCostLocalCurrency || 0)`. Dates are unused.

### `getExpensesForDateRange(startDate, endDate, trips)` (dashboard.controller.ts:157)
Returns `tripExpenses + monthlyExpensesTotal + vehicleMaintenanceExpensesTotal`:
1. **Trip expenses + driver salaries**: if `trips` non-empty, `expensesService.findByTripIdsInAndStatusIn(tripIds, [ACTIVE])`; for each Expenses doc add `amount || 0` of every `expenses[]` item with `status === ACTIVE`, plus `totalSalary || 0` of every `driverSalaries[]` item (no status on salaries).
2. **Monthly (company) expenses**: `startFirstDate` = 1st of `startDate`'s month 00:00 local; `endLastDate` = last day of `endDate`'s month 23:59:59.999 local. `monthlyExpensesService.advanceSearch(startFirstDate, endLastDate)`; for each doc, add `amount || 0` of each `expenses[]` item where `expense.date >= new Date(startDate) && expense.date <= new Date(endDate) && status === ACTIVE`.
3. **Vehicle maintenance**: `vehicleMaintenanceService.findAllByMaintenanceDateAndStatusIn([ACTIVE], startDate, endDate)`; for each record: skip if `vehicle` populate is null; skip if `vehicle.isFreelanceVehicle`; skip if `vehicle.isRentalVehicle && cost > 5000`; otherwise add `cost || 0`.

### `getAvailableDriversAndVehiclesCount(startDate, endDate)` (dashboard.controller.ts:64) — dead code
Not exported or called. Would compute: drivers role doc via `roleService.findByCustomId("3")`; PENDING/START trips overlapping the range (`tripService.findAllByStatusIn`), ACTIVE vehicles, active non-blocked users with the driver role; `available = max(0, total − distinct active assigned ids)` for drivers and vehicles.

## Utilities / DTOs

| Function | Input → Output |
|---|---|
| `modelToInventorySummeryResponse(product)` (dashboard.util.ts:4) | product → `{ _id, productName, productShortCode, measureUnitDetails: measureUnit.find(unitId === product.measureUnit), inventory: fromSiMeasureUnitToOtherMeasureUnit(product.measureUnit, product.inventory) }` |
| `modelsToInventorySummeryResponseDtos(products)` (dashboard.util.ts:16) | array map of the above |
| `fromSiMeasureUnitToOtherMeasureUnit(toUnitId, siQuantity)` (dashboard.util.ts:28, not exported) | unit not found → `0`; unit `isSiUnit` → `siQuantity`; else `siQuantity / conversionToSi` (e.g. kg: /1000, t: /1 000 000, mg: /0.001, l: /1000, cc: /1) |

`InventorySummaryResponseDto`: `{ _id: string; productName: string; productShortCode: string; measureUnitDetails: any; inventory: number }`.

## Business rules / formulas

- **Period membership of a trip** = its `endDate` (local day bounds). Only `status = FINISHED (4)` trips count for income, expenses and the trip count.
- **Income** = Σ `trip.totalCostLocalCurrency` (gross, before expenses/salaries).
- **Expenses** = Σ ACTIVE trip expense line items (from ACTIVE Expenses docs of those trips, regardless of the line item's own date) + Σ `driverSalaries[].totalSalary` of those docs + Σ ACTIVE monthly-expense items whose `date` ∈ [`new Date(startDate)`, `new Date(endDate)`] + Σ maintenance `cost` with `maintenanceDate` in range, excluding freelance vehicles and excluding rental vehicles where `cost > 5000` (rental maintenance ≤ 5000 is a company cost; > 5000 is deducted from the rental owner — see report `vehicleMonthlyPaymentMaintance`).
- Dashboard does not compute profit; the client derives it from `totalIncome − totalExpenses`.
- **Inventory summary** shows only ACTIVE products, sorted ascending by stock in display units.
- **Yearly series**: past years → all 12 months; current year → months 1..current month; future year → all 12 months computed (normally zeros). Closed months (start < `CompanyWorkingInfo.workingDate`, i.e. before the open working month set by month audit) are cached for one year.

## Cache keys used

| Key | Set by | TTL | Invalidation |
|---|---|---|---|
| `monthlyIncomeExpense_<year>_<month>` | this module (dashboard.controller.ts:292) | ONE_YEAR | none anywhere in the code |
| `product-[1]`, `expenses-…`, `monthlyExpenses-AdvanceSearch-…`, `vehicleMaintenance-…`, `companyWorkingInfo` | the respective services (read through) | see Service layer | the owning module's save functions |

## Cross-module dependencies

- inventory/product: `productService`, product fields `productName, productShortCode, measureUnit, inventory`; `util/data/measureUnitData.ts`.
- trip: `tripService.findAllByStatusInAndOnlyFromEndDate` (and `findAllByStatusIn` in dead code); trip fields `endDate, status, totalCostLocalCurrency, drivers[]`.
- expenses: `expensesService.findByTripIdAndStatusIn`, `findByTripIdsInAndStatusIn`; `Expenses.expenses[]` (amount, status) and `driverSalaries[]` (driver, totalSalary).
- monthlyExpenses: `monthlyExpensesService.advanceSearch`; `MonthlyExpenses.expenses[]` (date, amount, status).
- vehicleMaintain: `vehicleMaintenanceService.findAllByMaintenanceDateAndStatusIn`; fields `cost`, populated `vehicle.isFreelanceVehicle/isRentalVehicle`.
- common: `companyWorkingInfoService.getCompanyWorkingInfo` (`workingDate`, set by monthAudit), `roleService` (dead code).
- vehicle, user: only in dead code.

## Known issues / notes

1. `dashboard.controller.ts:202` — monthly-expense items are filtered with `new Date(startDate)`/`new Date(endDate)` (UTC midnight of the date strings), not day-bounded like the trip and maintenance queries. Items whose stored timestamp is after `endDate` 00:00Z are excluded (the last day of the range / of each month in the yearly series is only partly counted), and items stored as local midnight on a UTC+ server (e.g. 1st 00:00 +05:30 = previous day 18:30Z) fall before `startDate` 00:00Z and are dropped. Exact effect depends on how the client sends `date`.
2. `dashboard.controller.ts:265-292` — `monthlyIncomeExpense_*` cache is never invalidated and lives one year. Any later correction to data of a closed month (or a month re-opened) is not reflected. Key also bypasses `constants.CACHE.PREFIX`, so prefix-based clears cannot target it.
3. `dashboard.controller.ts:110-136` — `getFinishedTripsCount` runs one `Expenses.findOne` per trip to compute `isDriverSalaryDone`, which is discarded; it only returns `trips.length`. Pure wasted DB load.
4. `dashboard.controller.ts:64-101` — `getAvailableDriversAndVehiclesCount` is dead code. It would also crash: `user.service.ts:159` does `cached.length` when `getCache` returns `undefined` (TypeError on cache miss).
5. `dashboard.controller.ts:35-36, 229` — no validation of `startDate`/`endDate`/`year`; missing or bad values yield a generic 500 "Error fetching dashboard data" instead of a 400.
6. `dashboard.controller.ts:38` — `todayDateString` unused. Lines 104-108 and 142-146 contain commented-out queries.
7. `dashboard.controller.ts:218` — rental maintenance with `cost` exactly `5000` is counted as company expense (`> 5000` excluded); matches `report.controller.ts:137,352`, keep the boundary consistent if changed.
8. `dashboard.controller.ts:174-185` — trip expense line items are attributed to the trip's end-date period, not to the item's own `date`; monthly expenses are attributed by item `date`. Mixed attribution is intentional-looking but worth knowing when reconciling with the report module.
9. `dashboard.controller.ts:256-261` vs trip service — month bounds are built in UTC (`Date.UTC`) then passed as strings that the trip/maintenance services re-parse and bound in **server local time**; results depend on server TZ.
10. `monthlyExpenses.service.ts:56` (`advanceSearch`) has no document `status` filter; only item status is checked here.
11. `dashboard.service.ts` is an empty file.
