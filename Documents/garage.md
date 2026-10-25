# Garage Module

## 1. Overview

The Garage module is a master-data register of workshops and service garages that the company uses to repair and maintain its fleet. Each garage has contact details, a Google Maps link, and a list of **specializations**, for example engine work, AC, or body work. Vehicle maintenance records (`vehicleMaintain` module) must point to an existing garage. The garage name appears on maintenance invoices and in the monthly expenses report.

Routes are mounted at `/api/v1/garage` (`src/applicationRoutes.ts:193-201`, `src/mapping.ts:46`).

## 2. Files

| File | Role |
|---|---|
| `src/modules/garage/garage.model.ts` | Mongoose schema/model `Garage` with embedded `specializations` array |
| `src/modules/garage/garage.route.ts` | Router: paths, role guards, controllers |
| `src/modules/garage/garage.controller.ts` | Request handlers |
| `src/modules/garage/garage.service.ts` | DB access + cache |
| `src/modules/garage/garage.validation.ts` | Joi `garageRequestSchema` |
| `src/modules/garage/garage.util.ts` | Model → `GarageResponseDto` mappers |
| `src/modules/garage/dto/garageResponseDto.ts` | `GarageResponseDto` interface |

## 3. Data Model: `Garage` (collection `garages`)

Source: `src/modules/garage/garage.model.ts:4-80`. Options: `timestamps: true`, `versionKey: false`.

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `name` | String | required, maxlength 100 | |
| `address` | String | maxlength 300 | |
| `city` | String | maxlength 100 | |
| `contactNumber1` | String | maxlength 14 | No format validation |
| `contactNumber2` | String | maxlength 14 | |
| `googleMapUrl` | String | default `null` | |
| `specializations` | Array of sub-documents | (Joi requires at least 1) | See below |
| `description` | String | maxlength 500 | |
| `status` | Number | required, default `WellKnownStatus.ACTIVE` (1) | `1 ACTIVE`, `2 INACTIVE`, `3 DELETED` |
| `createdBy` | ObjectId → `User` | | |
| `updatedBy` | ObjectId → `User` | | |

**Embedded `specializations[]`** (`garage.model.ts:36-51`). Each element gets its own `_id` (Mongoose default).

| Field | Type | Rules |
|---|---|---|
| `id` | Number | required |
| `name` | String | required, maxlength 100 |

The code does not define a master list of specialization ids. They come from the client.

- Indexes: none declared beyond `_id`.
- Hooks / virtuals: none.
- Referenced by: `VehicleMaintenance.garage` (ref `'Garage'`).

## 4. API Endpoints

Base: `/api/v1/garage`. The write roles are SUPERADMIN (1), ADMIN (2), TRIPMANAGER (5), and DRIVERASSISTANT (6). They are referred to as **WRITE_ROLES** below.

| Method | Path | Controller | Auth / Roles | Description |
|---|---|---|---|---|
| POST | `/garage/` | `createGarage` | WRITE_ROLES | Create a garage |
| GET | `/garage/` | `getAllGarages` | Any authenticated user | List ACTIVE + INACTIVE garages (DTO) |
| GET | `/garage/:id` | `getGarageById` | Any authenticated user | Get one garage (raw document) |
| PUT | `/garage/:id` | `updateGarage` | WRITE_ROLES | Update a garage |
| DELETE | `/garage/:id` | `deleteGarage` | WRITE_ROLES | Soft delete |
| PUT | `/garage/activeInactiveGarage/:id` | `activeInactiveGarage` | WRITE_ROLES | Toggle ACTIVE ↔ INACTIVE |

Auth middleware behaviour, the response envelope (`{ isSuccessful, timeStamp, message, data }`), and error-to-status mapping are as described in `vehicle.md` §4. In short: a `BadRequestError` returns 400, and a `CastError` on a bad ObjectId returns 404 `No item found with ID "<id>"!`.

### Request body (`garageRequestSchema`, `garage.validation.ts:3-52`), shared by POST and PUT

Unknown keys are rejected.

| Field | Rule / message |
|---|---|
| `name` | string, max 100, **required** (`Garage Name is required`) |
| `address` | string, max 300, may be `''` or `null` |
| `city` | string, max 100, may be `''` or `null` |
| `contactNumber1`, `contactNumber2` | string, max 14, may be `''` or `null` |
| `googleMapUrl` | string, may be `''` or `null` (not validated as a URL) |
| `specializations` | array, **required**, `min(1)` (`At least one specialization is required`). Items: `{ id: number required, name: string max 100 required }` |
| `description` | string, max 500, may be `''` or `null` |

