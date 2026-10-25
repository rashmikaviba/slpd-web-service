# Expense Request Module (`src/modules/expenseRequest`)

## 1. Overview

An **Expense Request** (a.k.a. "Expense Extension Request") is raised by a **driver** during a running trip when the cash float (`Trip.estimatedExpense`) given for trip expenses is not enough. Office staff (super admin, admin, trip manager, finance officer) then **approve** it with an approved amount — which is **added to the trip's `estimatedExpense`** — or **reject** it with a remark. Real-time socket notifications are pushed to connected office users, and pending requests also appear in the notification feed (`notification` module).

Only one *pending* request per trip is allowed at a time.

## 2. Files

| File | Role |
|---|---|
| `expenseRequest.model.ts` | Mongoose model `ExpenseRequest` (named export). |
| `expenseRequest.route.ts` | Router: 4 endpoints with role authorization. |
| `expenseRequest.controller.ts` | Handlers: create, approve, reject, get by id. Emits socket events via local helpers `getAdminSocketIds` / `emitExpenseRequestEvent`. |
| `expenseRequest.service.ts` | Save, find by trip (cached), find by id (populated). |
| `expenseRequest.validation.ts` | Joi schemas for create/approve/reject. |
| `expenseRequest.util.ts` | Mappers to `ExpenseRequestByIdResponseDto`. |
| `dto/ExpenseRequestByIdResponseDto.ts` | Response DTO for "get by id" (includes requester bank details). |

## 3. Data Model

### Collection `expenserequests` (model `ExpenseRequest`) — `expenseRequest.model.ts`

Options: `timestamps: true`, `versionKey: false`. No hooks or virtuals.

