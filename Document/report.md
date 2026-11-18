# Report

Monthly, read-only reports for finance/operations: full trip report with expense summary, flat expense ledger (trip expenses + company monthly expenses + company-borne vehicle maintenance), driver salary ledger, per-trip income (profit) report, and a payment/maintenance-deduction calculator for freelance/rental vehicles. Every report is scoped to one calendar month derived from a supplied date. No writes. Shared concepts (auth middleware, `CommonResponse`, error middleware, roles, enums) are in [README.md](README.md).

## Files

| File | Responsibility |
|---|---|
| `src/modules/report/report.route.ts` | Registers 4 GET + 1 POST route. |
| `src/modules/report/report.controller.ts` | Handlers, `vehicleMaintenanceForMonthlyExpense`, `calculateIncome`, `vehiclePaymentReportResponse`. |
| `src/modules/report/report.service.ts` | Month-scoped Mongoose queries on Trip, Expenses, MonthlyExpenses, VehicleMaintenance. |
| `src/modules/report/report.util.ts` | Expense / monthly expense / driver salary → report DTO mappers. |
| `src/modules/report/report.validation.ts` | Joi `vehicleMonthlyPaymentMaintanceSchema`. |
| `src/modules/report/dto/expensesReportResponseDto.ts` | Expense ledger row. |
| `src/modules/report/dto/driverSalaryReportResponseDto.ts` | Driver salary row. |
| `src/modules/report/dto/monthlyIncomeReportResponseDto.ts` | Income report row. |

## Endpoints

Base path: `/api/v1/report` (`applicationRoutes.report`).

| Method | Path | Roles allowed | Validation schema | Handler |
|---|---|---|---|---|
| GET | `/api/v1/report/monthlyTripReport` | SUPERADMIN, ADMIN, TRIPMANAGER, FINANCEOFFICER | none | `monthlyTripReport` |
| GET | `/api/v1/report/monthlyExpensesReport` | SUPERADMIN, ADMIN, FINANCEOFFICER, TRIPMANAGER | none | `monthlyExpensesReport` |
| GET | `/api/v1/report/monthlyDriverSalary` | SUPERADMIN, ADMIN, FINANCEOFFICER, TRIPMANAGER | none | `monthlyDriverSalary` |
| GET | `/api/v1/report/monthlyIncomeReport` | SUPERADMIN, ADMIN, FINANCEOFFICER, TRIPMANAGER | none | `monthlyIncomeReport` |
| POST | `/api/v1/report/vehicleMonthlyPaymentMaintance` | SUPERADMIN, ADMIN, FINANCEOFFICER, TRIPMANAGER | `reportValidation.vehicleMonthlyPaymentMaintanceSchema` | `vehicleMonthlyPaymentMaintance` |

Role ids: SUPERADMIN 1, ADMIN 2, FINANCEOFFICER 4, TRIPMANAGER 5. DRIVER and assistants are rejected with 403.

## Month resolution (all endpoints)

`selectedDate = date ? new Date(date) : new Date()` (for the POST: `month` instead of `date`). The month window is then built from `selectedDate.getFullYear()/getMonth()` in **server local time**:
- Trips / maintenance: `[new Date(y, m, 1), new Date(y, m+1, 1))` (start inclusive, next-month start exclusive).
- Monthly expenses: exact match `month = new Date(Date.UTC(y, m, 1))` (matches how month audit creates the doc, `monthAudit.controller.ts:119`).

An invalid `date` string produces `Invalid Date` → Mongoose CastError → 404 `No item found with ID "Invalid Date"!` via the error middleware (no 400).

## Endpoint logic

### GET `/monthlyTripReport` — `monthlyTripReport` (report.controller.ts:20)

Query: `date` (optional, any `Date`-parsable string; default now).

1. `trips = reportService.findAllTripsByDateAndStatusIn(selectedDate, [PENDING(1), START(3), FINISHED(4)])` → lean `Trip.find({ endDate: {$gte: monthStart, $lt: nextMonthStart}, status: {$in} })`. No populate (drivers/vehicles/createdBy remain ObjectIds). CANCELED (2) and REACHED (5) excluded.
2. For each trip (sequential, one query per trip):
   1. `expense = expensesService.findByTripIdAndStatusIn(trip._id, [ACTIVE])` → `Expenses.findOne({tripId, status:{$in:[1]}}).populate('tripId')` (Mongoose doc, not lean).
   2. If found:
      - `activeExpenses = expense.expenses.filter(status === ACTIVE)`
      - `totalExpensesAmount = Σ activeExpenses.amount`
      - `expense.expenses = activeExpenses`
      - `expense.tripExpensesAmount = expense.tripId.estimatedExpense`
      - `expense.totalTripExpensesAmount = totalExpensesAmount`
      - `expense.remainingTripExpensesAmount = tripExpensesAmount − totalExpensesAmount`
      - `response = expensesUtil.ExpensesModelToTripExpensesResponseDto(expense)`
   3. `trip.expenses = response` (or `null` when no Expenses doc).
