# Month Audit Module (`src/modules/monthAudit`)

## 1. Overview

Month Audit is the **month-end close** of the system. The company works in a single "current working month" (stored in the `CompanyWorkingInfo` collection, owned by the `common` module). When the super admin closes the month:

- all leaves, trips (and the expense headers / POS records of finished trips), internal trips, monthly overhead expense documents and vehicle maintenance records belonging to the closing month (and anything older still open) are flagged **`isMonthEndDone = true`** and stamped with a **`batchId`** — which locks them against further edits in their own modules;
- the current `CompanyWorkingInfo` is retired and a new one is created for the new month;
- a new empty `MonthlyExpenses` document is created for the new month;
- a `MonthAudit` record is written as the audit trail of the close.

The module also exposes helper views used before closing: pending leaves and trips still awaiting driver salary in the working month, plus the current working month info.

## 2. Files

| File | Role |
|---|---|
| `monthAudit.model.ts` | Mongoose model `MonthAudit` (audit trail of each close). |
| `monthAudit.route.ts` | Router: 4 endpoints. |
| `monthAudit.controller.ts` | Handlers + the month-end close-out helpers for each collection (now id lookups + bulk `updateMany` writes). |
| `monthAudit.service.ts` | Save (clears whole cache) and batch-id generation. |
| `monthAudit.validation.ts` | Joi `createNewMonthSchema` — **declared but not exported or used**. |
| `monthAudit.util.ts` | Mapper to `WorkingInfoResponseDto`. |
| `dto/workingInfoResponseDto.ts` | `{ workingMonth, workingYear, workingDate }`. |

## 3. Data Models

### Collection `monthaudits` (model `MonthAudit`) — `monthAudit.model.ts`

Options: `timestamps: true`, `versionKey: false`. No indexes/hooks/virtuals.

| Field | Type | Required / Default | Ref | Notes |
|---|---|---|---|---|
| `newWorkingDate` | Date | required | — | `new Date(year, month - 1, 1)` (local midnight, 1st of new month). |
| `status` | Number | required, default ACTIVE (1) | — | `WellKnownStatus`. |
| `batchId` | Number | default `0` | — | Batch number of this close (`count(MonthAudit) + 1`). |
| `createdBy` / `updatedBy` | ObjectId | — | `User` | |
| `createdAt` / `updatedAt` | Date | auto | — | |

### Collection `companyworkinginfos` (model `CompanyWorkingInfo`, owned by `common`) — read/written here

`src/modules/common/model/companyWorkingInfo.model.ts`

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `workingYear` | Number | required | |
| `workingMonth` | Number | required | **1-based** (Jan = 1). |
| `workingDate` | Date | required | `new Date(year, month - 1, 1)`. |
| `status` | Number | required, default ACTIVE | Old record set to DELETED on close. |
| `batchId` | Number | default 0 | Set to the closing batch on retirement. |
| `createdBy` / `updatedBy` | ObjectId → `User` | | |

Index (new): non-unique `{ status: 1, createdAt: -1 }`.

`findLatestActive()` = `findOne({status: ACTIVE}).sort({$natural: -1}).populate('createdBy updatedBy')`.
- `getCompanyWorkingInfo()` — cached for 30 days under key `companyWorkingInfo`; with the cache at `useClones: false` the returned document is **shared** between requests and must be treated as read-only. Used by the GET endpoints.
- `getCompanyWorkingInfoFresh()` — same lookup, never cached. Used by `createNewDate`, which mutates and saves the record.
- `save(doc, session?)` deletes the `companyWorkingInfo` cache key, then saves.

### Collections written by the close (owned by other modules)

`leaves`, `trips`, `expenses`, `pos`, `internaltrips`, `monthlyexpenses`, `vehiclemaintenances` — fields `isMonthEndDone`, `batchId`, `updatedBy` (plus `updatedAt` via Mongoose timestamps), written with one `updateMany({_id: {$in: ids}}, {$set: …}, {session})` per collection.

## 4. API Endpoints

Base: `/api/v1/monthAudit`.

