# Report Module (`src/modules/report`)

## 1. Overview

The Report module provides **read-only monthly financial/operational reports** for the office:

| Report | Business question |
|---|---|
| Monthly trip report | Which trips ended this month, and what is each trip's expense position? |
| Monthly expenses report | Every expense line for the month: trip expenses + company monthly overhead + company/rental vehicle maintenance. |
| Monthly driver salary | Driver salary settlements for trips finished in the month. |
| Monthly income report | Per-trip profit: trip revenue (local currency) − driver salaries − trip expenses. |
| Vehicle monthly payment / maintenance | For a freelance or rental (hired) vehicle: how much to pay the owner for the month after maintenance offsets. |

The module has **no model of its own**; it queries other modules' collections. Nothing is written.

## 2. Files

| File | Role |
|---|---|
| `report.route.ts` | Router with 5 endpoints. |
| `report.controller.ts` | Handlers + local helpers `vehicleMaintenanceForMonthlyExpense`, `calculateIncome`, `vehiclePaymentReportResponse`. |
| `report.service.ts` | Queries on `Trip`, `Expenses`, `MonthlyExpenses`, `VehicleMaintenance`. |
| `report.validation.ts` | Joi `vehicleMonthlyPaymentMaintanceSchema`. |
| `report.util.ts` | Mappers to expense and driver-salary report DTOs. |
| `dto/expensesReportResponseDto.ts` | Row DTO for the expenses report. |
| `dto/driverSalaryReportResponseDto.ts` | Row DTO for the driver salary report. |
| `dto/monthlyIncomeReportResponseDto.ts` | Row DTO for the income report. |

## 3. Data Model

No schema. Collections queried:

