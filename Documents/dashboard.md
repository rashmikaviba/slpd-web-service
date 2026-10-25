# Dashboard Module

Source: `src/modules/dashboard/`

All endpoints are mounted under the global prefix `/api/v1` (`src/constant.ts:3`, `src/app.ts:43`). Paths below omit the prefix.

---

## 1. Overview

The dashboard module gives management (Super Admin / Admin) read-only KPIs:

- **Inventory summary**: current stock of every active product, lowest stock first (a low-stock watchlist).
- **Dashboard stats for a date range**: number of finished trips, total income (sum of trip prices in local currency) and total expenses (trip expenses + driver salaries + company monthly expenses + eligible vehicle maintenance).
- **Monthly income vs expense** for a year (12 buckets) for charting. Closed months are cached.

The module has **no collections of its own**. It aggregates data from Trip, Expenses, MonthlyExpenses, VehicleMaintenance, InventoryProduct and CompanyWorkingInfo.

---

## 2. Files

| File | Role |
|---|---|
| `dashboard.route.ts` | Express router for `/dashboard`. |
| `dashboard.controller.ts` | All handlers plus the private aggregation helpers (`getFinishedTripsCount`, `getIncomeForDateRange`, `getExpensesForDateRange`, unused `getAvailableDriversAndVehiclesCount`). |
| `dashboard.util.ts` | Product → `InventorySummaryResponseDto` mappers and SI → product-unit conversion. |
| `dashboard.service.ts` | **Empty file** (0 lines). |
| `dto/inventorySummaryResponseDto.ts` | `InventorySummaryResponseDto` interface. |

---

## 3. Data Model(s)

None. The module defines no Mongoose schema. The fields it reads from other collections:

| Collection (model) | Fields used |
|---|---|
| `Trip` | `status`, `endDate`, `totalCostLocalCurrency`, `drivers[].driver`, `drivers[].isActive`, `vehicles[].vehicle`, `vehicles[].isActive` |
| `Expenses` | `tripId`, `status`, `expenses[].amount`, `expenses[].status`, `driverSalaries[].driver`, `driverSalaries[].totalSalary` |
| `MonthlyExpenses` | `month` (Date), `expenses[].date`, `expenses[].amount`, `expenses[].status` |
| `VehicleMaintenance` | `status`, `maintenanceDate`, `cost`, `vehicle` → `Vehicle.isFreelanceVehicle`, `Vehicle.isRentalVehicle` |
| `InventoryProduct` | `_id`, `productName`, `productShortCode`, `measureUnit`, `inventory`, `status` |
| `CompanyWorkingInfo` | `workingDate` (latest ACTIVE record) |

---

## 4. API Endpoints

Base path `/dashboard` (`src/applicationRoutes.ts:204-209`, mounted `src/mapping.ts:47`). All three routes use `authMiddleware.authorize([SUPERADMIN, ADMIN])` (`dashboard.route.ts:9-19`): a Bearer JWT is required, the user must not be blocked, and the role id must be 1 or 2. Otherwise 401/403 (see `Documents/inventory.md` §3.1).

| Method | Full path | Controller | Roles | Description |
|---|---|---|---|---|
| GET | `/dashboard/inventorySummary` | `getDashboardInventorySummary` | SUPERADMIN, ADMIN | Active products with stock, ascending by stock. |
| GET | `/dashboard/getDashboardstats` | `getDashboardData` | SUPERADMIN, ADMIN | Finished-trip count, income and expenses for a date range. |
| GET | `/dashboard/monthlyIncomeExpense` | `getMonthlyIncomeExpense` | SUPERADMIN, ADMIN | 12-month income/expense series for a year. |

Response envelope: `{isSuccessful, timeStamp, message, data}`.

### 4.1 GET `/dashboard/inventorySummary` — `getDashboardInventorySummary` (`dashboard.controller.ts:20`)

**Params/query/body:** none.

