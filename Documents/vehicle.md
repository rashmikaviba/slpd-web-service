# Vehicle Module

## 1. Overview

The Vehicle module is the fleet register for the tour and transport company. Every vehicle that can be put on a customer trip, an internal trip, or a maintenance record lives here. The register covers:

- **Company-owned vehicles**: neither freelance nor rental. They must have a unique GPS tracker, and the notification module tracks their licence and insurance renewal dates.
- **Freelance vehicles** (`isFreelanceVehicle = true`): third-party vehicles that are paid per use. Mileage is not tracked on trips (see `trip.controller.ts` `markAsReached`).
- **Rental vehicles** (`isRentalVehicle = true`): vehicles rented by the company at a 30-day rate (`rentalFor30Days`).

The module provides CRUD and active/inactive toggling (SUPERADMIN only), plus an availability search. The search finds vehicles with enough seats that are not booked on an overlapping internal trip or customer trip. Other modules update `currentMileage` (odometer) when a trip place is marked as reached or an internal trip records a meter reading.

All routes are mounted under `/api/v1` (`src/constant.ts` `API.PREFIX`) + `/vehicle` (`src/applicationRoutes.ts:61-70`, `src/mapping.ts:34`).

## 2. Files

| File | Role |
|---|---|
| `src/modules/vehicle/vehicle.model.ts` | Mongoose schema/model `Vehicle` |
| `src/modules/vehicle/vehicle.route.ts` | Express router: binds paths, auth middleware and controllers |
| `src/modules/vehicle/vehicle.controller.ts` | Request handlers (validation, business rules, responses) |
| `src/modules/vehicle/vehicle.service.ts` | DB access + node-cache handling + availability query |
| `src/modules/vehicle/vehicle.validation.ts` | Joi schema `vehicleSchema` for create/update |
| `src/modules/vehicle/vehicle.util.ts` | Model → `VehicleResponseDto` mappers |
| `src/modules/vehicle/dto/vehicleResponseDto.ts` | `VehicleResponseDto` interface |

## 3. Data Model: `Vehicle` (collection `vehicles`)

Source: `src/modules/vehicle/vehicle.model.ts:4-117` (schema 4-110, indexes 112-115). Options: `timestamps: true` (adds `createdAt`, `updatedAt`), `versionKey: false`.

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `vehicleType` | Number | required (message incorrectly says `'Start Date is required'`, line 9) | Id from `vehicleTypes` in `src/util/data/commonData.ts`: `1 Car`, `2 Van`, `3 Bus`, `4 SUV`. Not enforced as an enum. |
| `vehicleOwner` | String | required | Free text owner name |
| `registrationNumber` | String | required | Stored upper-cased by the controller. **No unique index**: uniqueness is checked only in the controller. |
| `gpsTracker` | String | optional | Uniqueness among ACTIVE/INACTIVE company vehicles is checked in the controller |
| `capacity` | Number | required | |
| `availableSeats` | Number | required | Used by the passenger-count availability search |
| `licenseRenewalDate` | Date | optional | Used by notification service (7-day renewal reminder) |
| `insuranceRenewalDate` | Date | optional | Same as above |
| `gearOil` | String | maxlength 200 | |
| `airFilter` | String | maxlength 200 | |
| `oilFilter` | String | maxlength 200 | |
| `initialMileage` | Number | required, default `0` | Odometer when registered |
| `currentMileage` | Number | default `0` | Running odometer. Set to `initialMileage` on create, then incremented by trips and internal trips |
| `description` | String | maxlength 500 | |
| `isFreelanceVehicle` | Boolean | default `false` | |
| `rentalFor30Days` | Number | default `0` | 30-day rental amount (freelance or rental vehicles) |
| `isRentalVehicle` | Boolean | default `false` | |
| `status` | Number | required, default `WellKnownLeaveStatus.PENDING` (= 1) | Semantically uses `WellKnownStatus`: `1 ACTIVE`, `2 INACTIVE`, `3 DELETED` (see Gotchas) |
| `createdBy` | ObjectId → `User` | optional | |
| `updatedBy` | ObjectId → `User` | optional | |

