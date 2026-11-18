# Notification

Builds the in-app notification list on demand. Nothing is stored: every call re-queries pending expense-extension requests, vehicles with insurance/licence renewal due within 7 days, pending trips starting within 3 days that still lack an active driver/vehicle, and pending leave requests starting within 3 days. There is no read/unread state. Real-time pushes (Socket.IO) are emitted elsewhere (expenseRequest module) but reuse this module's DTO mapper; all emits in the codebase are listed at the end. Auth middleware, `CommonResponse`, roles, enums and the socket config are described in [README.md](README.md).

## Files

| File | Responsibility |
|---|---|
| `src/modules/notification/notification.route.ts` | One GET route, `authorize([])` (any authenticated role). |
| `src/modules/notification/notification.controller.ts` | `getAllNotifications` + 4 private collectors. |
| `src/modules/notification/notification.service.ts` | 4 direct Mongoose queries (ExpenseRequest, Vehicle, Trip, Leave). |
| `src/modules/notification/notification.util.ts` | Model → notification DTO mappers, `setMidnightDate`. |
| `src/modules/notification/dto/expensesExtensionResponseDto.ts` | Expense extension DTO (also used in socket payloads). |
| `src/modules/notification/dto/InsuranceInsuranceRenewalResponseDto.ts` | Vehicle insurance/licence renewal DTO. |
| `src/modules/notification/dto/pendingTripResponseDto.ts` | Pending trip DTO. |
| `src/modules/notification/dto/PendingleaveResponseDto.ts` | Pending leave DTO. |

## Endpoints

Base path: `/api/v1/notification` (`applicationRoutes.notification`).

| Method | Path | Roles allowed | Validation schema | Handler |
|---|---|---|---|---|
| GET | `/api/v1/notification/` | any authenticated, non-blocked user (`authorize([])` skips the role check) | none | `getAllNotifications` |

## Endpoint logic

### GET `/` — `getAllNotifications` (notification.controller.ts:9)

Request: no params/query/body. Uses `req.auth.role` from the JWT payload.

1. `response = []`.
2. Branch on `auth.role`:
   | Role | Notifications returned |
   |---|---|
   | SUPERADMIN (1) | all 4 types |
   | ADMIN (2) | all 4 types |
   | FINANCEOFFICER (4) | all 4 types |
   | TRIPMANAGER (5) | all 4 types |
   | DRIVER (3) | none (empty branch) |
   | DRIVERASSISTANT (6), TRIPASSISTANT (7) | none (no branch) |

   For the four roles the collectors run **sequentially** in this order and are concatenated:
   1. `getPendingExpenseExtensionRequests()` → type 1
   2. `getVehicleRenewalRequests()` → types 2 / 3
   3. `getPendingAndDriverVehicleNotAssignedTrips()` → type 4
   4. `getPendingLeaves()` → type 5
3. Sort descending by `new Date(createdAt).getTime()` (newest first). For types 2–5 `createdAt` is synthetic (see below).
4. `CommonResponse(res, true, 200, '', response)`.

No try/catch: errors (e.g. a null populate dereference) reach the global error middleware.

Response `data`: heterogeneous array; discriminate by `type` (`WellKnownNotificationType`). Shapes below.

## Notification types

### 1 — ExpenseExtensionRequest

- Query: `notificationService.getPendingExpenseRequest()` (notification.service.ts:9) → `ExpenseRequest.find({ status: WellKnownLeaveStatus.PENDING (1) }).populate('tripId createdBy')`. No date window — every pending request appears until approved/rejected.
- Mapper: `modelToExpensesExtensionResponseDto` (notification.util.ts:7).

| Field | Value |
|---|---|
| `_id` | ExpenseRequest id |
| `tripId` | `tripId._id` or `''` |
| `type` | `1` |
| `typeName` | `'Expense Extension Request'` |
| `description` | request `description` or `''` |
| `requestedAmount` | `requestedAmount` or `0` |
| `requestedUserId` | `createdBy._id` or `''` |
| `requestedUserName` | `"<createdBy.fullName> (<createdBy.userName>)"` |
| `tripConfirmedNumber` | `tripId.tripConfirmedNumber` |
| `createdAt` | real `ExpenseRequest.createdAt` |

