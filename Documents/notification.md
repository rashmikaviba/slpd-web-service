# Notification Module

Source: `src/modules/notification/`

All endpoints are mounted under the global prefix `/api/v1` (`src/constant.ts:3`, `src/app.ts:43`). Paths below omit the prefix.

---

## 1. Overview

The notification module builds the **in-app notification / to-do list** for office staff. It has **no notification collection**. Every request derives the list on the fly from current data:

| Notification type | Meaning |
|---|---|
| Expense Extension Request | A driver/trip staff member asked for extra trip expense money; it is still pending approval. |
| Vehicle Insurance Renewal | A company vehicle's insurance expires within 7 days (or has already expired). |
| Vehicle License Renewal | A company vehicle's revenue licence expires within 7 days (or has already expired). |
| Driver and Vehicle assign (Pending Trip) | A pending trip starting within 3 days (or already running) lacks an active driver or vehicle assignment. |
| Approve or Reject Leave | A pending leave request starting within 3 days (or already running) needs a decision. |

Its DTO mapper for expense requests is also reused by the expense-request module to push **real-time Socket.IO events** (`new-expense-request`, `expense-request-approved`, `expense-request-rejected`).

---

## 2. Files

| File | Role |
|---|---|
| `notification.route.ts` | Express router for `/notification`. |
| `notification.controller.ts` | `getAllNotifications` plus role-independent fetch helpers. |
| `notification.service.ts` | Mongo queries against ExpenseRequest, Vehicle, Trip, Leave. |
| `notification.util.ts` | Model → DTO mappers, `setMidnightDate`. |
| `dto/expensesExtensionResponseDto.ts` | `ExpensesExtensionResponseDto`. |
| `dto/InsuranceInsuranceRenewalResponseDto.ts` | `InsuranceInsuranceRenewalResponseDto` (used for both insurance and licence). |
| `dto/pendingTripResponseDto.ts` | `PendingTripResponseDto`. |
| `dto/PendingleaveResponseDto.ts` | `PendingLeaveResponseDto`. |

---

## 3. Data Model(s)

None. The module defines no schema. It reads:

| Model | Fields used |
|---|---|
| `ExpenseRequest` (`src/modules/expenseRequest/expenseRequest.model.ts`) | `status` (default `WellKnownLeaveStatus.PENDING` = 1), `tripId` → Trip, `createdBy` → User, `description`, `requestedAmount`, `createdAt` |
| `Vehicle` (`src/modules/vehicle/vehicle.model.ts`) | `insuranceRenewalDate`, `licenseRenewalDate`, `isFreelanceVehicle`, `isRentalVehicle`, `status`, `registrationNumber` |
| `Trip` (`src/modules/trip/trip.model.ts`) | `startDate`, `endDate`, `status`, `drivers[]` (`driver`, `isActive`), `vehicles[]` (`vehicle`, `isActive`), `tripConfirmedNumber` |
| `Leave` (`src/modules/leave/leave.model.ts`) | `startDate`, `endDate`, `status`, `appliedUser` → User (`fullName`) |
| `User` | `fullName`, `userName` (via populate) |

Enum `WellKnownNotificationType` (`src/util/enums/well-known-notification-type.enum.ts`):

| Value | Name |
|---|---|
| 1 | `ExpenseExtensionRequest` |
| 2 | `VehicleInsuranceRenewal` |
| 3 | `VehicleLicenseRenewal` |
| 4 | `PendingTrip` |
| 5 | `PendingLeave` |

---

## 4. API Endpoints

Base path `/notification` (`src/applicationRoutes.ts:127-130`, mounted `src/mapping.ts:39`).

| Method | Full path | Controller | Auth | Description |
|---|---|---|---|---|
| GET | `/notification/` | `getAllNotifications` | `authorize([])`: any authenticated, non-blocked user | Role-based list of derived notifications, newest first. |

