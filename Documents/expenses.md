# Expenses Module (`src/modules/expenses`)

## 1. Overview

The Expenses module records **on-trip expenses** (fuel, meals, tolls, parking, etc.) that drivers and office staff log against a tour **Trip**, and the **driver salary settlement** for each driver on that trip once the trip is finished.

Business flow:

1. When a trip is moved to **START**, the trip module creates an empty "expense header" document for the trip (`src/modules/trip/trip.controller.ts:793-803`). The header is also lazily created by this module on the first expense save if it doesn't exist yet.
2. While the trip is running, drivers (and admins / trip managers) add, edit and soft-delete individual expense lines. The trip's `estimatedExpense` is the cash float/budget given to the driver; the module reports how much of it is used and how much remains.
3. After the trip is **FINISHED**, an admin / trip manager records each driver's salary (per-day rate × days, plus additions, minus deductions, adjusted for unspent or overspent float).
4. At **month end** (`monthAudit` module), the header is flagged `isMonthEndDone = true`, which locks further expense add/update/delete.

There is exactly one header document per trip (one `Expenses` doc keyed by `tripId`) with embedded arrays of expense lines and driver salaries.

## 2. Files

| File | Role |
|---|---|
| `expenses.model.ts` | Mongoose schema/model `Expenses` (header + embedded `expenses[]` and `driverSalaries[]`). |
| `expenses.route.ts` | Express router: binds 6 endpoints to controllers with role-based `authorize`. |
| `expenses.controller.ts` | Request handlers + local salary calculation helpers (`calculateDriverSalary`, `calcRemainingExpenses`). |
| `expenses.service.ts` | DB access: save, hard delete by trip, find by trip, find by many trips (cached), batched lookups for report/month-end, bulk month-end flag, `applyDriverSalaryDone` for trip lists. |
| `expenses.validation.ts` | Joi schemas: `saveExpenseSchema`, `updateExpenseSchema`, `saveDriverSalarySchema`. |
| `expenses.util.ts` | `sumActiveExpenses`, `expenseWithTotalsToResponseDto` (filter + totals + map) and the mapper `ExpensesModelToTripExpensesResponseDto`. |
| `dto/tripExpensesResponseDto.ts` | Response DTO interface for the trip expense view. |

## 3. Data Model

### Collection `expenses` (model name `Expenses`) — `src/modules/expenses/expenses.model.ts`

Schema options: `timestamps: true` (adds `createdAt`, `updatedAt`), `versionKey: false`. No hooks, no virtuals.

**Indexes** (`expenses.model.ts:221-222`): compound non-unique `{ tripId: 1, status: 1 }` — backs every service filter (`tripId` [+ `$in`] + `status $in`). There is still no **unique** index on `tripId`; one header per trip is only by convention.

| Field | Type | Required / Default | Ref | Notes |
|---|---|---|---|---|
| `tripId` | ObjectId | required (`'Trip is required'`) | `Trip` | One header per trip (not enforced). |
| `expenses` | Array of sub-docs (see below) | — | — | Expense lines. |
| `isMonthEndDone` | Boolean | default `false` | — | Set to `true` by month-end audit; locks add/update/delete. |
| `batchId` | Number | default `0` | — | Month-audit batch number that closed this header. |
| `driverSalaries` | Array of sub-docs (see below) | — | — | One entry per driver. |
| `status` | Number | default `WellKnownStatus.ACTIVE` (1) | — | `WellKnownStatus`: 1 ACTIVE, 2 INACTIVE, 3 DELETED. Never changed by this module. |
| `createdBy` | ObjectId | — | `User` | |
| `updatedBy` | ObjectId | — | `User` | |
| `createdAt` / `updatedAt` | Date | auto (timestamps) | — | |

A commented-out single `driverSalary` object (`expenses.model.ts:86-137`) is the legacy design replaced by `driverSalaries[]`.

#### Embedded `expenses[]` line (`expenses.model.ts:15-73`)

