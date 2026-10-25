# Internal Trip Module

## 1. Overview

An **internal trip** is a period when a company vehicle and a driver are used for the company's own purposes, not for a customer tour. Examples are taking a vehicle to a garage, staff transport, or a repositioning run. The trip is described by a `reason`.

Internal trips matter to the rest of the system for three reasons:

- **They block the vehicle.** A vehicle cannot get an internal trip that overlaps another active internal trip or a customer trip. Vehicle availability for customer trips also excludes vehicles on overlapping internal trips.
- **They block the driver.** The user module's driver availability search (`/user/getDriversForTrip`) excludes drivers on overlapping active internal trips.
- **They update the odometer.** An optional `meterReading` advances the vehicle's `currentMileage` and stores the distance travelled (`calcDistance`).

Internal trips take part in the month-end audit (`isMonthEndDone`).

Routes are mounted at `/api/v1/internalTrip` (`src/applicationRoutes.ts:141-148`, `src/mapping.ts:40`).

## 2. Files

| File | Role |
|---|---|
| `src/modules/internalTrip/internalTrip.model.ts` | Mongoose schema/model `InternalTrip` |
| `src/modules/internalTrip/internalTrip.route.ts` | Router and role guards |
| `src/modules/internalTrip/internalTrip.controller.ts` | Request handlers (transactions for mileage updates) |
| `src/modules/internalTrip/internalTrip.service.ts` | DB access, cache, overlap validation, month-end query |
| `src/modules/internalTrip/internalTrip.validation.ts` | Joi `internalTripSchema` |
| `src/modules/internalTrip/internalTrip.util.ts` | Model → `InternalTripResponseDto` mappers |
| `src/modules/internalTrip/dto/internalTripResponseDto.ts` | DTO interface |

## 3. Data Model: `InternalTrip` (collection `internaltrips`)

Source: `internalTrip.model.ts:4-76`. Options: `timestamps: true`, `versionKey: false`.

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `startDate` | Date | required | |
| `endDate` | Date | required | No check that `endDate ≥ startDate` |
| `dateCount` | Number | required | Client-supplied (Joi min 1). Not derived from the dates. |
| `vehicle` | ObjectId → `Vehicle` | required | |
| `meterReading` | Number | default `0` | Odometer reading at trip end. `0` means not recorded. |
| `calcDistance` | Number | default `0` | `meterReading − vehicle.currentMileage` at the time of recording |
| `driver` | ObjectId → `User` | required | |
| `isMonthEndDone` | Boolean | default `false` | Set by the month audit |
| `reason` | String | required, maxlength 500 | |
| `status` | Number | required, default `WellKnownStatus.ACTIVE` | `1 ACTIVE`, `2 INACTIVE`, `3 DELETED` |
| `createdBy` | ObjectId → `User` | | |
| `updatedBy` | ObjectId → `User` | | |

- Indexes: none declared.
- Hooks / virtuals: none.
- There is **no `batchId` field**, although the month audit assigns one (see Gotchas).

## 4. API Endpoints

Base: `/api/v1/internalTrip`. Every route uses the same roles, referred to below as **ROLES**: SUPERADMIN (1), ADMIN (2), TRIPMANAGER (5), and FINANCEOFFICER (4).

| Method | Path | Controller | Auth / Roles | Description |
|---|---|---|---|---|
| POST | `/internalTrip/` | `saveInternalTrip` | ROLES | Create an internal trip (transaction) |
| GET | `/internalTrip/getByVehicle/:id` | `getInternalTripByVehicle` | ROLES | Active internal trips of a vehicle (DTO) |
| GET | `/internalTrip/:id` | `getInternalTripById` | ROLES | Raw internal trip |
| PUT | `/internalTrip/:id` | `updateInternalTrip` | ROLES | Update (transaction) |
| DELETE | `/internalTrip/:id` | `deleteInternalTripById` | ROLES | Soft delete + mileage rollback (transaction) |

Auth middleware, the response envelope, and error mapping are described in `vehicle.md` §4. In short: a `BadRequestError` returns 400, and a `CastError` returns 404.

The controller uses MongoDB transactions (`startSession`, `startTransaction`, `commitTransaction` or `abortTransaction`, then `endSession`). Transactions require a replica-set deployment.

### Request body (`internalTripSchema`, `internalTrip.validation.ts:3-37`), shared by POST and PUT

