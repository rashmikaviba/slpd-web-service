# Trip Summary Module

## 1. Overview

A **trip summary** is a daily running log for a customer trip (tour). For each day, or each leg, of a started or finished trip, the driver or office staff record:

- the date
- the start and end time
- the starting and ending odometer km
- the total km
- the fuel used or purchased
- a description

The log supports the trip's operational record (distance and fuel per day) and is shown together with the trip header on the trip summary screen.

Drivers can only log while the trip is in progress (status START). Office roles can also log after the trip is FINISHED. Nobody can change logs once the trip's month-end audit is done (`trip.isMonthEndDone`).

Routes are mounted at `/api/v1/tripSummary` (`src/applicationRoutes.ts:100-107`, `src/mapping.ts:41`).

## 2. Files

| File | Role |
|---|---|
| `src/modules/tripSummary/tripSummary.model.ts` | Mongoose schema/model `TripSummary` |
| `src/modules/tripSummary/tripSummary.route.ts` | Router and role guards |
| `src/modules/tripSummary/tripSummary.controller.ts` | Request handlers |
| `src/modules/tripSummary/tripSummary.service.ts` | DB access, cache, populated trip lookup |
| `src/modules/tripSummary/tripSummary.validation.ts` | Joi `tripSummarySchema` |
| `src/modules/tripSummary/tripSummary.util.ts` | Model → `TripSummaryResponseDto` mappers |
| `src/modules/tripSummary/dto/tripSummaryResponseDto.ts` | DTO interface |

## 3. Data Model: `TripSummary` (collection `tripsummaries`)

Source: `tripSummary.model.ts:4-81`. Options: `timestamps: true`, `versionKey: false`.

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `tripId` | ObjectId → `Trip` | required | Parent customer trip |
| `date` | Date | required | Day of the log |
| `startingTime` | Date | required | The API field is `startTime` |
| `endingTime` | Date | optional | The API field is `endTime` |
| `startingKm` | Number | required | Odometer at start |
| `endingKm` | Number | optional | Odometer at end |
| `totalKm` | Number | optional | **Client-supplied**, not computed |
| `fuel` | Number | default `0` | Unit or meaning not defined in code (litres or amount) |
| `description` | String | maxlength 500 | |
| `status` | Number | required, default `WellKnownStatus.ACTIVE` | `1 ACTIVE`, `2 INACTIVE`, `3 DELETED` |
| `createdBy` | ObjectId → `User` | | |
| `updatedBy` | ObjectId → `User` | | |
| `isMonthEndDone` | Boolean | default `false` | **Never set anywhere in the codebase.** The month-end lock uses `trip.isMonthEndDone` instead. |
| `batchId` | Number | default `0` | Never set anywhere |

- Indexes: none declared.
- Hooks / virtuals: none.

## 4. API Endpoints

Base: `/api/v1/tripSummary`. The write roles are TRIPMANAGER (5), SUPERADMIN (1), ADMIN (2), FINANCEOFFICER (4), and DRIVER (3). They are referred to below as **WRITE_ROLES**.

| Method | Path | Controller | Auth / Roles | Description |
|---|---|---|---|---|
| POST | `/tripSummary/` | `saveTripSummary` | WRITE_ROLES | Add a summary entry to a trip |
| GET | `/tripSummary/trip/:tripId` | `getAllSummaryByTrip` | Any authenticated user | Trip header + all active summaries |
| GET | `/tripSummary/:id` | `getTrpSummaryById` | Any authenticated user | One summary (raw document) |
| PUT | `/tripSummary/:id` | `updateTripSummary` | WRITE_ROLES | Update a summary |
| DELETE | `/tripSummary/:id` | `deleteTripSummary` | WRITE_ROLES | Soft delete |

Auth middleware, the response envelope, and error mapping are described in `vehicle.md` §4. In short: a `BadRequestError` returns 400, and a `CastError` on a bad ObjectId returns 404 `No item found with ID "<id>"!`.

Trip statuses (`WellKnownTripStatus`): `1 PENDING`, `2 CANCELED`, `3 START`, `4 FINISHED`, `5 REACHED`.

### Request body (`tripSummarySchema`, `tripSummary.validation.ts:3-44`), shared by POST and PUT