| Collection (model) | Owner module | Fields used |
|---|---|---|
| `trips` (`Trip`) | trip | `_id`, `endDate`, `startDate`, `status`, `tripConfirmedNumber`, `estimatedExpense`, `totalCost`, `totalCostLocalCurrency` |
| `expenses` (`Expenses`) | expenses | `tripId`, `expenses[]` (`typeId`, `typeName`, `amount`, `description`, `date`, `status`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`), `driverSalaries[]` |
| `monthlyexpenses` (`MonthlyExpenses`) | monthlyExpenses | `month`, `expenses[]` |
| `vehiclemaintenances` (`VehicleMaintenance`) | vehicleMaintain | `vehicle`, `garage`, `maintenanceDate`, `cost`, `maintenancePart`, `status`, `createdBy`, `updatedBy` |
| `vehicles` (`Vehicle`) | vehicle | `isFreelanceVehicle`, `isRentalVehicle`, `registrationNumber`, `status` |
| `users` (`User`) | user | `fullName`, `userName` (populate) |
| `garages` (`Garage`) | garage | `name` (populate) |

## 4. API Endpoints

Base: `/api/v1/report`. All endpoints allow **SUPERADMIN, ADMIN, TRIPMANAGER, FINANCEOFFICER**.

| Method | Full path | Controller | Description |
|---|---|---|---|
| GET | `/api/v1/report/monthlyTripReport?date=` | `monthlyTripReport` | Trips ending in month + expense summary. |
| GET | `/api/v1/report/monthlyExpensesReport?date=` | `monthlyExpensesReport` | All expense rows for month. |
| GET | `/api/v1/report/monthlyDriverSalary?date=` | `monthlyDriverSalary` | Driver salary rows for finished trips. |
| GET | `/api/v1/report/monthlyIncomeReport?date=` | `monthlyIncomeReport` | Per-trip income. |
| POST | `/api/v1/report/vehicleMonthlyPaymentMaintance` | `vehicleMonthlyPaymentMaintance` | Hired/freelance vehicle payment calc. |

Auth, envelope and error mapping: see `expenses.md` §4 "Common behaviour". All success responses use `message: ''` and HTTP 200.

### Month range used by the GET reports

`date` query param (any `Date`-parsable string). If omitted → `new Date()` (current server month). An unparsable value gives `Invalid Date`, so the range dates are invalid (query cast error → error middleware).

```ts
monthStart = new Date(date.getFullYear(), date.getMonth(), 1)       // local midnight, 1st
monthEnd   = new Date(date.getFullYear(), date.getMonth() + 1, 1)   // local midnight, 1st of next month
Trip.find({ endDate: { $gte: monthStart, $lt: monthEnd }, status: { $in } }).lean()
```

Trips are bucketed by **end date** (`report.service.ts:7-15`).

---

### 4.1 GET `/report/monthlyTripReport` (`report.controller.ts:20-77`)

1. Trips with `endDate` in month and status **PENDING (1), START (3), FINISHED (4)** (lean objects).
2. For each trip (sequential, one query per trip): `expensesService.findByTripIdAndStatusIn(trip._id, [ACTIVE])` (populates `tripId`). If a header exists:
   - keep only ACTIVE lines; `totalTripExpensesAmount = Σ amount`; `tripExpensesAmount = trip.estimatedExpense`; `remainingTripExpensesAmount = estimated − total`;
   - map with `expensesUtil.ExpensesModelToTripExpensesResponseDto`.
3. Attach as `trip.expenses = dto | null`.
4. **200**, `data` = array of **raw lean Trip documents** (all trip fields) each with an added `expenses` property (`TripExpensesResponseDto` — see `expenses.md`).

### 4.2 GET `/report/monthlyExpensesReport` (`report.controller.ts:80-125`)

1. Trips with `endDate` in month, status PENDING/START/FINISHED.
2. `findMonthlyExpensesByMonth(date)`: `MonthlyExpenses.findOne({ month: new Date(Date.UTC(y, m, 1)) })` (no status filter), populate `expenses.createdBy` (fullName, userName), lean; returns only lines with `status === ACTIVE` (or `[]`).
3. If trips exist: `findAllExpensesByTripIds(tripIds)` — `Expenses.find({ tripId: {$in} })` (no header status filter), populate `tripId` and `expenses.createdBy expenses.updatedBy` (fullName, userName), lean, then filter each header's lines to ACTIVE. Map with `expensesModelsToExpensesReportResponseDtos` (one row per line).
4. Append monthly-expense rows via `monthlyExpenseModelsToExpensesReportResponseDto`.
5. Append vehicle maintenance rows from `vehicleMaintenanceForMonthlyExpense(date)` (`:127-173`):
   - `VehicleMaintenance.find({ maintenanceDate in [monthStart, monthEnd), status ∈ [ACTIVE] }).populate('vehicle garage createdBy updatedBy').lean()`.
   - Skip if `vehicle == null`, `garage == null`, vehicle is **freelance**, or vehicle is **rental and `cost > 5000`**.
   - `typeName = 'Rental Vehicle Maintenance'` if rental else `'Company Vehicle Maintenance'`; `typeId = 0`; `description = "Vehicle : <reg>, Garage Name : <garage.name>, Maintenance Part : <part>"`; `amount = cost`; `date = maintenanceDate`.
6. **200**, `data: ExpensesReportResponseDto[]`.

**Row DTO** (`ExpensesReportResponseDto`):

| Field | Trip expense row | Monthly expense row | Vehicle maintenance row |
|---|---|---|---|
| `tripId` | `tripId._id` | `''` | `''` |
| `confirmationNumber` | `tripId.tripConfirmedNumber` | `''` | `''` |
| `expenseId` | line `_id` | line `_id` | maintenance `_id` (ObjectId, not string) |
| `typeId` | `typeId` | `expenseType` (stored as string) | `0` |
| `typeName` | `typeName` or `''` | `expenseTypeName` | see above |
| `amount` | `amount` or 0 | `amount` or 0 | `cost` |
| `description` | or `''` | or `''` | built string |
| `date` | `date` | `date` | `maintenanceDate` |
| `createdDate` / `updatedDate` | line `createdAt` / `updatedAt` | same | doc `createdAt` / `updatedAt` |
| `createdUser` / `updatedUser` | `"<userName> (<fullName>)"` | same (`updatedBy` **not populated** → `"undefined (undefined)"`) | same |

### 4.3 GET `/report/monthlyDriverSalary` (`report.controller.ts:177-203`)

1. Trips with `endDate` in month and status **FINISHED** only.
2. `findAllDriverSalaryByTripIds(tripIds)` (`report.service.ts:50-80`):
   ```ts
   Expenses.find({ tripId: { $in }, driverSalaries: { $ne: [] } })
     .populate({ path: 'driverSalaries',
                 populate: { path: '_id createdBy updatedBy driver', model: 'User', select: 'fullName userName' } })
     .populate('tripId')
     .select('tripId driverSalaries')
     .lean()
   ```
3. `driverModelsToDriverSalaryReportResponseDtos` → one row per `driverSalaries[]` entry.
4. **200**, `data: DriverSalaryReportResponseDto[]`.

**Row DTO**: `tripId`, `tripConfirmationNumber`, `driverId` (`driver._id`), `driverName` (`"<userName> (<fullName>)"`), `salaryPerDay`, `remainingExpenses`, `totalDeduction`, `totalAddition`, `totalSalary`, `noOfDays` (numbers default 0), `isRemainingToDriver` (default false), `createdDate`, `createdUser`, `updatedDate`, `updatedUser`.

### 4.4 GET `/report/monthlyIncomeReport` (`report.controller.ts:206-264`)

1. Trips with `endDate` in month and status **FINISHED or START**.
2. `findAllExpensesByTripIds(tripIds)` (ACTIVE lines only, `tripId` populated). Trips without an expense header produce **no row**.
3. For each header, `calculateIncome(expense)` (see §5) and push:

| Field | Value |
|---|---|
| `tripId` | `tripId._id` |
| `confirmationNumber` | `tripConfirmedNumber` |
| `startDate`, `endDate` | trip dates |
| `expenseId` | header `_id` |
| `totalCost` | `trip.totalCost` or 0 |
| `totalCostLocalCurrency` | `trip.totalCostLocalCurrency` or 0 |
| `totalIncomeLocalCurrency` | `calcTotals.totalIncomeLocalCurrency` → **always `undefined`** (omitted from JSON) |
| `estimatedExpense` | `trip.estimatedExpense` |
| `remainingExpenses` | `estimatedExpense − totalExpense` |
| `totalExpense` | Σ ACTIVE line amounts |
| `totalDriverSalary` | Σ `driverSalaries.totalSalary` (0 if none) |
| `isRemainingToDriver` | `true` if **any** driver salary has `isRemainingToDriver === true` |
| `tripIncome` | see formula |

4. **200**, `data` = rows.

### 4.5 POST `/report/vehicleMonthlyPaymentMaintance` (`report.controller.ts:307-340`)

**Body** (`vehicleMonthlyPaymentMaintanceSchema`, `report.validation.ts`):

| Field | Rule | Messages |
|---|---|---|
| `month` | string, required | `Month is required` / `Month is invalid` |
| `vehicle` | string, required (Vehicle id) | `Vehicle is required` / `Vehicle is invalid` |
| `rentalFor30Days` | number, required | `Rental For 30 Days is required` / `... is invalid` |
| `workedDaysCount` | number, required | `Worked Days Count is required` / `... is invalid` |

**Logic:**

1. Validate → **400** with Joi message.
2. `vehicleService.findByIdAndStatusIn(vehicle, [ACTIVE, INACTIVE])` (populates `createdBy updatedBy`) → none → **400** `Invalid vehicle!`.
3. If neither `isFreelanceVehicle` nor `isRentalVehicle` → **400** `This vehicle is not freelance or rental vehicle!`.
4. `selectedDate = new Date(month)`; `findVehicleMaintenanceByDateAndStatusInAndVehicle` — that vehicle's maintenance in that local month, ACTIVE, populated `vehicle garage createdBy updatedBy`, lean.
5. **200** with `vehiclePaymentReportResponse(...)` (`:342-371`):

```js
{ vehicleMaintenances,         // raw lean docs
  vehicle,                     // Vehicle doc
  rentalFor30Days, workedDaysCount,
  valuePerDay,                 // rentalFor30Days / 30
  totalVehicleMaintenance,     // Σ cost
  effectiveMaintenanceCost,    // see §5
  netTotal,                    // valuePerDay * workedDaysCount
  grossTotal,                  // netTotal − effectiveMaintenanceCost
  selectedDate }
```

## 5. Business Rules & Calculations

### Trip expense position (trip report)
`remainingTripExpensesAmount = trip.estimatedExpense − Σ active expense amounts`.

### Trip income (`calculateIncome`, `report.controller.ts:266-305`)

```ts
totalExpensesAmount = Σ amount (ACTIVE lines)
remainingExpenses   = trip.estimatedExpense − totalExpensesAmount
totalDriverSalary   = Σ driverSalaries[].totalSalary          // 0 if none
tripIncome          = (trip.totalCostLocalCurrency || 0) − totalDriverSalary − totalExpensesAmount
```

`totalSalary` already includes the float adjustment (see `expenses.md` §5).

### Which maintenance counts as a company expense (expenses report)

| Vehicle type | Included? |
|---|---|
| Company vehicle (neither flag) | Yes, any cost |
| Rental vehicle | Only if `cost <= 5000` |
| Freelance vehicle | Never |

The dashboard (`dashboard.controller.ts`) applies the same rule.

### Vehicle payment (hired/freelance vehicles)

```ts
valuePerDay = rentalFor30Days / 30
effectiveMaintenanceCost = Σ cost                     for freelance vehicles
                         = Σ cost where cost > 5000   for rental vehicles
netTotal   = valuePerDay × workedDaysCount
grossTotal = netTotal − effectiveMaintenanceCost      // payable to owner after maintenance offset
```

Maintenance the company paid that is the owner's responsibility (all of it for freelance, > 5000 for rental) is deducted from the owner's payment; rental repairs ≤ 5000 are absorbed by the company and appear in the monthly expenses report instead.

## 6. Utilities & DTOs

| Function | Location | Purpose |
|---|---|---|
| `expensesModelToExpensesReportResponseDto(header)` | `report.util.ts:4-29` | One row per line of a trip expense header. |
| `expensesModelsToExpensesReportResponseDtos(headers)` | `report.util.ts:57-70` | Flattens all headers. |
| `monthlyExpenseModelsToExpensesReportResponseDto(lines)` | `report.util.ts:31-54` | Rows for monthly overhead lines. |
| `driverModelToDriverSalaryReportResponseDto(header, salary)` | `report.util.ts:72-101` | One salary row. |
| `driverModelsToDriverSalaryReportResponseDtos(headers)` | `report.util.ts:103-121` | Flattens all salaries. |
| `vehicleMaintenanceForMonthlyExpense(date)` | `report.controller.ts:127-173` | Maintenance rows (§4.2). |
| `calculateIncome(expense)` | `report.controller.ts:266` | §5 (declared `async`, no awaits inside). |
| `vehiclePaymentReportResponse(...)` | `report.controller.ts:342` | §4.5. |

Service functions (`report.service.ts`): `findAllTripsByDateAndStatusIn`, `findAllExpensesByTripIds`, `findMonthlyExpensesByMonth`, `findAllDriverSalaryByTripIds`, `findVehicleMaintenanceByDateAndStatusIn`, `findVehicleMaintenanceByDateAndStatusInAndVehicle` — none cached.

`MonthlyIncomeReportResponseDto` declares: `tripId, confirmationNumber, startDate, endDate, expenseId, totalCost, totalCostLocalCurrency, estimatedExpense, remainingExpenses, totalExpense, totalDriverSalary, isRemainingToDriver, tripIncome` (the controller builds `data: any` and adds `totalIncomeLocalCurrency`).

## 7. Dependencies

**Reads:** `Trip` model, `Expenses` model + `expensesService.findByTripIdAndStatusIn` + `expensesUtil`, `MonthlyExpenses` model, `VehicleMaintenance` model, `vehicleService.findByIdAndStatusIn`, `User`/`Garage` via populate.

**Used by:** nothing in the backend imports this module (HTTP endpoints only).

## 8. Notes / Gotchas

1. **`totalIncomeLocalCurrency` is always undefined** — `calculateIncome` never sets it (`report.controller.ts:237-238`).
2. **Possible double count of overspend in income:** when expenses exceed `estimatedExpense`, each driver's `totalSalary` already includes `+|overspend|`; `tripIncome` then subtracts both `totalSalary` and the full `totalExpensesAmount`, so the overspend is deducted twice (and once more per extra driver). Under-spend cases net out correctly.
3. **`netTotal` / `grossTotal` naming is inverted**: `grossTotal` is the amount *after* deductions.
4. **Driver salary populate is questionable** (`report.service.ts:69-76`): it populates `driverSalaries` (an embedded array with no `ref`) with a nested populate of `'_id createdBy updatedBy driver'` as `User`. Whether Mongoose applies the nested populate here isn't determined by this code; if it doesn't, `driverName`/`createdUser`/`updatedUser` render as `"undefined (undefined)"`. Populating `_id` as a `User` makes no sense. Needs runtime verification.
5. **Month boundaries mix local and UTC**: trips/maintenance use local-time month ranges; monthly expenses are matched by exact equality with `Date.UTC(y, m, 1)`. This only works because month audit creates month docs with that exact UTC timestamp.
6. **Monthly expense `updatedBy` not populated** → `updatedUser` = `"undefined (undefined)"` for those rows.
7. **No status filter on expense headers** (`findAllExpensesByTripIds`) or on the month document (`findMonthlyExpensesByMonth`).
8. `monthlyTripReport` and `monthlyExpensesReport` include **PENDING** trips. Trips are selected by `endDate`, so a trip spanning two months appears only in its end month.
9. `monthlyTripReport` runs one expenses query per trip sequentially (N+1).
10. `monthlyIncomeReport` silently omits START/FINISHED trips that have no expense header.
11. Vehicle maintenance rows use `expenseId: ObjectId` (not stringified) and `typeId: 0`.
12. `vehicleMonthlyPaymentMaintance`: `month ? new Date(month) : new Date()` — the fallback is dead code since `month` is required; an unparsable `month` yields `Invalid Date` ranges. `auth` is read but unused. It's a POST for a read-only report.
13. Unused import `date` from `joi` (`report.controller.ts:17`).
14. User names are rendered as `"<userName> (<fullName>)"` with no null guard (missing user → `"undefined (undefined)"`); `expense.tripId._id` throws if a header's trip was deleted.
