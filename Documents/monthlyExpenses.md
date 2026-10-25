# Monthly Expenses Module (`src/modules/monthlyExpenses`)

## 1. Overview

Monthly Expenses holds **company overhead expenses that are not tied to a trip** (e.g. office rent, utilities, salaries of office staff, misc. purchases) grouped **per calendar month**. One `MonthlyExpenses` document exists per month; office users add, edit and soft-delete expense lines inside it, and the document keeps a running `totalExpenses`.

The monthly document is **created automatically by the month audit** (`monthAudit` → `createNewDate`) when the system moves into a new working month; there is no create-month endpoint in this module. At the next month end it is locked (`isMonthEndDone = true`). The data feeds the monthly expenses report and the dashboard expense totals.

## 2. Files

| File | Role |
|---|---|
| `monthlyExpenses.model.ts` | Mongoose model `MonthlyExpenses` with embedded `expenses[]`. |
| `monthlyExpenses.route.ts` | Router (5 endpoints). |
| `monthlyExpenses.controller.ts` | Handlers: add, update, delete lines; advance search; get by id. |
| `monthlyExpenses.service.ts` | Save, month-end id lookup (lean, uncached), bulk month-end flag, find by id, advance search (cached). |
| `monthlyExpenses.validation.ts` | Joi: `createNewExpensesSchema`, `advanceSearchSchema`. |
| `monthlyExpenses.util.ts` | Model → `MonthlyExpensesResponseDto` mappers. |
| `dto/monthlyExpensesResponseDto.ts` | List DTO interface. |

## 3. Data Model

### Collection `monthlyexpenses` (model `MonthlyExpenses`) — `monthlyExpenses.model.ts`

Options: `timestamps: true`, `versionKey: false`. No hooks or virtuals.

**Indexes** (`monthlyExpenses.model.ts:114-115`): non-unique `{ month: 1 }` — backs the month-range advance search, the month-end `month < cutoff` query and the report's `findOne({month})`. Not unique, so nothing at DB level prevents two documents for the same month.

| Field | Type | Required / Default | Ref | Notes |
|---|---|---|---|---|
| `month` | Date | required | — | First day of month at **UTC** midnight (`Date.UTC(year, month-1, 1)`, set by month audit). Used for lookups. |
| `year` | Number | required (`'Year is required'`) | — | e.g. 2026. |
| `monthName` | Number | required (`'Month is required'`) | — | 1-based month number despite the name. |
| `expenses` | Array of sub-docs | — | — | See below. |
| `totalExpenses` | Number | default `0` | — | Σ amount of ACTIVE lines, recomputed on every change. |
| `status` | Number | required, default ACTIVE (1) | — | `WellKnownStatus` 1/2/3. |
| `isMonthEndDone` | Boolean | default `false` | — | Locks edits. |
| `batchId` | Number | default `0` | — | Month-audit batch that closed it. |
| `createdBy` / `updatedBy` | ObjectId | — | `User` | |
| `createdAt` / `updatedAt` | Date | auto | — | |

#### Embedded `expenses[]` (`monthlyExpenses.model.ts:21-75`)

| Field | Type | Required / Default | Ref |
|---|---|---|---|
| `expenseType` | **String** | required (`'Expense type is required'`) | — |
| `expenseTypeName` | String | required | — |
| `date` | Date | required | — |
| `description` | String | required, maxlength 500 | — |
| `amount` | Number | required | — |
| `status` | Number | required, default ACTIVE (1) | — |
| `createdAt` / `updatedAt` | Date | default `Date.now` (manually updated) | — |
| `createdBy` | ObjectId | **required** | `User` |
| `updatedBy` | ObjectId | **required** | `User` |

## 4. API Endpoints

Base: `/api/v1/monthlyExpenses`. All endpoints allow **SUPERADMIN, ADMIN, TRIPMANAGER, FINANCEOFFICER**.