- Indexes (`vehicle.model.ts:112-115`, all **non-unique**, added for the service filters):
  - `{ registrationNumber: 1, status: 1 }`: registration duplicate checks.
  - `{ gpsTracker: 1, status: 1 }`: GPS tracker duplicate checks.
  - `{ status: 1, availableSeats: 1 }`: list and availability search.
- Hooks / virtuals: none.
- Other collections that reference `Vehicle`: `Trip.vehicles[].vehicle` (`src/modules/trip/trip.model.ts:411-416`), `InternalTrip.vehicle`, and `VehicleMaintenance.vehicle`.

## 4. API Endpoints

Base path: `/api/v1/vehicle`.

| Method | Path | Controller | Auth / Roles | Description |
|---|---|---|---|---|
| POST | `/vehicle/` | `saveVehicle` | SUPERADMIN (1) | Create a vehicle |
| PUT | `/vehicle/:id` | `updateVehicle` | SUPERADMIN (1) | Update a vehicle |
| GET | `/vehicle/:id` | `getVehicleById` | Any authenticated user | Get one vehicle (raw document) |
| GET | `/vehicle/` | `getAllVehicles` | Any authenticated user | List vehicles (DTO) |
| DELETE | `/vehicle/:id` | `deleteVehicleById` | SUPERADMIN (1) | Soft delete |
| PUT | `/vehicle/activeInactive/:id` | `activeInactiveVehicle` | SUPERADMIN (1) | Set ACTIVE/INACTIVE |
| GET | `/vehicle/passengerCount/:count` | `getVehiclesByPassengersCount` | Any authenticated user | Available vehicles for a date range and seat count |

### How authorization works (`src/middleware/auth.middleware.ts`)

`authorize(rolesArray)` handles every route as follows:

1. It requires an `Authorization: Bearer <token>` header. Otherwise it returns 401 `Authentication invalid!`.
2. It verifies the JWT. An expired token returns 401 `Your session is expired!`. Any other verification error returns 403 `You're unauthorized to access this resource!`.
3. It loads the auth record with `authService.findById(payload.authId)`. This lookup is `.lean()` and cached for ONE_WEEK under `auth-<authId>`, shared read-only between requests. A missing record returns 401 `Authentication invalid!`. A blocked record returns 401 `Your account is blocked, Please contact admin!`.
4. If `rolesArray` is non-empty and `payload.role` is not in the array, it returns 403 `You're unauthorized to access this resource!`. An empty array (`authorize([])`) allows any authenticated role.
5. It sets `req.auth = payload`. Controllers use `req.auth.id` and `req.auth.role`.

Role ids are defined in `src/constant.ts`: `SUPERADMIN 1`, `ADMIN 2`, `DRIVER 3`, `FINANCEOFFICER 4`, `TRIPMANAGER 5`, `DRIVERASSISTANT 6`, `TRIPASSISTANT 7`.

### Response envelope and error mapping

Every response goes through `CommonResponse` (`src/util/commonResponse.ts`):

```json
{ "isSuccessful": true, "timeStamp": "<ISO>", "message": "...", "data": ... }
```

Errors are caught by `express-async-errors` and sent to `src/middleware/error.middleware.ts`. The response has `isSuccessful: false` and `data: null`. Status mapping:

- `BadRequestError` → 400.
- Mongoose `ValidationError` → 400, using the first validator message.
- Duplicate key (code 11000) → 409.
- `CastError` (for example a malformed ObjectId in `:id`) → **404** `No item found with ID "<value>"!`.
- Anything else → 500.

---

### 4.1 POST `/vehicle/` (`saveVehicle`, `vehicle.controller.ts:16-100`)

**Body (Joi `vehicleSchema`, `vehicle.validation.ts:3-89`)**

Unknown keys are rejected because the Joi object is not `.unknown()`.