---

### 4.1 POST `/garage/` (`createGarage`, `garage.controller.ts:12-52`)

1. Validate the body. On failure, return 400 with the Joi message.
2. Build a new `Garage` from the body fields with `createdBy = updatedBy = req.auth?.id`. `status` is not set explicitly, so it defaults to ACTIVE.
3. Call `garageService.save(garage, null)`. This clears all cache keys that start with `garage-`, then saves.
4. Response: **201** `Garage created successfully!` with `data` set to the saved document.

The module does not check for duplicate garage names.

### 4.2 PUT `/garage/:id` (`updateGarage`, `garage.controller.ts:55-100`)

1. Validate the body. On failure, return 400.
2. Call `garageService.findByIdAndStatusIn(id, [ACTIVE, INACTIVE])`. If the garage is not found, return 400 `Garage not found!`.
3. Overwrite `name`, `address`, `city`, `contactNumber1`, `contactNumber2`, `googleMapUrl`, `specializations` (whole array replaced), `description`, and `updatedBy`.
4. Save, which clears the cache.
5. Response: 200 `Garage updated successfully!` with `data` set to the saved document.

### 4.3 DELETE `/garage/:id` (`deleteGarage`, `garage.controller.ts:102-126`)

1. Load the garage with status in [ACTIVE, INACTIVE]. If it is not found, return 400 `Garage not found!`.
2. Set `status = DELETED (3)` and `updatedBy = auth.id`, then save.
3. Response: 200 `Garage deleted successfully!` with `data: null`.

The delete does not check existing maintenance records that reference the garage.

### 4.4 GET `/garage/` (`getAllGarages`, `garage.controller.ts:128-148`)

1. Call `garageService.findAllAndStatusIn([ACTIVE, INACTIVE])` (`garage.service.ts:20-37`).
   - Cache key: `"garage-" + JSON.stringify([1,2])`. On a hit, return the cached value.
   - Query: `Garage.find({ status ∈ })`.
   - It populates `createdBy` and `updatedBy` with `select: "username fullName"`.
   - Sort: `createdAt: -1`.
   - The result (hydrated documents, not lean) is cached for ONE_WEEK. The cache stores and returns it by reference (`useClones: false`), so every request gets the same document objects. `getCache` is synchronous.
2. Map the results with `modelToGarageResponseDtoList`.
3. Response: 200 with `data` set to `GarageResponseDto[]`, or `[]`.

There is no query parameter to exclude inactive garages. The list always returns both ACTIVE and INACTIVE.

**`GarageResponseDto` fields:**

- `_id`
- `name`
- `address`
- `city`
- `contactNumber1`
- `contactNumber2`
- `googleMapUrl`
- `specializations`: a **comma-joined string of specialization names**, for example `"Engine, AC"`
- `status`
- `statusName` (for example `"ACTIVE"`)
- `createdBy`
- `createdUser` (`fullName`, may be `undefined`)
- `updatedBy`
- `updatedUser`
- `createdAt`
- `updatedAt`

`description` is **not** included.

### 4.5 GET `/garage/:id` (`getGarageById`, `garage.controller.ts:150-165`)

1. Call `garageService.findByIdAndStatusIn(id, [ACTIVE, INACTIVE])`. There is no populate.
2. Response: 200, message `''`, with `data` set to the raw document. The `specializations` array of `{ _id, id, name }` and `description` are included. `createdBy` and `updatedBy` are plain ids.
3. **There is no not-found check.** A missing or deleted garage returns 200 with `data: null`.

### 4.6 PUT `/garage/activeInactiveGarage/:id` (`activeInactiveGarage`, `garage.controller.ts:167-203`)

No body or query parameters. The endpoint is a **toggle**.

1. Load the garage with status in [ACTIVE, INACTIVE]. If it is not found, return 400 `Garage not found!`.
2. If it is ACTIVE, set it to INACTIVE. If it is INACTIVE, set it to ACTIVE.
3. Set `updatedBy = auth.id` and save.
4. Response: 200 with `Garage activated successfully!` or `Garage inactivated successfully!` (based on the new status) and `data: null`.

## 5. Business Rules & State Transitions