**Logic:**
1. `productService.findAllAndByStatusIn([ACTIVE])`: cached under key `product-[1]` for one week (cleared on any product save). The query returns ACTIVE products without `inventoryLogs`, with `createdBy`/`updatedBy` populated (`userName`). `|| []` guards a null result.
2. If there are products, map with `dashboardUtil.modelsToInventorySummeryResponseDtos` and sort **ascending by converted `inventory`** (`a.inventory - b.inventory`).

**Response:** `200 ''`, `data: InventorySummaryResponseDto[]`:

| Field | Value |
|---|---|
| `_id`, `productName`, `productShortCode` | product |
| `measureUnitDetails` | full unit object from `measureUnitData` for `product.measureUnit` |
| `inventory` | stock converted from base unit to the product's unit (§6) |

**Errors:** none specific. Unexpected errors propagate to the global error middleware (500).

### 4.2 GET `/dashboard/getDashboardstats` — `getDashboardData` (`dashboard.controller.ts:33`)

**Query:** `startDate`, `endDate`: date strings (e.g. `2025-01-01`). **Not validated**: no Joi schema, no required check.

**Logic:**
1. `trips = tripService.findAllByStatusInAndOnlyFromEndDate([FINISHED], startDate, endDate)` (`trip.service.ts:166`): `Trip.find({status: {$in:[4]}, $or: [{endDate: {$gte: sDate, $lte: eDate}}]})`, where `sDate` is `startDate` at 00:00:00.000 local time and `eDate` is `endDate` at 23:59:59.999 local time. It populates `createdBy updatedBy startedBy endedBy`, `drivers.driver` (with `match: {'drivers.isActive': true}`) and `vehicles.vehicle`, sorted by `startDate` asc. Not cached. **A trip counts in the period in which it ended.**
2. In parallel (`Promise.all`):
   - `getFinishedTripsCount(startDate, endDate, trips)` → `trips.length` (see §6.2 for the wasted work it does).
   - `getIncomeForDateRange(...)` → `Σ trip.totalCostLocalCurrency || 0`.
   - `getExpensesForDateRange(...)` → total expenses (§5.2).
3. The local `todayDateString` is computed and never used.

**Response:** `200 ''`, `data`:
```json
{ "finishedTripsCount": 0, "totalIncome": 0, "totalExpenses": 0 }
```
(each value `?? 0`).

**Errors:** the whole handler is wrapped in `try/catch`. Any error (e.g. invalid dates causing `RangeError`) returns `500 "Error fetching dashboard data"` with `data: null`, `isSuccessful: false`. With missing/invalid dates, `new Date(undefined)` is an Invalid Date. Mongo comparisons against it match nothing, and `getExpensesForDateRange` builds Invalid Dates too, so the call usually returns zeros rather than throwing.

### 4.3 GET `/dashboard/monthlyIncomeExpense` — `getMonthlyIncomeExpense` (`dashboard.controller.ts:226`)

**Query:** `year` (string, e.g. `2025`). Not validated.

**Logic:**
1. `currentYear = now.getFullYear()`, `currentMonth = now.getMonth() + 1`.
2. If `Number(year) != currentYear` then `currentMonth = 12` (all months), `currentYear = Number(year)`; else `currentYear = Number(year)` (months up to the current month).
3. Initialise 12 buckets `{monthIndex, month (English name), income: 0, expenses: 0}`.
4. For `i = 1..12`:
   - `startDate = YYYY-MM-01` and `endDate` = last day of month, both built with `Date.UTC` and formatted `YYYY-MM-DD`.
   - If `i > currentMonth` → `break` (future months stay 0).
   - Cache key `monthlyIncomeExpense_<year>_<i>`. On a hit, copy `income`/`expenses` from the cache.
   - On a miss: fetch FINISHED trips by end date (as in 4.2), `income = getIncomeForDateRange`, `expenses = getExpensesForDateRange`, store them in the bucket. Then load `companyWorkingInfoService.getCompanyWorkingInfo()` (latest ACTIVE `CompanyWorkingInfo`, cached one month under `companyWorkingInfo`). **If `new Date(startDate) < workingInfo.workingDate`**, cache `{income, expenses}` for **ONE_YEAR**. Only months that started before the company's current working date (i.e. closed/audited months) are cached; the current open month is always recomputed.