| Field | Rule |
|---|---|
| `vehicleType` | number, required (`Vehicle Type is required!` / `Vehicle Type is invalid!`) |
| `vehicleOwner` | string, required |
| `registrationNumber` | string, required |
| `capacity` | number, required |
| `availableSeats` | number, required |
| `gpsTracker` | string, may be `null` or `''` |
| `description` | string, may be `null` or `''`, max 500 (message says "Reason ...") |
| `licenseRenewalDate`, `insuranceRenewalDate` | date, may be `null` or `''` |
| `gearOil`, `airFilter`, `oilFilter` | string, may be `null` or `''`, max 200 |
| `initialMileage` | number, required |
| `isFreelanceVehicle`, `isRentalVehicle` | boolean (Joi default `false`, see Gotchas) |
| `rentalFor30Days` | number. **Required** when `isFreelanceVehicle === true` or `isRentalVehicle === true` |

**Logic**

1. Validate the body. On failure, return 400 with the Joi message (lines 38-41).
2. Duplicate registration check: `Vehicle.findOne({ registrationNumber: UPPER(registrationNumber), status ∈ [ACTIVE, INACTIVE] })`. If a match exists, return 400 `Vehicle already exists with this registration number!` (lines 43-53).
3. If the vehicle is **neither freelance nor rental**, run a GPS tracker duplicate check: `Vehicle.findOne({ gpsTracker, status ∈ [ACTIVE, INACTIVE] })`. If a match exists, return 400 `Vehicle already exists with this GPS Tracker!` (lines 55-67).
4. Build a new `Vehicle`:
   - `registrationNumber` is upper-cased.
   - `currentMileage = initialMileage`.
   - `status = ACTIVE`.
   - `createdBy = updatedBy = req.auth.id`.
   - The other fields are copied from the body (lines 69-90).
5. Call `vehicleService.save(vehicle, null)`. This clears every cache key that starts with `vehicle-` or `trip-`, then saves (`vehicle.service.ts:10-20`).
6. Response: **201** `Vehicle created successfully!` with `data` set to the saved Mongoose document (all schema fields).

**Errors:** 400 for validation or duplicates. A Mongoose validation error (for example a maxlength violation) returns 400.

### 4.2 PUT `/vehicle/:id` (`updateVehicle`, `vehicle.controller.ts:103-198`)

**Params:** `id` (vehicle ObjectId). **Body:** same Joi schema as create, with all required fields again (full replace).

**Logic**

1. Validate the body. On failure, return 400.
2. Load the vehicle with `findByIdAndStatusIn(id, [ACTIVE, INACTIVE])`, which populates `createdBy` and `updatedBy`. If it is not found, return 400 `Vehicle not found!`.
3. Duplicate registration check excluding this id: `findOne({ _id ≠ id, status ∈ [ACTIVE, INACTIVE], registrationNumber: UPPER })`. If a match exists, return 400 `Vehicle already exists with this registration number!`.
4. If the vehicle is not freelance and not rental, run a GPS duplicate check excluding this id. If a match exists, return 400 `Vehicle already exists with this GPS Tracker!`.
5. Overwrite these fields: `vehicleType`, `registrationNumber` (upper), `gpsTracker`, `capacity`, `availableSeats`, `description`, `updatedBy = auth.id`, `vehicleOwner`, `licenseRenewalDate`, `insuranceRenewalDate`, `gearOil`, `airFilter`, `oilFilter`, `isFreelanceVehicle`, `isRentalVehicle`, `rentalFor30Days`.
6. **Mileage reset rule (lines 184-187):** if `vehicle.initialMileage != initialMileage` (loose comparison), set **both** `initialMileage` and `currentMileage` to the new `initialMileage`. Any mileage accumulated from trips is discarded.
7. Call `vehicleService.save` (clears the `vehicle-` and `trip-` caches).
8. Response: **200** `Vehicle updated successfully!` with `data` set to the saved document (with populated `createdBy`/`updatedBy` user docs).

### 4.3 GET `/vehicle/:id` (`getVehicleById`, `vehicle.controller.ts:201-214`)

1. Call `findByIdAndStatusIn(id, [ACTIVE, INACTIVE])` with `createdBy`/`updatedBy` populated as full `User` documents.
2. If the vehicle is not found, return 400 `Vehicle not found!`.
3. Response: 200, message `''`, with `data` set to the **raw Mongoose document**, not the DTO. It includes all model fields and the populated user objects.

