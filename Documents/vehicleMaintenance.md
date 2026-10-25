# Vehicle Maintenance Module (`vehicleMaintain`)

## 1. Overview

The Vehicle Maintenance module records each repair or service done on a fleet vehicle at a garage. A record holds the vehicle, the part maintained, the garage, the date, the cost, a note, and photos of the bill. Maintenance cost is an operating expense:

- **Company vehicles:** all maintenance counts as a company expense (dashboard and monthly expenses report).
- **Rental vehicles:** maintenance costing **≤ 5000** is absorbed by the company as an expense. Maintenance costing **> 5000** is excluded from company expenses and deducted from the owner's monthly payment in the vehicle payment report.
- **Freelance vehicles:** maintenance is never a company expense. It is always deducted from the owner's payment.

Records can only be created or re-dated within the company's current **working month** (`CompanyWorkingInfo`). After the month-end audit runs (`isMonthEndDone = true`), records become read-only.

Routes are mounted at `/api/v1/vehicleMaintenance` (`src/applicationRoutes.ts:210-218`, `src/mapping.ts:48`).

## 2. Files

| File | Role |
|---|---|
| `src/modules/vehicleMaintain/vehicleMaintenance.model.ts` | Mongoose schema/model `VehicleMaintenance` |
| `src/modules/vehicleMaintain/vehicleMaintenance.route.ts` | Router and role guards |
| `src/modules/vehicleMaintain/vehicleMaintenance.controller.ts` | Request handlers |
| `src/modules/vehicleMaintain/vehicleMaintenance.service.ts` | DB access, cache, month-end query and bulk month-end flag |
| `src/modules/vehicleMaintain/vehicleMaintenance.validation.ts` | Joi `saveVehicleMaintenanceSchema` |
| `src/modules/vehicleMaintain/vehicleMaintenance.util.ts` | DTO mappers + `isDateInWorkingMonth` |
| `src/modules/vehicleMaintain/dto/vehicleMaintenanceResponseDto.ts` | List DTO |
| `src/modules/vehicleMaintain/dto/vehicleMaintenanceInvoiceResponseDto.ts` | Invoice DTO (adds `vehicleOwnerName`) |

## 3. Data Model: `VehicleMaintenance` (collection `vehiclemaintenances`)

Source: `vehicleMaintenance.model.ts:4-81` (schema 4-75, indexes 77-79). Options: `timestamps: true`, `versionKey: false`.

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `vehicle` | ObjectId → `Vehicle` | required | |
| `maintenancePart` | String | required, maxlength 100 | Free text, for example "Brake pads" |
| `garage` | ObjectId → `Garage` | required | |
| `maintenanceDate` | Date | required | Must fall in the working month at create time (and at update time, see 4.2) |
| `cost` | Number | required, default `0` | No minimum or sign check |
| `note` | String | maxlength 500 | |
| `isMonthEndDone` | Boolean | default `false` | Set to `true` by the month-end audit. Locks update and delete. |
| `billImageUrls` | [String] | default `[]` | URLs of uploaded bill images. Upload happens elsewhere (store module). `WellKnownUploadType.MaintenanceInvoice = 9` exists but is not referenced in code. |
| `batchId` | Number | default `0` | Month-end batch id, set by the month audit |
| `status` | Number | required, default `WellKnownStatus.ACTIVE` | `1 ACTIVE`, `2 INACTIVE`, `3 DELETED`. No endpoint sets INACTIVE. |
| `createdBy` | ObjectId → `User` | | |
| `updatedBy` | ObjectId → `User` | | |

- Indexes (`vehicleMaintenance.model.ts:77-79`, non-unique):
  - `{ maintenanceDate: 1, status: 1 }`: date-range list and month-end query.
  - `{ vehicle: 1, maintenanceDate: 1 }`: per-vehicle monthly query in the report module.
- Hooks / virtuals: none.
- No embedded sub-schemas.