Unknown keys are rejected.

| Field | Rule / message |
|---|---|
| `startDate` | date, **required** (`Start Date is required!` / `Start Date is invalid!`) |
| `endDate` | date, **required** |
| `dateCount` | number, min 1, **required** (`Date Count cannot be less than 1`) |
| `vehicle` | string, **required** |
| `meterReading` | number, optional |
| `driver` | string, **required** |
| `reason` | string, 1–500 chars, **required** |

---

### 4.1 POST `/internalTrip/` (`saveInternalTrip`, `internalTrip.controller.ts:14-100`)

1. Validate the body. On failure, return 400 with the Joi message.
2. Overlap check: `internalTripService.validateVehicleForDateRange(startDate, endDate, vehicle, '')`. If it returns true, return 400 `Vehicle already has internal trip or an other trip for this date range!` (lines 23-35). See 4.6 for the exact query.
3. Start a session and transaction.
4. Build the `InternalTrip` with `startDate`, `endDate`, `dateCount`, `vehicle`, `meterReading`, `reason`, `driver`, and `createdBy = updatedBy = auth.id`.
5. If `body.meterReading > 0` (lines 53-78):
   1. Load the vehicle (ACTIVE/INACTIVE). If it is not found, return 400 `Vehicle not found!`.
   2. If `vehicle.currentMileage >= meterReading`, return 400 `Vehicle current mileage is greater than meter reading!`.
   3. Set `calcDistance = meterReading − vehicle.currentMileage` and store it on the trip.
   4. Set `vehicle.currentMileage += calcDistance`, which equals `meterReading`.
   5. Call `vehicleService.save(vehicle, session)`. This clears the `vehicle-` and `trip-` caches.
6. Call `internalTripService.save(internalTrip, session)`, which clears the `internalTrip-` cache.
7. Commit the transaction.
8. Response: **201** `Internal trip created successfully!` with `data` set to the document.
9. On any error: abort the transaction, rethrow the error, and end the session in `finally`.

If `meterReading` is missing or ≤ 0, the vehicle id is **not** checked for existence.

### 4.2 PUT `/internalTrip/:id` (`updateInternalTrip`, `internalTrip.controller.ts:102-193`)

1. Validate the body. On failure, return 400.
2. Load the trip with `findByIdAndStatusIn(id, [ACTIVE])`. If it is not found, return 400 `Internal trip not found!`.
3. Overlap check with `validateVehicleForDateRange(startDate, endDate, body.vehicle, id)`, which excludes this trip. If it returns true, return 400 with the same overlap message.
4. In a transaction:
   1. Set `startDate`, `endDate`, `dateCount`, `reason`, `driver`, and `updatedBy`.
   2. **`vehicle` and `meterReading` are not updated.**
   3. If `internalTrip.meterReading <= 0 && body.meterReading > 0` (lines 147-172):
      - Load the trip's **existing** vehicle. If it is not found, return 400 `Vehicle not found!`.
      - If `currentMileage >= meterReading`, return 400 `Vehicle current mileage is greater than meter reading!`.
      - Set `calcDistance = meterReading − currentMileage` and store it on the trip.
      - Set `vehicle.currentMileage += calcDistance` and save the vehicle with the session.
   4. Save the trip with the session, then commit.
5. Response: 200 `Internal trip Updated successfully!` with `data` set to the document.

### 4.3 GET `/internalTrip/:id` (`getInternalTripById`, `internalTrip.controller.ts:195-204`)

- Calls `findByIdAndStatusIn(id, [ACTIVE, INACTIVE])`. There is no populate.
- Response: 200 with `data` set to the raw document, or `null` (no 404).

### 4.4 DELETE `/internalTrip/:id` (`deleteInternalTripById`, `internalTrip.controller.ts:206-261`)

1. Load the trip with `[ACTIVE]`. If it is not found, return 400 `Internal trip not found!`.
2. Load its vehicle with `[ACTIVE, INACTIVE]`. If the vehicle is not found, return 400 `Vehicle not found!`, which means a trip whose vehicle was deleted cannot be deleted.
3. In a transaction:
   1. Set `status = DELETED` and `updatedBy = auth.id`, then save.
   2. Set `vehicle.currentMileage -= internalTrip.calcDistance`. This subtracts 0 when no reading was recorded.
   3. Save the vehicle, then commit.