| Method | Full path | Controller | Allowed roles | Description |
|---|---|---|---|---|
| POST | `/api/v1/monthAudit/createNewMonth` | `createNewDate` | SUPERADMIN | Close current month, open new one. |
| GET | `/api/v1/monthAudit/pendingLeaves` | `getPendingLeaves` | SUPERADMIN | Pending leaves for the (computed) working month. |
| GET | `/api/v1/monthAudit/workingInfo` | `getWorkingInformation` | any authenticated user | Current working month/year/date. |
| GET | `/api/v1/monthAudit/pendingTrip` | `getTripInfoForWorkingMonth` | SUPERADMIN | Open trips in/before the working month that still need driver salary. |

Auth, envelope and error mapping: see `expenses.md` §4 "Common behaviour".

---

### 4.1 POST `/monthAudit/createNewMonth` — `createNewDate` (`monthAudit.controller.ts:34-159`)

**Body:** `{ month, year }` — **no validation is performed** (the Joi schema in `monthAudit.validation.ts` is never used). `month` is expected **1-based**.

**Logic:**

1. `lastCompanyInfo = companyWorkingInfoService.getCompanyWorkingInfoFresh()` — a fresh (uncached) document, because it is mutated and saved below.
2. Start session + transaction.
3. `batchId = monthAuditService.generateBatchId()` = `MonthAudit.countDocuments() + 1` (not in session).
4. Close-out, sequentially in this order, each passing `lastCompanyInfo.workingMonth`, `lastCompanyInfo.workingYear`, session, `auth.id`, `batchId`, `correlationId`. Every helper follows the same pattern: **one lean id lookup (outside the session) → one bulk `markMonthEndDone` (`updateMany … $set {isMonthEndDone: true, batchId, updatedBy}` in the session, no-op for an empty id list) → one info log per record**:
   1. **`monthEndDoneForLeave`** (`:161-186`) — `leaveService.findAllIdsByMonthYearAndStatusIn(year, month, [APPROVED, REJECTED, PENDING, CANCELLED])`: `Leave.find({ status: {$in}, startDate ∈ [new Date(year, month, 1), new Date(year, month+1, 0)] }).select('_id status').lean()` (see gotcha #3) → `leaveService.markMonthEndDone(ids, …)` (does not clear the leave cache itself).
   2. **`monthEndDoneForTrip`** (`:252-292`) — `tripService.findAllIdsByEndMonthAndStatusIn(month, year, [PENDING, START, FINISHED, CANCELED])`: `Trip.find({ endDate: { $lt: cutoff }, status: {$in}, isMonthEndDone: false }).select('_id status').sort({startDate: 1}).lean()`, `cutoff` = local 1st of the month after the working month (see §5). Then, for the trips whose status is **FINISHED** only:
      - `expensesService.findAllIdsByTripIdsAndStatusIn(finishedTripIds, [ACTIVE])` — one lean query, first header `_id` per trip;
      - `posService.findAllIdsByTripIdsAndStatusIn(finishedTripIds, [ACTIVE])` — same for POS.
      Writes, in order: `expensesService.markMonthEndDone` (clears `expenses-` cache) → `posService.markMonthEndDone` → `tripService.markMonthEndDone(all trip ids)`. Then one log line per trip (`Trip ID | Status`).
   3. **`monthEndDoneForInternalTrip`** (`:188-208`) — `internalTripService.findAllByEndMonthAndStatusIn(month, year, [ACTIVE, INACTIVE])`: `find({ createdAt: { $lt: cutoff }, status, isMonthEndDone: false }).select('_id').lean()` (**no longer cached**) → `internalTripService.markMonthEndDone` (clears the internal-trip cache prefix).
   4. **`monthEndDoneForMonthlyExpenses`** (`:210-229`) — `monthlyExpensesService.findAllByEndMonthAndStatusIn(month, year, [ACTIVE, INACTIVE])`: `find({ month: { $lt: cutoff 23:59:59.999 }, status, isMonthEndDone: false }).select('_id').lean()` (**no longer cached**) → `monthlyExpensesService.markMonthEndDone` (clears `monthlyExpenses-`).
   5. **`monthEndDoneForVehicleMaintenance`** (`:231-250`) — `vehicleMaintenanceService.findAllByEndMonthAndStatusIn(month, year, [ACTIVE])`: `find({ maintenanceDate: { $lt: cutoff 23:59:59.999 }, status, isMonthEndDone: false }).select('_id').lean()` → `vehicleMaintenanceService.markMonthEndDone` (clears the vehicle-maintenance cache prefix).
5. If `lastCompanyInfo`: set `status = DELETED`, `updatedBy`, `batchId`; save in session (deletes the `companyWorkingInfo` cache key); log.
6. Create `CompanyWorkingInfo { workingYear: year, workingMonth: month, workingDate: new Date(year, month-1, 1), createdBy, updatedBy }`; save; log.
7. Create `MonthlyExpenses { month: new Date(Date.UTC(year, month-1, 1)), monthName: month, year, expenses: [], totalExpenses: 0, status: ACTIVE, isMonthEndDone: false, batchId: 0, createdBy, updatedBy }`; save; log.
8. Create `MonthAudit { newWorkingDate: new Date(year, month-1, 1), batchId, createdBy, updatedBy }`; `monthAuditService.save` **clears every cache prefix** in `constants.CACHE.PREFIX` (this is what covers the leave/trip/POS caches, whose `markMonthEndDone` don't clear anything); log.
9. Commit. On any error: abort and rethrow (500 for TypeErrors, 400 for Mongoose validation errors, etc.). Always end session.
10. After the `finally`: **201** `Month Audit successfully done and System date move to <month>/<year>!`, `data` = saved `MonthAudit` document.

All log lines go through `helperUtil.consoleLogMessage("info", "MONTH_AUDIT | … | Correlation ID: <id>")`. Per-record logs are now written after the bulk write of that collection (they are no longer interleaved with per-document saves).

### 4.2 GET `/monthAudit/pendingLeaves` — `getPendingLeaves` (`:294-355`)

1. Active company info (`getCompanyWorkingInfo`, cached/shared) → none → **400** `No active company information found!`.
2. `leaveService.findAllLeavesByMonthYearAndStatusIn(workingYear, workingMonth, [PENDING])` (same month filter as the close-out; populates `appliedUser` + its `role`, `approveBy`, `rejectBy`, `createdBy`, `updatedBy`; hydrated, uncached).
3. If any leaves:
   - **One** `userService.findAllByIdsWithRole(appliedUserIds of PENDING leaves)` — `User.find({_id: {$in}, status: ACTIVE}).populate({path: 'role', select: '_id name id'})` → `Map<userId, user>` (replaces the old per-leave `findByIdWithGenderRole`).
   - For each PENDING leave, look up its user in the map. The intended condition is "applicant is ADMIN, TRIPMANAGER or FINANCEOFFICER", but due to the comma operator only `role.id == FINANCEOFFICER` is evaluated (see gotcha #2). Matching leaves are collected.
   - **One** `leaveService.getTotalLeaveDaysForUsers(userIds, workingYear)`: per-user cache lookup (`leave-totalLeaveDays-<userId>-<year>`); for the misses a single `Leave.find({appliedUser: {$in: missing}, startDate ≥ Jan 1, endDate ≤ Dec 31, status: APPROVED}).select('appliedUser dateCount').lean()`, summed per user (0 when none) and cached 3 months each.
   - `leave.availableLeaveCount = appliedUser.leaveCount − totals.get(userId)`.
4. Map with `leaveUtil.leaveModelToLeaveResponseDtos` → **200** `LeaveResponseDto[]` (`_id, startDate, endDate, dateCount, reason, status, statusName, appliedUser, appliedUserName, appliedUserRole, availableLeaveCount (or ''), approveBy/approvedUser/approveDate/approveRemark, rejectBy/rejectedUser/rejectDate/rejectReason, isMonthEndDone, createdBy/createdUser, updatedBy/updatedUser, createdAt, updatedAt`).

### 4.3 GET `/monthAudit/workingInfo` — `getWorkingInformation` (`:357-373`)

Active company info (cached/shared) → none → **400** `No active company information found!`. **200** `{ workingMonth, workingYear, workingDate }`.

### 4.4 GET `/monthAudit/pendingTrip` — `getTripInfoForWorkingMonth` (`:375-405`)

1. Active company info → none → **400** `No active company information found!`.
2. `tripService.findAllByEndMonthAndStatusIn(workingMonth, workingYear, [PENDING, START, FINISHED])` — not-yet-closed trips with `endDate < cutoff` (shared `monthEndFilter`), populated `createdBy updatedBy startedBy endedBy`, `drivers.driver` (with `match: {'drivers.isActive': true}`), `vehicles.vehicle`, sorted by `startDate` asc. Hydrated documents.
3. `expensesService.applyDriverSalaryDone(trips)` — **one** lean query for the ACTIVE expense headers of all START/FINISHED trips (`select('tripId driverSalaries.driver')`, first header per trip), then sets on every trip `isDriverSalaryDone = drivers.length > 0 && every trip driver's driver._id ∈ { driverSalaries[].driver }`, else `false` (replaces the old per-trip header lookups).
4. Keep only trips with `isDriverSalaryDone == false` (so PENDING trips are always included).
5. Map with `tripUtil.tripModelArrToTripResponseDtoGetAlls` → **200** `TripResponseDtoGetAll[]` (empty array if none).

## 5. Business Rules & State Transitions

### Working month state

```
CompanyWorkingInfo(month N, ACTIVE)
   └─ POST createNewMonth {month: M, year: Y}
        → old record: status DELETED, batchId = B
        → new record: CompanyWorkingInfo(M, Y, ACTIVE)
        → MonthlyExpenses(UTC 1st of M/Y) created
        → MonthAudit(newWorkingDate = 1st of M/Y, batchId = B)
```

No rule enforces `M` = `N + 1`; any month/year can be supplied, including past months.

### Batch id
`batchId = (number of MonthAudit documents) + 1`, computed before the close.

### Close-out cutoff (trips, internal trips, monthly expenses, vehicle maintenance)

Each service computes (with 1-based `workingMonth` passed as `endMonth`):

```ts
let endDate = new Date();                 // today
endDate.setFullYear(workingYear);
endDate.setMonth(workingMonth);           // 0-based setter → month AFTER the working month
endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);   // local 00:00 on its 1st
// monthlyExpenses & vehicleMaintenance additionally: endDate.setHours(23, 59, 59, 999)
```

| Collection | Date field | Filter |
|---|---|---|
| Trip | `endDate` | `< cutoff`, status ∈ {PENDING, START, FINISHED, CANCELED}, `isMonthEndDone: false` |
| InternalTrip | `createdAt` | `< cutoff`, status ∈ {ACTIVE, INACTIVE}, not closed |
| MonthlyExpenses | `month` | `< cutoff 23:59:59.999`, status ∈ {ACTIVE, INACTIVE}, not closed |
| VehicleMaintenance | `maintenanceDate` | `< cutoff 23:59:59.999`, status ACTIVE, not closed |
| Leave | `startDate` | within `[new Date(y, workingMonth, 1), new Date(y, workingMonth+1, 0)]`, any status, **no** `isMonthEndDone` filter |
| Expenses header / POS | `tripId` | `$in` the FINISHED trips' ids, status ACTIVE; first match per trip only |

All lookups are `.lean()` id projections run **outside** the session; all writes are bulk `updateMany` inside it.

Because the cutoff is "before the next month", any older open records are also swept up (catch-up behaviour).

### Effect of `isMonthEndDone`
Owning modules reject edits when set (e.g. expenses: `Cannot add/update/delete expense after month end!`; monthly expenses: `Cannot update monthly expense after month end!`; trip status changes: `Trip is already month end done!`).

## 6. Utilities & DTOs

| Function | Location | Purpose |
|---|---|---|
| `companyWorkingInfoToWorkingInfoResponseDto(info)` | `monthAudit.util.ts:3-11` | → `{ workingMonth, workingYear, workingDate }`. |
| `monthAuditService.save(doc, session?)` | `monthAudit.service.ts:5-14` | Clears **all** cache prefixes (joins every `constants.CACHE.PREFIX` value with `,`) then saves. |
| `monthAuditService.generateBatchId()` | `monthAudit.service.ts:16-20` | `countDocuments() + 1`. |
| `monthEndDoneFor*` helpers | controller `:161-292` | Per-collection close-out (§4.1): id lookup → `markMonthEndDone` → logs. |

## 7. Dependencies

**Reads/writes:**
- `common`: `CompanyWorkingInfo` model + `companyWorkingInfoService` (`getCompanyWorkingInfoFresh` for the close, `getCompanyWorkingInfo` for the GETs, `save`).
- `leave`: `leaveService.findAllIdsByMonthYearAndStatusIn`, `markMonthEndDone`, `findAllLeavesByMonthYearAndStatusIn`, `getTotalLeaveDaysForUsers`; `leaveUtil`.
- `user`: `userService.findAllByIdsWithRole`.
- `trip`: `tripService.findAllIdsByEndMonthAndStatusIn`, `markMonthEndDone`, `findAllByEndMonthAndStatusIn`; `tripUtil.tripModelArrToTripResponseDtoGetAlls`.
- `expenses`: `expensesService.findAllIdsByTripIdsAndStatusIn`, `markMonthEndDone`, `applyDriverSalaryDone`.
- `pos`: `posService.findAllIdsByTripIdsAndStatusIn`, `markMonthEndDone`.
- `internalTrip`: `internalTripService.findAllByEndMonthAndStatusIn`, `markMonthEndDone`.
- `monthlyExpenses`: `MonthlyExpenses` model, `monthlyExpensesService.findAllByEndMonthAndStatusIn`, `markMonthEndDone`, `save`.
- `vehicleMaintain`: `vehicleMaintenanceService.findAllByEndMonthAndStatusIn`, `markMonthEndDone`.

**Depended on by:** nothing imports this module; all other modules depend on the `isMonthEndDone` flags and the `CompanyWorkingInfo` it maintains (e.g. vehicle maintenance validates dates against the working month; auth login returns `workingMonth`).

## 8. Notes / Gotchas

1. **No body validation in `createNewDate`**: `createNewMonthSchema` exists but isn't exported or called. Missing/garbage `month`/`year` produce `NaN`/Invalid Dates and fail late with Mongoose errors (after the close-out work ran in the transaction, which then aborts). No check that the new month follows the current one, nor that it doesn't already exist (duplicate `MonthlyExpenses` for a month is possible; the report's `findOne` would then pick an arbitrary one).
2. **Comma-operator bug** (still present after the batching refactor, `monthAudit.controller.ts:328-334`):
   ```ts
   if ((appliedUser?.role?.id == ADMIN || appliedUser?.role?.id == TRIPMANAGER, appliedUser?.role?.id == FINANCEOFFICER))
   ```
   evaluates to `role == FINANCEOFFICER` only; ADMIN and TRIPMANAGER applicants never get `availableLeaveCount`.
3. **Leave month off-by-one**: `workingMonth` is 1-based but `findAllLeavesByMonthYearAndStatusIn` builds `new Date(year, month, 1)` (0-based), so both the leave close-out and `pendingLeaves` target the month **after** the working month. Leaves starting in the actual working month are not closed by that run. Also no `isMonthEndDone: false` filter (the new `monthYearFilter` shared by both leave queries still has none), so leaves can be re-stamped with a newer `batchId`.
4. **Null deref before null check**: `lastCompanyInfo.workingMonth` is read (`:52`) before `if (lastCompanyInfo)` (`:96`), so with no active company info the close crashes with a TypeError (500); the system cannot be bootstrapped through this endpoint.
5. **Day-of-month overflow in the cutoff**: `new Date()` keeps today's day; `setMonth()` on the 29th–31st into a shorter month rolls into the following month, pushing the cutoff a month further and closing next month's trips/maintenance too. (Trips now share one `monthEndFilter` in `trip.service.ts:95-106`; the bug is unchanged there and in the internal-trip / monthly-expense / maintenance copies.)
6. **Only FINISHED trips get their expense header and POS closed**: trips still PENDING/START/CANCELED at close are marked `isMonthEndDone` but their expense headers remain open (editable).
7. **Reads outside the transaction** (partially fixed): the close no longer uses cached or hydrated documents — the company info is loaded fresh, the internal-trip / monthly-expense lookups are uncached, and all writes are bulk `updateMany`s, so an abort no longer leaves mutated objects in the cache. Still open: every id lookup runs without the session (a record changed concurrently between lookup and `updateMany` is still flagged, and one created in between is missed), and all cache prefixes are cleared **before** `commitTransaction`, so a request in that window can re-cache pre-close data (e.g. `isMonthEndDone: false`) for the cache's TTL.
8. **Batch id race**: `countDocuments() + 1` outside the session; two concurrent closes (or a deleted MonthAudit) can produce duplicate batch ids.
9. **`pendingTrip` driver check likely never passes**: `drivers.driver` is populated with `match: { 'drivers.isActive': true }`, a condition evaluated against `User` documents, which have no `drivers` field, so populated `driver` values are likely `null`. `applyDriverSalaryDone` then reads `d?.driver?._id` → `undefined`, `isDriverSalaryDone` stays `false` and every trip with drivers is listed. The logic moved to `expensesService.applyDriverSalaryDone`, which `trip.getAllTripsByRole` shares, so the same behaviour applies there.
10. `createNewDate` returns a **201** with the `MonthAudit` document; the response is sent after commit (correct here, unlike some other modules).
11. Monthly-expenses cutoff uses `23:59:59.999` on the next month's 1st, while trips use `00:00`, so the same "month" is defined differently per collection; internal trips use `createdAt` rather than a trip date.
12. `getWorkingInformation` is open to every authenticated role.
13. **Bulk writes skip document middleware/validation**: `updateMany` doesn't run `save` hooks or validators (equivalent today; `updatedAt` is still set by timestamps). Leave, trip and POS `markMonthEndDone` don't clear their own cache prefixes — they rely on `monthAuditService.save` clearing every prefix at the end of the close.
14. **First-match-per-trip for headers/POS**: `findAllIdsByTripIdsAndStatusIn` keeps only the first ACTIVE expense header / POS per trip (unsorted natural order, like the old `findOne`), so duplicate headers for a trip leave the others unlocked.
15. **`CompanyWorkingInfo` index vs. sort**: the new `{status: 1, createdAt: -1}` index serves the `status` filter, but `findLatestActive` sorts by `$natural: -1`, not `createdAt`, so the index can't satisfy the sort.

## Changelog

### 2026-10-25 — synced with uncommitted code changes
- `createNewDate` loads the working info with `getCompanyWorkingInfoFresh()` (uncached) instead of the shared cached copy.
- Every close-out helper now does a lean `_id`(+`status`) lookup and one bulk `markMonthEndDone` `updateMany` per collection (leave, trip, expenses header, POS, internal trip, monthly expenses, vehicle maintenance) instead of per-document `save`s; trip close fetches expense-header and POS ids for all FINISHED trips in one query each; internal-trip and monthly-expense lookups are no longer cached.
- `getPendingLeaves`: users loaded once (`findAllByIdsWithRole`) and leave totals once (`getTotalLeaveDaysForUsers`) instead of per leave.
- `getTripInfoForWorkingMonth`: driver-salary check delegated to `expensesService.applyDriverSalaryDone` (one lean query).
- Removed unused imports/variables and the no-op `try/catch` wrappers; `CompanyWorkingInfo` gained a `{status, createdAt}` index; line references updated.
- Gotchas: #7 partially fixed (no cached/hydrated docs mutated), #12 trimmed (unused imports/`auth` gone); #13–#15 added.