Each line gets its own `_id`.

| Field | Type | Required / Default | Ref | Notes |
|---|---|---|---|---|
| `typeId` | Number | required (`'Type is required'`) | — | Expense type code. Types are not defined server-side (client-defined list). |
| `typeName` | String | — | — | Display name of the type. |
| `amount` | Number | required (`'Amount is required'`) | — | |
| `description` | String | maxlength 500 | — | |
| `date` | Date | required (`'Date is required'`) | — | Date the expense occurred. |
| `receiptUrl` | String | — | — | URL of uploaded receipt (upload done via `/store` module, type `ExpensesRecept = 7`). |
| `status` | Number | required, default ACTIVE (1) | — | Soft delete sets `DELETED` (3). |
| `createdBy` | ObjectId | — | `User` | |
| `updatedBy` | ObjectId | — | `User` | |
| `createdAt` | Date | default `Date.now` | — | Manually managed (sub-doc has no timestamps option). |
| `updatedAt` | Date | default `Date.now` | — | Manually set on update/delete. |

#### Embedded `driverSalaries[]` entry (`expenses.model.ts:139-195`)

| Field | Type | Required / Default | Ref | Notes |
|---|---|---|---|---|
| `driver` | ObjectId | — | `User` | Driver this salary is for. |
| `salaryPerDay` | Number | — | — | |
| `noOfDays` | Number | — | — | |
| `totalSalary` | Number | — | — | Computed — see §5. |
| `totalAddition` | Number | — | — | |
| `totalDeduction` | Number | — | — | |
| `remainingExpenses` | Number | — | — | `estimatedExpense − sum(active expenses)` at save time. |
| `isRemainingToDriver` | Boolean | default `false` | — | If true and float is under-spent, the driver keeps the remainder (deducted from salary). |
| `createdBy` / `updatedBy` | ObjectId | — | `User` | |
| `createdAt` / `updatedAt` | Date | default `Date.now` | — | Manually set. |

## 4. API Endpoints

Base path: `/api/v1` (`constants.API.PREFIX`) + `/expense` (`applicationRoutes.expenses.base`).

Roles (`src/constant.ts`): 1 SUPERADMIN, 2 ADMIN, 3 DRIVER, 4 FINANCEOFFICER, 5 TRIPMANAGER, 6 DRIVERASSISTANT, 7 TRIPASSISTANT.

| Method | Full path | Controller | Allowed roles | Description |
|---|---|---|---|---|
| POST | `/api/v1/expense/:tripId` | `saveExpense` | SUPERADMIN, ADMIN, TRIPMANAGER, DRIVER | Add an expense line to a trip. |
| PUT | `/api/v1/expense/:tripId/:expenseId` | `updateExpense` | SUPERADMIN, ADMIN, TRIPMANAGER, DRIVER | Edit an expense line. |
| DELETE | `/api/v1/expense/:tripId/:expenseId` | `deleteExpense` | SUPERADMIN, ADMIN, TRIPMANAGER, DRIVER | Soft-delete an expense line. |
| GET | `/api/v1/expense/:tripId` | `getExpenseByTripId` | any authenticated user (`authorize([])`) | Trip expense summary + active lines. |
| GET | `/api/v1/expense/:tripId/:expenseId` | `getExpenseByTripIdAndExpenseId` | any authenticated user | Single active expense line. |
| POST | `/api/v1/expense/saveSalary/:tripId` | `saveDriverSalary` | SUPERADMIN, ADMIN, TRIPMANAGER | Create/overwrite a driver's salary for a finished trip. |

### Common behaviour (all endpoints)