3. `CommonResponse(res, true, 200, '', trips)`.

Response `data`: array of raw lean Trip documents (all schema fields: dates, `tripConfirmedNumber`, costs, passengers, flight/pickup/dropoff info, activities, places, hotels, contact, `drivers[]`, `vehicles[]`, `checkListAnswers`, `status`, audit fields, `isMonthEndDone`, `batchId`, timestamps) plus `expenses`:

| `expenses` field | Value |
|---|---|
| `_id` | Expenses doc id |
| `tripId` | trip id |
| `expenses` | ACTIVE line items `{_id, typeId, typeName, amount, description, date, receiptUrl, status, createdBy, updatedBy, createdAt, updatedAt}` (users not populated) |
| `driverSalaries` | raw `driverSalaries[]` (not populated) |
| `isMonthEndDone` | from Expenses doc |
| `tripExpensesAmount` | `trip.estimatedExpense` |
| `totalTripExpensesAmount` | Σ ACTIVE item amounts |
| `remainingTripExpensesAmount` | `estimatedExpense − totalTripExpensesAmount` |

### GET `/monthlyExpensesReport` — `monthlyExpensesReport` (report.controller.ts:80)

Query: `date` (optional).

1. `trips = findAllTripsByDateAndStatusIn(selectedDate, [PENDING, START, FINISHED])` (as above).
2. `monthlyExpenses = reportService.findMonthlyExpensesByMonth(selectedDate) || []` → ACTIVE items of the MonthlyExpenses doc for that month.
3. If trips exist: `expensesData = reportService.findAllExpensesByTripIds(tripIds)`; `response = reportUtil.expensesModelsToExpensesReportResponseDtos(expensesData)` (one row per ACTIVE trip expense item).
4. If monthly expenses exist: append `reportUtil.monthlyExpenseModelsToExpensesReportResponseDto(monthlyExpenses)`.
5. Append `vehicleMaintenanceForMonthlyExpense(selectedDate)` (report.controller.ts:127):
   - `reportService.findVehicleMaintenanceByDateAndStatusIn(selectedDate, [ACTIVE])` (maintenanceDate in month, populated `vehicle garage createdBy updatedBy`).
   - For each record skip if `vehicle == null`, `garage == null`, `vehicle.isFreelanceVehicle`, or `vehicle.isRentalVehicle && cost > 5000`.
   - Row: `{ tripId: "", confirmationNumber: "", expenseId: maintenance._id, typeId: 0, typeName: "Rental Vehicle Maintenance" if rental else "Company Vehicle Maintenance", description: "Vehicle : <registrationNumber>, Garage Name : <garage.name>, Maintenance Part : <maintenancePart>", amount: cost, date: maintenanceDate, createdDate: createdAt, createdUser: "<userName> (<fullName>)", updatedDate: updatedAt, updatedUser: "<userName> (<fullName>)" }`.
6. `CommonResponse(res, true, 200, '', response)`.

Response `data`: `ExpensesReportResponseDto[]` in order: trip expense rows, monthly expense rows, maintenance rows. No sorting, no totals.

### GET `/monthlyDriverSalary` — `monthlyDriverSalary` (report.controller.ts:177)

Query: `date` (optional).

1. `trips = findAllTripsByDateAndStatusIn(selectedDate, [FINISHED])`.
2. If trips exist: `driverSalaries = reportService.findAllDriverSalaryByTripIds(tripIds)` → Expenses docs with non-empty `driverSalaries`; `response = reportUtil.driverModelsToDriverSalaryReportResponseDtos(driverSalaries)` (one row per salary entry).
3. `CommonResponse(res, true, 200, '', response)`.

Response `data`: `DriverSalaryReportResponseDto[]`.

### GET `/monthlyIncomeReport` — `monthlyIncomeReport` (report.controller.ts:206)

Query: `date` (optional).

1. `trips = findAllTripsByDateAndStatusIn(selectedDate, [FINISHED(4), START(3)])`.
2. If trips exist: `expenses = reportService.findAllExpensesByTripIds(tripIds)` (items already filtered to ACTIVE, `tripId` populated).
3. For each Expenses doc (trips with no Expenses doc are **not** in the report): `calcTotals = calculateIncome(expense)`, then push row:

| Field | Value |
|---|---|
| `tripId` | `expense.tripId._id` |
| `confirmationNumber` | `tripId.tripConfirmedNumber` |
| `startDate`, `endDate` | trip dates |
| `expenseId` | Expenses doc `_id` |
| `totalCost` | `tripId.totalCost \|\| 0` (foreign currency) |
| `totalCostLocalCurrency` | `tripId.totalCostLocalCurrency \|\| 0` |
| `totalIncomeLocalCurrency` | `calcTotals.totalIncomeLocalCurrency` — always `undefined`, omitted from JSON (see Known issues) |
| `estimatedExpense` | `tripId.estimatedExpense` |
| `remainingExpenses` | `calcTotals.remainingExpenses` |
| `totalExpense` | `calcTotals.totalExpensesAmount` |
| `totalDriverSalary` | `calcTotals.totalDriverSalary` |
| `isRemainingToDriver` | `true` if any `driverSalaries[].isRemainingToDriver === true` |
| `tripIncome` | `calcTotals.totalIncome` |

4. `CommonResponse(res, true, 200, '', response)`.

### POST `/vehicleMonthlyPaymentMaintance` — `vehicleMonthlyPaymentMaintance` (report.controller.ts:307)

Body (Joi `vehicleMonthlyPaymentMaintanceSchema`, all required):

| Field | Rule | Messages |
|---|---|---|
| `month` | string | `Month is required` / `Month is invalid` |
| `vehicle` | string (vehicle `_id`) | `Vehicle is required` / `Vehicle is invalid` |
| `rentalFor30Days` | number | `Rental For 30 Days is required` / `Rental For 30 Days is invalid` |
| `workedDaysCount` | number | `Worked Days Count is required` / `Worked Days Count is invalid` |

Unknown keys are rejected by Joi default (`"<key>" is not allowed`).

1. Validate; on error `throw new BadRequestError(error.message)` (400).
2. `vehicleData = vehicleService.findByIdAndStatusIn(vehicle, [ACTIVE, INACTIVE])` → `Vehicle.findOne({_id, status:{$in}}).populate('createdBy updatedBy')`. None → `BadRequestError('Invalid vehicle!')`. A malformed ObjectId → CastError → 404 `No item found with ID "<id>"!`.
3. If `!isFreelanceVehicle && !isRentalVehicle` → `BadRequestError('This vehicle is not freelance or rental vehicle!')`.
4. `selectedDate = new Date(month)`; `vehicleMaintenanceData = reportService.findVehicleMaintenanceByDateAndStatusInAndVehicle(selectedDate, [ACTIVE], vehicle)`.
5. `CommonResponse(res, true, 200, '', vehiclePaymentReportResponse(...))`.

Response `data` (`vehiclePaymentReportResponse`, report.controller.ts:342):

| Field | Value |
|---|---|
| `vehicleMaintenances` | lean maintenance docs for the vehicle/month, with populated `vehicle`, `garage`, `createdBy`, `updatedBy` (full docs) |
| `vehicle` | the vehicle document (populated `createdBy`, `updatedBy`) |
| `rentalFor30Days` | echo |
| `workedDaysCount` | echo |
| `valuePerDay` | `rentalFor30Days / 30` |
| `totalVehicleMaintenance` | Σ `cost` of all records |
| `effectiveMaintenanceCost` | freelance: Σ all `cost`; rental: Σ `cost` of records with `cost > 5000` |
| `netTotal` | `valuePerDay × workedDaysCount` |
| `grossTotal` | `valuePerDay × workedDaysCount − effectiveMaintenanceCost` (amount payable to owner) |
| `selectedDate` | the parsed `month` date |

## Service layer (report.service.ts)