## 4. API Endpoints

Base: `/api/v1/vehicleMaintenance`.

`ACCESS_ROLES` (`vehicleMaintenance.route.ts:10`) is ADMIN (2), SUPERADMIN (1), TRIPMANAGER (5), FINANCEOFFICER (4), DRIVERASSISTANT (6), and TRIPASSISTANT (7). It is every role except DRIVER (3).

| Method | Path | Controller | Auth / Roles | Description |
|---|---|---|---|---|
| POST | `/vehicleMaintenance/` | `saveVehicleMaintenance` | ACCESS_ROLES | Create a maintenance record |
| PUT | `/vehicleMaintenance/:id` | `updateVehicleMaintenance` | ACCESS_ROLES | Update a record |
| DELETE | `/vehicleMaintenance/:id` | `deleteVehicleMaintenance` | ACCESS_ROLES | Soft delete |
| GET | `/vehicleMaintenance/:id` | `getVehicleMaintenanceById` | Any authenticated user | Raw record |
| GET | `/vehicleMaintenance/?startDate=&endDate=` | `getAllVehicleMaintenances` | Any authenticated user | List by date range (DTO) |
| GET | `/vehicleMaintenance/maintainInvoice/:id` | `getVehicleMaintenanceInvoice` | Any authenticated user | Invoice view (DTO) |

Auth middleware, the response envelope, and error mapping are described in `vehicle.md` §4. In short: a `BadRequestError` returns 400, and a Mongoose `CastError` returns 404 `No item found with ID "<value>"!`.

### Request body (`saveVehicleMaintenanceSchema`, `vehicleMaintenance.validation.ts:3-40`), shared by POST and PUT

Unknown keys are rejected.

| Field | Rule / message |
|---|---|
| `vehicle` | string, **required** (`Vehicle is required`). Not validated as an ObjectId. |
| `maintenancePart` | string, max 100, **required** |
| `garage` | string, **required** |
| `maintenanceDate` | Joi date, **required** (`Maintenance Date is invalid` on parse failure) |
| `cost` | number, **required** |
| `note` | string, max 500, may be `null` or `''` |
| `billImageUrls` | array of strings, may be `null` (`Bill Image URLs must be an array`) |

---

### 4.1 POST `/vehicleMaintenance/` (`saveVehicleMaintenance`, `vehicleMaintenance.controller.ts:17-85`)

1. Validate the body. On failure, return 400 with the Joi message.
2. Call `companyWorkingInfoService.getCompanyWorkingInfo()`. It returns the latest ACTIVE `CompanyWorkingInfo` and is cached for ONE_MONTH under the key `companyWorkingInfo`. If there is none, return 400 `No active company information found!`.
3. Call `vehicleMaintenanceUtil.isDateInWorkingMonth(maintenanceDate, workingYear, workingMonth)`. If it returns false, return 400 `Vehicle maintenance date is not in working month!`.
4. Call `vehicleService.findByIdAndStatusIn(vehicle, [ACTIVE, INACTIVE])`. If the vehicle is not found, return 400 `Invalid vehicle. Vehicle does not exist!`.
5. Call `garageService.findByIdAndStatusIn(garage, [ACTIVE, INACTIVE])`. If the garage is not found, return 400 `Invalid garage. Garage does not exist!`.
6. Build a new document from the body with `createdBy = updatedBy = auth.id`. `status` and `isMonthEndDone` take their defaults.
7. Call `vehicleMaintainService.save(doc, null)`. This clears cache prefix `vehicleMaintenance-`, then saves.
8. Response: **201** `Vehicle maintenance record created successfully` with `data` set to the document.

### 4.2 PUT `/vehicleMaintenance/:id` (`updateVehicleMaintenance`, `vehicleMaintenance.controller.ts:88-170`)