Auth: Bearer JWT required, otherwise `401 "Authentication invalid!"`. An expired token gives `401 "Your session is expired!"`, an invalid one `403`, and a blocked account `401 "Your account is blocked, Please contact admin!"` (`src/middleware/auth.middleware.ts`). Role filtering is done in the controller, not the middleware.

### 4.1 GET `/notification/` — `getAllNotifications` (`notification.controller.ts:9`)

**Params/query/body:** none. Uses `req.auth.role`.

**Logic:**
1. `response = []`.
2. By role (`src/constant.ts` ids):

   | Role | Notifications included |
   |---|---|
   | SUPERADMIN (1), ADMIN (2), FINANCEOFFICER (4), TRIPMANAGER (5) | all four groups: expense requests, vehicle renewals, pending trips, pending leaves |
   | DRIVER (3) | none (empty branch) |
   | DRIVERASSISTANT (6), TRIPASSISTANT (7), other | none (no branch) |

   The four groups are fetched **sequentially** (one `await` after another) and concatenated.
3. Sort the combined list by `createdAt` descending (`new Date(b.createdAt) - new Date(a.createdAt)`). For non-expense items, `createdAt` is a synthetic "notify-from" date (see below).

**Response:** `200 ''`, `data`: a heterogeneous array of the DTOs in §4.2–4.5 (distinguish them by `type`).

**Errors:** no explicit errors. Unexpected errors (e.g. a leave whose `appliedUser` no longer exists) go to the global handler as `500`.

### 4.2 Group: pending expense extension requests

`notificationService.getPendingExpenseRequest()` (`notification.service.ts:9`):
```js
ExpenseRequest.find({ status: WellKnownLeaveStatus.PENDING /* 1 */ }).populate('tripId createdBy')
```
No date window, no sort.

Mapped by `modelToExpensesExtensionResponseDto`:

| Field | Value |
|---|---|
| `_id` | expense request id |
| `tripId` | `tripId._id` or `''` |
| `type` / `typeName` | `1` / `"Expense Extension Request"` |
| `description` | request description or `''` |
| `requestedAmount` | or `0` |
| `requestedUserId` | `createdBy._id` or `''` |
| `requestedUserName` | `` `${createdBy.fullName} (${createdBy.userName})` `` |
| `tripConfirmedNumber` | `tripId.tripConfirmedNumber` |
| `createdAt` | request's real `createdAt` |

### 4.3 Group: vehicle insurance / licence renewals

`notificationService.findVehicleRenewalBy7DaysBefore()` (`notification.service.ts:15`):
1. `date = today + 7 days`, at 00:00:00.000 (server local time).
2. Query (lean):
   ```js
   Vehicle.find({
     $or: [{ insuranceRenewalDate: { $lte: date } }, { licenseRenewalDate: { $lte: date } }],
     isFreelanceVehicle: false,
     isRentalVehicle: false,
     status: { $ne: DELETED }     // ACTIVE and INACTIVE vehicles
   })
   ```
3. For each vehicle, push `{...vehicle, insuranceRenewalFlag: true}` if `insuranceRenewalDate <= date`, and separately `{...vehicle, licenseRenewalFlag: true}` if `licenseRenewalDate <= date`. One vehicle can therefore produce **two** notifications with the same `_id`.

There is no lower bound, so long-expired dates keep appearing until the renewal date is updated.

Mapped by `modelToInsuranceInsuranceRenewalResponseDto`:

| Field | Insurance item | Licence item |
|---|---|---|
| `_id` | vehicle id | vehicle id |
| `type` | `2` | `3` |
| `typeName` | `"Insurance Renewal"` | `"License Renewal"` |
| `expiryDate` | `insuranceRenewalDate` | `licenseRenewalDate` |
| `vehicleName` | `registrationNumber` or `''` | same |
| `createdAt` | `insuranceRenewalDate − 7 days`, at 00:00 | `licenseRenewalDate − 7 days`, at 00:00 |
| `description` | `''` | `''` |