### 4.4 GET `/vehicle/` (`getAllVehicles`, `vehicle.controller.ts:217-237`)

**Query:** `withInactive` (optional). Any truthy string, including `"false"`, counts as true.

1. If `withInactive` is set, call `findAllAndStatusIn([ACTIVE, INACTIVE])`. Otherwise call `findAllAndStatusIn([ACTIVE])`.
2. Service (`vehicle.service.ts:50-65`):
   - Cache key: `"vehicle-" + JSON.stringify(status)`. On a cache hit, return the cached data.
   - Otherwise run `Vehicle.find({ status: { $in } }).populate({ path: 'createdBy updatedBy', select: '_id fullName' }).sort({ createdAt: -1 })`. Only `_id` and `fullName` of the users are loaded, which is all the DTO reads. The query is **not** `.lean()`, so hydrated Mongoose documents are returned.
   - Cache the result for **ONE_WEEK** (604 800 s). The cache stores and returns the documents by reference (`useClones: false`, see §6).
3. Map the results with `vehicleModelArrToVehicleResponseDtos`.
4. Response: 200 with `data` set to `VehicleResponseDto[]`, or `[]` when there are no vehicles.

**`VehicleResponseDto` fields:**

- `_id`
- `vehicleType`
- `vehicleTypeName` (resolved from `vehicleTypes`, `''` if unknown)
- `registrationNumber`
- `vehicleOwner`
- `gpsTracker`
- `capacity`
- `availableSeats`
- `description`
- `currentMileage`
- `status`
- `statusName` (`WellKnownStatus` key, for example `"ACTIVE"`)
- `isFreelanceVehicle`
- `isRentalVehicle`
- `rentalFor30Days`
- `createdBy` (user id)
- `createdUser` (`fullName` or `''`)
- `updatedBy`
- `updatedUser`
- `createdAt`
- `updatedAt`

The DTO does **not** include `initialMileage`, the renewal dates, or `gearOil`/`airFilter`/`oilFilter`.

### 4.5 DELETE `/vehicle/:id` (`deleteVehicleById`, `vehicle.controller.ts:240-264`)

1. Load the vehicle with status in [ACTIVE, INACTIVE]. If it is not found, return 400 `Vehicle not found!`.
2. Set `status = DELETED (3)` and `updatedBy = auth.id`, then save (cache cleared). This is a soft delete.
3. Response: 200 `Vehicle deleted successfully!`. The `data` argument is the **`updateVehicle` controller function** (line 262). `JSON.stringify` drops function-valued properties, so the JSON body has **no `data` key**.

The delete does not check whether the vehicle is on a pending or started trip, an internal trip, or a maintenance record.

### 4.6 PUT `/vehicle/activeInactive/:id?status=1|2` (`activeInactiveVehicle`, `vehicle.controller.ts:267-307`)

**Query:** `status` is required and must loosely equal `1` (ACTIVE) or `2` (INACTIVE). Any other value returns 400 `Invalid status value!`.

1. Validate `status`.
2. Load the vehicle with status in [ACTIVE, INACTIVE]. If it is not found, return 400 `Vehicle not found!`.
3. Set `vehicle.status = (status == 1) ? ACTIVE : INACTIVE` and `updatedBy = auth.id`, then save.
4. Response: 200 with message `Vehicle activated successfully!` or `Vehicle inactivated successfully!`. As in 4.5, `data` is the `updateVehicle` function, so the JSON body has no `data` key.

### 4.7 GET `/vehicle/passengerCount/:count` (`getVehiclesByPassengersCount`, `vehicle.controller.ts:309-333`)

Finds vehicles that can take a trip with the given passenger count within a date window.

**Params:** `count` is a numeric string. It defaults to `'0'` and is converted with unary `+`.

**Query:**

- `startDate` and `endDate` are optional, but **both** are needed to apply the booking exclusion.
- `tripId` is optional. It is the current trip id, so the trip being edited does not exclude its own vehicle.