- **Auth** (`src/middleware/auth.middleware.ts`): requires `Authorization: Bearer <jwt>`. Missing/malformed header → **401** `Authentication invalid!`; expired token → **401** `Your session is expired!`; other verify failure → **403** `You're unauthorized to access this resource!`; auth record not found → **401** `Authentication invalid!`; blocked account → **401** `Your account is blocked, Please contact admin!`; role not in list (when list is non-empty) → **403** `You're unauthorized to access this resource!`. On success `req.auth = { id (userId), userName, role (numeric), authId }`.
- **Response envelope** (`src/util/commonResponse.ts`): `{ isSuccessful, timeStamp, message, data }`.
- **Error mapping** (`src/middleware/error.middleware.ts`): thrown `BadRequestError` → 400; Mongoose `ValidationError` → 400 with first validator message; Mongoose `CastError` (e.g. malformed `tripId` ObjectId) → **404** `No item found with ID "<value>"!`; duplicate key → 409; anything else → 500.

---

### 4.1 POST `/expense/:tripId` — `saveExpense` (`expenses.controller.ts:16-99`)

**Params:** `tripId` (Trip ObjectId).

**Body** (`saveExpenseSchema`, `expenses.validation.ts:3-29`):

| Field | Rule | Messages |
|---|---|---|
| `typeId` | number, required | `Type is required` / `Type is invalid` |
| `typeName` | string, optional | — |
| `amount` | number, required | `Amount is required` / `Amount is invalid` |
| `description` | string, max 500, allows `null` and `''` | `Description should not be more than 500 characters` / `Description is invalid` |
| `date` | date, required | `Date is required` / `Date is invalid` |
| `receiptUrl` | string, optional, allows `null`/`''` | `Receipt URL is invalid` |

Unknown keys are rejected by Joi (default `allowUnknown: false`), producing a 400 with Joi's message.

**Logic:**

1. Joi validate → 400 with Joi message on failure.
2. Start a Mongo session + transaction.
3. `tripService.findByIdAndStatusIn(tripId, [START(3), FINISHED(4)])` — not session-bound. Not found → **400** `No trip found!`.
4. `expensesService.findByTripIdAndStatusIn(tripId, [ACTIVE])` — `Expenses.findOne({tripId, status: {$in}}).populate('tripId')`.
   - If none: create a new header (`tripId`, `expenses: []`, `createdBy/updatedBy = auth.id`, also sets `expense.driverSalary = null` — a non-schema path, ignored) and save it in the session.
   - Else if `isMonthEndDone` → **400** `Cannot add new expense after month end!`.
5. If `auth.role == DRIVER` **and** `trip.status == FINISHED` → **400** `Cannot add new expense after trip finished!` (admins / trip managers may still add on finished trips).
6. Push new line `{typeId, typeName, amount, description, date, receiptUrl, status: ACTIVE, createdBy: auth.id, updatedBy: auth.id}` and save in session. `service.save` clears all cache keys starting with `expenses-`.
7. Send **201** `Expense saved successfully!`, `data: null`, **then** commit the transaction.
8. On any error: abort transaction, rethrow. Session always ended.

### 4.2 PUT `/expense/:tripId/:expenseId` — `updateExpense` (`expenses.controller.ts:101-161`)