1. Validate the body. On failure, return 400.
2. Load the record with `findByIdAndStatusIn(id, [ACTIVE, INACTIVE])`. If it is not found, return 400 `Invalid vehicle maintenance!`.
3. If `isMonthEndDone` is true, return 400 `Cannot update vehicle maintenance, Month end process already done!`.
4. If `record.vehicle.toString() !== body.vehicle`, check that the new vehicle exists (ACTIVE/INACTIVE). If it does not, return 400 `Invalid vehicle. Vehicle does not exist!`.
5. If `record.maintenanceDate !== body.maintenanceDate`, re-check the working month. The step either returns 400 `No active company information found!` or 400 `Vehicle maintenance date is not in working month!`.
   - This comparison is a `Date` object against the raw request string, so it is **always true**. The working-month check effectively runs on every update.
6. If `record.garage.toString() !== body.garage`, check that the new garage exists. If it does not, return 400 `Invalid garage. Garage does not exist!`.
7. Overwrite `vehicle`, `maintenancePart`, `garage`, `maintenanceDate`, `cost`, `note`, `billImageUrls`, and `updatedBy`, then save (cache cleared).
8. Response: 200 `Vehicle maintenance updated successfully` with `data` set to the document.

### 4.3 DELETE `/vehicleMaintenance/:id` (`deleteVehicleMaintenance`, `vehicleMaintenance.controller.ts:172-200`)

1. Load the record with status in [ACTIVE, INACTIVE]. If it is not found, return 400 `Invalid vehicle maintenance!`.
2. If `isMonthEndDone` is true, return 400 `Cannot delete vehicle maintenance, Month end process already done!`.
3. Set `status = DELETED` and `updatedBy = auth.id`, then save.
4. Response: 200 `Vehicle maintenance deleted successfully` with `data: null`.

Delete does **not** check the working month, so a record from an earlier, not yet audited month can be deleted.

### 4.4 GET `/vehicleMaintenance/:id` (`getVehicleMaintenanceById`, `vehicleMaintenance.controller.ts:202-215`)

1. Call `findByIdAndStatusIn(id, [ACTIVE, INACTIVE])`. There is no populate.
2. Response: 200 with `data` set to the raw document, or `null` if it is not found. There is no 404.

### 4.5 GET `/vehicleMaintenance/?startDate=&endDate=` (`getAllVehicleMaintenances`, `vehicleMaintenance.controller.ts:217-237`)

**Query:** `startDate` and `endDate` are date strings. Neither is validated by the controller, but both are needed in practice (see Gotchas).

1. Call `findAllByMaintenanceDateAndStatusIn([ACTIVE], startDate, endDate)` (`vehicleMaintenance.service.ts:23-51`):
   - Cache key: `"vehicleMaintenance-" + startDate + endDate + "[1]"`. On a hit, return the cached value.
   - `sDate = new Date(startDate)` set to 00:00:00.000, and `eDate = new Date(endDate)` set to 23:59:59.999. Both use **server local time**.
   - Query: `find({ status ∈ [ACTIVE], maintenanceDate: { $gte: sDate, $lte: eDate } })`.
   - Populate with projections: `vehicle` → `_id registrationNumber isRentalVehicle isFreelanceVehicle`; `garage` → `_id name`; `createdBy`/`updatedBy` → `_id userName fullName`. These are exactly the fields the DTO and the dashboard read. The query is not `.lean()`, so hydrated documents are returned.
   - Sort `maintenanceDate: 1` (ascending).
   - Cache the result for ONE_WEEK. The cache stores the documents by reference (`useClones: false`), so every caller gets the same objects.
2. Map the results with `mapmodelArrToVehicleMaintenanceResponseDtos`.
3. Response: 200 with `data` set to `VehicleMaintenanceResponseDto[]`, or `[]`.

**`VehicleMaintenanceResponseDto` fields** (`vehicleMaintenance.util.ts:5-28`):