**Indexes** (`expenseRequest.model.ts:57-59`, non-unique): `{ tripId: 1, status: 1 }` (backs `findByTripIdAndStatusIn`) and `{ status: 1 }` (backs the notification feed's `find({status: PENDING})`). There is no unique/partial index enforcing "one PENDING per trip".

| Field | Type | Required / Default | Ref | Notes |
|---|---|---|---|---|
| `tripId` | ObjectId | required (`'Trip is required'`) | `Trip` | |
| `requestedAmount` | Number | required (`'Requested Amount is required'`) | — | |
| `description` | String | maxlength 500 | — | |
| `approvedAmount` | Number | default `0` | — | Set on approval. |
| `rejectRemark` | String | default `null`, maxlength 500 | — | Set on rejection. |
| `status` | Number | default `WellKnownLeaveStatus.PENDING` (1) | — | Reuses the **leave** status enum: 1 PENDING, 2 APPROVED, 3 REJECTED, 4 CANCELLED (4 never used here). |
| `createdBy` | ObjectId | — | `User` | The requesting driver. |
| `updatedBy` | ObjectId | — | `User` | Approver/rejecter. |
| `createdAt` / `updatedAt` | Date | auto | — | |

## 4. API Endpoints

Base: `/api/v1/expenseRequest`.

| Method | Full path | Controller | Allowed roles | Description |
|---|---|---|---|---|
| POST | `/api/v1/expenseRequest/` | `requestMoreExpenses` | DRIVER only | Create an expense extension request. |
| PUT | `/api/v1/expenseRequest/approve/:id` | `approveExpensesRequest` | SUPERADMIN, ADMIN, TRIPMANAGER, FINANCEOFFICER | Approve and increase trip budget. |
| PUT | `/api/v1/expenseRequest/reject/:id` | `rejectExpensesRequest` | SUPERADMIN, ADMIN, TRIPMANAGER, FINANCEOFFICER | Reject with remark. |
| GET | `/api/v1/expenseRequest/:id` | `getExpenseExtension` | any authenticated user | Get request detail incl. requester bank info. |

Auth, envelope and error mapping are the shared ones (see `expenses.md` §4 "Common behaviour"): 401/403 from `authorize`, `{isSuccessful, timeStamp, message, data}` envelope, `BadRequestError` → 400, Mongoose `CastError` (invalid ObjectId) → 404 `No item found with ID "<v>"!`.

---

### 4.1 POST `/expenseRequest/` — `requestMoreExpenses` (`expenseRequest.controller.ts:48-113`)

**Body** (`saveExpenseRequestSchema`, `expenseRequest.validation.ts:3-18`):

| Field | Rule | Messages |
|---|---|---|
| `tripId` | string, required | `Type is required` / `Type is invalid` (copy-paste messages) |
| `requestedAmount` | number, required | `Requested Amount is required` / `Requested Amount is invalid` |
| `description` | string, max 500, allows `null`/`''` | `Description should not be more than 500 characters` / `Description is invalid` |

**Logic** (no transaction; the old no-op `try/catch → rethrow` wrapper is gone, errors go straight to the error middleware):

1. Validate → **400** with Joi message.
2. `tripService.findByIdAndStatusIn(tripId, [START])` → else **400** `Invalid trip or trip is not in started status!`.
3. `expenseRequestService.findByTripIdAndStatusIn(tripId, [PENDING])` (cached) → if any → **400** `You already have a pending expense request for this trip. If you need immediate assistance, please contact the administrator!`.
4. Create `ExpenseRequest { tripId, requestedAmount, description, createdBy: auth.id, updatedBy: auth.id }` (status defaults to PENDING); `save` clears cache prefix `expenseRequest-`.
5. Socket notify: `getAdminSocketIds()` (= `getActiveSocketIdsByRoles([SUPERADMIN, ADMIN, FINANCEOFFICER, TRIPMANAGER])`, `:21-27`); re-load the request via `findByIdAndStatusIn(id, [PENDING])` (populates `tripId createdBy`). `emitExpenseRequestEvent` (`:29-46`) emits only if sockets exist and the doc was found — here **`new-expense-request`** with:
   ```js
   { message: `New expense request has been created for trip ${tripConfirmedNumber} by ${requestedUserName} `,
     data: ExpensesExtensionResponseDto }
   ```
6. **201** `Expense request saved successfully!`, `data: null`.

### 4.2 PUT `/expenseRequest/approve/:id` — `approveExpensesRequest` (`expenseRequest.controller.ts:115-197`)

**Body** (`approveExpenseRequestSchema`): `approvedAmount` number, required (`Approved Amount is required` / `Approved Amount is invalid`).

**Logic** (inside a Mongo transaction):

1. Validate → 400.
2. Start session + transaction.
3. `findByIdAndStatusIn(id, [PENDING, APPROVED, REJECTED])` (populated) → else **400** `No expense requests were not found.!`.
4. If `status == APPROVED` → **400** `Expense request already approved!`; if `REJECTED` → **400** `Expense request already rejected!`.
5. Trip `findByIdAndStatusIn(request.tripId._id, [START])` → else **400** `Invalid trip or trip is not in started status!`.
6. Update request: `approvedAmount = body.approvedAmount`, `status = APPROVED`, `updatedBy = auth.id`; save in session.
7. Build log line `EXPENSE_REQUEST_APPROVED: Previously estimated expense : X | Approved additional amount : Y | New estimated expense : X+Y | Trip ID | Approved By | Correlation ID`.
8. **Side effect on Trip:** `trip.estimatedExpense += body.approvedAmount`, `trip.updatedBy = auth.id`; `tripService.save(trip, session)`.
9. `emitExpenseRequestEvent(getAdminSocketIds(), 'expense-request-approved', expenseRequest)` → `{ message: '', data: ExpensesExtensionResponseDto }` to office roles (before commit).
10. `helperUtil.consoleLogMessage("info", logMessage)`.
11. Send **200** `Expense request approved successfully!`, `data: null`, **then** commit.
12. On error: abort, rethrow; always `endSession()`.

### 4.3 PUT `/expenseRequest/reject/:id` — `rejectExpensesRequest` (`expenseRequest.controller.ts:199-246`)

**Body** (`rejectExpenseRequestSchema`): `rejectRemark` string, max 500, allows `null`/`''`, optional.

**Logic** (no transaction):

1. Validate → 400.
2. Load request with statuses PENDING/APPROVED/REJECTED → else **400** `No expense requests were found.!`.
3. Already APPROVED / REJECTED → **400** `Expense request already approved!` / `Expense request already rejected!`.
4. **No trip status check.** Set `status = REJECTED`, `updatedBy`, `rejectRemark`; save (clears cache).
5. `emitExpenseRequestEvent(..., 'expense-request-rejected', expenseRequest)` → `{ message: '', data: ExpensesExtensionResponseDto }`.
6. **200** `Expense request rejected successfully!`, `data: null`.

### 4.4 GET `/expenseRequest/:id` — `getExpenseExtension` (`expenseRequest.controller.ts:248-269`)

1. Load request (PENDING/APPROVED/REJECTED) with `tripId` and `createdBy` populated → else **400** `No expense requests were found.!`.
2. Map via `modelToExpensesRequestByIdResponseDto` → **200**.

**Response DTO** (`ExpenseRequestByIdResponseDto`):

| Field | Source |
|---|---|
| `_id` | request id |
| `tripId` | `tripId._id` or `''` |
| `typeName` | constant `'Expense Extension Request'` |
| `description` | or `''` |
| `requestedAmount` | or `0` |
| `requestedUserId` | `createdBy._id` or `''` |
| `requestedUserName` | `createdBy.fullName` or `''` |
| `bankName`, `bankId`, `branch`, `accountNumber`, `accountHolderName`, `accountHolderAddress` | from requester `User` or `''` |
| `tripConfirmedNumber` | `tripId.tripConfirmedNumber` |
| `createdAt` | request `createdAt` |

Note: `status`, `approvedAmount` and `rejectRemark` are **not** included.

## 5. Business Rules & State Transitions

```
PENDING (1) ──approve──▶ APPROVED (2)   [trip must be START; trip.estimatedExpense += approvedAmount]
PENDING (1) ──reject───▶ REJECTED (3)   [no trip check]
APPROVED / REJECTED are terminal (both actions return 400 "already approved/rejected").
```

- Create requires trip status **START** and **no other PENDING** request for that trip.
- Approval formula: `trip.estimatedExpense_new = trip.estimatedExpense_old + approvedAmount`. `approvedAmount` is independent of `requestedAmount` (may be higher, lower, zero or negative — no validation).
- The increased `estimatedExpense` feeds the expenses module (`remainingTripExpensesAmount`, driver salary `remaining`) and reports.
- Trip module rule: a trip cannot be reverted from START to PENDING while any PENDING or APPROVED request exists for it (`trip.controller.ts:821-844, 930-935`).

### Socket events

Recipients: socket IDs from `useSocketMap` whose key (client-supplied `userWithRoleId` handshake query) starts with role id 1, 2, 4 or 5 (`src/config/soket.config.ts:18-26`).

| Event | When | Payload |
|---|---|---|
| `new-expense-request` | after create | `{ message, data: ExpensesExtensionResponseDto }` |
| `expense-request-approved` | approve (before commit) | `{ message: '', data }` |
| `expense-request-rejected` | reject | `{ message: '', data }` |

`ExpensesExtensionResponseDto` (`notification.util.ts:7-25`): `_id`, `tripId`, `type = 1 (ExpenseExtensionRequest)`, `typeName`, `description`, `requestedAmount`, `requestedUserId`, `requestedUserName = "<fullName> (<userName>)"`, `tripConfirmedNumber`, `createdAt`.

## 6. Utilities & DTOs

| Function | Location | Purpose |
|---|---|---|
| `modelToExpensesRequestByIdResponseDto(req)` | `expenseRequest.util.ts:3-24` | Single-doc mapper (see DTO table). |
| `modelsToExpensesRequestByIdResponseDto(reqs[])` | `expenseRequest.util.ts:26-32` | Array version (unused within this module). |
| `getAdminSocketIds()` | `expenseRequest.controller.ts:21-27` | Socket ids of SUPERADMIN/ADMIN/FINANCEOFFICER/TRIPMANAGER (not exported). |
| `emitExpenseRequestEvent(sockets, event, doc, getMessage?)` | `expenseRequest.controller.ts:29-46` | If `sockets.length > 0 && doc`: maps with `modelToExpensesExtensionResponseDto` and `io.to(sockets).emit(event, {message: getMessage(dto) ?? '', data: dto})`. Default message `''` (not exported). |

**Service** (`expenseRequest.service.ts`):

| Function | Query | Cache |
|---|---|---|
| `save(doc, session?)` | `doc.save({session})` | Clears prefix `expenseRequest-` first. |
| `findByTripIdAndStatusIn(tripId, status[])` | `ExpenseRequest.find({tripId, status:{$in}})` (full docs) | Cached 1 week, key `expenseRequest-<tripId><JSON status>`; `getCache` is now synchronous and, with the cache's `useClones: false`, returns the shared stored array (read-only by convention). |
| `findByIdAndStatusIn(id, status[])` | `findOne({_id, status:{$in}}).populate('tripId createdBy')` | Not cached. |

## 7. Dependencies

**Uses:** `trip` service/model (status check, `estimatedExpense` update), `User` (populate), `notification.util` (`modelToExpensesExtensionResponseDto`) + `ExpensesExtensionResponseDto`, `config/soket.config` (`io`, `getActiveSocketIdsByRoles`), `helperUtil.consoleLogMessage`, `cache`, `constants`.

**Used by:**
- `trip.controller.ts:821, 930` — `expenseRequestService.findByTripIdAndStatusIn` to block reverting a trip to PENDING.
- `notification.service.ts:9-15` — `ExpenseRequest.find({status: PENDING})` with projected populates (`tripId: _id tripConfirmedNumber`, `createdBy: _id fullName userName`) and `.lean()` for the notification feed (uses the new `{status: 1}` index).

## 8. Notes / Gotchas

1. **Response before commit / socket before commit** in approve (`:176-190`): client gets 200 and admins get `expense-request-approved` before `commitTransaction()`; a failed commit leaves them inconsistent with the DB.
2. **No amount validation**: `approvedAmount` and `requestedAmount` can be negative or zero; `approvedAmount` may exceed `requestedAmount`. A negative approval reduces the trip budget.
3. **No trip-assignment check**: any DRIVER can raise a request on any started trip.
4. **Stuck pending requests**: approval requires the trip to be START; once the trip is FINISHED a pending request can only be rejected.
5. **Reject has no transaction or trip check**, unlike approve.
6. **Copy-paste validation messages**: `tripId` errors say `Type is required` / `Type is invalid`.
7. Message typo/double negative: approve not-found message is `No expense requests were not found.!`.
8. **Cache race**: `save` clears the `expenseRequest-` prefix before the write; a concurrent `findByTripIdAndStatusIn` can re-cache pre-write data for a week, letting the "one pending per trip" check or the trip-revert guard read stale data. Cache is per-process (`node-cache`). The new indexes don't change this — there is still no DB-level uniqueness for one PENDING request per trip, so two concurrent creates can both pass the check.
9. Status reuses `WellKnownLeaveStatus` (leave enum) rather than a dedicated enum.
10. `getExpenseExtension` DTO omits `status`, `approvedAmount`, `rejectRemark` — the client cannot see the outcome from this endpoint, but does see the requester's **bank account details**, and the endpoint is open to every authenticated role (including other drivers).
11. `requestedUserName` in the socket DTO is built as `fullName + ' ' + (userName)` and the `|| ''` fallback never triggers (string concat is always truthy), so a missing user renders `undefined (undefined)`.
12. Since the cache runs with `useClones: false`, `findByTripIdAndStatusIn` hands every caller the same cached array of live Mongoose documents; current callers only read `.length`, but any future mutation would leak into the cache.

## Changelog

### 2026-10-25 — synced with uncommitted code changes
- Model: added non-unique indexes `{ tripId: 1, status: 1 }` and `{ status: 1 }`.
- Controller: socket fan-out extracted into local helpers `getAdminSocketIds` and `emitExpenseRequestEvent` (same events, payloads and "only if sockets and doc" guard); no-op `try/catch → rethrow` wrappers removed; line references updated.
- Service: `getCache` read is synchronous; shared cache now `useClones: false` (gotcha 12).
- Cross-module: notification feed query now uses projected populates + `.lean()`; trip revert-guard line refs updated.