| Method | Full path | Controller | Description |
|---|---|---|---|
| POST | `/api/v1/monthlyExpenses/advanceSearch` | `advanceSearchMonthlyExpense` | List month documents in a month range. |
| POST | `/api/v1/monthlyExpenses/save/:id` | `saveMonthlyExpense` | Add a line to month doc `:id`. |
| GET | `/api/v1/monthlyExpenses/:id` | `getMonthlyExpenseById` | Month doc with non-deleted lines. |
| PUT | `/api/v1/monthlyExpenses/update/:id/expense/:expenseId` | `updateMonthlyExpense` | Edit a line. |
| DELETE | `/api/v1/monthlyExpenses/delete/:id/expense/:expenseId` | `deleteMonthlyExpense` | Soft-delete a line. |

(`applicationRoutes.monthlyExpenses.activeInactiveGarage` is defined but not routed.)

Auth / envelope / error mapping: see `expenses.md` §4 "Common behaviour". `NotFoundError` → 404; `BadRequestError` → 400; invalid ObjectId → `CastError` → 404.

---

### 4.1 POST `/monthlyExpenses/save/:id` — `saveMonthlyExpense` (`monthlyExpenses.controller.ts:14-89`)

**Params:** `id` = MonthlyExpenses document id.

**Body** (`createNewExpensesSchema`, `monthlyExpenses.validation.ts:3-24`):

| Field | Rule | Messages |
|---|---|---|
| `expenseType` | **number**, required | `Expense type is required` / `Expense type is invalid` |
| `date` | date, required | `Date is required` / `Date is invalid` |
| `expenseTypeName` | string, required | `Expense type name is required` / `... is invalid` |
| `description` | string, required (no max in Joi; model max 500) | `Description is required` / `Description is invalid` |
| `amount` | number, required | `Amount is required` / `Amount is invalid` |

**Logic:**

1. Validate → **400**.
2. `findByIdAndStatusIn(id, [ACTIVE, INACTIVE])` → none → **404** `Monthly expense not found!`; `isMonthEndDone` → **400** `Cannot update monthly expense after month end!`.
3. Start transaction. Push `{expenseType, expenseTypeName, date, description, amount, status: ACTIVE, createdAt/updatedAt: now, createdBy/updatedBy: auth.id}`.
4. `totalExpenses = Σ amount where status === ACTIVE` (over all lines).
5. Build log `MONTHLY_EXPENSES | Expense Created Amount: … | Previous Total Expenses: … | New Total Expenses: … | Correlation ID: …`.
6. Set `totalExpenses`, `updatedBy`; save in session (clears `monthlyExpenses-` cache prefix); commit; log info.
7. **201** `Monthly expense saved successfully!`, `data` = full updated document (all lines, including deleted).

No check that `date` falls inside the document's month.

### 4.2 PUT `/monthlyExpenses/update/:id/expense/:expenseId` — `updateMonthlyExpense` (`:91-164`)

Body: same `createNewExpensesSchema`. Same 404/400 preconditions. In a transaction:

1. Find line by `exp._id.toString() === expenseId` (no status filter) → else **404** `Expense not found in this monthly expense!`.
2. Overwrite `expenseType, expenseTypeName, description, amount, date`; set `updatedAt`, `updatedBy`.
3. Recompute `totalExpenses` (ACTIVE only); log `Expense Updated…`; save; commit.
4. **201** (`StatusCodes.CREATED`) `Expense updated successfully!`, `data` = full document.

### 4.3 DELETE `/monthlyExpenses/delete/:id/expense/:expenseId` — `deleteMonthlyExpense` (`:166-223`)

No body. Same preconditions (month-end message still says "Cannot update…"). In a transaction: line not found → **404**; set line `status = DELETED (3)`, `updatedAt`, `updatedBy`; recompute total; log `Expense Deleted Amount…`; save; commit. **201** `Expense deleted successfully!`, `data` = full document.

### 4.4 POST `/monthlyExpenses/advanceSearch` — `advanceSearchMonthlyExpense` (`:225-251`)

**Body** (`advanceSearchSchema`): `startMonth` date required (`Start Date is required!` / `Start Date is invalid!`), `endMonth` date required (`End Date is required` / `End Date is invalid`).