| Field | Source |
|---|---|
| `id` | `_id` |
| `vehicleId` | `vehicle._id` |
| `vehicleNumber` | `vehicle.registrationNumber` |
| `maintenancePart` | `maintenancePart` |
| `isCompanyVehicle` | `!vehicle.isRentalVehicle && !vehicle.isFreelanceVehicle` |
| `isRentalVehicle` | `vehicle.isRentalVehicle` (default `false`) |
| `isFreelanceVehicle` | `vehicle.isFreelanceVehicle` (default `false`) |
| `garageId` | `garage._id` |
| `garageName` | `garage.name` |
| `maintenanceDate` | `maintenanceDate` |
| `cost` | `cost` |
| `note` | `note` |
| `billImageUrls` | `billImageUrls` |
| `isMonthEndDone` | `isMonthEndDone` |
| `createdBy` | `createdBy._id` |
| `createdUser` | `createdBy.userName` (or `''`) |
| `updatedBy` | `updatedBy._id` |
| `updatedUser` | `updatedBy.userName` (or `''`) |
| `createdAt` | `createdAt` |
| `updatedAt` | `updatedAt` |

### 4.6 GET `/vehicleMaintenance/maintainInvoice/:id` (`getVehicleMaintenanceInvoice`, `vehicleMaintenance.controller.ts:239-258`)

1. Call `findByIdAndStatusInWithData(id, [ACTIVE])`, which populates `vehicle garage createdBy updatedBy`. Only ACTIVE records are returned.
2. If the record is found, map it with `modelTovehicleMaintainInvoiceResponseDto`. Otherwise `data` is `null` and the status is still 200.
3. **Invoice DTO:** the same fields as the list DTO, plus `vehicleOwnerName = vehicle.vehicleOwner`. Here `createdUser` and `updatedUser` come from **`fullName`**, not `userName` (`vehicleMaintenance.util.ts:34-58`).

## 5. Business Rules & State Transitions

### Status

| From | To | Via |
|---|---|---|
| (new) | ACTIVE | POST (schema default) |
| ACTIVE / INACTIVE | DELETED | DELETE (blocked if `isMonthEndDone`) |

No API sets INACTIVE. The list and invoice endpoints only show ACTIVE records.

### Month-end lock

| `isMonthEndDone` | Update | Delete |
|---|---|---|
| `false` | allowed (date must be in the working month) | allowed |
| `true` | 400 | 400 |

Month-end is set by `monthAudit.controller.ts:231-250` (`monthEndDoneForVehicleMaintenance`) while a new working month is created (`createNewDate`, inside a transaction):

1. `vehicleMaintenanceService.findAllByEndMonthAndStatusIn(workingMonth, workingYear, [ACTIVE])` (`vehicleMaintenance.service.ts:53-71`) builds the cut-off date and returns only the ids:

   ```js
   endDate = new Date(); endDate.setFullYear(currYear); endDate.setMonth(endMonth); // endMonth is 1-based → JS month index of NEXT month
   endDate = new Date(Y, M, 1); endDate.setHours(23, 59, 59, 999);                 // 1st of next month 23:59:59.999 (local)
   find({ maintenanceDate < endDate, status ∈ [ACTIVE], isMonthEndDone: false }).select('_id').sort({ startDate: 1 }).lean()
   ```

2. `vehicleMaintenanceService.markMonthEndDone(ids, userId, batchId, session)` (`vehicleMaintenance.service.ts:73-78`) flags all of them in **one write**: it returns early when `ids` is empty, otherwise clears cache prefix `vehicleMaintenance-` and runs `updateMany({ _id ∈ ids }, { $set: { isMonthEndDone: true, batchId, updatedBy } }, { session })`.
3. The audit then logs one `MONTH_AUDIT | Vehicle Maintain Month End Done …` line per id (`helperUtil.consoleLogMessage`).

### Working-month rule (`isDateInWorkingMonth`, `vehicleMaintenance.util.ts:61-78`)