4. Response: 200 `Internal trip Deleted successfully!` with `data` set to the deleted document.

`isMonthEndDone` is **not** checked.

### 4.5 GET `/internalTrip/getByVehicle/:id` (`getInternalTripByVehicle`, `internalTrip.controller.ts:263-278`)

1. Call `internalTripService.findAllByVehicleId(vehicleId)` (`internalTrip.service.ts:23-52`):
   - Cache key: `"internalTrip-" + vehicleId`. On a hit, return the cached value.
   - Query: `find({ vehicle: vehicleId, status: ACTIVE })`.
   - Populates `driver` (`_id fullName`), `createdBy` (`_id userName`), and `updatedBy` (`_id userName`).
   - Sort `startDate: -1` (newest first).
   - Cache the result for ONE_WEEK.
2. Map the results with `modelsToInternalTripResponseDto`.
3. Response: 200 with `data` set to `InternalTripResponseDto[]`, or `[]`.

**`InternalTripResponseDto`** (`internalTrip.util.ts:3-20`):

| Field | Source |
|---|---|
| `_id` | `_id` |
| `startDate` | `startDate` |
| `endDate` | `endDate` |
| `driver` | `driver.fullName` (a **name**, not an id) |
| `reason` | `reason` |
| `isMonthEndDone` | `isMonthEndDone` (or `false`) |
| `createdBy` | `createdBy._id` |
| `createdAt` | `createdAt` |
| `createdByUser` | `createdBy.userName` |
| `updatedBy` | `updatedBy._id` |
| `updatedAt` | `updatedAt` |
| `updatedByUser` | `updatedBy.userName` |

The DTO does not include `dateCount`, `meterReading`, `calcDistance`, or `vehicle`.

### 4.6 Overlap validation (`validateVehicleForDateRange`, `internalTrip.service.ts:81-135`)

Returns `true` (conflict) if **either** query finds a match.

1. **InternalTrip:** `findOne({ vehicle, status: ACTIVE, $or: OVERLAP, _id ≠ internalTripId (only when an id is passed) })`.
2. **Trip:** `find({ $or: OVERLAP, status ∈ [PENDING(1), START(3), FINISHED(4)], vehicles: { $elemMatch: { vehicle: { $in: [vehicleId] } } } })`. This matches any vehicle entry, whether `isActive` or not.

The overlap condition (OVERLAP) for the window [S = startDate, E = endDate):

```js
[
  { startDate: { $gte: S, $lt: E } },
  { endDate:   { $gte: S, $lt: E } },
  { startDate: { $lte: S }, endDate: { $gte: E } },
]
```

## 5. Business Rules & State Transitions

### Status

| From | To | Via |
|---|---|---|
| (new) | ACTIVE | POST (schema default) |
| ACTIVE | DELETED | DELETE |

No endpoint sets INACTIVE. Update and delete only operate on ACTIVE trips, while GET by id also returns INACTIVE.

### Month-end

The month audit runs `monthEndDoneForInternalTrip` (`monthAudit.controller.ts:193-215`). It calls `findAllByEndMonthAndStatusIn(workingMonth, workingYear, [ACTIVE, INACTIVE])` (`internalTrip.service.ts:54-79`):

```js
endDate = new Date(); endDate.setFullYear(currYear); endDate.setMonth(endMonth); // 1-based month → next month index
endDate = new Date(Y, M, 1);                                                     // 1st of next month 00:00 local
find({ createdAt < endDate, status ∈ [1,2], isMonthEndDone: false })            // NOTE: filters on createdAt, not startDate
```

The result is cached under `"internalTrip-" + endMonth + currYear + JSON.stringify(status)` for ONE_WEEK. For each trip: `isMonthEndDone = true`, `batchId = <batch>` (not persisted, see Gotchas), `updatedBy`, then save with the session.

`isMonthEndDone` is **not enforced** by the update or delete endpoints.

### Mileage formulas

- Record a reading on create, or on the first update with a reading:

  ```text
  require meterReading > vehicle.currentMileage
  calcDistance = meterReading − vehicle.currentMileage
  vehicle.currentMileage = vehicle.currentMileage + calcDistance   (= meterReading)
  ```

- Delete: `vehicle.currentMileage = vehicle.currentMileage − calcDistance`.

## 6. Utilities & DTOs

