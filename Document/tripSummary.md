# Trip Summary

Daily running log for a [Trip](./trip.md): one record per day/leg with start/end time, start/end odometer, total km, fuel and a note. Drivers (and office roles) record it while the trip is running; office roles can also maintain it after the trip is finished, until month-end. Shared conventions (auth, `CommonResponse`, roles, cache) are in [README.md](./README.md).

## Files

| File | Responsibility |
|---|---|
| `src/modules/tripSummary/tripSummary.route.ts` | Router + role guards |
| `src/modules/tripSummary/tripSummary.controller.ts` | Handlers: save, update, list by trip, get by id, soft delete |
| `src/modules/tripSummary/tripSummary.service.ts` | Queries on `TripSummary` (+ one `Trip` query), cache handling |
| `src/modules/tripSummary/tripSummary.model.ts` | `TripSummary` schema |
| `src/modules/tripSummary/tripSummary.validation.ts` | Joi `tripSummarySchema` |
| `src/modules/tripSummary/tripSummary.util.ts` | Model → DTO mappers |
| `src/modules/tripSummary/dto/tripSummaryResponseDto.ts` | DTO interface |

## Data model

### `TripSummary` (collection `tripsummaries`, model name `TripSummary`)
Options: `timestamps: true`, `versionKey: false`. No indexes, hooks or virtuals.

| Field | Type | Required / default / ref | Meaning |
|---|---|---|---|
| `tripId` | ObjectId | required, ref `Trip` | Parent trip |
| `date` | Date | required | Log date |
| `startingTime` | Date | required | Start time (API field `startTime`) |
| `endingTime` | Date | — | End time (API field `endTime`) |
| `startingKm` | Number | required | Odometer at start |
| `endingKm` | Number | — | Odometer at end |
| `totalKm` | Number | — | Distance (client-computed; not validated against start/end) |
| `fuel` | Number | default `0` | Fuel (unit not specified in code) |
| `description` | String | maxlength 500 | Note |
| `status` | Number | required, default `WellKnownStatus.ACTIVE` (1) | 1 ACTIVE, 3 DELETED (soft delete) |
| `createdBy`, `updatedBy` | ObjectId | ref `User` | |
| `isMonthEndDone` | Boolean | default `false` | Never set by any code |
| `batchId` | Number | default `0` | Never set by any code |

## Endpoints

Base: `/api/v1/tripSummary`. "Any" = `authorize([])` (any authenticated user).

| Method | Path | Roles allowed | Validation | Handler |
|---|---|---|---|---|
| POST | `/api/v1/tripSummary/` | TRIPMANAGER, SUPERADMIN, ADMIN, FINANCEOFFICER, DRIVER | `tripSummarySchema` | `saveTripSummary` |
| GET | `/api/v1/tripSummary/trip/:tripId` | Any | — | `getAllSummaryByTrip` |
| GET | `/api/v1/tripSummary/:id` | Any | — | `getTrpSummaryById` |
| PUT | `/api/v1/tripSummary/:id` | TRIPMANAGER, SUPERADMIN, ADMIN, FINANCEOFFICER, DRIVER | `tripSummarySchema` | `updateTripSummary` |
| DELETE | `/api/v1/tripSummary/:id` | TRIPMANAGER, SUPERADMIN, ADMIN, FINANCEOFFICER, DRIVER | — | `deleteTripSummary` |

DRIVERASSISTANT and TRIPASSISTANT can read but not write.

## Endpoint logic

All errors are `BadRequestError` (400).

**`tripSummarySchema`** (body for POST and PUT)
- `tripId` string, required
- `date` date, required
- `startTime` date, required
- `endTime` date, null/'' allowed
- `startingKm` number, required
- `endingKm` number
- `totalKm` number
- `fuel` number, default 0
- `description` string, max 500, null/'' allowed