Unknown keys are rejected.

| Field | Rule / message |
|---|---|
| `tripId` | string, **required** (`tripId is required`). Required on PUT too, but ignored there. |
| `date` | date, **required** |
| `startTime` | date, **required** (`Start Time is required`) |
| `endTime` | date, may be `null` or `''` |
| `startingKm` | number, **required** |
| `endingKm` | number, optional |
| `totalKm` | number, optional |
| `fuel` | number (Joi default 0, which is not applied because the controller reads `req.body`) |
| `description` | string, max 500, may be `null` or `''` |

---

### 4.1 POST `/tripSummary/` (`saveTripSummary`, `tripSummary.controller.ts:17-74`)

1. Validate the body. On failure, return 400 with the Joi message.
2. Call `tripService.findByIdAndStatusIn(body.tripId, [START, FINISHED])`. This is a plain `Trip.findOne` with no populate (`trip.service.ts:14-25`). If no trip is found, return 400 `No trip found!`.
3. If `auth.role === DRIVER` and `trip.status != START`, return 400 `You can not save trip summary, because trip is already finished!`.
4. Otherwise, if `trip.isMonthEndDone`, return 400 `You can not save trip summary, because month end is already done!`.
5. Create a new `TripSummary` with this field mapping:

   | Request field | Stored as |
   |---|---|
   | `tripId` | `tripId` |
   | `date` | `date` |
   | `startTime` | `startingTime` |
   | `endTime` | `endingTime` |
   | `startingKm` | `startingKm` |
   | `endingKm` | `endingKm` |
   | `totalKm` | `totalKm` |
   | `fuel` | `fuel` |
   | `description` | `description` |

   It also sets `createdBy = updatedBy = auth.id`.
6. Call `tripSummaryService.save(doc, null)`. This clears cache prefix `tripSummary-`, then saves.
7. Response: **200** (not 201) `Trip summary saved successfully!` with `data` set to the saved document.

The module does not check that a driver is actually assigned to the trip. It also does not reconcile km values or update the vehicle mileage.

### 4.2 PUT `/tripSummary/:id` (`updateTripSummary`, `tripSummary.controller.ts:75-132`)

1. Validate the body. On failure, return 400.
2. Call `getTripSummaryByIdAndStatusIn(id, [ACTIVE])`, which populates `tripId` with the full Trip document. If nothing is found, return 400 `No trip summary found!`.
3. Let `trip = tripSummary.tripId` (the populated trip).
   - If the role is DRIVER and `trip.status != START`, return 400 `You can not update trip summary, because trip is already finished!`.
   - Otherwise, if `trip.isMonthEndDone`, return 400 `You can not update trip summary, because month end is already done!`.
4. Overwrite `date`, `startingTime` (from `startTime`), `endingTime` (from `endTime`), `startingKm`, `endingKm`, `totalKm`, `fuel`, `description`, and `updatedBy`. `tripId` cannot be changed.
5. Save, which clears the cache.
6. Response: 200 `Trip summary updated successfully!` with `data` set to the document. `tripId` is still populated in the in-memory document.

For non-driver roles the trip status is not re-checked, so a summary can be edited regardless of the trip's current status.

### 4.3 GET `/tripSummary/trip/:tripId` (`getAllSummaryByTrip`, `tripSummary.controller.ts:134-171`)

1. Call `tripSummaryService.findTripByIdAndStatusIn(tripId, [START, FINISHED])` (`tripSummary.service.ts:43-58`). It runs `Trip.findOne` and populates:
   - `createdBy`, `updatedBy`, `startedBy`, `endedBy`
   - `drivers.driver` and `drivers.driverAssignedBy` (User)
   - `vehicles.vehicle` (Vehicle)

   If no trip is found, return 400 `No trip found!`.
2. Map the trip with `tripUtil.tripModelToTripResponseDtoGetAll(trip)` (`src/modules/trip/trip.util.ts:127-188`), which produces a `TripResponseDtoGetAll`.
3. Call `findAllTripSummaryByTripIdAndStatusIn(tripId, [ACTIVE])` (`tripSummary.service.ts:23-41`):
   - Cache key: `"tripSummary-" + tripId + "[1]"`.
   - Query: `TripSummary.find({ tripId, status ∈ })`. There is **no sort**, so the order is natural or insertion order.
   - The result is cached for ONE_WEEK.