**Service logic** (`findVehiclesBySheetCountAndNotInInternalTripsAndNormalTrips`, `vehicle.service.ts:86-139`)

1. If both `startDate` and `endDate` are provided, collect the vehicles to exclude. The two queries below run **in parallel** (`Promise.all`, `vehicle.service.ts:438-473`); both use `.select(...)` and `.lean()`.
   - **Internal-trip vehicles:** `InternalTrip.find` with `status = ACTIVE` and the overlap condition below. The service selects `vehicle` and maps each result to a string id.
   - **Customer-trip vehicles:** `Trip.find` with the overlap condition, `_id ≠ tripId`, and `status ∈ [PENDING(1), START(3)]`. For each trip it keeps only the `vehicles[]` entries with `isActive === true` and takes their vehicle ids.
2. Final query: `Vehicle.find({ availableSeats ≥ count, status: ACTIVE, _id ∉ excluded }).lean()`. No sort and no cache.

Overlap condition used for the window [startDate, endDate):

```js
$or: [
  { startDate: { $gte: S, $lt: E } },        // starts inside window
  { endDate:   { $gte: S, $lt: E } },        // ends inside window
  { startDate: { $lte: S }, endDate: { $gte: E } } // spans the window
]
```

3. Back in the controller, each returned lean object gets an extra property `typeName`, resolved from `vehicleTypes` (`''` if unknown).
4. Response: 200 with `data` set to an array of raw lean vehicle objects plus `typeName`. These are not DTOs.

**Errors:** if `startDate` and `endDate` are both given but `tripId` is omitted, then `_id: { $ne: '' }` fails ObjectId casting. The result is a **404** `No item found with ID ""!` (verified against Mongoose 8 casting). See Gotchas.

## 5. Business Rules & State Transitions

### Status (`WellKnownStatus`)

| From | To | Via |
|---|---|---|
| (new) | ACTIVE (1) | `saveVehicle` always sets ACTIVE |
| ACTIVE / INACTIVE | ACTIVE / INACTIVE | `PUT /activeInactive/:id?status=` |
| ACTIVE / INACTIVE | DELETED (3) | `DELETE /:id` (irreversible through the API) |

- DELETED vehicles are invisible to every lookup in this module, because lookups filter status to [ACTIVE, INACTIVE] or [ACTIVE].
- Only ACTIVE vehicles appear in the default list, the availability search, and trip assignment (`trip.controller.ts:699-702` uses `[ACTIVE]`).

### Uniqueness (application level only)

- `registrationNumber` (upper-cased) must be unique among ACTIVE and INACTIVE vehicles.
- `gpsTracker` must be unique among ACTIVE and INACTIVE vehicles. This is only checked when the vehicle is **not** freelance **and not** rental.

### Mileage

- On create: `currentMileage = initialMileage`.
- On update: if `initialMileage` changed, then `currentMileage = initialMileage = new value`.
- **Trip place reached** (`trip.controller.ts:1141-1180`):
  - For non-freelance vehicles, the request must have `currentMilage > vehicle.currentMileage`.
  - `calcDistance = currentMilage − vehicle.currentMileage`.
  - `vehicle.currentMileage += calcDistance`.
  - Freelance vehicles are not updated.
- **Internal trip with `meterReading > 0`:** `calcDistance = meterReading − currentMileage` and `currentMileage += calcDistance`. Deleting the internal trip subtracts `calcDistance`.

### Rental / freelance

`rentalFor30Days` is required in the body when the vehicle is freelance or rental. It is consumed by the report module's vehicle monthly payment report (`valuePerDay = rentalFor30Days / 30`, `report.controller.ts:291`). That report takes `rentalFor30Days` from the request body, not from the vehicle document.

## 6. Utilities & DTOs