```js
const d = new Date(maintenanceDate);
if (isNaN(d.getTime())) return false;               // logs console.warn
return d.getFullYear() === workingYear && d.getMonth() + 1 === workingMonth;
```

The check uses the server's **local** timezone.

### Expense treatment (implemented in other modules)

**Dashboard expense total** (`dashboard.controller.ts:132-146`, fetched in parallel with the trip and monthly expenses via `Promise.all` at lines 96-103) and **monthly expenses report** (`report.controller.ts:99-141`):

- Skip records with a null `vehicle` (the report also skips a null `garage`).
- Skip freelance vehicles.
- Skip rental vehicles with `cost > 5000`.
- Otherwise add `cost`. The report labels the line "Rental Vehicle Maintenance" or "Company Vehicle Maintenance".

**Vehicle monthly payment report** (`report.controller.ts:290-318`) for one freelance or rental vehicle in a month:

```text
totalVehicleMaintenance  = Σ cost
effectiveMaintenanceCost = Σ cost                     (freelance)
                         = Σ cost where cost > 5000   (rental)
valuePerDay = rentalFor30Days / 30
netTotal    = valuePerDay × workedDaysCount
grossTotal  = netTotal − effectiveMaintenanceCost
```

## 6. Utilities & DTOs

| Function | Location | Description |
|---|---|---|
| `mapmodelToVehicleMaintenanceResponseDto` | `util.ts:5-28` | List DTO (see 4.5). Requires a populated `vehicle` and `garage`; a `null` populate throws a TypeError, which becomes a 500. |
| `mapmodelArrToVehicleMaintenanceResponseDtos` | `util.ts:30-32` | Array map |
| `modelTovehicleMaintainInvoiceResponseDto` | `util.ts:34-58` | Invoice DTO (+ `vehicleOwnerName`, user names from `fullName`) |
| `isDateInWorkingMonth` | `util.ts:61-78` | See §5 |
| `save(doc, session)` | `service.ts:5-13` | Clears prefix `vehicleMaintenance-`, then saves (with an optional session) |
| `findByIdAndStatusIn(id, statuses)` | `service.ts:15-17` | Plain `findOne` |
| `findByIdAndStatusInWithData(id, statuses)` | `service.ts:19-21` | `findOne` + populate `vehicle garage createdBy updatedBy` |
| `findAllByMaintenanceDateAndStatusIn(statuses, start, end)` | `service.ts:23-51` | Cached date-range list with projected populates (see 4.5) |
| `findAllByEndMonthAndStatusIn(endMonth, year, status)` | `service.ts:53-71` | Month-end candidate query; returns lean `{ _id }` objects only (see §5) |
| `markMonthEndDone(ids, userId, batchId, session)` | `service.ts:73-78` | Bulk `updateMany` setting `isMonthEndDone`, `batchId`, `updatedBy`; clears the `vehicleMaintenance-` cache; no-op for an empty list |

## 7. Dependencies

**This module reads:**

- `vehicle` (`vehicleService.findByIdAndStatusIn`)
- `garage` (`garageService.findByIdAndStatusIn`)
- `common/companyWorkingInfo` (`getCompanyWorkingInfo`)
- `User` (populate)
- `cache`

**This module writes:** only its own `VehicleMaintenance` collection.

**Modules that depend on this one:**

| Module | Usage |
|---|---|
| `monthAudit` (`monthAudit.controller.ts:31, 87-94, 231-250`) | `findAllByEndMonthAndStatusIn` + `markMonthEndDone` to mark records as month-end done, with a batch id |
| `dashboard` (`dashboard.controller.ts:13, 103`) | `findAllByMaintenanceDateAndStatusIn` for the expense totals (reads `vehicle.isFreelanceVehicle`, `vehicle.isRentalVehicle`, `cost`) |
| `report` (`report.service.ts:5, 71-93`) | Imports the **model** directly. Queries by calendar month, `[monthStart, nextMonthStart)`, `.lean()`, for the monthly expense report (projected populates) and the vehicle payment report (full populate, filtered by `vehicle`). |