4. Map the summaries with `modelsToTripSummaryResponseDtos`.
5. Response: 200 with this `data`:

```json
{
  "trip": { /* TripResponseDtoGetAll */ },
  "tripSummaries": [ /* TripSummaryResponseDto[] */ ]
}
```

**`TripResponseDtoGetAll` fields** (from the trip module):

- Identity and dates: `id`, `startDate`, `endDate`, `dateCount`.
- Costs and payment: `totalCost`, `totalCostLocalCurrency`, `paymentMode`, `requestedVehicle`, `isPaymentCollected`.
- Flags: `isActiveDriver`, `isCheckListDone` (`checkListAnswers != null`).
- Contact: `email`, `phoneNumber`, `contactPerson`.
- Status: `status`, `statusName`, `passengersCount` (`passengers.length`), `tripConfirmedNumber`.
- Audit users: `createdBy`, `updatedBy`, `startedBy`, `endedBy`, `createdUser`, `updatedUser`, `startedUser`, `endedUser`.
- Month-end and salary: `isMonthEndDone`, `isDriverSalaryDone`.
- `canUndo`: `status === START` and no place reached yet.
- Timestamps: `createdAt`, `updatedAt`.
- `paidByCompanyCount`: the number of hotels and activities with `isPaymentByCompany`.
- Active vehicle and driver: `activeVehicleId`, `activeRegistrationNumber`, `activeDriverId`, `activeDriverName` (`fullName (userName)`).
- `drivers[]`: `{ driver, driverName, driverAssignedBy, driverAssignedByName, isActive }`.
- `vehicles[]`: `{ vehicle, registrationNumber, vehicleAssignedBy, licenseRenewalDate, insuranceRenewalDate, isActive }`.

**`TripSummaryResponseDto`** (`tripSummary.util.ts:3-18`):

| Field | Source |
|---|---|
| `_id` | `_id` |
| `tripId` | `tripId` (ObjectId) |
| `date` | `date` |
| `startTime` | `startingTime` |
| `endTime` | `endingTime` |
| `startingKm` | `startingKm` |
| `endingKm` | `endingKm` |
| `totalKm` | `totalKm` |
| `fuel` | `fuel` |
| `description` | `description` |

The DTO has no audit fields.

### 4.4 GET `/tripSummary/:id` (`getTrpSummaryById`, `tripSummary.controller.ts:173-194`)

1. Call `getTripSummaryByIdAndStatusIn(id, [ACTIVE])`, which populates `tripId`.
2. If the summary is found:
   - `trip = tripSummary.tripId`.
   - `delete tripSummary.tripId`. This has no effect on a Mongoose document, because the path accessor lives on the prototype.
   - `tripSummary.tripId = trip._id`. This depopulates the field back to the id.
3. Response: 200 with `data` set to the raw document (model field names `startingTime`/`endingTime`, plus the audit fields), with `tripId` as an id. If nothing is found, `data` is `null` (no 404).

### 4.5 DELETE `/tripSummary/:id` (`deleteTripSummary`, `tripSummary.controller.ts:196-239`)

1. Load the summary with `[ACTIVE]` and the trip populated. If nothing is found, return 400 `No trip summary found!`.
2. If `trip.status != START` and the role is DRIVER, return 400 `You can not delete trip summary, because trip is already finished!`.
3. Otherwise, if `trip.isMonthEndDone`, return 400 `You can not delete trip summary, because month end is already done!`.
4. Set `status = DELETED` and save. **`updatedBy` is not set.**
5. Response: 200 `Trip summary deleted successfully!` with `data` set to the document (trip populated).

## 5. Business Rules & State Transitions

### Summary status

| From | To | Via |
|---|---|---|
| (new) | ACTIVE | POST |
| ACTIVE | DELETED | DELETE |

No endpoint uses INACTIVE.

### Permission matrix (trip state × role)