5. Months are processed **sequentially** (one `await` per month).

**Response:** `200 ''`, `data`: array of 12 `{monthIndex, month, income, expenses}`.

**Errors:** `try/catch` → `500 "Error fetching dashboard data"`, `data: null`. A missing or non-numeric `year` gives `Number(year) = NaN`, so `Date.UTC(NaN, …)` is an Invalid Date and `toISOString()` throws `RangeError`, which returns this 500.

---

## 5. Business Rules & Calculations

### 5.1 Income
```
income = Σ over FINISHED trips with endDate in [startDate 00:00, endDate 23:59:59.999] of (trip.totalCostLocalCurrency || 0)
```

### 5.2 Expenses (`getExpensesForDateRange`, `dashboard.controller.ts:157`)

```
total = tripExpenses + monthlyExpenses + vehicleMaintenance
```

1. **Trip expenses** (only if there is at least one trip): `expensesService.findByTripIdsInAndStatusIn(tripIds, [ACTIVE])`, which finds `Expenses` headers for those trips with status ACTIVE (cached one week under `expenses-<ids><statuses>`). For each header:
   - `+ expense.amount` for each `expenses[]` item with `status === ACTIVE`;
   - `+ salary.totalSalary` for **every** `driverSalaries[]` item (no status filter).
2. **Monthly (company overhead) expenses**:
   - `startFirstDate` = first day of `startDate`'s month 00:00 local; `endLastDate` = last day of `endDate`'s month 23:59:59.999 local.
   - `monthlyExpensesService.advanceSearch(startFirstDate, endLastDate)`: `MonthlyExpenses.find({month: {$gte, $lte}})` (no header status filter), cached one week.
   - Sum `expense.amount` for each sub-expense where `expense.date >= new Date(startDate)` **and** `expense.date <= new Date(endDate)` **and** `status === ACTIVE`. Note `new Date('YYYY-MM-DD')` is UTC midnight, so the end bound excludes expenses later on the end day (see Gotchas).
3. **Vehicle maintenance**: `vehicleMaintenanceService.findAllByMaintenanceDateAndStatusIn([ACTIVE], startDate, endDate)`, where `maintenanceDate` is in `[startDate 00:00, endDate 23:59:59.999]` local time, populated with `vehicle garage createdBy updatedBy` and cached one week. For each record:
   - skip if `vehicle == null`;
   - skip if `vehicle.isFreelanceVehicle`;
   - skip if `vehicle.isRentalVehicle && cost > 5000`;
   - else `+ cost || 0`.
   So company vehicles are always included, rental vehicles only when cost ≤ 5000, and freelance vehicles never.

### 5.3 Finished trips count
`finishedTripsCount = number of FINISHED trips whose endDate falls in the range`.

### 5.4 Inventory summary ordering
Ascending by `inventory` converted to each product's own unit. Products with different units are compared by raw number (e.g. 3 kg vs 5 pieces).

### 5.5 Month-cache rule
Month `i` of year `Y` is cached for one year only if `Date(Y-i-01) < companyWorkingInfo.workingDate`.

---

## 6. Utilities & DTOs

### 6.1 `dashboard.util.ts`
- `modelToInventorySummeryResponse(product)` → `{_id, productName, productShortCode, measureUnitDetails, inventory}`.
- `modelsToInventorySummeryResponseDtos(products)` → maps the array.
- `fromSiMeasureUnitToOtherMeasureUnit(toUnitId, siQuantity)` (private): unit not found → `0`; `isSiUnit` → `siQuantity`; else `siQuantity / conversionToSi`. (Same as `product.util.ts`.)