| From | To | Via |
|---|---|---|
| (new) | ACTIVE | POST (schema default) |
| ACTIVE | INACTIVE | `PUT /activeInactiveGarage/:id` (toggle) |
| INACTIVE | ACTIVE | `PUT /activeInactiveGarage/:id` (toggle) |
| ACTIVE / INACTIVE | DELETED | `DELETE /:id` |

- DELETED garages are hidden from all lookups in this module.
- **INACTIVE garages are still accepted** when creating or updating vehicle maintenance. `vehicleMaintenance.controller.ts:57, 144` uses `[ACTIVE, INACTIVE]`.
- The module has no calculations.

## 6. Utilities & DTOs

| Function | File | Description |
|---|---|---|
| `modelToGarageResponseDto(garage)` | `garage.util.ts:5-25` | Joins `specializations[].name` with `', '`. Adds `statusName` via `getNameFromEnum(WellKnownStatus, status)`. Takes the user names from the populated `fullName`. |
| `modelToGarageResponseDtoList(garages)` | `garage.util.ts:27-29` | Array map |
| `garageService.save(garage, session)` | `garage.service.ts:5-14` | Clears cache prefix `garage-`, then saves (with an optional session) |
| `garageService.findByIdAndStatusIn(id, status)` | `:16-18` | `findOne({ _id, status ∈ })`, no populate |
| `garageService.findAllAndStatusIn(status)` | `:20-37` | Cached list (see 4.4) |

## 7. Dependencies

**This module reads:**

- `User` (populate)
- `cache`
- `helperUtil`
- `WellKnownStatus`

**Modules that depend on this one:**

| Module | Usage |
|---|---|
| `vehicleMaintain` | `garageService.findByIdAndStatusIn(garage, [ACTIVE, INACTIVE])` to validate the garage. Populates `garage` for the list (projected to `_id name`) and the invoice (full document), using `garage.name`. |
| `report` (`report.service.ts:71-93`, `report.controller.ts:106-118`) | Populates `garage` on maintenance records (`_id name` for the monthly expense report, full document for the vehicle payment report). Skips records whose garage is `null`. Uses `garage.name` in the expense description. |

## 8. Notes / Gotchas

1. **`getGarageById` has no 404 handling.** It returns 200 with `data: null` for unknown or deleted ids, unlike update, delete, and toggle, which return 400 `Garage not found!`.
2. **The populate selects a non-existent field.** `findAllAndStatusIn` selects `"username fullName"`, but the `User` model field is `userName`. This is harmless because the DTO only uses `fullName`.
3. **Shape mismatch between list and detail.** The list returns `specializations` as a joined string and omits `description`. The detail returns the raw array and `description`. Clients must handle both shapes.
4. **The toggle endpoint differs from the vehicle module.** Vehicle uses `?status=` explicitly, while garage toggles blindly. Two concurrent toggles cancel each other out.
5. **No referential integrity.** Deleting a garage does not affect maintenance records. Populate still resolves the deleted garage, because populate does not filter by status, so the old records keep showing its name.
6. **Odd role set.** DRIVERASSISTANT (6) can create, edit, and delete garages, but FINANCEOFFICER (4) and TRIPASSISTANT (7) cannot. Those two roles *can* create vehicle maintenance records.
7. **No duplicate-name check** and no URL or phone format validation.
8. **The cached list is shared by reference.** List results are hydrated Mongoose documents cached for one week, and since `node-cache` now runs with `useClones: false` every request receives the **same** objects. Any caller that mutated one would change it for all later requests; current callers only read. The cache is invalidated only through `garageService.save`, so direct DB edits outside the service are not reflected until the TTL expires or the process restarts.
9. **Unrelated route key.** `applicationRoutes.monthlyExpenses.activeInactiveGarage` (`src/applicationRoutes.ts:182`) exists under the monthly-expenses routes. It looks like a copy-paste artefact. It is not part of this module.

## Changelog

### 2026-10-25 — synced with code changes in commit `50632dc` ("Code Ai Optimization revamp")

- Controller: removed the redundant `try { … } catch (e) { throw e }` wrappers from create, update, delete and toggle (no behaviour change); `file:line` references updated.
- Service: `findAllAndStatusIn` no longer `await`s the (synchronous) `getCache`.
- Cache util: `node-cache` uses `useClones: false`, so the cached garage list is shared by reference; gotcha 8 reworded.
- Dependents: `vehicleMaintain` list and the report monthly expense query now populate `garage` with `_id name` only; `applicationRoutes` line references shifted by one.