### POST `/` — `saveTripSummary`
1. Joi validate → `BadRequestError(error.message)`.
2. `tripService.findByIdAndStatusIn(body.tripId, [START, FINISHED])` → `'No trip found!'`.
3. If role is DRIVER and trip status ≠ START → `'You can not save trip summary, because trip is already finished!'`.
4. Else if `trip.isMonthEndDone` → `'You can not save trip summary, because month end is already done!'`. (Checked for every role, including drivers on a START trip.)
5. New `TripSummary` with `tripId, date, startingTime = startTime, endingTime = endTime, startingKm, endingKm, totalKm, fuel, description, createdBy = updatedBy = auth.id`.
6. `tripSummaryService.save` → clears cache prefix `tripSummary-`, then saves.

**Response** 200 `'Trip summary saved successfully!'`, `data` = saved document (model field names, i.e. `startingTime`/`endingTime`).

### PUT `/:id` — `updateTripSummary`
1. Joi validate (full schema; `tripId` required but ignored — a summary cannot be moved to another trip).
2. `getTripSummaryByIdAndStatusIn(id, [ACTIVE])` (populates `tripId`) → `'No trip summary found!'`.
3. DRIVER and populated trip status ≠ START → `'You can not update trip summary, because trip is already finished!'`.
4. Else if trip `isMonthEndDone` → `'You can not update trip summary, because month end is already done!'`.
5. Overwrite `date, startingTime, endingTime, startingKm, endingKm, totalKm, fuel, description, updatedBy`; save (clears `tripSummary-` cache).

**Response** 200 `'Trip summary updated successfully!'`, `data` = saved document (with `tripId` still populated).