| Function | Query |
|---|---|
| `findAllTripsByDateAndStatusIn(date, status)` (:7) | `Trip.find({ endDate: {$gte: new Date(y,m,1), $lt: new Date(y,m+1,1)}, status: {$in: status} }).lean()` |
| `findAllExpensesByTripIds(tripIds)` (:17) | `Expenses.find({ tripId: {$in} })` (no doc-status filter), populate `tripId`, populate `expenses.createdBy expenses.updatedBy` (User, `fullName userName`), lean; then in JS keeps only `expenses[]` items with `status === ACTIVE` |
| `findMonthlyExpensesByMonth(date)` (:36) | `MonthlyExpenses.findOne({ month: new Date(Date.UTC(y,m,1)) })` (no status filter), populate `expenses.createdBy` (User, `fullName userName`), lean; returns ACTIVE `expenses[]` items or `[]` |
| `findAllDriverSalaryByTripIds(tripIds)` (:50) | `Expenses.find({ tripId: {$in}, driverSalaries: {$ne: []} })`, populate `{ path: 'driverSalaries', populate: { path: '_id createdBy updatedBy driver', model: 'User', select: 'fullName userName' } }`, populate `tripId`, select `tripId driverSalaries`, lean |
| `findVehicleMaintenanceByDateAndStatusIn(date, status)` (:82) | `VehicleMaintenance.find({ maintenanceDate: {$gte: monthStart, $lt: nextMonthStart}, status: {$in} })`, populate `vehicle garage createdBy updatedBy`, lean |
| `findVehicleMaintenanceByDateAndStatusInAndVehicle(date, status, vehicleId)` (:92) | same plus `vehicle: vehicleId` |

None of these are cached. This module reads/writes no cache keys.

## Utilities / DTOs (report.util.ts)

| Function | Input → Output |
|---|---|
| `expensesModelToExpensesReportResponseDto(expense)` (:4) | One Expenses doc → one row per `expenses[]` item: `{ tripId: expense.tripId._id.toString(), confirmationNumber: tripId.tripConfirmedNumber, expenseId: item._id.toString(), typeId: item.typeId, typeName: item.typeName \|\| '', amount: item.amount \|\| 0, description: item.description \|\| '', date: item.date, createdDate: item.createdAt, createdUser: "<createdBy.userName> (<createdBy.fullName>)", updatedDate: item.updatedAt, updatedUser: "<updatedBy.userName> (<updatedBy.fullName>)" }`. Falsy `expense` → `[]`. |
| `expensesModelsToExpensesReportResponseDtos(expenses)` (:57) | concatenation of the above over all docs |
| `monthlyExpenseModelsToExpensesReportResponseDto(items)` (:31) | Monthly expense items → `{ tripId: '', confirmationNumber: '', expenseId: item._id.toString(), typeId: item.expenseType (a string in the schema), typeName: item.expenseTypeName \|\| '', amount \|\| 0, description \|\| '', date, createdDate: createdAt, createdUser: "<userName> (<fullName>)", updatedDate: updatedAt, updatedUser: "<userName> (<fullName>)" }` |
| `driverModelToDriverSalaryReportResponseDto(doc, salary)` (:72) | `{ tripId: doc.tripId._id.toString(), tripConfirmationNumber: doc.tripId.tripConfirmedNumber, driverId: salary.driver._id.toString() \|\| '', driverName: "<driver.userName> (<driver.fullName>)", salaryPerDay, remainingExpenses, totalDeduction, totalAddition, totalSalary, noOfDays (each \|\| 0), isRemainingToDriver \|\| false, createdDate: salary.createdAt, createdUser, updatedDate: salary.updatedAt, updatedUser }`. Falsy `doc` → empty null-prototype object. |
| `driverModelsToDriverSalaryReportResponseDtos(docs)` (:103) | one row per `driverSalaries[]` entry across all docs |

DTO interfaces:
- `ExpensesReportResponseDto`: `tripId, confirmationNumber, expenseId, typeId:number, typeName, amount, description, date, createdDate, createdUser, updatedDate, updatedUser`.
- `DriverSalaryReportResponseDto`: `tripId, tripConfirmationNumber, driverId, driverName, salaryPerDay, remainingExpenses, totalDeduction, totalAddition, totalSalary, noOfDays, isRemainingToDriver, createdDate, createdUser, updatedDate, updatedUser`.
- `MonthlyIncomeReportResponseDto`: `tripId, confirmationNumber, startDate, endDate, expenseId, totalCost, totalCostLocalCurrency, estimatedExpense, remainingExpenses, totalExpense, totalDriverSalary, isRemainingToDriver, tripIncome` (the controller row is typed `any` and additionally carries `totalIncomeLocalCurrency`).

## Business rules / formulas

- **Month membership**: trips by `endDate`; maintenance by `maintenanceDate`; company expenses by the MonthlyExpenses doc whose `month` is the UTC first-of-month. Trip expense items are included by their trip's month, not by their own `date`.
- **Statuses per report**: trip report & expense report: PENDING, START, FINISHED. Driver salary: FINISHED only. Income: START and FINISHED. Expense items: ACTIVE only. Maintenance: ACTIVE only.
- **`calculateIncome(expense)`** (report.controller.ts:266):
  - `totalExpensesAmount = Σ amount` of ACTIVE `expenses[]`
  - `remainingExpenses = trip.estimatedExpense − totalExpensesAmount`
  - `totalDriverSalary = Σ driverSalaries[].totalSalary` (0 when none)
  - `tripIncome = (trip.totalCostLocalCurrency || 0) − totalDriverSalary − totalExpensesAmount`