### 2 — VehicleInsuranceRenewal / 3 — VehicleLicenseRenewal

- Query: `findVehicleRenewalBy7DaysBefore()` (notification.service.ts:15):
  - `date` = today + 7 days, set to 00:00:00.000 server local time.
  - `Vehicle.find({ $or: [{ insuranceRenewalDate: {$lte: date} }, { licenseRenewalDate: {$lte: date} }], isFreelanceVehicle: false, isRentalVehicle: false, status: {$ne: DELETED(3)} }).lean()` — company vehicles only, ACTIVE and INACTIVE included, **no lower bound** (already-overdue dates keep appearing).
  - For each vehicle, push `{...vehicle, insuranceRenewalFlag: true}` if `insuranceRenewalDate <= date`, and separately `{...vehicle, licenseRenewalFlag: true}` if `licenseRenewalDate <= date`. A vehicle due for both yields two entries with the same `_id`.
- Mapper: `modelToInsuranceInsuranceRenewalResponseDto` (notification.util.ts:35).

| Field | Insurance (flag `insuranceRenewalFlag`) | Licence (flag `licenseRenewalFlag`) | Neither (unreachable) |
|---|---|---|---|
| `_id` | vehicle id | vehicle id | vehicle id |
| `type` | `2` | `3` | `0` |
| `typeName` | `'Insurance Renewal'` | `'License Renewal'` | `''` |
| `expiryDate` | `insuranceRenewalDate` | `licenseRenewalDate` | `new Date()` |
| `vehicleName` | `registrationNumber` or `''` | same | same |
| `createdAt` | `insuranceRenewalDate − 7 days`, 00:00 local | `licenseRenewalDate − 7 days`, 00:00 local | today 00:00 |
| `description` | `''` | `''` | `''` |

### 4 — PendingTrip ("Driver and Vehicle assign")

- Query: `findTripsBy3DaysBefore()` (notification.service.ts:52):
  - `date` = today + 3 days 00:00 local; `today` = today 00:00 local.
  - `Trip.find({ startDate: {$lte: date}, endDate: {$gte: today}, status: PENDING(1), $or: [ {drivers: {$exists: true, $eq: []}}, {'drivers.isActive': false}, {vehicles: {$exists: true, $eq: []}}, {'vehicles.isActive': false} ] }).lean()`.
  - i.e. pending trips that start within the next 3 days (or already started but not ended) and have no drivers, or any inactive driver entry, or no vehicles, or any inactive vehicle entry.
- Mapper: `modelToPendingTripResponseDto` (notification.util.ts:73).

| Field | Value |
|---|---|
| `_id` | trip id |
| `type` | `4` |
| `tripConfirmedNumber` | trip `tripConfirmedNumber` |
| `typeName` | `'Driver and Vehicle assign'` |
| `description` | `''` |
| `startDate` | trip `startDate` |
| `createdAt` | `startDate − 3 days`, 00:00 local |

### 5 — PendingLeave ("Approve or Reject Leave")

- Query: `findPendingLeaveBy3DaysBefore()` (notification.service.ts:75): `Leave.find({ startDate: {$lte: today+3 00:00}, endDate: {$gte: today 00:00}, status: WellKnownLeaveStatus.PENDING(1) }).populate('appliedUser').lean()`.
- Mapper: `modelToPendingLeaveResponseDto` (notification.util.ts:91).

| Field | Value |
|---|---|
| `_id` | leave id |
| `type` | `5` |
| `appliedBy` | `appliedUser.fullName` or `''` |
| `typeName` | `'Approve or Reject Leave'` |
| `description` | `''` |
| `startDate` | leave `startDate` |
| `createdAt` | `startDate − 3 days`, 00:00 local |

## Service layer (notification.service.ts)

| Function | Query |
|---|---|
| `getPendingExpenseRequest()` (:9) | `ExpenseRequest.find({status: 1}).populate('tripId createdBy')` |
| `findVehicleRenewalBy7DaysBefore()` (:15) | see type 2/3; returns flagged copies |
| `findTripsBy3DaysBefore()` (:52) | see type 4; returns `trips \|\| []` |
| `findPendingLeaveBy3DaysBefore()` (:75) | see type 5; returns `leaves \|\| []` |