**Params:** `tripId`, `expenseId` (the embedded line's `_id`).

**Body:** `updateExpenseSchema` — identical rules to `saveExpenseSchema`.

**Logic** (no transaction; errors propagate straight to the error middleware — the old no-op `try { … } catch (e) { throw e }` wrapper was removed, no behaviour change):

1. Validate → 400.
2. Trip must be in **START** only → else **400** `No trip found or trip not in started status!`.
3. Load header (ACTIVE). None → **400** `No expense header found for this trip!`; `isMonthEndDone` → **400** `Cannot update expense after month end!`.
4. Find line where `exp.id === expenseId` (no status filter — a soft-deleted line can be edited). Not found → **400** `Expense not found!`.
5. Overwrite `typeId, typeName, amount, description, date, receiptUrl`; set `updatedBy = auth.id`, `updatedAt = new Date()`. Save (clears `expenses-` cache).
6. **200** `Expense updated successfully!`, `data: null`.

No check that a DRIVER is assigned to the trip or created the line.

### 4.3 DELETE `/expense/:tripId/:expenseId` — `deleteExpense` (`expenses.controller.ts:163-212`)

Same preconditions as update (trip START, header exists, not month-end, line found by `id`). Error messages use `Cannot delete expense after month end!`.

Soft delete: `status = DELETED (3)`, `updatedBy`, `updatedAt`. Save. **200** `Expense deleted successfully!`, `data: null`.

### 4.4 GET `/expense/:tripId` — `getExpenseByTripId` (`expenses.controller.ts:214-230`)

1. Load header (ACTIVE) with populated `tripId`.
2. If found, `expensesUtils.expenseWithTotalsToResponseDto(expense)` (`expenses.util.ts:32-47`):
   - `activeExpenses` = lines with `status === ACTIVE` (written back onto the doc's `expenses`).
   - `totalExpensesAmount = sumActiveExpenses(activeExpenses)`.
   - `tripExpensesAmount = trip.estimatedExpense`.
   - `remainingTripExpensesAmount = tripExpensesAmount − totalExpensesAmount`.
   - Map with `ExpensesModelToTripExpensesResponseDto`.
3. **200**, `message: ''`, `data` = DTO or `null` if no header (no 404).

**Response DTO** (`TripExpensesResponseDto`):

| Field | Source |
|---|---|
| `_id` | header `_id` |
| `tripId` | `expense.tripId._id` |
| `expenses` | active lines only (full sub-docs) |
| `driverSalaries` | all driver salary entries |
| `isMonthEndDone` | header flag |
| `tripExpensesAmount` | `trip.estimatedExpense` |
| `totalTripExpensesAmount` | Σ active amounts |
| `remainingTripExpensesAmount` | estimated − total |

### 4.5 GET `/expense/:tripId/:expenseId` — `getExpenseByTripIdAndExpenseId` (`expenses.controller.ts:232-256`)

Load header (ACTIVE); find line with `id === expenseId` **and** `status === ACTIVE`. **200** with the raw line sub-doc, or `data: null` if header/line not found.

### 4.6 POST `/expense/saveSalary/:tripId` — `saveDriverSalary` (`expenses.controller.ts:258-366`)

**Body** (`saveDriverSalarySchema`, `expenses.validation.ts:59-85`):

| Field | Rule | Messages |
|---|---|---|
| `driver` | string, required | `Driver Id is required` / `Driver Id is invalid` |
| `salaryPerDay` | number, required | `Salary Per Day is required` / `... is invalid` |
| `noOfDays` | number, required | `No of Days is required` / `... is invalid` |
| `totalAddition` | number, optional | `Total Addition is invalid` |
| `totalDeduction` | number, optional | `Total Deduction is invalid` |
| `isRemainingToDriver` | boolean, optional | `Is Remaining To Driver is invalid` |

**Logic** (no transaction):

1. Validate → 400.
2. Trip must be **FINISHED** → else **400** `Trip not found!`.
3. Header (ACTIVE) must exist → else **400** `No expense header found for this trip!`. **No `isMonthEndDone` check.**
4. `trip.drivers.find(d => d.driver.toString() === body.driver)` (includes inactive driver assignments) → else **400** `Driver not found in trip!`.
5. Look up existing entry in `expense.toObject().driverSalaries` by `driver`.
   - **New:** build entry with `salaryPerDay`, `noOfDays`, `totalSalary = calculateDriverSalary(...)`, `totalAddition`, `totalDeduction`, `remainingExpenses = calcRemainingExpenses(...)`, `isRemainingToDriver`, `createdBy/updatedBy = auth.id`, `createdAt/updatedAt = now`; push.
   - **Existing:** recompute the same fields on the plain-object copy, set `updatedBy/updatedAt`, and replace `expense.driverSalaries[index]` with it.
6. Save (clears `expenses-` cache). **200** `Driver salary saved successfully!`, `data: null`.

## 5. Business Rules & State Transitions

### Preconditions per operation

| Operation | Trip status allowed | Header `isMonthEndDone` | Role restriction |
|---|---|---|---|
| Add expense | START or FINISHED | must be false | DRIVER blocked when trip FINISHED |
| Update / delete expense | START only | must be false | — |
| Save driver salary | FINISHED only | **not checked** | SUPERADMIN/ADMIN/TRIPMANAGER |

### Expense line status

`ACTIVE (1)` → `DELETED (3)` via DELETE. No restore endpoint; but update does not filter by status, so a deleted line can still be edited (stays deleted).

### Header lifecycle (cross-module)

- Created on trip START (`trip.controller.ts:793-803`) or lazily on first `saveExpense`.
- **Hard-deleted** (`findAndHardDeleteByTripId`) when the trip is moved/undone back to PENDING (`trip.controller.ts:863, 970`), provided the trip module's guard passes.
- Locked by month-end (`monthAudit` → `monthEndDoneForTrip`, only for FINISHED trips): now a single bulk write — `findAllIdsByTripIdsAndStatusIn` then `markMonthEndDone` → `updateMany({_id:{$in}}, {$set:{isMonthEndDone: true, batchId, updatedBy}})` inside the month-end transaction.

### Driver salary formula (`calculateDriverSalary`, `expenses.controller.ts:368-404`)

```ts
totalActive = sumActiveExpenses(expenses)   // Σ amount of lines with status ACTIVE
remaining   = (trip.estimatedExpense − totalActive) || 0   // NaN/0 → 0

totalSalary = 0
if (salaryPerDay > 0 && noOfDays > 0) totalSalary += salaryPerDay * noOfDays
if (totalAddition  > 0)               totalSalary += totalAddition
if (totalDeduction > 0)               totalSalary -= totalDeduction

if (remaining > 0) {                 // float under-spent
    if (isRemainingToDriver) totalSalary -= remaining   // driver keeps the cash → deduct
} else {                             // float exactly used or over-spent
    totalSalary += Math.abs(remaining)                  // reimburse overspend
}
```

`remainingExpenses` stored on the entry = `calcRemainingExpenses` = same `remaining` value (`expenses.controller.ts:406-413`).

`trip.estimatedExpense` is the trip's budget; it is increased when an expense extension is approved (`expenseRequest` module).

## 6. Utilities & DTOs

| Function | Location | Purpose |
|---|---|---|
| `sumActiveExpenses(expenses)` | `expenses.util.ts:5-14` | `Σ amount` of lines with `status === ACTIVE`. Shared by the salary helpers and `report.controller.ts:234`. |
| `ExpensesModelToTripExpensesResponseDto(expense)` | `expenses.util.ts:16-29` | Maps a header (with populated `tripId` and the extra computed props) to `TripExpensesResponseDto`. Throws if `tripId` is not populated/null (`expense.tripId._id`). |
| `expenseWithTotalsToResponseDto(expense)` | `expenses.util.ts:32-47` | Replaces `expense.expenses` with the active lines (mutates the passed doc), sets `tripExpensesAmount` / `totalTripExpensesAmount` / `remainingTripExpensesAmount`, then maps. Used by `getExpenseByTripId`, `trip.controller.ts:1233, 1262` and `report.controller.ts:45`. |
| `calculateDriverSalary(...)` | `expenses.controller.ts:368` | See §5 (not exported). |
| `calcRemainingExpenses(trip, expenses)` | `expenses.controller.ts:406` | `estimatedExpense − sumActiveExpenses`, `|| 0`. |

**Service functions** (`expenses.service.ts`):

| Function | Query | Cache |
|---|---|---|
| `save(doc, session?)` | `doc.save({session})` | Clears all keys with prefix `expenses-` before saving. |
| `findAndHardDeleteByTripId(tripId, session?)` | `Expenses.findOneAndDelete({tripId})` | Clears `expenses-` prefix. |
| `findByTripIdAndStatusIn(tripId, status[])` | `findOne({tripId, status:{$in}}).populate('tripId')` | Not cached. |
| `findByTripIdsInAndStatusIn(tripIds[], status[])` | `find({tripId:{$in}, status:{$in}})` (full Mongoose docs) | Cached 1 week under `expenses-<JSON tripIds><JSON status>` (now read synchronously, no `await`). Used by dashboard. |
| `findAllByTripIdsAndStatusIn(tripIds[], status[])` (`:54-69`) | One `find({tripId:{$in}, status:{$in}}).populate({path:'tripId', select:'_id estimatedExpense'})`; returns a `Map<tripIdString, doc>` keeping the **first** doc per trip (mimics `findOne`). Empty input → empty Map, no query. | Not cached. Used by `report.getTripExpenses`. |
| `findAllIdsByTripIdsAndStatusIn(tripIds[], status[])` (`:72-89`) | `find(...).select('_id tripId').lean()`; returns the first header `_id` per trip. Empty input → `[]`. | Not cached. Used by month-end. |
| `markMonthEndDone(ids[], userId, batchId, session)` (`:92-96`) | `updateMany({_id:{$in: ids}}, {$set:{isMonthEndDone: true, batchId, updatedBy: userId}}, {session})`. No-op for empty `ids`. | Clears `expenses-` prefix **before** the write. |
| `applyDriverSalaryDone(trips[])` (`:100-137`) | For trips in START/FINISHED: one `find({tripId:{$in}, status: ACTIVE}).select('tripId driverSalaries.driver').lean()`; builds a per-trip set of paid driver ids (first header per trip). Then mutates **every** passed trip: `isDriverSalaryDone = drivers.length > 0 && every driver (d.driver._id) has a salary row`, else `false`. | Not cached. Used by `trip.getAllTripsByRole` (`trip.controller.ts:584`) and month-end listing (`monthAudit.controller.ts:394`). |

Cache is an in-process `node-cache` (`src/util/cache.ts`), so it is per-instance. It now runs with `useClones: false`: `getCache` returns the **same** object that was stored (here an array of live Mongoose documents), so callers must treat cached values as read-only.

## 7. Dependencies

**Reads/uses:**
- `trip` module: `tripService.findByIdAndStatusIn` (trip status, `estimatedExpense`, `drivers[]`).
- `WellKnownTripStatus` (service: `applyDriverSalaryDone` filters START/FINISHED).
- `Trip` collection via `populate('tripId')`.
- Shared: `constants`, `cache`, `CommonResponse`, `BadRequestError`, `WellKnownStatus`, `WellKnownTripStatus`.

**Depended on by:**
- `trip` module (`trip.controller.ts`): creates the header on START (`:803`), computes `isDriverSalaryDone` for trip lists via `applyDriverSalaryDone` (`:584`), reads it for report/QR views via `expenseWithTotalsToResponseDto` (`:1225-1233`, `:1254-1262`), checks it before reverting to PENDING (`:820`, `:929`), hard-deletes it on revert (`:863`, `:970`).
- `report` module: reads `Expenses` model directly (aggregations in `report.service.ts`), uses `findAllByTripIdsAndStatusIn` + `expenseWithTotalsToResponseDto` + `sumActiveExpenses`.
- `monthAudit` module: closes headers for FINISHED trips at month end (`findAllIdsByTripIdsAndStatusIn` + `markMonthEndDone`), and uses `applyDriverSalaryDone` when listing pending trips.
- `dashboard` module: `findByTripIdsInAndStatusIn` to total expenses + driver salaries.

## 8. Notes / Gotchas

1. **Response sent before commit** (`saveExpense`, `expenses.controller.ts:85-92`): `CommonResponse` (201) is sent, then `commitTransaction()`. If the commit fails, the client already got success and the error handler will attempt a second response ("headers already sent").
2. **Trip lookup outside the transaction**: `tripService.findByIdAndStatusIn` and `findByTripIdAndStatusIn` don't take the session; only the saves are transactional.
3. **No trip ownership check**: any DRIVER can add/edit/delete expenses on any started trip, not only trips they're assigned to.
4. **Inconsistent finished-trip rules**: admins can *add* expenses to a FINISHED trip but nobody can *update/delete* them (update/delete require START).
5. **Driver salary ignores month-end lock**: `saveDriverSalary` doesn't check `isMonthEndDone`, so salaries can be changed after month close.
6. **Overspend reimbursement per driver**: with multiple drivers, each driver's `totalSalary` gets the full `remaining` adjustment (deduction or reimbursement) — the same float difference is applied once per driver.
7. **Possible double count in income/dashboard**: overspend is added into `totalSalary`, and reports/dashboard then add `Σ totalSalary + Σ expenses`, so overspend may be counted twice (see `report.md`).
8. **Stale salaries**: `totalSalary`/`remainingExpenses` are snapshots; editing expenses later (admins on FINISHED trips) doesn't recompute them.
9. **Update can edit soft-deleted lines**: `updateExpense` finds by id without filtering `status`.
10. `driverSalaries` lookup uses `d.driver.toString()` on trip drivers — a trip driver entry with `driver: null` would throw a TypeError (500).
11. `expense.driverSalary = null` (`expenses.controller.ts:50`) writes a path that no longer exists in the schema (legacy); harmless.
12. No **unique** index on `tripId` (only the non-unique `{tripId, status}` compound); nothing prevents two headers per trip at the DB level (the trip-start path and the lazy-create path both create one). The batched helpers (`findAllByTripIdsAndStatusIn`, `findAllIdsByTripIdsAndStatusIn`, `applyDriverSalaryDone`) keep only the first header per trip (unsorted natural order, like `findOne`), so with duplicates month-end flags only one of them.
13. Validation messages for the Joi `date` fields say "Date is invalid" etc.; no business validation that `date` falls within the trip dates or that `amount > 0` (negative amounts are accepted).
14. GET endpoints are open to every authenticated role, including DRIVERASSISTANT/TRIPASSISTANT.
15. **Shared cached documents** (`findByTripIdsInAndStatusIn`): with the cache now at `useClones: false`, every dashboard hit within the TTL receives the same array of live Mongoose documents. Any caller that mutates them (e.g. assigns computed props) changes the cached copy for all later callers until an `expenses-` clear.
16. **Cache cleared before the write commits** (`save`, `markMonthEndDone`): the `expenses-` prefix is cleared before `save()`/`updateMany` run (and, at month end, before the transaction commits), so a concurrent dashboard read in that window can re-cache pre-write data for up to a week. If the month-end transaction aborts, the clear is harmless.
17. `expenseWithTotalsToResponseDto` mutates its argument (replaces `expense.expenses` with active lines only); callers that reuse the doc afterwards (or would ever save it) see the filtered array.

## Changelog

### 2026-10-25 — synced with code changes in commit `50632dc` ("Code Ai Optimization revamp")
- Model: added non-unique compound index `{ tripId: 1, status: 1 }`.
- Util: new `sumActiveExpenses` and `expenseWithTotalsToResponseDto` (filter-active + totals + DTO); `getExpenseByTripId`, `calculateDriverSalary`, `calcRemainingExpenses`, trip and report modules now use them.
- Service: new batched helpers `findAllByTripIdsAndStatusIn` (report, projected populate), `findAllIdsByTripIdsAndStatusIn` (`.lean()` + projection) and bulk `markMonthEndDone` (`updateMany` in session) for month end, and `applyDriverSalaryDone` (one lean query instead of per-trip lookups) for trip lists / month-end listing.
- Controller: removed no-op `try/catch → rethrow` wrappers in update/delete/get/salary handlers (no behaviour change); line references updated.
- Shared: cache now `useClones: false` (cached dashboard docs are shared — gotcha 15); `getCache` no longer awaited.