(If neither flag is set, which cannot happen from this service, `type=0`, `typeName=''`, `expiryDate=now` and `createdAt=today 00:00`.)

### 4.4 Group: pending trips missing driver/vehicle

`notificationService.findTripsBy3DaysBefore()` (`notification.service.ts:52`):
```js
date  = today + 3 days @ 00:00 local;  today = today @ 00:00 local
Trip.find({
  startDate: { $lte: date },
  endDate:   { $gte: today },
  $or: [
    { drivers:  { $exists: true, $eq: [] } },   // no drivers
    { 'drivers.isActive': false },              // ANY driver entry inactive
    { vehicles: { $exists: true, $eq: [] } },   // no vehicles
    { 'vehicles.isActive': false },             // ANY vehicle entry inactive
  ],
  status: WellKnownTripStatus.PENDING           // 1
}).lean()
```

Mapped by `modelToPendingTripResponseDto`:

| Field | Value |
|---|---|
| `_id` | trip id |
| `type` / `typeName` | `4` / `"Driver and Vehicle assign"` |
| `tripConfirmedNumber` | trip's confirmed number |
| `description` | `''` |
| `startDate` | trip start date |
| `createdAt` | `startDate − 3 days`, at 00:00 |

### 4.5 Group: pending leaves

`notificationService.findPendingLeaveBy3DaysBefore()` (`notification.service.ts:75`):
```js
Leave.find({
  startDate: { $lte: today + 3 days @ 00:00 },
  endDate:   { $gte: today @ 00:00 },
  status: WellKnownLeaveStatus.PENDING          // 1
}).populate('appliedUser').lean()
```

Mapped by `modelToPendingLeaveResponseDto`:

| Field | Value |
|---|---|
| `_id` | leave id |
| `type` / `typeName` | `5` / `"Approve or Reject Leave"` |
| `appliedBy` | `appliedUser.fullName` or `''` |
| `description` | `''` |
| `startDate` | leave start date |
| `createdAt` | `startDate − 3 days`, at 00:00 |

---

## 5. Business Rules & Calculations

- **Notification windows** (server local midnight):
  - Vehicle renewals: `renewalDate ≤ today + 7d` (includes overdue).
  - Pending trips / leaves: `startDate ≤ today + 3d` **and** `endDate ≥ today` (upcoming within 3 days or currently in progress).
- **Synthetic `createdAt`** (used only for sorting/display): `setMidnightDate(eventDate, N)` = event date minus N days at 00:00 (N = 7 for renewals, 3 for trips/leaves). This is the date the notification "became active".
- **Ordering**: all items sorted by `createdAt` descending.
- **Eligibility**: only company vehicles (not freelance, not rental) generate renewal notifications. Only PENDING trips/leaves/expense requests are included.
- Nothing is stored. There is no read/unread state, no dismissal and no pagination.

---

## 6. Utilities & DTOs

### 6.1 `notification.util.ts`

| Function | Purpose |
|---|---|
| `modelToExpensesExtensionResponseDto(expenseRequest)` / `modelsToExpensesExtensionResponseDto(list)` | §4.2. Also imported by `src/modules/expenseRequest/expenseRequest.controller.ts:17,79,172,246`. |
| `modelToInsuranceInsuranceRenewalResponseDto(v)` / `modelsToInsuranceInsuranceRenewalResponseDtos(list)` | §4.3. |
| `modelToPendingTripResponseDto(trip)` / `modelsToPendingTripResponseDtos(list)` | §4.4. |
| `modelToPendingLeaveResponseDto(leave)` / `modelsToPendingLeaveResponseDtos(list)` | §4.5. |
| `setMidnightDate(date, beforeDateCount)` (private) | `d = new Date(date); d.setDate(d.getDate() - beforeDateCount); d.setHours(0,0,0,0)`. |

### 6.2 DTO interfaces