No cache is used by this module; every request hits MongoDB 4 times.

## Utilities / DTOs (notification.util.ts)

| Function | Input → Output |
|---|---|
| `modelToExpensesExtensionResponseDto(expenseRequest)` / `modelsToExpensesExtensionResponseDto(list)` | ExpenseRequest (with `tripId`, `createdBy` populated) → `ExpensesExtensionResponseDto` (type 1 table). Also imported by `expenseRequest.controller.ts` for socket payloads. |
| `modelToInsuranceInsuranceRenewalResponseDto(v)` / `modelsToInsuranceInsuranceRenewalResponseDtos(list)` | flagged lean Vehicle → `InsuranceInsuranceRenewalResponseDto` (type 2/3 table) |
| `modelToPendingTripResponseDto(trip)` / `modelsToPendingTripResponseDtos(list)` | lean Trip → `PendingTripResponseDto` |
| `modelToPendingLeaveResponseDto(leave)` / `modelsToPendingLeaveResponseDtos(list)` | lean Leave (`appliedUser` populated) → `PendingLeaveResponseDto` |
| `setMidnightDate(date, beforeDateCount)` (:111, not exported) | `new Date(date)` minus `beforeDateCount` days, time set to 00:00:00.000 local |

DTO interfaces:
- `ExpensesExtensionResponseDto`: `_id, tripId, type:number, typeName, requestedAmount:number, requestedUserId, requestedUserName, tripConfirmedNumber, description, createdAt:Date`.
- `InsuranceInsuranceRenewalResponseDto`: `_id (vehicle id), type, typeName, vehicleName, expiryDate, description, createdAt`.
- `PendingTripResponseDto`: `_id (trip id), type, tripConfirmedNumber, typeName, description, startDate, createdAt`.
- `PendingLeaveResponseDto`: `_id (leave id), type, appliedBy, typeName, description, startDate, createdAt`.

## Business rules

- Visibility: SUPERADMIN, ADMIN, FINANCEOFFICER, TRIPMANAGER see every type; DRIVER, DRIVERASSISTANT, TRIPASSISTANT get `[]`.
- Expense extension: visible while status PENDING, no time window.
- Vehicle renewal: company-owned (non-freelance, non-rental), non-deleted vehicles whose renewal date is ≤ today+7 (including overdue). Shown "as of" 7 days before the renewal date.
- Pending trip: PENDING trips overlapping [today, today+3] with missing/inactive driver or vehicle assignment. Shown "as of" 3 days before start.
- Pending leave: PENDING leaves overlapping [today, today+3]. Shown "as of" 3 days before start.
- All windows use server local midnight.

## Real-time socket emits (entire codebase)

Socket server: `src/config/soket.config.ts`. Clients connect with handshake query `userWithRoleId`; it is stored as `useSocketMap[userWithRoleId] = socket.id` (:36) and deleted on disconnect (:40). `getActiveSocketIdsByRoles(roles)` (:18) returns socket ids whose key `startsWith(role.toString())` — the client is therefore expected to send a key beginning with its role id. No `socket.on` handlers other than `disconnect` exist; the server never receives custom events.

`grep io.to / .emit( / getActiveSocketIdsByRoles` over `src` finds exactly three emits, all in `src/modules/expenseRequest/expenseRequest.controller.ts`:

| File:line | Event | Trigger | Target roles | Payload |
|---|---|---|---|---|
| `expenseRequest.controller.ts:83` | `new-expense-request` | `POST /api/v1/expenseRequest/` (`requestMoreExpenses`, DRIVER) after save; emitted only if ≥1 matching socket and the re-fetched request exists | SUPERADMIN, ADMIN, FINANCEOFFICER, TRIPMANAGER (:65-70) | `{ message: "New expense request has been created for trip <tripConfirmedNumber> by <requestedUserName> ", data: ExpensesExtensionResponseDto }` (request re-read via `findByIdAndStatusIn(id,[PENDING])`, populated `tripId createdBy`) |
| `expenseRequest.controller.ts:176` | `expense-request-approved` | `PUT /api/v1/expenseRequest/approve/:id` (`approveExpensesRequest`) after saving request + trip in the transaction, **before** `commitTransaction` (:191) | SUPERADMIN, ADMIN, FINANCEOFFICER, TRIPMANAGER (:163-168) | `{ message: '', data: ExpensesExtensionResponseDto }` of the approved request (`type` still `1`) |
| `expenseRequest.controller.ts:250` | `expense-request-rejected` | `PUT /api/v1/expenseRequest/reject/:id` (`rejectExpensesRequest`) after save | SUPERADMIN, ADMIN, FINANCEOFFICER, TRIPMANAGER (:237-242) | `{ message: '', data: ExpensesExtensionResponseDto }` of the rejected request (`type` still `1`) |

Types 2–5 (renewals, pending trips, pending leaves) have no real-time push; clients must poll `GET /api/v1/notification/`.

## Cross-module dependencies

- expenseRequest: `ExpenseRequest` model (direct); this module's `notificationUtil.modelToExpensesExtensionResponseDto` and `ExpensesExtensionResponseDto` are consumed by `expenseRequest.controller.ts`.
- vehicle: `Vehicle` model (`insuranceRenewalDate`, `licenseRenewalDate`, `isFreelanceVehicle`, `isRentalVehicle`, `registrationNumber`, `status`).
- trip: `Trip` model (`startDate`, `endDate`, `status`, `drivers[].isActive`, `vehicles[].isActive`, `tripConfirmedNumber`).
- leave: `Leave` model (`startDate`, `endDate`, `status`, `appliedUser` → User `fullName`).
- user: populated `fullName`, `userName`.
- Enums: `WellKnownNotificationType`, `WellKnownLeaveStatus`, `WellKnownStatus`, `WellKnownTripStatus`.

## Known issues / notes

1. `notification.service.ts:64-67` — `'drivers.isActive': false` / `'vehicles.isActive': false` match when **any** array element is inactive, so a trip whose old driver/vehicle was replaced (inactive entry kept) but has a new active one still raises "Driver and Vehicle assign". Should be "no element with `isActive: true`" (e.g. `drivers: { $not: { $elemMatch: { isActive: true } } }`). Trips with the `drivers`/`vehicles` field missing entirely are not matched by the `$eq: []` clauses.
2. `notification.util.ts:97` — `leave.appliedUser.fullName` throws `TypeError` if the applied user no longer exists (populate → `null`), failing the whole notifications request with 500 for every admin.
3. `notification.controller.ts:13-45` — four identical role branches; DRIVER branch empty; roles 6/7 fall through. Collectors run sequentially (4 round trips) though they are independent.
4. `notification.util.ts:18-21` — ``fullName + ' ' + `(...)` || ''``: the `|| ''` never applies; a missing `createdBy` renders `"undefined (undefined)"`.
5. `notification.service.ts:21-29` — no lower bound on renewal dates; overdue vehicles stay in the list until the dates are updated (probably intended, but undocumented). A vehicle due for both renewals produces two entries with identical `_id` — clients must not key list items by `_id` alone.
6. `notification.service.ts:11` — ExpenseRequest status is queried with `WellKnownLeaveStatus.PENDING`; correct only because the ExpenseRequest model also uses the leave-status enum (`expenseRequest.model.ts:38`).
7. `soket.config.ts:36,40` — one socket id per `userWithRoleId`: a second tab overwrites the first; when either tab disconnects the key is deleted, so the remaining tab stops receiving events until reconnect.
8. `soket.config.ts:21` — role matching is a string prefix test; it relies on the client key format and would break if role ids ever reached two digits (e.g. role `1` matching `10…`).
9. `expenseRequest.controller.ts:176` vs `:191` — approval event is emitted before the transaction commits; if commit fails, clients were told it was approved. Approve/reject events go only to admin roles, not to the requesting DRIVER.
10. `notification.controller.ts:6` — `ExpensesExtensionResponseDto` import unused; `constants` used only for role ids.