## 8. Notes / Gotchas

1. **The update date comparison is always true.** `vehicleMaintain.maintenanceDate !== maintenanceDate` compares a `Date` with a string (`vehicleMaintenance.controller.ts:127`). Every update therefore re-validates the working month. In practice an un-audited record from a previous month **cannot be updated at all**, even when the date is unchanged, although it *can* be deleted.
2. **Missing `startDate`/`endDate` on the list endpoint causes a 404.** The query receives an `Invalid Date`, and Mongoose throws a `CastError`, which the error middleware turns into a 404 `No item found with ID "Invalid Date"!` (verified against Mongoose 8 casting).
3. **Different user-name fields per DTO.** The list DTO uses `userName` and the invoice DTO uses `fullName` for `createdUser`/`updatedUser`.
4. **GET by id and the invoice return 200 with `null`** for unknown records instead of 404/400.
5. **The month-end query sorts by `startDate`, which does not exist on the schema.** The sort has no effect. The cut-off is the end of the **1st day of the next month**, so the boundary includes one extra day. `new Date().setMonth(...)` also overflows when the job runs on the 29th–31st: for example, `setMonth(3)` on the 31st becomes 1 May, which can push the cut-off a month further.
6. **The timezone dependency is server-local.** Both `isDateInWorkingMonth` and the list's `setHours` use the server timezone. A client sending UTC ISO timestamps near midnight can fall into the neighbouring month or day.
7. **INACTIVE vehicles and garages are accepted** for new or updated records.
8. **No minimum cost.** A negative or zero `cost` passes validation.
9. **The list cache can hold stale related data.** The list is cached per date range for one week and cleared only when a maintenance record is saved. Edits to a vehicle (registration number, rental flags) or a garage name are not reflected in the cached list until another maintenance save or a restart. This affects the dashboard expense calculation, which uses the same cached function. Because the cache now holds the documents by reference (`useClones: false`), the list and the dashboard also share the same objects; neither mutates them today.
10. **A dangling populate can crash the list.** If a referenced vehicle or garage document were hard-deleted, `model.vehicle._id` would throw a TypeError and the list would return a 500. The report code guards against `null`, but this mapper does not.
11. **`WellKnownUploadType.MaintenanceInvoice (9)` is defined but never referenced.** Bill images are expected to be uploaded through `/store/upload`, with the URLs passed in `billImageUrls`.
12. **The 5000 threshold is hard-coded** in the dashboard and report controllers and is not defined as a constant.
13. **The month-end bulk write bypasses document middleware and validation.** `markMonthEndDone` uses `updateMany`, so no `save` hooks or validators run (none exist today; `timestamps` still updates `updatedAt`). It also clears the list cache *before* the write inside the audit transaction, so a list read between the clear and the commit can re-cache records still showing `isMonthEndDone: false` for up to a week.

## Changelog

### 2026-10-25 — synced with code changes in commit `50632dc` ("Code Ai Optimization revamp")

- Model: added non-unique indexes `{ maintenanceDate, status }` and `{ vehicle, maintenanceDate }`.
- Service: `findAllByMaintenanceDateAndStatusIn` populates with field projections (`vehicle`, `garage`, users) instead of whole documents; `getCache` is no longer awaited.
- Service: `findAllByEndMonthAndStatusIn` now returns lean `_id`-only results, and the new `markMonthEndDone` flags all month-end records in one `updateMany` (replacing the per-document `save` loop in `monthAudit`). Added gotcha 13.
- Cache util: `useClones: false` (shared cached references); gotcha 9 extended.
- Updated `file:line` references for monthAudit, dashboard (now fetches maintenance in a `Promise.all`), report and `applicationRoutes`.