- `ExpensesExtensionResponseDto`: `_id, tripId, type, typeName, requestedAmount, requestedUserId, requestedUserName, tripConfirmedNumber, description, createdAt`.
- `InsuranceInsuranceRenewalResponseDto`: `_id (vehicle id), type, typeName, vehicleName, expiryDate, description, createdAt`.
- `PendingTripResponseDto`: `_id (trip id), type, tripConfirmedNumber, typeName, description, startDate, createdAt`.
- `PendingLeaveResponseDto`: `_id (leave id), type, appliedBy, typeName, description, startDate, createdAt`.

### 6.3 Real-time push (outside this module, uses its DTO)

`src/config/soket.config.ts` keeps an in-memory map `userWithRoleId → socket.id`. The key comes from the client handshake query `userWithRoleId`, and `getActiveSocketIdsByRoles(roles)` selects keys whose string **starts with** the role id. `expenseRequest.controller.ts` emits to SUPERADMIN, ADMIN, FINANCEOFFICER and TRIPMANAGER sockets:
- `new-expense-request`: `{message: "New expense request has been created for trip <no> by <name> ", data: ExpensesExtensionResponseDto}` (on create),
- `expense-request-approved`: `{message: '', data}` (on approve),
- `expense-request-rejected`: `{message: '', data}` (on reject).

The front end presumably re-fetches `GET /notification/` or merges these events into its list.

---

## 7. Dependencies

**Reads:** `ExpenseRequest`, `Vehicle`, `Trip`, `Leave`, `User` (populate) models directly (not through their services, and without caching). Enums `WellKnownLeaveStatus`, `WellKnownStatus`, `WellKnownTripStatus`, `WellKnownNotificationType`.

**Writes:** none.

**Depended on by:** `src/modules/expenseRequest/expenseRequest.controller.ts` (imports `notificationUtil` and `ExpensesExtensionResponseDto` for socket payloads).

---

## 8. Notes / Gotchas

1. **The expense-request status is filtered with `WellKnownLeaveStatus.PENDING`**: this works only because the ExpenseRequest model also uses the leave-status enum (`expenseRequest.model.ts:1,38`). It is a cross-domain enum reuse.
2. **`requestedUserName` fallback never applies**: `fullName + ' ' + \`(${userName})\` || ''`. The `|| ''` binds to an always-truthy string, so a missing `createdBy` yields `"undefined (undefined)"`.
3. **Pending-trip false positives**: `'drivers.isActive': false` matches if **any** driver entry is inactive, e.g. a trip whose first driver was replaced (old entry inactive, new entry active) is still flagged. The same applies to vehicles.
4. **3-day / 7-day window edge**: the upper bound is midnight at the start of day +3 / +7, so a trip or leave starting at, say, 08:00 on day +3 is not included until the next day. Behaviour also depends on server TZ.
5. **Duplicate `_id`s**: a vehicle with both insurance and licence due returns two items with the same `_id`. Clients keying lists by `_id` should combine `type` + `_id`.
6. **Overdue renewals never expire from the list**, and INACTIVE vehicles are included (`status: {$ne: DELETED}`).
7. **Null `appliedUser` crashes the endpoint**: `leave.appliedUser.fullName` has no optional chaining (`notification.util.ts:97`), so a leave whose user was removed gives a `500` for every admin.
8. **No role restriction at the route level**: drivers and assistants get `200` with an empty array. The SUPERADMIN/ADMIN/FINANCEOFFICER/TRIPMANAGER branches are identical copies.
9. **Sequential queries and no caching**: four DB round-trips per call, run one after another. Expense requests have no date window, so old un-actioned requests accumulate.
10. **Socket role matching by prefix**: `key.startsWith(role.toString())` means role `1` would also match keys beginning with `1x...` if the key format were ambiguous. This depends on the client's `userWithRoleId` format (`soket.config.ts:20-22`). The socket map is also per-process (it does not work across multiple instances).
11. The DTO filename/type name `InsuranceInsuranceRenewalResponseDto` is duplicated wording; it covers both insurance and licence renewals.
