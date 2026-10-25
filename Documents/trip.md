# Trip Module

> Source: `src/modules/trip/` — mounted at `/api/v1/trip` (`src/app.ts:43` uses `constants.API.PREFIX = '/api/v1'`, `src/mapping.ts` mounts `TripRouter` at `applicationRoutes.trip.base = '/trip'`).

---

## 1. Overview

The Trip module is the core of the tour/transport management system. A **trip** is a confirmed customer booking (a tour) that the company operates:

- **Booking data** — start/end dates, number of days, quoted price (foreign and local currency), estimated expense budget for the driver, payment mode, requested vehicle type, customer contact person/email/phone, special requirements.
- **Passengers** — name, nationality, age, gender.
- **Logistics** — arrival/departure flight info, pickup/drop-off info.
- **Itinerary** — ordered list of **places** (destinations) that the driver marks as "reached" on the road (recording GPS location and odometer mileage); **hotels** and **activities** that may be pre-paid by the company (with payment tracking and receipts).
- **Resources** — the assigned **driver(s)** and **vehicle(s)** (history kept, one active at a time once the trip is started).
- **Pre-trip vehicle checklist** — answered by the driver before starting.
- **Lifecycle** — `PENDING → START → FINISHED`, or `PENDING → CANCELED`. Starting a trip creates an `Expenses` document (driver's trip expense ledger); cancelling reverses any POS (shop/minibar) stock issued for the trip.
- **Month-end** — the `monthAudit` module later flags trips with `isMonthEndDone`/`batchId`, after which most mutations are blocked.

---

## 2. Files

| File | Role |
|---|---|
| `src/modules/trip/trip.model.ts` | Mongoose `Trip` schema/model (collection `trips`). |
| `src/modules/trip/trip.route.ts` | Express router: binds routes from `applicationRoutes.trip` to controller functions with `authMiddleware.authorize` role guards. |
| `src/modules/trip/trip.controller.ts` | All request handling and business logic (validation, state transitions, driver/vehicle assignment, places, payments, POS reversal, transactions). |
| `src/modules/trip/trip.service.ts` | Data-access helpers (`save`, finders by id/status/date/driver/month, lean list queries with field projections, month-end id lookup + bulk flag, confirmed-number uniqueness). |
| `src/modules/trip/trip.validation.ts` | Joi schemas: `tripSchema`, `assignDriverVehicleSchema`, `checkListAnswerSchema`, `markPlaceSchema`, `tripHotelActivityPaymentSchema` (the last one is never used). |
| `src/modules/trip/trip.util.ts` | DTO mappers (trip → list DTO, trip → detail DTO, places → place DTO). |
| `src/modules/trip/dto/tripResponseDtos.ts` | TypeScript interfaces for response DTOs. |

---

## 3. Data Model

### 3.1 `Trip` (`src/modules/trip/trip.model.ts`)

Model name `'Trip'` (`trip.model.ts:495`). Schema options: `timestamps: true` (adds `createdAt`, `updatedAt`), `versionKey: false`. **No hooks, virtuals or methods.**

**Indexes** (`trip.model.ts:488-493`, all non-unique, besides the default `_id`):

| Index | Serves |
|---|---|
| `{ status: 1, startDate: 1, endDate: 1 }` | `findAllByStatusIn` / `findAllByStatusInAndOnlyFromEndDate` (status + date range). |
| `{ endDate: 1, status: 1, isMonthEndDone: 1 }` | Month-end filter (`monthEndFilter`). |
| `{ 'drivers.driver': 1, status: 1, isMonthEndDone: 1 }` | `findAllByDriverIdAndStatusIn` (driver listing). |
| `{ 'vehicles.vehicle': 1 }` | Lookups of trips by vehicle (other modules). |
| `{ tripConfirmedNumber: 1, status: 1 }` | `isTripConfirmedNumberExists`. **Not unique** — uniqueness is still enforced only in code. |

#### Top-level fields

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `startDate` | Date | yes (`'Start Date is required'`) | — | |
| `endDate` | Date | yes (`'End Date is required'`) | — | |
| `tripConfirmedNumber` | String | no | `0` (number literal, cast to `"0"`) | Business-facing booking number. Uniqueness enforced in code only (among non-cancelled trips); the `{tripConfirmedNumber, status}` index is non-unique. |
| `isPaymentCollected` | Boolean | no | `false` | Whether the customer payment has been collected. |
| `dateCount` | Number | yes | — | Number of days. |
| `requestedVehicle` | String | no | `''` | Free text vehicle type requested. |
| `totalCost` | Number | yes | — | Price (foreign currency). |
| `totalCostLocalCurrency` | Number | yes | `0` | Price in local currency. |
| `estimatedExpense` | Number | yes | — | Expense budget given to the driver. Incremented by `expenseRequest` approvals. |
| `specialRequirement` | String | no | — | `maxlength 500` (`'Special Requirement cannot be more than 500 characters'`). |
| `paymentMode` | String | yes | `'Cash'` | |
| `passengers` | [Passenger] | — | `[]` | See 3.2. |
| `arrivalInfo` | nested | — | — | `arrivalDate: Date`, `arrivalTime: Date`, `arrivalFlightNumber: String`. |
| `departureInfo` | nested | — | — | `departureDate: Date`, `departureTime: Date`, `departureFlightNumber: String`. |
| `pickUpInfo` | nested | — | — | `pickupDate: Date`, `pickupTime: Date`, `pickupCity: String`, `pickupAddress: String`. |
| `dropOffInfo` | nested | — | — | `dropOffDate: Date`, `dropOffTime: Date`, `dropOffCity: String`, `dropOffAddress: String`. |
| `activities` | [Activity] | — | `[]` | See 3.3. |
| `places` | [Place] | — | `[]` | See 3.4. |
| `hotels` | [Hotel] | — | `[]` | See 3.5. |
| `email` | String | yes | — | `maxlength 100`; regex validator `/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/` (`'Please enter a valid email'`). |
| `phoneNumber` | String | no | — | `maxlength 20`. |
| `contactPerson` | String | no | — | `maxlength 100`. |
| `drivers` | [DriverAssignment] | — | `[]` | See 3.6. (Older single `driver`/`driverAssignedBy` fields are commented out, `trip.model.ts:380-388`.) |
| `vehicles` | [VehicleAssignment] | — | `[]` | See 3.7. |
| `checkListAnswers` | Object (Mixed) | no | `null` | Driver's pre-trip checklist (shape = `checkListAnswerSchema`). `null` ⇒ checklist not done. |
| `checkListCheckBy` | ObjectId → `User` | no | `null` | Driver who submitted the checklist. |
| `status` | Number | yes | `WellKnownLeaveStatus.PENDING` (= 1) | Trip status, semantically `WellKnownTripStatus` (see §5). Note the default uses the *leave* enum. |
| `createdBy` | ObjectId → `User` | no | — | |
| `updatedBy` | ObjectId → `User` | no | — | |
| `startedBy` | ObjectId → `User` | no | `null` | Driver who started the trip. |
| `endedBy` | ObjectId → `User` | no | `null` | Admin/manager who finished it. |
| `isMonthEndDone` | Boolean | no | `false` | Set `true` by the `monthAudit` module via `tripService.markMonthEndDone` (bulk `updateMany`, `monthAudit.controller.ts:287`). |
| `batchId` | Number | no | `0` | Month-end batch id, set in the same `updateMany` (together with `updatedBy`). |
| `createdAt` / `updatedAt` | Date | auto | — | From `timestamps`. |

#### 3.2 Passenger sub-document (`trip.model.ts:70-89`)

| Field | Type | Required |
|---|---|---|
| `name` | String | yes |
| `nationality` | String | yes |
| `age` | Number | yes |
| `gender` | String | yes |

Each has an auto `_id`.

#### 3.3 Activity sub-document (`trip.model.ts:149-216`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `date` | Date | — | |
| `description` | String | — | |
| `adultCount` | Number | — | |
| `childCount` | Number | — | |
| `totalCost` | Number | — | |
| `isPaymentByCompany` | Boolean | `false` | Company pre-pays this activity. |
| `isPaymentDone` | Boolean | `false` | Set by `updateHotelActivityPayment`. |
| `paymentAmount` | Number | `0` | |
| `paymentDate` | Date | `null` | |
| `paymentRemark` | String | `''` | |
| `updatedBy` | ObjectId → `User` | `null` | Who recorded the payment. |
| `paymentMode` | String | `0` (cast to `"0"`) | Joi sends a number; stored as string. |
| `receiptImageUrl` | String | `''` | |

#### 3.4 Place sub-document (`trip.model.ts:218-283`)

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `description` | String | required (`'Description is required'`) | Destination name. |
| `dates` | [Date] | element `required` | Dates the place is visited. |
| `isReached` | Boolean | `false` | Set by `markPlaceAsReached`. |
| `index` | Number | `0` | 1-based order, (re)computed on save/update. |
| `reachedDate` | Date | `null` | Server time when marked reached. |
| `calcDistance` | Number | `0` | km driven since last odometer reading. |
| `startMilage` | Number | `0` | Vehicle odometer before. |
| `endMilage` | Number | `0` | Odometer entered by driver. |
| `location` | Object (Mixed) | `null` | `{ lat, lng }` from driver. |
| `reachedBy` | ObjectId → `User` | `null` | |
| `updatedBy` | ObjectId → `User` | `null` | Last user that edited the place. |

#### 3.5 Hotel sub-document (`trip.model.ts:285-348`)

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `dates` | **String** | required | Comma-separated date list (sorted by the earliest one on update). |
| `hotelName` | String | required | |
| `city` | String | required | |
| `isPaymentByCompany` | Boolean | `false` | |
| `isPaymentDone` | Boolean | `false` | |
| `paymentAmount` | Number | `0` | |
| `paymentDate` | Date | `null` | |
| `paymentRemark` | String | `''` | |
| `updatedBy` | ObjectId → `User` | `null` | |
| `paymentMode` | String | `0` | |
| `receiptImageUrl` | String | `''` | |

#### 3.6 Driver assignment sub-document (`trip.model.ts:390-407`)

| Field | Type | Default |
|---|---|---|
| `driver` | ObjectId → `User` | — |
| `driverAssignedBy` | ObjectId → `User` | — |
| `isActive` | Boolean | `true` |

#### 3.7 Vehicle assignment sub-document (`trip.model.ts:410-430`)

| Field | Type | Required / Default |
|---|---|---|
| `vehicle` | ObjectId → `Vehicle` | required (`'Vehicle is required'`), default `null` |
| `isActive` | Boolean | `true` |
| `vehicleAssignedBy` | ObjectId → `User` | `null` |

### 3.8 Collections referenced by `Trip`

`User` (many fields), `Vehicle` (`vehicles.vehicle`). Collections that reference `Trip` via `tripId`: `Expenses`, `ExpenseRequest`, `Pos`, `TripSummary`.

---

## 4. API Endpoints

All paths below are relative to `/api/v1`. "Any authenticated" = `authMiddleware.authorize([])`: valid `Bearer` JWT, `Auth` record exists and is not blocked, any role. Role ids (`src/constant.ts`): `SUPERADMIN=1, ADMIN=2, DRIVER=3, FINANCEOFFICER=4, TRIPMANAGER=5, DRIVERASSISTANT=6, TRIPASSISTANT=7`.

| # | Method | Path | Controller | Allowed roles | Description |
|---|---|---|---|---|---|
| 1 | POST | `/trip` | `saveTrip` | TRIPMANAGER, SUPERADMIN, ADMIN, TRIPASSISTANT | Create a trip. |
| 2 | PUT | `/trip/:id` | `updateTrip` | TRIPMANAGER, SUPERADMIN, ADMIN, TRIPASSISTANT | Update a trip (merging activities/hotels/places). |
| 3 | DELETE | `/trip/:id` | `cancelTrip` | TRIPMANAGER, SUPERADMIN, ADMIN, TRIPASSISTANT | Cancel a pending trip and reverse its POS stock. |
| 4 | GET | `/trip/:id` | `getTripById` | Any authenticated | Raw trip document. |
| 5 | GET | `/trip` | `getAllTripsByRole` | Any authenticated (result depends on role) | List trips. |
| 6 | PUT | `/trip/assignDriver/:id` | `assignDriverAndVehicle` | TRIPMANAGER, SUPERADMIN, ADMIN | Assign/replace driver and/or vehicle. |
| 7 | PUT | `/trip/checkList/:id` | `saveCheckListAnswers` | DRIVER | Save pre-trip checklist. |
| 8 | GET | `/trip/checkList/:id` | `getCheckListAnswers` | Any authenticated | Get checklist answers. |
| 9 | PUT | `/trip/updateHotelActivityPayment/:id` | `updateHotelActivityPayment` | TRIPMANAGER, SUPERADMIN, ADMIN | Record company payment of a hotel/activity. |
| 10 | PUT | `/trip/:id/status/:status` | `changeTripStatus` | TRIPMANAGER, SUPERADMIN, ADMIN, DRIVER | Start / revert-to-pending / finish. |
| 11 | GET | `/trip/places/:id` | `getPlacesByTripId` | Any authenticated | Places (itinerary) as DTOs. |
| 12 | PUT | `/trip/:tripId/markAsReached/:placeId` | `markPlaceAsReached` | DRIVER | Mark a place reached with mileage. |
| 13 | GET | `/trip/tripForPrint/:id` | `getTripForReport` | Any authenticated (expenses only for some roles) | Trip + expense summary for printing. |
| 14 | GET | `/trip/tripForQrCode/:id` | `getTripForQrCode` | **No auth** (`authorize([], true)`) | Trip + expense summary for a QR-code page. |
| 15 | GET | `/trip/hotelsAndActivities/:id` | `getTripHotelsAndActivities` | Any authenticated | Company-paid hotels and activities. |
| 16 | GET | `/trip/destinationSummary/:id` | `getDestinationSummaryPrint` | Any authenticated | Raw places for the destination summary print. |

`applicationRoutes.trip.undoTripStatus = '/:id/undoStatus/:status'` is defined but **no route uses it**.

### Common response / error envelope

Success: `CommonResponse(res, true, status, message, data)` → `{ isSuccessful, timeStamp, message, data }` (`src/util/commonResponse.ts`).

Errors (handled by `src/middleware/error.middleware.ts`, async errors propagated via `express-async-errors`), response body `{ isSuccessful: false, timeStamp, message, data: null }`:

| Source | HTTP | Message |
|---|---|---|
| `BadRequestError` | 400 | given message |
| Auth: missing/invalid header, unknown auth, expired token | 401 | `Authentication invalid!` / `Your session is expired!` / `Your account is blocked, Please contact admin!` |
| Auth: bad token signature, role not in list | 403 | `You're unauthorized to access this resource!` |
| Mongoose `ValidationError` | 400 | first validator message |
| Mongoose `CastError` (e.g. malformed `:id`) | 404 | `No item found with ID "<value>"!` |
| Duplicate key (code 11000) | 409 | `<keys> already exists! ...` (no unique indexes on Trip, so not expected) |
| Any other error (e.g. `TypeError`) | 500 | the raw `err.message` |

---

### 4.1 POST `/trip` — `saveTrip` (`trip.controller.ts:29-127`)

**Body** — validated with `tripSchema` (`trip.validation.ts:3-270`) using default Joi options (**unknown keys are rejected**; Joi defaults are not applied since `value` is discarded):

| Field | Rule |
|---|---|
| `tripConfirmedNumber` | string, required |
| `startDate`, `endDate` | date, required |
| `dateCount` | number ≥ 1, required |
| `contactPerson` | string, required |
| `totalCost`, `totalCostLocalCurrency`, `estimatedExpense` | number, required |
| `isPaymentCollected` | boolean (default false) |
| `specialRequirement` | string, allows `null`/`''` (no max in Joi; Mongoose enforces 500) |
| `requestedVehicle` | string, allows `null`/`''` |
| `paymentMode` | string, required |
| `passengers` | array, required, min 1; items `{ _id: string req, name: string req, nationality: string req, age: number req, gender: string req }` |
| `activities` | array (optional); items `{ _id: string req, date: date, description: string, adultCount: number, childCount: number, totalCost: number, isPaymentByCompany: boolean }` |
| `hotels` | array (optional); items `{ _id: string req, dates: string req, hotelName: string req, city: string req, isPaymentByCompany: boolean }` |
| `email` | string email, required |
| `phoneNumber` | string, required |
| `arrivalInfo` | object or null, optional `{ arrivalDate: date, arrivalTime: date, arrivalFlightNumber: string }` |
| `departureInfo` | object or null `{ departureDate, departureTime: date, departureFlightNumber: string }` |
| `pickUpInfo` | object or null `{ pickupDate, pickupTime: date, pickupCity, pickupAddress: string }` |
| `dropOffInfo` | object or null `{ dropOffDate, dropOffTime: date, dropOffCity, dropOffAddress: string }` |
| `places` | array, **required**; items `{ _id: string req, description: string req, dates: array req, isReached: boolean, index: number req }` |

The `_id`s are client-generated placeholders (required by Joi, stripped by the controller).

**Logic**
1. Joi validation → 400 with Joi message on failure.
2. `tripService.isTripConfirmedNumberExists(body.tripConfirmedNumber, '')` — finds any trip with the same number whose `status != CANCELED` → 400 `This trip confirmed number already used in another trip!`.
3. Normalise arrays (`passengers`, `activities` default `[]`; info objects default `null`; `places`, `hotels` default `[]`).
4. Delete `_id` from every passenger, activity, hotel and place so Mongo generates new ones.
5. Places: sort by client `index` ascending, then set `index = position + 1` and `updatedBy = auth.id`.
6. Build `new Trip({...})` with all body fields, `createdBy = updatedBy = auth.id`. `status` defaults to 1 (PENDING); drivers/vehicles empty. The number comes from the client (a commented-out call to the now-removed `tripService.generateTripId()` remains at `:90`).
7. `tripService.save(newTrip, null)` — no transaction, no cache invalidation.

**Response** `201 Created`, message `Trip Created Successfully`, `data` = saved raw Mongoose document.

**Errors**: 400 Joi message; 400 duplicate confirmed number; 400 Mongoose validation (e.g. invalid email regex, maxlength).

---

### 4.2 PUT `/trip/:id` — `updateTrip` (`trip.controller.ts:129-430`)

**Params**: `id` trip ObjectId. **Body**: same `tripSchema`, validated with `allowUnknown: true`.

**Logic**
1. Joi validation → 400.
2. Load trip with status in `[PENDING, START, FINISHED]` → 400 `Trip not found!`. (No `isMonthEndDone` check — month-closed and finished trips can still be edited.)
3. Confirmed-number uniqueness excluding this trip (`_id: { $ne: id }`) → 400 `This trip confirmed number already used in another trip!`.
4. **Passengers**: fully replaced by body passengers (their `_id`s deleted → regenerated each update).
5. **Activities merge** (starting from `savedActivities = [...trip.activities]`):
   - *Deleted* = saved activities whose `_id` is not in the body. For each: if `isPaymentDone` → 400 `Cannot delete activity <description>, because payment is already done!`; otherwise spliced out.
   - *Updated* = body activities whose `_id` matches a saved one. If saved `isPaymentDone && isPaymentByCompany` and body `isPaymentByCompany` is falsy → 400 `Cannot update activity <description> as not payment by company, because payment is already done!`. Otherwise copies `date, description, adultCount, childCount, totalCost, isPaymentByCompany` (payment fields preserved).
   - *New* = body activities with no matching saved `_id` → `_id` deleted and appended.
   - Sorted ascending by `new Date(a.date)`.
6. **Hotels merge** (same pattern):
   - Delete with `isPaymentDone` → 400 `Cannot delete hotel <hotelName>, because payment is already done!`.
   - Update: if saved `isPaymentByCompany && isPaymentDone` and body `isPaymentByCompany` falsy → 400 `Cannot update hotel <hotelName> as not payment by company, because payment is already done!`. Otherwise copies `hotelName, dates, city, isPaymentByCompany`.
   - New → appended without `_id`.
   - Sorted by earliest date: `dates.split(',').map(trim).sort()[0]` (lexicographic string sort), parsed with `new Date(...)`.
7. **Places merge** (only when body `places.length > 0`):
   - Body places sorted by `index`, re-indexed `1..n`, `updatedBy = auth.id`.
   - *Removed* = saved places whose `_id` is not in body ids; if any removed place `isReached` → 400 `Can not delete reached place!`.
   - For each body place in order:
     - Matches saved place: if `description` differs or `JSON.stringify(saved.dates) !== JSON.stringify(body.dates)` → if saved `isReached` → 400 `Can not update reached place!`; else `Object.assign(saved, bodyPlace, { updatedBy })`. If unchanged, the saved sub-doc is pushed **as is** (its stored `index` is *not* updated).
     - No match: `_id` deleted, `updatedBy` set, appended as new.
   - Result order = body order.
   - If body `places` is `[]`, this block is skipped and `trip.places` becomes `[]` (see Gotchas).
8. Assign all scalar fields from body (`contactPerson, startDate, endDate, dateCount, totalCost, tripConfirmedNumber, specialRequirement, requestedVehicle, paymentMode, totalCostLocalCurrency, estimatedExpense, isPaymentCollected`), arrays, info objects (`?? null`), `email`, `phoneNumber`, `updatedBy = req.auth.id`.
9. `tripService.save(trip, null)`.

Drivers, vehicles, status, checklist are not touched.

**Response** `200`, `Trip Updated Successfully`, `data` = updated raw document.

**Errors**: all 400s above; Mongoose validation 400; 404 CastError for malformed id.

---

### 4.3 DELETE `/trip/:id` — `cancelTrip` (`trip.controller.ts:432-530`)

**Logic**
1. Load trip with status in `[PENDING, START, FINISHED]` → 400 `Trip not found!`.
2. If status is `FINISHED` or `START` → 400 `Can't cancel started or finished trip!` (so only PENDING trips can be cancelled).
3. Start a Mongo session + transaction:
   1. `trip.status = CANCELED (2)`, `updatedBy = auth.id`, save with session.
   2. `posService.findByTripIdAndStatusInWIthProducts(id, [ACTIVE])` — finds the trip's active `Pos` doc, populates `tripId` (`_id tripConfirmedNumber status`) and `products.product` (`InventoryProduct`: `_id productName isReturnableProduct`), and **filters `pos.products` in-memory to `status === ACTIVE`**.
   3. If POS exists and has ≥1 active product:
      - `productService.createBatchLoader(posProduct.map(p => p.product), [ACTIVE])` — **one** `InventoryProduct.find({ _id: {$in: uniqueIds}, status: {$in} })` (outside the session) preloading all line products into a map; the returned `loadProduct(id)` hands out each preloaded document **once** and falls back to `productService.findByIdAndStatusIn` for a repeated id (or one not preloaded).
      - For each product line `p`:
        - `product = await loadProduct(p.product)`; if not found → skip (stock not restored).
        - Unit code via `helperUtil.getSiUnitCode(product.measureUnit)` (`src/util/helper.util.ts`): if the product's unit `isSaveWithSiUnit`, the SI unit code of the same category (e.g. `g`, `ml`), else the unit's own code.
        - `product.inventory += p.quantityWithSiUnitOfMeasure`.
        - Push `inventoryUtil.buildInventoryLog({...})` (`src/util/inventory.util.ts`) to `product.inventoryLogs`: `{ inventoryLogType: WellKnownGrnLogType.POS_TRANSACTION (2), inventoryLogDate: now, inventoryLogQuantity, beforeTransactionInventory, afterTransactionInventory, inventoryLogProductId, inventoryLogCreatedBy: auth.id, message: 'Inventory updated: <qty><unit> added to product "<name>" via voiding POS transaction in trip "<tripConfirmedNumber>". (Trip Cancellation)' }`.
        - `productService.save(product, session)` (clears `product-` cache prefix). Saves are sequential.
      - Then POS `status = DELETED (3)`, `updatedBy`, every (remaining) product line `status = DELETED`, `updatedBy`; `posService.save(pos, session)`.
   4. Commit. On any error: abort and rethrow. Session always ended.

**Response** `200`, `Trip Canceled Successfully`, `data: null`.

**Errors**: 400 `Trip not found!`; 400 `Can't cancel started or finished trip!`; 500 if a product's `measureUnit` id isn't in `measureUnit` data (`getSiUnitCode` reads `isSaveWithSiUnit` on `undefined`).

---

### 4.4 GET `/trip/:id` — `getTripById` (`trip.controller.ts:533-546`)

Loads trip with status in `[PENDING, START, FINISHED]` (no populate) → 400 `Trip not found!`. Returns the raw document (`200`, message `''`). Cancelled trips are not returned.

---

### 4.5 GET `/trip` — `getAllTripsByRole` (`trip.controller.ts:548-619`, `sortTrips` `:621-632`)

**Query**
| Param | Notes |
|---|---|
| `status` | default `'-1'`. `-1` → `[PENDING, START, FINISHED]`; `1` → `[PENDING]`; `3` → `[START]`; `4` → `[FINISHED]` (only those **without** completed driver salaries); `5` → `[FINISHED]` (only those **with** all driver salaries done). Any other value → empty status list → no results. |
| `startDate`, `endDate` | Date strings; used only for non-driver roles. |

**Logic — ADMIN, TRIPMANAGER, SUPERADMIN, DRIVERASSISTANT, TRIPASSISTANT**
1. `tripService.findAllByStatusIn(statusArr, startDate, endDate)`:
   ```js
   sDate = new Date(startDate).setHours(0,0,0,0)     // server local time
   eDate = new Date(endDate).setHours(23,59,59,999)
   Trip.find({ status: {$in}, $or: [ {startDate: {$gte: sDate, $lte: eDate}}, {endDate: {$gte: sDate, $lte: eDate}} ] })
     .populate({ path: 'createdBy updatedBy startedBy endedBy', select: '_id fullName' })
     .populate({ path: 'drivers.driver', select: '_id fullName userName' })   // match {'drivers.isActive': true} is stripped by strictQuery
     .populate({ path: 'vehicles.vehicle', select: '_id registrationNumber licenseRenewalDate insuranceRenewalDate' })
     .sort({ startDate: 1 })
     .lean()                                    // plain objects, no Mongoose defaults/virtuals
   ```
2. `expensesService.applyDriverSalaryDone(trips)` (`expenses.service.ts:100`) sets in-memory `trip.isDriverSalaryDone` for all trips with **one** query:
   - Collect ids of `START`/`FINISHED` trips; `Expenses.find({ tripId: {$in: ids}, status: {$in: [ACTIVE]} }).select('tripId driverSalaries.driver').lean()`; keep the first expense doc per trip.
   - Every trip defaults to `false`; if its expense doc exists and the trip has drivers → `true` iff **every** `trip.drivers[].driver._id` appears in `expense.driverSalaries[].driver`.
3. Filter: `status=5` keep `isDriverSalaryDone`; `status=4` keep `!isDriverSalaryDone`.
4. `sortTrips`: stable sort by status priority `PENDING(1) < START(2) < FINISHED(3)` (within a status, `startDate` ascending from the query).
5. Map with `tripUtil.tripModelArrToTripResponseDtoGetAlls`.

**Logic — DRIVER**
1. `tripService.findAllByDriverIdAndStatusIn(auth.id, statusArr)`: `{ 'drivers.driver': auth.id, status: {$in}, isMonthEndDone: false }`, same populates/projections, sorted by `startDate`, `.lean()`. **Date range ignored.** Matches any driver entry (active or historic).
2. `trip.isActiveDriver = (active driver's _id == auth.id)`.
3. `sortTrips`, map to DTO. (No `isDriverSalaryDone` computation → always `false` in DTO; status `5` behaves like `4` without the salary filter.)

**Other roles (FINANCEOFFICER)**: `data = []`.

**Response** `200`, `data: TripResponseDtoGetAll[]` (see §6).

**Errors**: if `startDate`/`endDate` are omitted for a non-driver, `new Date(undefined)` is `Invalid Date`, which Mongoose fails to cast → `CastError` → 404 `No item found with ID "Invalid Date"!` (behavior of the shared error handler).

---

### 4.6 PUT `/trip/assignDriver/:id` — `assignDriverAndVehicle` (`trip.controller.ts:634-756`)

**Body** (`assignDriverVehicleSchema`): `driverId` string / null / `''`; `vehicleId` string / null / `''`. Unknown keys rejected.

**Logic**
1. Validate → 400.
2. Load trip with status in `[PENDING, START]` → 400 `Trip not found!`.
3. If `driverId` truthy:
   - `userService.findById(driverId)` (any ACTIVE user — role is **not** checked) → 400 `Driver not found!`.
   - **PENDING**: `trip.drivers = [{ driver: driverId, driverAssignedBy: auth.id, isActive: true }]` (history replaced).
   - **START**: find active driver; if it differs from `driverId`: iterate drivers — if `driver.driver === driverId` (ObjectId vs string, never true) reactivate, else set `isActive=false`; if not found, push new active entry. If the active driver equals `driverId` → no change.
4. If `vehicleId` truthy:
   - `vehicleService.findByIdAndStatusIn(vehicleId, [ACTIVE])` → 400 `Vehicle not found!`.
   - Same PENDING (replace) / START (deactivate others + push) logic on `trip.vehicles` with `vehicleAssignedBy`.
5. `tripService.save(trip, null)` (no transaction).

**Response** `200`, `data: null`, message: `Driver and vehicle assigned successfully!` / `Driver assigned successfully!` / `Vehicle assigned successfully!` (the last also when neither id was supplied).

**Errors**: 400s above; 500 `TypeError` if trip is START but has no active driver/vehicle entry (`activeDriver.driver` on `undefined`).

---

### 4.7 PUT `/trip/checkList/:id` — `saveCheckListAnswers` (`trip.controller.ts:1009-1041`)

**Body** (`checkListAnswerSchema`, unknown keys rejected):
| Key | Rule |
|---|---|
| `1` … `14` | number (optional) |
| `umbrellaCount` | number |
| `isTermsConditionsChecked1`, `isTermsConditionsChecked2` | boolean, **required** (value `false` is accepted) |
| `vehicleDamageImages` | array |

**Logic**: validate → trip must be `PENDING` → 400 `Invalid trip or trip is not in pending status!`. Sets `checkListAnswers = body` (overwrites any previous), `checkListCheckBy = auth.id`, save. The calling driver is not checked against the trip's assigned driver.

**Response** `200`, `Answers saved successfully!`, `data: null`.

---

### 4.8 GET `/trip/checkList/:id` — `getCheckListAnswers` (`trip.controller.ts:1043-1062`)

Trip with status in `[PENDING, START, FINISHED, CANCELED]` → 400 `Invalid trip!`. If `checkListAnswers == null` → 400 `Checklist not completed yet!`. Returns `data = checkListAnswers` object.

---

### 4.9 PUT `/trip/updateHotelActivityPayment/:id` — `updateHotelActivityPayment` (`trip.controller.ts:1314-1388`)

**Body** (intended shape `tripHotelActivityPaymentSchema`, `trip.validation.ts:363-389`, but **the controller never validates it**):
| Field | Intended rule |
|---|---|
| `objectId` | string, required — hotel/activity sub-doc `_id` |
| `paymentAmount` | number, required |
| `paymentDate` | date, required |
| `paymentRemark` | string / null / `''` |
| `paymentMode` | number, required |
| `receiptImageUrl` | string / null / `''` |
| `type` | number, required — `1` = Hotel, `2` = Activity |

**Logic**
1. Trip with status in `[PENDING, START, FINISHED]` → 400 `Trip not found!`.
2. `isMonthEndDone` → 400 `Cannot update trip after month end!`.
3. `type === 1` (strict): find hotel by `_id.toString() === objectId` → 400 `Hotel not found!`; if `isPaymentByCompany === false` → 400 `Selected hotel is not paid by company!`. Set `isPaymentDone = true`, `paymentDate`, `paymentAmount`, `paymentRemark`, `paymentMode`, `receiptImageUrl`, `updatedBy = auth.id`; save. Message `Hotel payment updated successfully!`.
4. `type === 2`: same for activity (`Activity not found!`, `Selected activity is not paid by company!`, `Activity payment updated successfully!`).
5. Else → 400 `Invalid request type!`.

No check whether payment was already done (re-posting overwrites). Payments are not written to the `Expenses` collection.

**Response** `200`, `data: null`.

---

### 4.10 PUT `/trip/:id/status/:status` — `changeTripStatus` (`trip.controller.ts:758-1007`)

**Params**: `id` trip id; `status` parsed with `parseInt`.

**Logic** (all inside a Mongo transaction):
1. `helperUtil.isValueInEnum(WellKnownTripStatus, status)` → else 400 `Invalid status!`.
2. **Role DRIVER**
   - `status = START (3)`:
     - Trip must be `PENDING` → 400 `Trip not found or not in pending status!`.
     - `isMonthEndDone` → 400 `Trip is already month end done!`.
     - `status = START`, `startedBy = auth.id`.
     - Create `Expenses({ tripId, createdBy, updatedBy: auth.id, expenses: [], driverSalaries: [] })` and save with session (clears `expenses-` cache).
     - Not checked: whether this driver is assigned to the trip, whether a vehicle is assigned, whether the checklist was completed.
   - `status = PENDING (1)` (undo start):
     - Trip must be `START` → 400 `Trip not found or not in start status!`; month-end → 400 `Trip is already month end done!`.
     - Load `expensesService.findByTripIdAndStatusIn(tripId, [ACTIVE])` and `expenseRequestService.findByTripIdAndStatusIn(tripId, [PENDING, APPROVED])` (leave-status enum; cached 1 week, cache cleared on expenseRequest save).
     - Guards (in order):
       - any hotel or activity `isPaymentDone` → 400 `Can't change status to pending after hotel or activity payment done!`
       - `expenses != null && (active expense lines > 0) && driverSalaries.length > 0` → 400 `Can't change status to pending after expense added or driver salary added!`
       - expense requests found → 400 `Can't change status to pending after expense request added!`
       - any place `isReached` → 400 `Can't change status to pending after reached at least one place!`
     - `status = PENDING`, `startedBy = null`, `updatedBy = auth.id`, `checkListAnswers = null`, `checkListCheckBy = null`.
     - `expensesService.findAndHardDeleteByTripId(tripId, session)` — hard-deletes the trip's `Expenses` doc.
   - Any other status → 400 `You'r not allowed to change status to <NAME>!`.
3. **Role ADMIN / TRIPMANAGER / SUPERADMIN**
   - `status = FINISHED (4)`:
     - Trip must be `START` → 400 `Trip not found or not in start status!`; month-end → 400 `Trip is already month end done!`.
     - `posService.findByTripIdAndStatusIn(tripId, [ACTIVE])`; if a POS exists and `!isTripEndAuditDone` → 400 `Unable to finish trip because the trip end POS audit is not completed!`.
     - `status = FINISHED`, `endedBy = auth.id`.
   - `status = PENDING (1)`: identical guards/messages to the driver undo, then `status = PENDING`, `updatedBy`, `startedBy = null`, and hard-delete of expenses. **Checklist is not cleared** in this branch.
   - Any other status → 400 `You'r not allowed to change status to <NAME>!`.
4. `tripService.save(trip, session)`, commit; on error abort + rethrow; end session.

**Response** `200`, `data: null`, message `Trip started successfully!` / `Trip finished successfully!` / `Trip pending successfully!`.

---

### 4.11 GET `/trip/places/:id` — `getPlacesByTripId` (`trip.controller.ts:1064-1084`)

`tripService.findTripPlacesByTripIdAndStatusIn(id, [PENDING, START, FINISHED])` — populates `places.reachedBy` (`_id fullName userName`) → 400 `Invalid trip!`. Returns `TripPlaceResponseDto[]` (§6) in stored order.

---

### 4.12 PUT `/trip/:tripId/markAsReached/:placeId` — `markPlaceAsReached` (`trip.controller.ts:1086-1204`)

**Body** (`markPlaceSchema`): `location` object `{ lat: number, lng: number }` (optional); `currentMilage` number, **required**. Unknown keys rejected.

**Logic** (transaction):
1. Validate → 400.
2. Trip must be `START` → 400 `Started trip not found!`.
3. Active driver entry → 400 `No active driver found!`; must equal `auth.id` → 400 `Only active driver can update place as reached!`.
4. Find place where `place._id == placeId` → 400 `Place not found!`; already reached → 400 `Place already reached!`.
5. Active vehicle entry (assumed to exist) → `vehicleService.findByIdAndStatusIn(id, [ACTIVE])` → 400 `Selected vehicle not found!`.
6. **Freelance vehicle** (`isFreelanceVehicle`): `isReached=true`, `reachedDate=now`, `reachedBy=auth.id`, `location`, `startMilage = vehicle.currentMileage`, `endMilage = body.currentMilage`, `calcDistance = 0`. Vehicle not modified, no mileage check.
7. **Company vehicle**: if `vehicle.currentMileage >= body.currentMilage` → 400 `Current mileage should be greater than previous mileage!`. Else
   ```
   calcDistance = body.currentMilage - vehicle.currentMileage
   place.{isReached, reachedDate, reachedBy, location, startMilage = vehicle.currentMileage, endMilage = body.currentMilage, calcDistance}
   vehicle.currentMileage += calcDistance        // == body.currentMilage
   ```
   `vehicleService.save(vehicle, session)` (clears `vehicle-` and `trip-` cache prefixes).
8. Save trip, commit.

Places can be reached in any order; reaching the last place does not finish the trip.

**Response** `200`, `Place marked as reached successfully!`, `data: null`.

**Errors**: 400s above; 500 if the trip has no active vehicle entry.

---

### 4.13 GET `/trip/tripForPrint/:id` — `getTripForReport` (`trip.controller.ts:1206-1240`)

1. Load trip with status in `[PENDING, START, FINISHED]` (not populated). **No not-found error** — returns `data: null` with 200.
2. If found **and** `auth.role ∈ {ADMIN, SUPERADMIN, TRIPMANAGER, FINANCEOFFICER}`: convert to plain object and attach `trip.expenses`:
   - `expense = expensesService.findByTripIdAndStatusIn(tripId, [ACTIVE])` (populates `tripId`).
   - If found, `expensesUtil.expenseWithTotalsToResponseDto(expense)` (`expenses.util.ts:32`, shared helper; same formula as before):
     ```
     activeExpenses              = expense.expenses.filter(e => e.status === ACTIVE)
     totalTripExpensesAmount     = sumActiveExpenses(activeExpenses)   // Σ amount
     tripExpensesAmount          = expense.tripId.estimatedExpense
     remainingTripExpensesAmount = tripExpensesAmount - totalTripExpensesAmount
     ```
     then `ExpensesModelToTripExpensesResponseDto` → `{ _id, tripId, expenses, driverSalaries, isMonthEndDone, tripExpensesAmount, totalTripExpensesAmount, remainingTripExpensesAmount }`.
   - Else `trip.expenses = null`.
3. Other roles get the raw trip without an `expenses` key.

---

### 4.14 GET `/trip/tripForQrCode/:id` — `getTripForQrCode` (`trip.controller.ts:1242-1269`)

**Public — no authentication** (`authorize([], true)` returns `next()` immediately; `req.auth` undefined). Same as 4.13 but expenses are attached for every caller (no role check). Not found → `data: null`, 200.

---

### 4.15 GET `/trip/hotelsAndActivities/:id` — `getTripHotelsAndActivities` (`trip.controller.ts:1287-1312`)

Trip with status in `[PENDING, START, FINISHED]`. Response `data = { hotels: [...isPaymentByCompany === true], activities: [...isPaymentByCompany === true] }` (raw sub-docs incl. payment fields). If trip not found → `{ hotels: [], activities: [] }` with 200.

---

### 4.16 GET `/trip/destinationSummary/:id` — `getDestinationSummaryPrint` (`trip.controller.ts:1271-1285`)

`findTripPlacesByTripIdAndStatusIn(id, [PENDING, START, FINISHED])` → 400 `Invalid trip!`. Returns raw `trip.places` (with `reachedBy` populated `_id fullName userName`) or `[]`.

---

## 5. Business Rules & State Transitions

### 5.1 Status enum — `WellKnownTripStatus` (`src/util/enums/well-known-trip-status.enum.ts`)

| Value | Name | Used? |
|---|---|---|
| 1 | `PENDING` | Initial state (schema default via `WellKnownLeaveStatus.PENDING` = 1). |
| 2 | `CANCELED` | Set by `cancelTrip`. Terminal. |
| 3 | `START` | Trip in progress. |
| 4 | `FINISHED` | Trip completed. |
| 5 | `REACHED` | Never assigned. `status=5` is reused as a list *filter* meaning "finished + all driver salaries paid". |

### 5.2 Transitions

| From | To | Who | Endpoint | Preconditions | Side effects |
|---|---|---|---|---|---|
| — | PENDING | TM, SA, ADMIN, TA | POST `/trip` | unique `tripConfirmedNumber` | — |
| PENDING | CANCELED | TM, SA, ADMIN, TA | DELETE `/trip/:id` | status PENDING | POS stock returned to inventory, POS + lines → DELETED |
| PENDING | START | DRIVER (any) | PUT `/:id/status/3` | not month-end | `startedBy`; new `Expenses` doc |
| START | PENDING | DRIVER, or TM/SA/ADMIN | PUT `/:id/status/1` | not month-end; no hotel/activity paid; not (active expenses **and** driver salary); no pending/approved expense request; no reached place | `startedBy=null`; Expenses hard-deleted; checklist cleared (driver path only) |
| START | FINISHED | TM, SA, ADMIN | PUT `/:id/status/4` | not month-end; POS (if any) trip-end audit done | `endedBy` |

Driver/assistant assignment allowed in PENDING and START. Checklist only in PENDING. Places reachable only in START. Hotel/activity payments in PENDING/START/FINISHED (not month-end). Trip edits in PENDING/START/FINISHED.

### 5.3 Driver / vehicle assignment rules
- PENDING: assignment **replaces** the whole `drivers`/`vehicles` array with one active entry.
- START: previous entries are kept with `isActive=false` and a new active entry is appended (history of driver/vehicle swaps mid-trip).

### 5.4 Calculations
- **Distance per place** (company vehicles): `calcDistance = currentMilage − vehicle.currentMileage`; vehicle odometer becomes `currentMilage`. Must be strictly increasing.
- **Trip expense summary** (print/QR): `remainingTripExpensesAmount = trip.estimatedExpense − Σ(active expense amounts)`.
- **isDriverSalaryDone**: all `trip.drivers[*].driver` ∈ `expenses.driverSalaries[*].driver`.
- **paidByCompanyCount** (list DTO): count of hotels + activities with `isPaymentByCompany`.
- **canUndo** (list DTO): `status === START && no place isReached`.
- **Place index**: `1..n` after sorting by client-supplied `index`.
- **Date-range filter** (list): trip included if `startDate` **or** `endDate` falls within `[startDate 00:00:00.000, endDate 23:59:59.999]` (server local time).

---

## 6. Utilities & DTOs

### 6.1 `trip.service.ts`

| Function | Behavior |
|---|---|
| `save(trip, session)` (`:5`) | `trip.save({ session })` or `trip.save()`. Does **not** clear any cache. |
| `findByIdAndStatusIn(id, status[])` (`:13`) | `Trip.findOne({ _id, status: {$in} })`, no populate, full Mongoose document (callers mutate + save it). |
| `findAllByStatusIn(status[], startDate, endDate)` (`:17`) | Date-range (start OR end inside range) list. Projected populates: `createdBy/updatedBy/startedBy/endedBy` → `_id fullName`; `drivers.driver` → `_id fullName userName`; `vehicles.vehicle` → `_id registrationNumber licenseRenewalDate insuranceRenewalDate`. Sorted `startDate` asc, **`.lean()`**. Used only by the trip list. |
| `findAllByDriverIdAndStatusIn(driverId, status[])` (`:54`) | Trips containing the driver in `drivers`, `isMonthEndDone: false`; same projected populates, sorted, **`.lean()`**. |
| `findTripPlacesByTripIdAndStatusIn(tripId, status[])` (`:83`) | `findOne` + populate `places.reachedBy` (`_id fullName userName`). |
| `monthEndFilter(endMonth, currYear, status[])` (`:95`, internal) | Builds `{ endDate: {$lt: first day of (currYear, endMonth)}, status: {$in}, isMonthEndDone: false }`; shared by the two month-end finders. |
| `findAllIdsByEndMonthAndStatusIn(endMonth, currYear, status[])` (`:109`) | `monthEndFilter` + `.select('_id status').sort({startDate: 1}).lean()`. Used by `monthAudit` to flag trips. |
| `markMonthEndDone(ids, userId, batchId, session)` (`:121`) | No-op for `[]`; else `Trip.updateMany({ _id: {$in: ids} }, { $set: { isMonthEndDone: true, batchId, updatedBy: userId } }, { session })` — one write instead of a per-document save (bypasses document middleware/validation; Mongoose timestamps still set `updatedAt`). |
| `findAllByEndMonthAndStatusIn(endMonth, currYear, status[])` (`:126`) | `monthEndFilter` + full (unprojected) populates, sorted, Mongoose documents. Used by the `monthAudit` pending-trip listing. |
| `isTripConfirmedNumberExists(number, tripId)` (`:145`) | `findOne({ tripConfirmedNumber, status: {$ne: CANCELED}, _id: {$ne: tripId} if valid })`. Backed by the `{tripConfirmedNumber, status}` index. |
| `findAllByStatusInAndOnlyFromEndDate(status[], startDate, endDate)` (`:162`) | Like `findAllByStatusIn` (same projections, `.lean()`) but filters only on `endDate` in range. Used by `dashboard`. |

`generateTripId` has been removed.

Populate `match` options such as `{ 'drivers.isActive': true }` and `{ 'places.isReached': true }` target fields that don't exist on `User`; with `mongoose.set('strictQuery', true)` (`src/config/database.config.ts:7`) those keys are stripped, so the populate is effectively unfiltered.

### 6.2 `trip.util.ts` mappers

| Function | Output |
|---|---|
| `tripModelToTripResponseDto(trip)` (`:79`) | `TripResponseDto`: dates, counts, costs, mapped `passengers`, info objects (missing → `null`), `activities` (id, date, description, adultCount, childCount, totalCost — payment fields omitted), `email`, `phoneNumber`, `drivers` (DriverDto), `status`, `statusName` (`WellKnownTripStatus[status]`), creator/updater/starter/ender ids and `fullName`s, timestamps. Exported but **not used anywhere**. |
| `tripModelArrToTripResponseDtos(trips)` (`:120`) | Array version. **Unused.** |
| `tripModelToTripResponseDtoGetAll(trip)` (`:126`) | `TripResponseDtoGetAll` — list DTO (below). Accepts Mongoose documents or lean objects: `passengers`, `places`, `vehicles`, `drivers` are now read with optional chaining / `|| []` so raw docs missing those arrays don't throw. Also used by `tripSummary` and `monthAudit`. |
| `tripModelArrToTripResponseDtoGetAlls(trips)` (`:189`) | Array version. |
| `TripModelArrToTripPlaceResponseDtos(places)` (`:212`) | `TripPlaceResponseDto[]`. |

Internal sub-mappers: `mapPassengerToPassengerDto` (`id` = Mongoose virtual id), `mapArrivalInfo…`, `mapDepartureInfo…`, `mapPickUpInfo…`, `mapDropOffInfo…` (each field `|| null`), `mapActivityToActivityDto`, `mapVehicleToVehicleDto` (`vehicle._id`, `registrationNumber`, `vehicleAssignedBy._id`, `licenseRenewalDate`, `insuranceRenewalDate`, `isActive`), `mapDriverToDriverDto` (`driver._id`, `driverName = fullName`, `driverAssignedBy._id`, `driverAssignedByName`, `isActive`).

**`TripResponseDtoGetAll` fields** (`dto/tripResponseDtos.ts:91`):

| Field | Source |
|---|---|
| `id` | `_id` |
| `startDate`, `endDate`, `dateCount`, `totalCost`, `totalCostLocalCurrency` | direct |
| `requestedVehicle`, `paymentMode`, `contactPerson` | direct or `''` |
| `isActiveDriver` | in-memory flag (driver listing only), else `false` |
| `isCheckListDone` | `checkListAnswers != null` |
| `isPaymentCollected`, `isMonthEndDone` | direct or `false` |
| `isDriverSalaryDone` | in-memory flag (non-driver listing), else `false` |
| `email`, `phoneNumber` | direct (`phoneNumber || null`) |
| `status`, `statusName` | status number / enum name |
| `passengersCount` | `passengers?.length || 0` |
| `tripConfirmedNumber` | direct |
| `createdBy`/`updatedBy`/`startedBy`/`endedBy` | populated `_id` (`''` or `null`) |
| `createdUser`/`updatedUser`/`startedUser`/`endedUser` | populated `fullName` |
| `canUndo` | `status === START && !places.some(isReached)` |
| `paidByCompanyCount` | count of company-paid hotels + activities |
| `activeVehicleId`, `activeRegistrationNumber` | first `vehicles[].isActive` entry |
| `activeDriverId`, `activeDriverName` | first active driver; name = `` `${fullName} (${userName})` `` |
| `drivers` | `DriverDto[]` (all, incl. inactive). `driverAssignedBy` is never populated by the list queries, so `driverAssignedByName` is always `''`. |
| `vehicles` | `VehicleDto[]` (all, incl. inactive) |
| `createdAt`, `updatedAt` | timestamps |

**`TripPlaceResponseDto`**: `description, dates, isReached (||false), index (||0), updatedBy (raw id ||''), _id, location, reachedBy (_id ||''), reachedDate (||null), reachedByUser (fullName ||'')`. Mileage fields (`startMilage`, `endMilage`, `calcDistance`) are **not** included.

### 6.3 Shared helpers used
- `helperUtil.getNameFromEnum(enum, value)` → `enum[value]` (reverse mapping of numeric TS enums).
- `helperUtil.isValueInEnum(enum, value)` → `Object.values(enum).includes(value)`.
- `helperUtil.getSiUnitCode(unitId)` (new in `src/util/helper.util.ts`) — unit code for the cancellation inventory log message (SI code of the category when `isSaveWithSiUnit`, else the unit's own code; throws on an unknown unit id).
- `inventoryUtil.buildInventoryLog({ type, quantity, before, after, productId, userId, message })` (new file `src/util/inventory.util.ts`) — builds one `inventoryLogs` entry with `inventoryLogDate = new Date()`.
- `productService.createBatchLoader(ids, status)` — preloads products in one query; returns a per-id loader (each preloaded doc handed out once, repeat ids re-read via `findByIdAndStatusIn`).
- `expensesService.applyDriverSalaryDone(trips)` — single-query computation of `isDriverSalaryDone` (also used by `monthAudit`).
- `expensesUtil.expenseWithTotalsToResponseDto(expense)` — active-expense filter + totals + DTO (shared with other modules).
- `CommonResponse` — response envelope.

---

## 7. Dependencies

### 7.1 This module reads / writes

| Module / collection | Usage |
|---|---|
| `User` (`user.service.findById`) | Validate driver on assignment (active user). Populated for creator/updater/driver/reachedBy. |
| `Vehicle` (`vehicle.service.findByIdAndStatusIn`, `save`) | Validate vehicle on assignment; **writes** `currentMileage` when a place is reached. |
| `Expenses` (`expenses.model`, `expenses.service`) | **Creates** on trip start; **hard-deletes** on revert to pending; reads for list salary status (`applyDriverSalaryDone`, one batched query) and print/QR summaries (`expenses.util.expenseWithTotalsToResponseDto`). |
| `ExpenseRequest` (`expenseRequest.service.findByTripIdAndStatusIn`) | Blocks revert to pending. |
| `Pos` (`pos.service`) | Blocks finish until trip-end audit; **writes** status DELETED on cancel. |
| `InventoryProduct` (`product.service.createBatchLoader`, `save`) | **Writes** inventory + `inventoryLogs` on cancel (log entries via `src/util/inventory.util.ts`). |
| `auth.service` / JWT | via `auth.middleware`. |

### 7.2 Modules that depend on Trip

| Module | What it uses |
|---|---|
| `expenses` controller | `tripService.findByIdAndStatusIn` |
| `expenseRequest` controller | `findByIdAndStatusIn`, `save` (increments `estimatedExpense` on approval) |
| `pos` controller | `findByIdAndStatusIn` (POS allowed for PENDING/START trips) |
| `monthAudit` controller | `findAllIdsByEndMonthAndStatusIn` + `markMonthEndDone` (bulk-sets `isMonthEndDone`, `batchId`, `updatedBy`); `findAllByEndMonthAndStatusIn` + `tripModelArrToTripResponseDtoGetAlls` (pending month-end listing) |
| `tripSummary` controller/service | `findByIdAndStatusIn`, `tripModelToTripResponseDtoGetAll`, `Trip.findOne` |
| `dashboard` controller | `findAllByStatusInAndOnlyFromEndDate` (lean) |
| `report`, `notification`, `user`, `vehicle`, `internalTrip` services | Query `Trip` model directly |
| `Expenses`, `ExpenseRequest`, `Pos`, `TripSummary` models | `ref: 'Trip'` |

---

## 8. Notes / Gotchas

**Possible bugs**

1. **Reached places can be wiped** — `updateTrip` only runs the "can't delete reached place" check when `body.places.length > 0` (`trip.controller.ts:352`). Sending `places: []` (allowed by Joi) sets `trip.places = []`, deleting reached places and their mileage history.
2. **Place re-ordering not persisted for unchanged places** — unchanged saved places are pushed as-is (`:401-403`); their stored `index` keeps the old value even if the order changed. Also `JSON.stringify(savedDates) !== JSON.stringify(bodyDates)` compares ISO strings against whatever the client sent; any format difference marks a reached place as "changed" → `Can not update reached place!`.
3. **Driver/vehicle re-activation never matches** — `driver.driver === body.driverId` and `vehicle.vehicle === body.vehicleId` compare an ObjectId to a string with `===` (`:730`, `:778`), so switching back to a previous driver/vehicle on a started trip always pushes a duplicate entry instead of reactivating it.
4. **Missing active entry → 500** — in START, `activeDriver.driver` / `activeVehicle.vehicle` (`:728`, `:776`) and `activeVehicle.vehicle` in `markPlaceAsReached` (`:1202`) throw `TypeError` if no active entry exists (e.g. started without assigning a vehicle).
5. **Driver role not verified** — assignment accepts any active user id as a driver (`userService.findById`). Any DRIVER can start *any* pending trip and save its checklist; there's no check that they are the assigned driver, that a vehicle is assigned, or that the checklist is done.
6. **Expense guard uses AND** — revert-to-pending is blocked only if there are active expense lines **and** driver salaries (`:881`, `:990`), though the message says "or". A trip with expenses but no salary can be reverted, and `findAndHardDeleteByTripId` then **permanently deletes those expenses**.
7. **Inconsistent revert** — driver revert clears `checkListAnswers`/`checkListCheckBy`; admin revert does not.
8. **`updateHotelActivityPayment` has no validation** — `tripHotelActivityPaymentSchema` exists but is never called; any body passes. `type` uses strict `=== 1/2`, so a string `"1"` gives `Invalid request type!`. Already-paid items can be overwritten.
9. **Cancel drops voided POS lines** — `findByTripIdAndStatusInWIthProducts` replaces `pos.products` with only ACTIVE lines in memory; saving that document in `cancelTrip` permanently removes the previously voided lines from the POS record. If the POS has no active lines it's left ACTIVE. Cancellation logs use `POS_TRANSACTION` rather than `POS_TRANSACTION_RETURN`. Inactive products are skipped (stock not restored) but the POS is still marked DELETED. A product with an unknown `measureUnit` causes a 500.
10. **Public QR endpoint exposes data** — `GET /trip/tripForQrCode/:id` needs no auth and returns the full trip (passenger names/ages/nationalities, email, phone, costs) plus expenses and driver salaries.
11. **Date-range overlap** — `findAllByStatusIn` misses trips that start before and end after the selected range. Missing `startDate`/`endDate` gives a CastError → 404 `No item found with ID "Invalid Date"!`.
12. **`findAllByEndMonthAndStatusIn` month overflow** — it calls `setMonth(endMonth)` on *today's* date before rebuilding the 1st of the month (`trip.service.ts:126-129`). On the 29th–31st, `setMonth` can roll over into the next month, so the cutoff can be one month too late.
13. **`generateTripId` (unused)** — `tripConfirmedNumber` is a String, so `-tripConfirmedNumber` sorts lexicographically and `+ 1` concatenates (`"12" + 1 = "121"`).
14. **Not-found inconsistency** — `getTripForReport`, `getTripForQrCode` and `getTripHotelsAndActivities` return 200 with `null`/empty data when the trip doesn't exist; others return 400 (not 404).
15. **Month-end not enforced everywhere** — `updateTrip`, `assignDriverAndVehicle`, `saveCheckListAnswers` and `markPlaceAsReached` don't check `isMonthEndDone`.
16. **`mapVehicleToVehicleDto`** reads `vehicle.vehicle.licenseRenewalDate` without optional chaining (`trip.util.ts:67-68`); a vehicle ref that fails to populate (deleted document) throws.

**Inconsistencies / quirks**

17. `status` default is `WellKnownLeaveStatus.PENDING` (works only because both equal 1). `expenseRequest` statuses also use the leave enum.
18. `tripConfirmedNumber` String default `0`; `paymentMode` in hotels/activities is String with default `0`, while the payment Joi schema expects a number.
19. Joi vs Mongoose mismatch: `phoneNumber` and `contactPerson` required in Joi but optional in the schema; `specialRequirement` has a `'string.max'` message but no `.max()` rule (only Mongoose's 500 limit applies). Joi's validated `value` is discarded, so Joi defaults (e.g. `isPaymentCollected: false`) are not applied (Mongoose defaults cover it).
20. `saveTrip` rejects unknown body keys; `updateTrip` allows them (`allowUnknown: true`).
21. Uniqueness of `tripConfirmedNumber` is enforced only in code (race-prone, no unique index). Numbers of cancelled trips can be reused.
22. Status value `5` (`REACHED`) is never stored; `GET /trip?status=5` reuses it to mean "finished with driver salary done". For drivers, `status=4/5` return all finished trips not yet month-closed (no salary filter).
23. `isDriverSalaryDone` and `isActiveDriver` are set as ad-hoc properties on Mongoose documents and read by the DTO.
24. `tripService.save` doesn't clear the `trip-` cache prefix (only `vehicleService.save` does); the trip module itself doesn't use the cache.
25. Populate `match` filters (`'drivers.isActive'`, `'vehicles.isActive'`, `'places.isReached'`) target the wrong collection and are silently dropped by `strictQuery: true`.
26. Hotel sorting uses lexicographic sort of date strings and `new Date(string)` parsing; activities without `date` sort as `NaN`.
27. Dead code / unused imports: `start` from `repl` (`trip.service.ts:1`), `truncate` from `fs/promises` (`trip.util.ts:16`), `number` from `joi` and `commonUtil` (`trip.controller.ts:12,21`), `tripModelToTripResponseDto(s)`, `generateTripId`, `applicationRoutes.trip.undoTripStatus`. The `try { … } catch (e) { throw e; }` blocks in several handlers do nothing.
28. Typos in user-facing messages: `You'r not allowed…`; fields `startMilage`/`endMilage`/`currentMilage` (vs `currentMileage` on Vehicle).
29. Transactions (`cancelTrip`, `changeTripStatus`, `markPlaceAsReached`) need MongoDB running as a replica set. Reads in those flows (POS, expense requests) are not done inside the session.