| Function | File | Description |
|---|---|---|
| `vehicleModelToVehicleResponseDto(vehicle)` | `vehicle.util.ts:6-34` | Maps a document to `VehicleResponseDto`. It resolves `vehicleTypeName` from `vehicleTypes`, `statusName` via `helperUtil.getNameFromEnum(WellKnownStatus, status)`, and `createdUser`/`updatedUser` from the populated `fullName` (default `''`). |
| `vehicleModelArrToVehicleResponseDtos(vehicles)` | `vehicle.util.ts:36-42` | Array map of the above |
| `vehicleService.save(vehicle, session)` | `vehicle.service.ts:10-20` | Clears the caches with prefixes `vehicle-` and `trip-` (comma-separated prefix string passed to `cache.clearCacheByPrefixs`). Then saves, inside `session` if one is provided. |
| `findByRegistrationNumAndStatusIn` | `:22-30` | `findOne({ registrationNumber, status ∈ })` |
| `findByRegNumAndStatusInAndIdNot` | `:32-42` | Same, with `_id ≠ id` |
| `findByIdAndStatusIn` | `:44-48` | `findOne({ _id, status ∈ }).populate('createdBy updatedBy')`. Returns a hydrated document, so the trip and internalTrip modules can modify and save it. |
| `findAllAndStatusIn` | `:50-65` | Cached list (ONE_WEEK), sorted `createdAt` desc. Populates `createdBy`/`updatedBy` with `_id fullName` only. Hydrated documents (not lean). |
| `findByGpsTrackerAndStatusIn` | `:67-72` | `findOne({ gpsTracker, status ∈ })` |
| `findByIdNotAndGpsTrackerAndStatusIn` | `:74-84` | Same, with `_id ≠ id` |
| `findVehiclesBySheetCountAndNotInInternalTripsAndNormalTrips` | `:86-139` | Availability search (see 4.7). Exclusion queries run in parallel. |

The cache (`src/util/cache.ts`) is an in-process `node-cache` instance (default TTL 300 s, `checkperiod` 120 s) created with **`useClones: false`**. `getCache` returns the stored object itself instead of a deep copy, so the cached vehicle list is the **same set of hydrated Mongoose documents** for every request and must be treated as read-only. `clearCacheByPrefixs("a,b")` deletes every key that starts with any of the comma-separated prefixes in a single pass over the keys. `getCache` is synchronous (callers no longer `await` it).

## 7. Dependencies

**This module reads:**

- `InternalTrip` model (availability search)
- `Trip` model (availability search)
- `User` (populate)
- `commonData.vehicleTypes`
- `helperUtil`
- `cache`
- `WellKnownStatus`, `WellKnownTripStatus`

**Modules that depend on this one:**

| Module | Usage |
|---|---|
| `trip` (`trip.controller.ts:15, 699-706, 1141-1180`) | Validates the vehicle (ACTIVE) when assigning it to a trip. Reads and increments `currentMileage` when a place is marked as reached. Saves through `vehicleService.save(…, session)`. |
| `internalTrip` | `vehicleService.findByIdAndStatusIn` / `save` to update `currentMileage` in a transaction |
| `vehicleMaintain` | Checks that the vehicle exists (ACTIVE/INACTIVE) |
| `report` (`report.controller.ts:274`) | Loads the vehicle for the monthly vehicle payment report. Must be freelance or rental. |
| `notification` (`notification.service.ts:17-50`) | Queries `Vehicle` directly for company vehicles (not freelance, not rental, not deleted) whose insurance or licence renewal date is within 7 days |
| `user` | Not a direct dependency. The driver availability search mirrors the same overlap logic. |

## 8. Notes / Gotchas