### GET `/trip/:tripId` — `getAllSummaryByTrip`
1. `tripSummaryService.findTripByIdAndStatusIn(tripId, [START, FINISHED])` (populates `createdBy updatedBy startedBy endedBy`, `drivers.driver`, `drivers.driverAssignedBy`, `vehicles.vehicle`) → `'No trip found!'`.
2. `trip` → `tripUtil.tripModelToTripResponseDtoGetAll` (see [trip.md](./trip.md#utilities--dtos-triputilts-dtotripresponsedtosts)).
3. `findAllTripSummaryByTripIdAndStatusIn(tripId, [ACTIVE])` — cached (see service).
4. Map summaries with `modelsToTripSummaryResponseDtos`.

**Response** 200, `data: { trip: TripResponseDtoGetAll, tripSummaries: TripSummaryResponseDto[] }`.

### GET `/:id` — `getTrpSummaryById`
1. `getTripSummaryByIdAndStatusIn(id, [ACTIVE])` (populated `tripId`).
2. If found: replace populated `tripId` with `trip._id`.
3. 200, `data` = summary document (model field names) or `null` when not found (no error).

### DELETE `/:id` — `deleteTripSummary`
1. `getTripSummaryByIdAndStatusIn(id, [ACTIVE])` → `'No trip summary found!'`.
2. Trip status ≠ START and role DRIVER → `'You can not delete trip summary, because trip is already finished!'`.
3. Else if trip `isMonthEndDone` → `'You can not delete trip summary, because month end is already done!'`.
4. Soft delete: `status = DELETED` (3); save (clears cache). `updatedBy` not set.

**Response** 200 `'Trip summary deleted successfully!'`, `data` = updated document.

## Service layer (`tripSummary.service.ts`)

| Function | Query / behaviour |
|---|---|
| `save(tripSummary, session)` | `cache.clearCacheByPrefixs('tripSummary-')` **then** `tripSummary.save({session})` / `save()` |
| `getTripSummaryByIdAndStatusIn(id, status[])` | `TripSummary.findOne({_id, status: {$in}}).populate('tripId')` — not cached; trip status not filtered |
| `findAllTripSummaryByTripIdAndStatusIn(tripId, status[])` | Cache key `'tripSummary-' + tripId + JSON.stringify(status)`; on miss `TripSummary.find({tripId, status: {$in}})` (no sort), stored for `ONE_WEEK` (604800 s) |
| `findTripByIdAndStatusIn(id, status[])` | `Trip.findOne({_id, status: {$in}})` with populates listed above (duplicate of trip service query but with populates) |

Cache: only prefix `constants.CACHE.PREFIX.TRIP_SUMMARY` (`tripSummary-`) is read/written; cleared on every save (create, update, soft delete). No socket events, no notifications.

## Utilities / DTOs

| Function | Input → output |
|---|---|
| `modelToTripSummaryResponseDto` | model → `{_id, tripId, date, startTime: startingTime, endTime: endingTime, startingKm, endingKm, totalKm, fuel, description}` |
| `modelsToTripSummaryResponseDtos` | array map of the above |

`TripSummaryResponseDto`: `{_id: string, tripId: string, date: Date, startTime: Date, endTime: Date, startingKm, endingKm, totalKm, fuel: number, description: string}`.

## Business rules

- Summaries exist only for trips in START or FINISHED (create/list). Update/delete do not re-check trip status, only the driver rule and month-end.
- DRIVER may create/update/delete only while the trip is START. Office roles (TRIPMANAGER, SUPERADMIN, ADMIN, FINANCEOFFICER) may also do so on FINISHED trips.
- Nothing can be created/changed/deleted once the parent trip's `isMonthEndDone` is true.
- Deletion is soft (`status = 3`); lists show ACTIVE only.
- No ownership check: any driver can edit any trip's summaries while it is running.
- No numeric consistency checks (`endingKm ≥ startingKm`, `totalKm = endingKm − startingKm`, overlapping dates) and no link to `Vehicle.currentMileage` or trip place mileage.

## Cross-module dependencies

- Reads: `trip` — `tripService.findByIdAndStatusIn`, `Trip` model (own populated query), `tripUtil.tripModelToTripResponseDtoGetAll`, `TripResponseDtoGetAll` type.
- Writes: only its own collection.
- Callers: none — no other module imports `TripSummary` (not used by month audit, reports or dashboard). Trip undo (START → PENDING) and cancel do not check or remove trip summaries.

## Known issues / notes

1. **Stale-cache race** — `tripSummary.service.ts:7-8` clears the cache *before* `save()`; a concurrent `GET /trip/:tripId` between the clear and the write re-caches the old list for one week.
2. **Month-end fields never set** — `isMonthEndDone`/`batchId` (`tripSummary.model.ts:65-73`) are never written; month audit (`monthAudit.controller.ts`) does not touch `TripSummary`. Locking relies on the parent trip's flag.
3. **Orphaned summaries after undo** — a trip can be undone to PENDING (`trip.controller.ts` changeTripStatus) while summaries exist; they remain ACTIVE but are hidden by `getAllSummaryByTrip` (START/FINISHED only), and drivers can no longer edit/delete them (status ≠ START).
4. Update/delete (`tripSummary.controller.ts:96-108`, `:211-223`) don't check the parent trip status for non-drivers, so office roles can edit summaries of PENDING/CANCELED trips.
5. `updateTripSummary` requires `tripId` in the body but ignores it (`tripSummary.controller.ts:80`, `:110-118`).
6. `deleteTripSummary` doesn't set `updatedBy` (`tripSummary.controller.ts:225`).
7. `getTrpSummaryById` returns 200 with `data: null` for unknown ids (`tripSummary.controller.ts:183-190`); `delete tripSummary.tripId` on a Mongoose document (`:186`) is ineffective — the reassignment on `:187` is what actually replaces it. Handler name typo `getTrpSummaryById`.
8. Response shapes differ: POST/PUT/GET-by-id return model fields (`startingTime`/`endingTime`), the list returns DTO fields (`startTime`/`endTime`).
9. List query has no sort (`tripSummary.service.ts:31-34`) — order is insertion order.
10. No driver ownership check and no numeric validation (`endingKm` vs `startingKm`, `totalKm`).
11. `findTripByIdAndStatusIn` (`tripSummary.service.ts:43`) duplicates trip-service logic inside this module.
12. Every handler wraps logic in a no-op `try { … } catch (e) { throw e }`.