**Logic:**

1. Validate → 400.
2. `service.advanceSearch(startMonth, endMonth)` (`monthlyExpenses.service.ts:50-65`): `MonthlyExpenses.find({ month: { $gte: startMonth, $lte: endMonth } }).populate({ path: 'createdBy updatedBy', select: '_id userName' }).sort({ startDate: 1 })` — **no status filter**; populated users now carry only `_id` + `userName` (all the DTO needs). Returns hydrated docs (no `.lean()`). Cached 1 week under `monthlyExpenses-AdvanceSearch-<startMonth><endMonth>` (raw body strings).
3. Map to DTO list, then sort by `month` **descending**.
4. **200**, `data: MonthlyExpensesResponseDto[]` (empty array when none).

**DTO** (`MonthlyExpensesResponseDto`): `_id`, `month`, `totalExpenses`, `status`, `isMonthEndDone`, `batchId`, `createdBy` (id), `updatedBy` (id), `createdByUser` (userName or `''`), `updatedByUser`, `createdAt`, `updatedAt`. Lines are **not** included.

### 4.5 GET `/monthlyExpenses/:id` — `getMonthlyExpenseById` (`:253-270`)

`findByIdAndStatusIn(id, [ACTIVE, INACTIVE])`. If found: drop lines with `status === DELETED`, sort remaining by `date` descending. **200** with the raw document (not a DTO) or `data: null` if not found (no 404).

## 5. Business Rules & State Transitions

- **Document lifecycle:** created by month audit for the new working month (`month = UTC 1st`, `monthName`, `year`, `totalExpenses 0`, `status ACTIVE`, `isMonthEndDone false`, `batchId 0`) → editable while `isMonthEndDone = false` → at the next month audit `monthEndDoneForMonthlyExpenses` fetches the open ids and calls `markMonthEndDone`, a single `updateMany` (in the month-end session) setting `isMonthEndDone = true`, `batchId`, `updatedBy`.
- **Line status:** ACTIVE (1) → DELETED (3). No restore. Update does not check line status.
- **Total formula** (recomputed on add/update/delete):
  ```ts
  totalExpenses = expenses.reduce((t, e) => e.status === ACTIVE ? t + e.amount : t, 0) || 0
  ```
- Document `status` must be ACTIVE or INACTIVE to be edited/read by id; nothing in this module changes the document status.

## 6. Utilities & DTOs

| Function | Location | Purpose |
|---|---|---|
| `modelToMonthlyExpensesResponseDto(doc)` | `monthlyExpenses.util.ts:3-18` | Summary DTO (see §4.4). |
| `modelToMonthlyExpensesResponseDtoList(docs)` | `monthlyExpenses.util.ts:20-22` | Array map. |

**Service** (`monthlyExpenses.service.ts`):

| Function | Query | Cache |
|---|---|---|
| `save(doc, session?)` | `doc.save({session})` | Clears prefix `monthlyExpenses-`. |
| `findAllByEndMonthAndStatusIn(endMonth, year, status[])` | See below — `.select('_id').lean()`, returns plain `{_id}` objects | **Not cached** any more. |
| `markMonthEndDone(ids[], userId, batchId, session)` (`:39-43`) | `updateMany({_id:{$in: ids}}, {$set:{isMonthEndDone: true, batchId, updatedBy: userId}}, {session})`; no-op for empty `ids` | Clears prefix `monthlyExpenses-` before the write. |
| `findByIdAndStatusIn(id, status[])` | `findOne({_id, status:{$in}})` | none |
| `advanceSearch(start, end)` | see §4.4 (projected populate) | 1 week (`getCache` now synchronous) |

`findAllByEndMonthAndStatusIn` (used by month audit, `:15-36`):