1. **The delete and active/inactive responses return a function as `data`** (`vehicle.controller.ts:262, 305`). They pass `updateVehicle` (the controller function) instead of the vehicle, so the JSON response has no `data` property.
2. **The model's default status uses the wrong enum.** `status` defaults to `WellKnownLeaveStatus.PENDING` (`vehicle.model.ts:93`). It works only because PENDING = 1 = `WellKnownStatus.ACTIVE`. The controller always sets ACTIVE explicitly.
3. **Copy-paste required message.** The `vehicleType` required message is `'Start Date is required'` (`vehicle.model.ts:9`).
4. **Joi defaults are not applied.** Controllers call `.validate()` but then destructure from `req.body`, not from the validated `value`. Joi `default(false)` and `default(0)` therefore have no effect. Missing booleans fall back to the Mongoose defaults on create, but on **update** an omitted flag is assigned as `vehicle.isFreelanceVehicle = undefined`. The path is set to `undefined`: Mongoose defaults apply only to new documents, so the field is unset and reads back falsy.
5. **GPS tracker false positives.** For company vehicles, `gpsTracker` may be `''` or `null` according to Joi. The duplicate check `findOne({ gpsTracker: null|'' , ...})` then matches any other vehicle with an empty or missing tracker. In Mongo, `null` also matches missing fields. The result is the error `Vehicle already exists with this GPS Tracker!`.
6. **Changing `initialMileage` on update resets `currentMileage`** and loses all trip and internal-trip mileage accumulated since registration.
7. **Uniqueness is not enforced in the database.** The `{ registrationNumber, status }` and `{ gpsTracker, status }` indexes are non-unique (they only speed up the duplicate checks), so concurrent creates can still produce duplicates.
8. **Availability search with dates but no `tripId` fails.** `Trip.find({ _id: { $ne: '' } })` throws a CastError, which surfaces as a 404 `No item found with ID ""!`. The client must always send `tripId` (or omit the dates).
9. **Overlap and status sets are inconsistent between modules.** The availability search excludes customer trips in PENDING/START only, and only the `isActive` vehicle. The internal-trip validation (`internalTrip.service.ts:115-135`) also counts FINISHED trips and matches any vehicle entry, active or not. The overlap test uses `$lt endDate`, so a booking that starts exactly at `endDate` is not treated as overlapping.
10. **`withInactive` is truthy for any string**, including `?withInactive=false`.
11. **`getVehicleById` returns the raw document**, including fully populated `User` documents for `createdBy`/`updatedBy`. The `User` model holds personal data such as NIC, address, and phone. The password is stored in the separate `Auth` model, so it is not exposed.
12. **The DTO omits fields.** `initialMileage`, the renewal dates, and the filter/oil fields are only available through `GET /:id`.
13. **Cache invalidation and transactions.** `save` clears the cache *before* `vehicle.save()`. Inside a transaction (internal trip, trip place reached), a concurrent read between the clear and the commit can re-cache stale data for up to one week.
14. **No referential checks on delete.** A vehicle that is still assigned to a pending or started trip can be soft-deleted. Trip code that later calls `findByIdAndStatusIn(…, [ACTIVE])` then fails with `Selected vehicle not found!`.
15. **The availability search adds `typeName`, while the DTO uses `vehicleTypeName`.** The two endpoints use inconsistent naming.
16. **The cached vehicle list is shared by reference.** Since `node-cache` now runs with `useClones: false`, `findAllAndStatusIn` hands every caller the same hydrated documents. A caller that mutates one (for example sets `status` and calls `save`) would change the cached copy for every other request until the next `vehicle-`/`trip-` cache clear. Current callers (`getAllVehicles`) only read; anything that needs to modify a vehicle must load it with `findByIdAndStatusIn` (uncached).

## Changelog

### 2026-10-25 — synced with uncommitted code changes

- Model: added three non-unique indexes (`{registrationNumber,status}`, `{gpsTracker,status}`, `{status,availableSeats}`). Gotcha 7 reworded (still no unique constraint).
- Service: `findAllAndStatusIn` now populates `createdBy`/`updatedBy` with `_id fullName` only; `getCache` is no longer awaited.
- Service: the availability search runs its internal-trip and customer-trip exclusion queries in parallel with `Promise.all`.
- Cache util: `node-cache` uses `useClones: false` (cached values are shared references) and `clearCacheByPrefixs` deletes in one pass. Added gotcha 16.
- Controller: removed the redundant `try { … } catch (e) { throw e }` wrappers (no behaviour change) and the unused imports (`startSession`, `leaveService`, `constants`, `VehicleResponseDto`); old gotcha 14 removed. All `file:line` references updated.
- Dependents: the dashboard no longer uses `vehicleService` (removed from §7); trip and report line references updated.