| Trip status | DRIVER: create | DRIVER: update/delete | Other WRITE_ROLES: create | Other WRITE_ROLES: update/delete |
|---|---|---|---|---|
| PENDING / CANCELED / REACHED | ✗ `No trip found!` | ✗ "already finished" | ✗ `No trip found!` | ✓ (no status check) |
| START | ✓ | ✓ | ✓ | ✓ |
| FINISHED | ✗ "already finished" | ✗ "already finished" | ✓ | ✓ |
| any + `trip.isMonthEndDone` | ✗ | ✗ | ✗ "month end is already done" | ✗ |

On create, the trip must be START or FINISHED for every role. The DRIVER check runs before the month-end check.

### Calculations

None. `totalKm` is stored exactly as sent. The module does not compute `endingKm − startingKm`, does not validate `endingKm ≥ startingKm`, and does not touch `Vehicle.currentMileage`. Vehicle mileage is advanced by the trip module's mark-as-reached flow.

## 6. Utilities & DTOs

| Function | Location | Description |
|---|---|---|
| `modelToTripSummaryResponseDto` | `tripSummary.util.ts:3-18` | Maps the model to the DTO, renaming `startingTime`/`endingTime` to `startTime`/`endTime` |
| `modelsToTripSummaryResponseDtos` | `tripSummary.util.ts:20-24` | Array map (typed `any`) |
| `save(doc, session)` | `tripSummary.service.ts:6-14` | Clears prefix `tripSummary-`, then saves |
| `getTripSummaryByIdAndStatusIn(id, status)` | `:16-21` | `findOne` + `populate('tripId')` |
| `findAllTripSummaryByTripIdAndStatusIn(tripId, status)` | `:23-41` | Cached list per trip (ONE_WEEK) |
| `findTripByIdAndStatusIn(id, status)` | `:43-58` | Fully populated `Trip` lookup (duplicates a trip-module concern) |

## 7. Dependencies

**This module reads:**

- `trip` module: `tripService.findByIdAndStatusIn`, the `Trip` model, `tripUtil.tripModelToTripResponseDtoGetAll`, and `TripResponseDtoGetAll`.
- `User` and `Vehicle` (populated through Trip).
- `cache`.
- `WellKnownTripStatus` and `WellKnownStatus`.

**This module writes:** only `TripSummary`.

**Modules that depend on this one:** none. No other module imports the trip summary model or service (verified by grep). The month audit does **not** touch trip summaries.

## 8. Notes / Gotchas

1. **The summary's own `isMonthEndDone` and `batchId` are dead fields.** They are never written. The month-end lock relies solely on the parent `trip.isMonthEndDone`.
2. **Non-driver roles bypass trip-status checks on update and delete.** Office roles can edit or delete summaries of trips that are PENDING, CANCELED, or REACHED, for example after an undo or cancel, but cannot create them.
3. **Drivers are not scoped to their own trips.** Any DRIVER can create, update, or delete summaries on any START trip. There is no check against `trip.drivers`.
4. **A dangling `tripId` causes a 500.** If the referenced trip document no longer exists, populate yields `null`, and `trip.status` or `trip._id` throws a TypeError in update, delete, and get-by-id.
5. **`delete tripSummary.tripId` in get-by-id is a no-op** on a Mongoose document. The following assignment is what actually depopulates the field.
6. **Inconsistent field names.** The request and DTO use `startTime`/`endTime`, but the model and the raw get-by-id response use `startingTime`/`endingTime`.
7. **Create returns 200 instead of 201,** unlike other modules.
8. **Delete does not record `updatedBy`.**
9. **`tripId` is required in the PUT body but ignored.** A summary cannot be moved to another trip.
10. **No ordering on the list.** Summaries come back in natural order, not sorted by `date` or `startingTime`.
11. **No km or fuel validation.** Negative values, `endingKm < startingKm`, and a `totalKm` inconsistent with the two readings are all accepted. Joi `fuel.default(0)` is not applied, because the controller reads from `req.body`, but the Mongoose default of 0 covers create.
12. **The cache is in-process only.** The summary list is cached per trip for one week in `node-cache`. Every mutation goes through `save`, which clears the `tripSummary-` prefix, so the cache only goes stale after out-of-band DB edits. Running more than one API instance would also leave stale data, because each process has its own cache. The trip header is always fetched fresh.