### 6.2 Private helpers in `dashboard.controller.ts`
- `getFinishedTripsCount(startDate, endDate, trips)`: for each FINISHED trip it loads the trip's ACTIVE `Expenses` header and sets `trip.isDriverSalaryDone = every trip driver's id is in driverSalaries[].driver`. **This flag is never used.** The function returns `trips.length`, so it makes one extra DB query per trip for nothing.
- `getIncomeForDateRange(...)`: §5.1.
- `getExpensesForDateRange(...)`: §5.2.
- `getAvailableDriversAndVehiclesCount(startDate, endDate)`: **dead code (not called)**. It would count ACTIVE vehicles and DRIVER-role users minus those assigned (active assignment) to PENDING/START trips overlapping the range.

### 6.3 DTO
`dto/inventorySummaryResponseDto.ts`: `InventorySummaryResponseDto {_id, productName, productShortCode, measureUnitDetails, inventory}`.

---

## 7. Dependencies

Reads only (no writes):

| Service | Function | Used for |
|---|---|---|
| `inventory/product/product.service` | `findAllAndByStatusIn` | inventory summary |
| `trip/trip.service` | `findAllByStatusInAndOnlyFromEndDate` | finished trips per range |
| `trip/trip.service` | `findAllByStatusIn` | (dead code only) |
| `expenses/expenses.service` | `findByTripIdAndStatusIn`, `findByTripIdsInAndStatusIn` | salary-done flag, trip expenses |
| `monthlyExpenses/monthlyExpenses.service` | `advanceSearch` | monthly overheads |
| `vehicleMaintain/vehicleMaintenance.service` | `findAllByMaintenanceDateAndStatusIn` | maintenance cost |
| `common/service/companyWorkingInfo.service` | `getCompanyWorkingInfo` | month cache rule |
| `vehicle/vehicle.service`, `user/user.service`, `common/service/role.service` | various | (dead code only) |
| `src/util/cache.ts` | `getCache`, `setCache` | monthly cache |

No other module depends on the dashboard module.

---

## 8. Notes / Gotchas

1. **The monthly income/expense cache is never invalidated**: keys `monthlyIncomeExpense_*` do not start with any prefix cleared by `clearCacheByPrefixs`, and `clearCache()` is never called. Edits to past (closed) months' trips or expenses won't show for up to a year or until a server restart (node-cache is in-process memory).
2. **Monthly expense end-date bound**: `expense.date <= new Date(endDate)` where `endDate` is `YYYY-MM-DD`, which is UTC midnight. Monthly expenses dated later on the last day of the range (or the last day of the month in the yearly chart) are excluded, while trips and maintenance use 23:59:59.999 local. The bounds are inconsistent.
3. **Mixed time zones**: the date range uses `setHours` (server local time) on dates parsed from `YYYY-MM-DD` strings (UTC), and the monthly chart builds dates with `Date.UTC`. Results depend on the server TZ.
4. **Driver salaries counted without status filter** and regardless of whether the expense header's trip is still FINISHED. Only headers with status ACTIVE are included.
5. **Monthly expenses header status is not filtered** (`advanceSearch` has no `status` condition); only sub-expense status is.
6. **No input validation**: missing `startDate`/`endDate` silently yields zeros; a missing `year` yields a generic 500.
7. **Wasted queries**: `getFinishedTripsCount` makes N `Expenses` queries to compute an unused `isDriverSalaryDone`.
8. **Dead code**: `getAvailableDriversAndVehiclesCount`, the unused `todayDateString`, and the empty `dashboard.service.ts`. If revived, note that `userService.findAllByRoleId` does `cached.length` on a possibly-undefined cache value (`user.service.ts:159`), which would throw.
9. **Errors are swallowed**: `getDashboardData` and `getMonthlyIncomeExpense` catch all errors and return a generic 500 without logging, which hides the root cause.
10. **Stale inputs from service caches**: trip expenses, monthly expenses and maintenance lookups are cached for one week per exact key (each is cleared when its own module saves).
11. **Inventory summary sorts across different units** (pieces vs kg vs l), so "lowest stock first" is only meaningful within the same unit.
12. **Sequential month loop**: up to 12 × (trip query + expense queries + maintenance query) run one after another on a cold cache.