```ts
let endDate = new Date();            // today
endDate.setFullYear(currYear);
endDate.setMonth(endMonth);          // endMonth is the 1-based working month → acts as "next month" (0-based)
endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);   // local 1st of next month
endDate.setHours(23, 59, 59, 999);                                  // local 23:59:59.999 on that 1st
MonthlyExpenses.find({ month: { $lt: endDate }, status: { $in }, isMonthEndDone: false })
    .select('_id').sort({ startDate: 1 }).lean()
```

## 7. Dependencies

**Uses:** shared `cache`, `constants`, `CommonResponse`, errors, `helperUtil.consoleLogMessage`, `WellKnownStatus`; `User` via populate.

**Used by:**
- `monthAudit` — creates the month document (`save`, `monthAudit.controller.ts:131`) and closes old ones (`findAllByEndMonthAndStatusIn` + `markMonthEndDone`, `:218-224`).
- `report` — `MonthlyExpenses.findOne({ month: UTC 1st })` for the monthly expenses report (`report.service.ts:42`).
- `dashboard` — `monthlyExpensesService.advanceSearch(startFirstDate, endLastDate)` for expense totals.

## 8. Notes / Gotchas

1. **Type mismatch:** Joi requires `expenseType` to be a **number**, the schema stores it as **String** (Mongoose casts it). The report maps it to `typeId: number`.
2. **Wrong status codes:** update and delete return **201 Created**.
3. **Delete message** on month-end lock says `Cannot update monthly expense after month end!`.
4. **`getMonthlyExpenseById` returns 200 with `null`** when not found, while the mutating endpoints return 404.
5. **Sorting on non-existent field:** both `find`s use `.sort({ startDate: 1 })`; the schema has no `startDate`, so it is a no-op.
6. **Cutoff includes the next month's document:** documents are keyed by **UTC 00:00 on the 1st**, while `findAllByEndMonthAndStatusIn` uses `month < local 1st-of-next-month 23:59:59.999` (the `setHours(23,59,59,999)` pushes the cutoff to the *end* of the 1st). For UTC or any UTC+ server timezone (e.g. Sri Lanka, UTC+5:30) the next month's document falls before that cutoff, so if it already exists (month audit re-run, months created out of order) it is also closed. In the normal flow it doesn't exist yet because `createNewDate` creates it after the close-out.
7. **Day-overflow bug** in the cutoff: `new Date()` keeps today's day-of-month; calling `setMonth()` on e.g. the 31st into a 30-day month rolls over into the following month, pushing the cutoff one month further when month end is run on the 29th–31st.
8. **Caching hydrated Mongoose docs** (`advanceSearch`) for one week: the cache now runs with `useClones: false`, so every caller (this controller and the dashboard) receives the **same** document array; any mutation by one caller leaks to later ones. The cache is only cleared on `save` / `markMonthEndDone` in this process, so results go stale if another process/instance writes. (The month-end lookup is no longer cached and no longer mutates/saves documents.)
9. **Advance search has no status filter** (returns DELETED month documents too).
10. No validation that a line's `date` falls inside the document's month, nor that `amount > 0`.
11. Responses from add/update/delete return the whole document including DELETED lines (unlike GET by id which filters them).
12. **Month-end clears the cache before the transaction commits** (`markMonthEndDone`): a concurrent advance search between the clear and the commit can re-cache the pre-close state (`isMonthEndDone: false`) for up to a week.
13. **Bulk close skips per-document save semantics**: `updateMany` doesn't run validators/middleware; `updatedAt` is still bumped by Mongoose timestamps. Equivalent today (no hooks), but any future `pre('save')` hook won't fire at month end.

## Changelog

### 2026-10-25 — synced with uncommitted code changes
- Model: added non-unique index `{ month: 1 }`.
- Service: `findAllByEndMonthAndStatusIn` is no longer cached and now returns `.select('_id').lean()` ids; new `markMonthEndDone` bulk `updateMany` (session-bound) replaces per-document saves at month end.
- Service: `advanceSearch` populates `createdBy`/`updatedBy` with only `_id userName`; cache read is synchronous and the shared cache is `useClones: false` (gotcha 8 adjusted).
- Validation: removed unused `endianness` import (old gotcha 12 resolved); schema line refs shifted by one.