| Function | Location | Description |
|---|---|---|
| `modelToInternalTripResponseDto` | `internalTrip.util.ts:3-20` | See 4.5. Requires a populated `driver`; a null driver throws a TypeError. |
| `modelsToInternalTripResponseDto` | `internalTrip.util.ts:22-28` | Array map |
| `save(body, session)` | `internalTrip.service.ts:8-17` | Clears prefix `internalTrip-`, then saves (with an optional session) |
| `findByIdAndStatusIn(id, status)` | `:19-21` | Plain `findOne` |
| `findAllByVehicleId(vehicleId)` | `:23-52` | Cached per-vehicle list |
| `findAllByEndMonthAndStatusIn(month, year, status)` | `:54-79` | Month-end candidates (cached) |
| `validateVehicleForDateRange(start, end, vehicleId, excludeId)` | `:81-135` | Overlap check (see 4.6) |

## 7. Dependencies

**This module reads:**

- `vehicle` service (`findByIdAndStatusIn`)
- `Trip` model (overlap check)
- `User` (populate)
- `cache`

**This module writes:**

- `InternalTrip`
- `Vehicle.currentMileage` (through `vehicleService.save` within a transaction)

**Modules that depend on this one:**

| Module | Usage |
|---|---|
| `vehicle` (`vehicle.service.ts:95-105`) | Imports the `InternalTrip` model and excludes vehicles on overlapping ACTIVE internal trips from the availability search |
| `user` (`user.service.ts:178-200`) | Imports the `InternalTrip` model and excludes drivers on overlapping ACTIVE internal trips (`GET /user/getDriversForTrip`) |
| `monthAudit` (`monthAudit.controller.ts:29, 70-77, 193-215`) | Uses `findAllByEndMonthAndStatusIn` and `save` to mark trips as month-end done |

## 8. Notes / Gotchas

1. **The vehicle cannot be changed on update, but the overlap check uses `body.vehicle`.** `updateInternalTrip` never assigns `internalTrip.vehicle`, yet it checks overlap against `body.vehicle`. If the client sends a different vehicle, the overlap check runs against the wrong vehicle and the change is silently ignored.
2. **`meterReading` is never persisted on update** (`internalTrip.controller.ts:147-172`). The guard `internalTrip.meterReading <= 0 && body.meterReading > 0` therefore stays true for a trip created without a reading. After one update adds a reading, the vehicle's `currentMileage` equals that reading. Any later update that sends the same `meterReading` fails with `Vehicle current mileage is greater than meter reading!`. A later update with a higher reading adds the extra distance again and **overwrites** `calcDistance`, so a delete only rolls back the last delta.
3. **The mileage rollback on delete is naive.** `currentMileage -= calcDistance` ignores mileage added afterwards by other trips. The result is still mathematically consistent as a sum of deltas, but the record no longer matches the actual odometer history.
4. **No month-end lock.** Update and delete do not check `isMonthEndDone`, unlike vehicle maintenance and trip summaries.
5. **`batchId` is not in the schema.** `monthAudit` sets `internalTrip.batchId = batchId`, but under Mongoose strict mode the value is silently dropped and never saved.
6. **Month-end uses `createdAt` instead of the trip dates.** An internal trip created late, for example on the 2nd of the next month for last month's dates, is not closed in that month's batch.
7. **The vehicle is only checked when a meter reading is given.** With no reading, any syntactically valid ObjectId is accepted as `vehicle`. The `driver` is never validated: it is not checked for existence, for the DRIVER role, or for overlapping assignments on other internal or customer trips.
8. **Inconsistent overlap rules.** This module treats FINISHED customer trips, and non-active vehicle entries in `trip.vehicles`, as conflicts. The vehicle availability search only considers PENDING/START trips and active entries. `$lt E` means a trip that starts exactly at `endDate` does not count as a conflict.
9. **No date sanity checks.** `endDate < startDate` is accepted, and `dateCount` is never reconciled with the dates.
10. **GET by id returns 200 with `null`** when nothing is found. It returns INACTIVE trips, but no endpoint creates them.
11. **The error message is misleading.** `Vehicle current mileage is greater than meter reading!` is also thrown when the two values are **equal** (`>=`).
12. **The per-vehicle cache is invalidated only by internal-trip saves.** That is acceptable here because all mutations go through `internalTripService.save`. Changes to user names, such as a driver's `fullName`, stay stale for up to a week.
