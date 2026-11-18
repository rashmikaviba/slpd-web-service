# Month Audit module

Month-end close. The system has one "open" accounting month (`CompanyWorkingInfo`, see [common.md](common.md#companyworkinginfo--collection-companyworkinginfos)). `createNewMonth` stamps everything belonging to the closing month with `isMonthEndDone = true` + a `batchId`, closes the current working-info row, opens the next month, creates its `MonthlyExpenses` header and records a `MonthAudit` row. Read endpoints let SUPERADMIN review pending leaves and unsettled trips before closing. Shared plumbing: [README.md](README.md).

## Files

| File | Responsibility |
|---|---|
| `src/modules/monthAudit/monthAudit.route.ts` | Routes (`MonthAuditRouter`, mounted at `/api/v1/monthAudit`). |
| `src/modules/monthAudit/monthAudit.controller.ts` | `createNewDate` (+ private `monthEndDoneFor*` helpers), `getPendingLeaves`, `getWorkingInformation`, `getTripInfoForWorkingMonth`. |
| `src/modules/monthAudit/monthAudit.service.ts` | `save`, `generateBatchId`. |
| `src/modules/monthAudit/monthAudit.model.ts` | `MonthAudit` schema. |
| `src/modules/monthAudit/monthAudit.util.ts` | Working info → `WorkingInfoResponseDto`. |
| `src/modules/monthAudit/dto/workingInfoResponseDto.ts` | DTO interface. |
| `src/modules/monthAudit/monthAudit.validation.ts` | Joi `createNewMonthSchema` — **not exported nor used**. |

## Data model

### `MonthAudit` → collection `monthaudits`

`timestamps: true`, `versionKey: false`. No indexes/hooks.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `newWorkingDate` | Date | required | First day of the month being opened (`new Date(year, month-1, 1)`). |
| `status` | Number | required, default ACTIVE | |
| `batchId` | Number | default 0 | Sequential close number (= count of rows + 1 at close time). |
| `createdBy` / `updatedBy` | ObjectId | ref `User` | |

Other collections written by the close: `CompanyWorkingInfo` ([common](common.md)), `Leave` ([leave](leave.md)), `Trip`, `Expenses`, `Pos`, `InternalTrip`, `MonthlyExpenses`, `VehicleMaintenance` (owned by their modules; each has `isMonthEndDone: Boolean` and `batchId: Number`).

## Endpoints

| Method | Path | Roles allowed | Validation | Handler |
|---|---|---|---|---|
| POST | `/api/v1/monthAudit/createNewMonth` | SUPERADMIN | none (schema file unused) | `createNewDate` |
| GET | `/api/v1/monthAudit/pendingLeaves` | SUPERADMIN | none | `getPendingLeaves` |
| GET | `/api/v1/monthAudit/workingInfo` | any authenticated (`authorize([])`) | none | `getWorkingInformation` |
| GET | `/api/v1/monthAudit/pendingTrip` | SUPERADMIN | none | `getTripInfoForWorkingMonth` |

## Endpoint logic

Let `W` = active working info, `M = W.workingMonth` (1-based), `Y = W.workingYear`.

### POST `/monthAudit/createNewMonth` — `createNewDate` (`monthAudit.controller.ts:36`)

Body: `month` (1–12, the month to open), `year`. Not validated (the intended Joi schema would even require `month` to be a date).

1. `lastCompanyInfo = getCompanyWorkingInfo()` (cache key `companyWorkingInfo`, else latest ACTIVE row).
2. Start session + transaction.
3. `batchId = monthAuditService.generateBatchId()` = `MonthAudit.countDocuments() + 1` (outside the session).
4. `monthEndDoneForLeave(M, Y)`: `leaveService.findAllLeavesByMonthYearAndStatusIn(Y, M, [APPROVED, REJECTED, PENDING, CANCELLED])` → for each: `isMonthEndDone = true`, `updatedBy = auth.id`, `batchId`; `leaveService.save(leave, session)`; console log `MONTH_AUDIT | Leave Month End Done ...`. Because the service treats `month` as 0-based this selects leaves whose **startDate is in month M+1** (Known issues #1).
5. `monthEndDoneForTrip(M, Y)`: `tripService.findAllByEndMonthAndStatusIn(M, Y, [PENDING, START, FINISHED, CANCELED])` = trips with `endDate < first day of month M+1`, `isMonthEndDone: false` (all earlier unclosed trips, not only month M). For each trip:
   - set `isMonthEndDone`, `batchId`, `updatedBy`;
   - if `status == FINISHED`: `expensesService.findByTripIdAndStatusIn(trip._id, [ACTIVE])` → if found set the same three fields and `expensesService.save(…, session)` (clears `expenses-` cache); `posService.findByTripIdAndStatusIn(trip._id, [ACTIVE])` → if found same and `posService.save`;
   - `tripService.save(trip, session)`; console log.
   PENDING and START trips are also closed (no guard).
6. `monthEndDoneForInternalTrip(M, Y)`: `internalTripService.findAllByEndMonthAndStatusIn(M, Y, [ACTIVE, INACTIVE])` = internal trips with `createdAt < first day of M+1`, not yet closed (cached `internalTrip-…`) → set fields, `internalTripService.save(…, session)` (clears `internalTrip-`); log.
7. `monthEndDoneForMonthlyExpenses(M, Y)`: `monthlyExpensesService.findAllByEndMonthAndStatusIn(M, Y, [ACTIVE, INACTIVE])` = `MonthlyExpenses` with `month < 1st of M+1 23:59:59.999`, not closed (cached `monthlyExpenses-…`) → set fields, save (clears `monthlyExpenses-`); log.
8. `monthEndDoneForVehicleMaintenance(M, Y)`: `vehicleMaintenanceService.findAllByEndMonthAndStatusIn(M, Y, [ACTIVE])` = maintenance with `maintenanceDate < 1st of M+1 23:59:59.999`, not closed → set fields, save (clears `vehicleMaintenance-`); log.
9. If `lastCompanyInfo`: `status = DELETED`, `updatedBy = auth.id`, `batchId`; `companyWorkingInfoService.save(…, session)` (deletes cache key `companyWorkingInfo`); log.
10. New `CompanyWorkingInfo { workingYear: year, workingMonth: month, workingDate: new Date(year, month-1, 1), createdBy, updatedBy }` → save; log.
11. New `MonthlyExpenses { month: new Date(Date.UTC(year, month-1, 1)), monthName: month, year, expenses: [], totalExpenses: 0, status: ACTIVE, isMonthEndDone: false, batchId: 0, createdBy, updatedBy }` → `monthlyExpensesService.save` (clears `monthlyExpenses-`); log.
12. New `MonthAudit { newWorkingDate: new Date(year, month-1, 1), batchId, createdBy, updatedBy }` → `monthAuditService.save` → **clears every cache prefix**, then saves; log.
13. Commit. On any error: abort, rethrow (all writes above roll back).

Response 201, message `` `Month Audit successfully done and System date move to ${month}/${year}!` ``, `data` = saved `MonthAudit` document.

Logging: every step writes a `MONTH_AUDIT | …` info line with the request `correlationId` (from `accessLogMiddleware`). No `AuditLog` documents and no socket events are produced.

### GET `/monthAudit/pendingLeaves` — `getPendingLeaves` (`monthAudit.controller.ts:321`)

1. `W` missing → `BadRequestError('No active company information found!')`.
2. `findAllLeavesByMonthYearAndStatusIn(Y, M, [PENDING])` (again month M+1 — Known issues #1).
3. For each leave: `findByIdWithGenderRole(leave.appliedUser._id)`; the intended "ADMIN/TRIPMANAGER/FINANCEOFFICER" test is written with the comma operator, so it is true **only for FINANCEOFFICER** (Known issues #2); for those, `leave.availableLeaveCount = user.leaveCount - getTotalLeaveDaysFromYear(user._id, Y)`.
4. Map with `leaveUtil.leaveModelToLeaveResponseDtos`.

Response 200, `LeaveResponseDto[]` (see [leave.md](leave.md#utilities--dtos)).

### GET `/monthAudit/workingInfo` — `getWorkingInformation` (`monthAudit.controller.ts:373`)

`W` missing → `BadRequestError('No active company information found!')`; else 200 with `{ workingMonth, workingYear, workingDate }`.

### GET `/monthAudit/pendingTrip` — `getTripInfoForWorkingMonth` (`monthAudit.controller.ts:393`)

Lists trips that still block a clean month-end (driver salaries not fully recorded).

1. `W` missing → `BadRequestError('No active company information found!')`.
2. `tripService.findAllByEndMonthAndStatusIn(M, Y, [PENDING, START, FINISHED])` (endDate before 1st of M+1, not closed; populates `drivers.driver`, `vehicles.vehicle`, users).
3. In parallel per trip: `isDriverSalaryDone = false`; for START/FINISHED trips load the ACTIVE `Expenses` header; if it exists and the trip has drivers, `isDriverSalaryDone = every trip.drivers[i].driver._id ∈ expense.driverSalaries[].driver`.
4. Keep trips with `isDriverSalaryDone == false` (all PENDING trips, all trips without expenses, partially paid trips).
5. Map with `tripUtil.tripModelArrToTripResponseDtoGetAlls` (see trip docs).

Response 200, `TripResponseDtoGetAll[]` or `[]`.

## Service layer

| Function | Behaviour |
|---|---|
| `monthAuditService.save(doc, session)` | `clearCacheByPrefixs(<all CACHE.PREFIX values>)` then `doc.save({session})` / `save()`. |
| `monthAuditService.generateBatchId()` | `MonthAudit.countDocuments() + 1`. |

External services called: `companyWorkingInfoService.getCompanyWorkingInfo/save`, `leaveService.findAllLeavesByMonthYearAndStatusIn/save/getTotalLeaveDaysFromYear`, `userService.findByIdWithGenderRole`, `tripService.findAllByEndMonthAndStatusIn/save`, `expensesService.findByTripIdAndStatusIn/save`, `posService.findByTripIdAndStatusIn/save`, `internalTripService.findAllByEndMonthAndStatusIn/save`, `monthlyExpensesService.findAllByEndMonthAndStatusIn/save`, `vehicleMaintenanceService.findAllByEndMonthAndStatusIn/save`.

## Utilities / DTOs

- `companyWorkingInfoToWorkingInfoResponseDto(info)` → `{ workingMonth, workingYear, workingDate }`.
- `WorkingInfoResponseDto { workingMonth: number; workingYear: number; workingDate: Date }`.

## Business rules

- Exactly one ACTIVE `CompanyWorkingInfo`; closing sets it DELETED and creates the next. The working month is what login returns and what other modules (vehicle maintenance, dashboard, leave eligibility) use as "current month".
- Closing stamps `isMonthEndDone = true` + `batchId` on: trips (all statuses except REACHED) ending before next month, plus their ACTIVE expense header and POS record when FINISHED; internal trips created before next month; monthly expenses before next month; ACTIVE vehicle maintenance before next month; leaves (see issue #1).
- Downstream effect: trip/expenses controllers refuse changes when `isMonthEndDone` (`trip.controller.ts:843,871,952,980,1440`, `expenses.controller.ts:53,131,191`). Leave endpoints do not check it.
- `batchId` = sequential number of the close; the same id is written on every touched document, enabling traceability (no undo endpoint exists).
- The pre-close checks (`pendingLeaves`, `pendingTrip`) are advisory; `createNewMonth` does not block on them.
- All close writes are in a single transaction (requires a replica set).

## Cross-module dependencies

- Writes: `companyworkinginfos`, `monthaudits`, `monthlyexpenses` (new header + close), `leaves`, `trips`, `expenses`, `pos`, `internaltrips`, `vehiclemaintenances`.
- Reads: users (applicant role/leaveCount), expenses (`driverSalaries`).
- Cache: clears `companyWorkingInfo`, `expenses-`, `internalTrip-`, `monthlyExpenses-`, `vehicleMaintenance-`, and finally every prefix.
- Callers: front-end only (SUPERADMIN month-audit screen); `workingInfo` for all roles.

## Known issues / notes

1. **Leave month off-by-one**: `workingMonth` is 1-based (`createNewDate` stores `month` and uses `new Date(year, month-1, 1)`), but `leaveService.findAllLeavesByMonthYearAndStatusIn` builds `new Date(year, month, 1)`..`new Date(year, month+1, 0)` (0-based). Month-end therefore stamps leaves that **start in the following month**, and `pendingLeaves` shows next month's pending leaves (`leave.service.ts:199-200`, `monthAudit.controller.ts:171,334`). Leaves are also selected by `startDate` only and not filtered by `isMonthEndDone`.
2. **Comma operator in role check**: `(a == ADMIN || a == TRIPMANAGER, a == FINANCEOFFICER)` evaluates to the last operand only, so `availableLeaveCount` is computed only for FINANCEOFFICER (`monthAudit.controller.ts:348-354`).
3. **Null working info crash**: `lastCompanyInfo.workingMonth` is dereferenced at line 53 before the `if (lastCompanyInfo)` guard at line 97, so with no active working info the close fails with `TypeError` (500) instead of creating the first month (`monthAudit.controller.ts:52-97`).
4. No input validation: `monthAudit.validation.ts` is never exported/imported (and types `month` as a date). Nothing prevents re-opening the same month, skipping months, going backwards or sending month 13 (`monthAudit.controller.ts:38`).
5. `generateBatchId` counts outside the session; two concurrent closes get the same `batchId` (`monthAudit.service.ts:16-19`). There is no lock against concurrent closes.
6. Pre-close checks are not enforced: PENDING/START trips and PENDING leaves are closed silently (`monthAudit.controller.ts:275-280,174-179`).
7. `lastCompanyInfo` is usually the node-cache clone of a populated document; `.save()` is called on that clone (`monthAudit.controller.ts:41,101`).
8. Caches are cleared before commit (`monthAuditService.save`, other services' `save`), so concurrent requests can re-cache pre-commit data. The `find*` reads inside the close do not use the session.
9. **`pendingTrip` always reports trips with drivers as unpaid**: `tripService.findAllByEndMonthAndStatusIn` populates `drivers.driver` with `match: { 'drivers.isActive': true }`, a condition evaluated against `User` documents that have no such field, so every populated driver is `null`; `paidDriverIds.has(undefined)` is false (`trip.service.ts:137-141`, `monthAudit.controller.ts:428-430`). Also the `every` check includes inactive driver entries.
10. `findAllByEndMonthAndStatusIn` in trip/internalTrip/monthlyExpenses/vehicleMaintenance services compute the cut-off with `new Date(); setFullYear(Y); setMonth(M)` — on the 29th–31st, `setMonth` can overflow into the following month and push the cut-off one month too far (`trip.service.ts:126-129` and equivalents). The monthlyExpenses/vehicleMaintenance variants also add `23:59:59.999`, including records on the 1st of the next month.
11. Unused imports: `assert`, `TripPlaceResponseDto`, `auth` in `getPendingLeaves`/`getWorkingInformation` (`monthAudit.controller.ts:21,28,322,374`). The handler is named `createNewDate` while the route is `createNewMonth`.
12. `MonthlyExpenses.month` uses `Date.UTC` while `workingDate`/`newWorkingDate` use local time — dates differ by the server's UTC offset (`monthAudit.controller.ts:109,119,136`).