- **Trip report**: `remainingTripExpensesAmount = estimatedExpense − Σ ACTIVE expense amounts`.
- **Company-borne maintenance** (expense report; same rule as dashboard): include company vehicles; include rental vehicles only if `cost ≤ 5000`; never freelance; also skip if vehicle or garage populate is null.
- **Freelance/rental payment**: `valuePerDay = rentalFor30Days / 30` (always 30, regardless of month length); `payable (grossTotal) = valuePerDay × workedDaysCount − deductions`, deductions = all maintenance for freelance vehicles, maintenance items `> 5000` for rental vehicles.

## Cross-module dependencies

- trip: `Trip` model (direct).
- expenses: `Expenses` model (direct), `expensesService.findByTripIdAndStatusIn`, `expensesUtil.ExpensesModelToTripExpensesResponseDto`, `TripExpensesResponseDto`.
- monthlyExpenses: `MonthlyExpenses` model (direct); doc `month` written by monthAudit as `Date.UTC(y, m-1, 1)`.
- vehicleMaintain: `VehicleMaintenance` model (direct).
- vehicle: `vehicleService.findByIdAndStatusIn`; fields `isFreelanceVehicle`, `isRentalVehicle`, `registrationNumber`.
- garage: populated `garage.name`.
- user: populated `fullName`, `userName`.

## Known issues / notes

1. `report.controller.ts:238` — `totalIncomeLocalCurrency: calcTotals.totalIncomeLocalCurrency`; `calculateIncome` never returns that key, so the field is always `undefined` and missing from the JSON. `tripIncome` holds the real value.
2. `report.service.ts:39-45` + `report.util.ts:48` — monthly expenses populate only `expenses.createdBy`, so `updatedUser` for company-expense rows is always `"undefined (undefined)"`.
3. `report.controller.ts:365-366` — naming inverted: `netTotal` is the amount before maintenance deductions and `grossTotal` is after. Clients must not rely on the usual meaning.
4. `report.util.ts:21,23,47,84,94,96` and `report.controller.ts:162,164` — template strings produce `"undefined (undefined)"` when a user is not populated; the `|| ''` at `report.util.ts:84` never applies (a template literal is always truthy).
5. `report.util.ts:12,80` — `expense.tripId._id.toString()` throws `TypeError` (→ 500) if the referenced trip no longer exists (populate returns `null`).
6. `report.service.ts:69-76` — nested populate on `driverSalaries` (an embedded array, not a ref) with `'_id createdBy updatedBy driver'` against `User`. Populating `_id` with User is meaningless; verify against Mongoose 8 that `driver`/`createdBy`/`updatedBy` actually populate, otherwise `driverName`/`createdUser` print `undefined`.
7. `report.service.ts:18` / `:39` — no document-level `status` filter on `Expenses` / `MonthlyExpenses` (dashboard filters `Expenses.status = ACTIVE`). Currently harmless because only line items get `DELETED` (`expenses.controller.ts:204`), but the two modules can diverge.
8. `report.controller.ts:37-41` — trip report does one `Expenses.findOne` per trip (N+1).
9. `report.controller.ts:223-257` — income report omits trips that have no Expenses document; driver-salary report excludes START trips while income report includes them.
10. `report.controller.ts:294` — `exp.totalSalary` summed without `|| 0`; one missing value makes `totalDriverSalary`/`tripIncome` `NaN`.
11. `report.controller.ts:24,84,181,210,332` — no validation of `date`/`month`; month bounds use server local time on a value parsed as UTC (`new Date('YYYY-MM')` = UTC midnight), so a server in a negative-offset TZ would select the previous month.
12. `report.controller.ts:342-371` — response returns full populated vehicle and maintenance documents (whole `User` docs for `createdBy`/`updatedBy`, no `select`). Passwords live in `Auth`, not `User`, but the payload is larger than needed.
13. `report.controller.ts:17` — unused `import { date } from 'joi'`; every handler wraps in `try { } catch (e) { throw e }` (no-op). POST is used for a read-only report.
14. `WellKnownTripStatus.REACHED (5)` is never included in any report (the enum value is not referenced anywhere in `src`).
