# POS Module (Trip Point-of-Sale / Stock Issue)

Source: `src/modules/pos/`

All endpoints are mounted under the global prefix `/api/v1` (`src/constant.ts:3`, `src/app.ts:43`). Paths below omit the prefix.

---

## 1. Overview

The POS module records **inventory items issued to a trip**: water, snacks, blankets, coolers and so on, which are loaded into the vehicle for a tour. Each trip has at most one active POS document. Its `products[]` array is a list of issue transactions (lines). Each line:

- deducts stock from the `InventoryProduct` it refers to (see `Documents/inventory.md`),
- is priced at the product's `unitPrice`, which feeds the POS `totalAmount`.

Lines can be **voided** while the trip is running, which puts the stock back. At the end of the trip a **trip-end POS audit** records how much of each line came back. Returned quantities go back into stock. Returnable products (e.g. coolers) and consumables are handled slightly differently. A trip cannot be marked FINISHED until this audit is done (enforced in the trip module). If a pending trip is cancelled, the trip module voids the whole POS and returns all stock. Month-end closing marks POS documents as month-end done.

---

## 2. Files

| File | Role |
|---|---|
| `pos.model.ts` | Mongoose schema/model `Pos` (embedded `products[]` and `endAuditProducts[]`). |
| `pos.route.ts` | Express router for `/pos`. |
| `pos.controller.ts` | Handlers: save line, void line, trip-end audit, get by trip. Unit conversion and log entries come from shared utils (§6.1). |
| `pos.service.ts` | DB access (`save`, `findByTripIdAndStatusIn`, `findByTripIdAndStatusInWIthProducts`) plus month-end bulk helpers (`findAllIdsByTripIdsAndStatusIn`, `markMonthEndDone`). |
| `pos.validation.ts` | Joi schemas `savePosProductSchema`, `tripEndAuditShema`. |
| `pos.utils.ts` | `modelToPosGetByIdReponseDto` mapper (computes returned/consumed quantities). |
| `dto/posGetByIdReponseDto.ts` | `PosGetByIdReponseDto`, `PosProductDto` interfaces. |

Shared code used: `src/util/data/measureUnitData.ts`, `src/util/helper.util.ts` (`fromMeasureUnitToSiMeasureUnit`, `fromMeasureUnitToOtherMeasureUnit`, `fromSiMeasureUnitToOtherMeasureUnit`, `getSiUnitCode`), `src/util/inventory.util.ts` (`buildInventoryLog`), `src/util/commonResponse.ts`, enums `WellKnownStatus`, `WellKnownTripStatus`, `WellKnownGrnLogType`, errors `BadRequestError`, `InternalServerError`, `src/modules/trip/trip.service.ts`, `src/modules/inventory/product/product.service.ts`.

---

## 3. Data Model — `Pos` (`pos.model.ts`)

Model name `Pos`. Options: `timestamps: true`, `versionKey: false`. One non-unique compound index `{tripId: 1, status: 1}` (`pos.model.ts:176`), which serves every lookup by trip. There is no unique index on `tripId`; "one POS per trip" is enforced only by the controller looking up the existing ACTIVE document. No hooks/virtuals.

### 3.1 Root fields

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `tripId` | ObjectId → `Trip` | required ("Trip is required") | |
| `products` | [PosProduct] | — | Issue transactions (3.2). |
| `totalAmount` | Number | default `0` | Sum of ACTIVE line values (formula in 5.2). |
| `isTripEndAuditDone` | Boolean | default `false` | Set `true` by trip-end audit. |
| `endAuditProducts` | [EndAuditProduct] | — | Audit results (3.3). Replaced in full on each audit. |
| `totalAfterAudit` | Number | default `0` | **Never written by any code.** |
| `isMonthEndDone` | Boolean | default `false` | Set by month-end audit (`src/modules/monthAudit/monthAudit.controller.ts:279-286`, via `posService.markMonthEndDone`). |
| `batchId` | Number | default `0` | Month-end batch id, set by month-end audit. |
| `status` | Number | default `WellKnownStatus.ACTIVE` | `1=ACTIVE, 3=DELETED` used (DELETED set on trip cancellation). |
| `createdBy` / `updatedBy` | ObjectId → `User` | | |
| `createdAt` / `updatedAt` | Date | auto | |

### 3.2 `products[]` (issue line; each has `_id`, which is the "transaction id")

| Field | Type | Default | Notes |
|---|---|---|---|
| `product` | ObjectId → `InventoryProduct` | required ("Product is required") | |
| `isReturnableProduct` | Boolean | `false` | Snapshot of product flag at issue time. |
| `unitPrice` | Number | `0` | Snapshot of product `unitPrice` (per product unit). |
| `productUnitOfMeasure` | Number | `0` | Snapshot of product `measureUnit`. |
| `enteredUnitOfMeasure` | Number | `0` | Unit the user entered. |
| `enteredQuantity` | Number | `0` | Quantity as entered. |
| `quantityWithSiUnitOfMeasure` | Number | `0` | Quantity in base unit (g / ml / count). This is the amount deducted from stock. |
| `status` | Number | `ACTIVE` | `DELETED` when voided or trip cancelled. |
| `createdBy` / `updatedBy` | ObjectId → `User` | | |
| `createdAt` / `updatedAt` | Date | `Date.now` | Manual fields (sub-docs have no timestamps option). |

### 3.3 `endAuditProducts[]` (each has `_id`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `product` | ObjectId, ref **`'Product'`** | required | Ref name does not match any registered model (should be `InventoryProduct`). It is never populated. |
| `transactionId` | ObjectId | | `_id` of the `products[]` line audited. |
| `isReturnableProduct` | Boolean | `false` | |
| `isReturned` | Boolean | `false` | Client-supplied flag. |
| `notReturnedReson` | String | `''` | (sic) |
| `returnedquantity` | Number | `0` | As entered (sic lowercase q). |
| `returnedUnitOfMeasure` | Number | `0` | |
| `returnedQuantityWithSiUnitOfMeasure` | Number | `0` | Base-unit returned quantity. |
| `createdBy` | ObjectId → `User` | | |
| `createdAt` | Date | `Date.now` | |

---

## 4. API Endpoints

Base path `/pos` (`src/applicationRoutes.ts:186-192`, mounted `src/mapping.ts:45`). All routes allow **SUPERADMIN, ADMIN, TRIPMANAGER, FINANCEOFFICER** (`pos.route.ts:10-32`). Authorization works as in `Documents/inventory.md` §3.1 (Bearer JWT, non-blocked user, role id in list, else 401/403).

| Method | Full path | Controller | Roles | Description |
|---|---|---|---|---|
| POST | `/pos/savePosProduct/:tripId` | `saveProductForPos` | SA, A, TM, FO | Issue a product to a trip (adds a line, deducts stock). |
| DELETE | `/pos/voidPosProduct/:id/trip/:tripId` | `voidProductInPos` | SA, A, TM, FO | Void a line (restores stock). |
| PUT | `/pos/tripEndAudit` | `tripEndPosAudit` | SA, A, TM, FO | Record returns at trip end (restores returned stock). |
| GET | `/pos/getPosByTrip/:tripId` | `getPosByTrip` | SA, A, TM, FO | Get the trip's POS with computed return/consumption figures. |

Responses use the envelope `{isSuccessful, timeStamp, message, data}`. Errors: custom error status; Mongoose `ValidationError` → 400; `CastError` → 404 `No item found with ID "<v>"!`; otherwise 500.

### 4.1 POST `/pos/savePosProduct/:tripId` — `saveProductForPos` (`pos.controller.ts:23`)

**Params:** `tripId` (Trip ObjectId).

**Body** (Joi `savePosProductSchema`, `pos.validation.ts:3`):

| Field | Rule | Messages |
|---|---|---|
| `productId` | string, required | "productId is required" / "productId is invalid" |
| `quantity` | number, required (no min) | "quantity is required" / "quantity is invalid" |
| `unitOfMeasure` | number, required | "unitOfMeasure is required" / "unitOfMeasure is invalid" |

**Logic:**
1. Joi validate → `400 <message>`.
2. `tripService.findByIdAndStatusIn(tripId, [PENDING, START])` (`trip.service.ts:14`, plain `Trip.findOne`). Not found → `400 "Pending or Started Trip not found!"`.
3. `posTransactionQtyWithSiUnit = helperUtil.fromMeasureUnitToSiMeasureUnit(unitOfMeasure, quantity)` (§6.1).
4. Load product with status `ACTIVE`. Not found → `400 "Product is not found!"`. If `product.inventory < posTransactionQtyWithSiUnit` → `400 "You can not save pos transaction, because product inventory is not enough!"`.
5. `posService.findByTripIdAndStatusIn(tripId, [ACTIVE])`: existing POS, with `tripId` populated (`_id tripConfirmedNumber status`).
6. Start transaction.
   - **No existing POS:** create `new Pos({tripId, products: [], totalAmount: 0, isTripEndAuditDone: false, endAuditProducts: [], totalConsumedAmount: 0, createdBy, updatedBy})` (`totalConsumedAmount` is not in the schema and is dropped). Push the new line (fields below). `totalAmount += helperUtil.fromMeasureUnitToOtherMeasureUnit(unitOfMeasure, product.measureUnit, quantity) * product.unitPrice`. Save.
   - **Existing POS:** push the new line, then recompute `totalAmount` from scratch over all lines with `status == ACTIVE` (formula §5.2). Save.
   - New line = `{product: productId, isReturnableProduct, unitPrice, productUnitOfMeasure: product.measureUnit, enteredUnitOfMeasure: unitOfMeasure, enteredQuantity: quantity, quantityWithSiUnitOfMeasure: posTransactionQtyWithSiUnit, status: ACTIVE, createdBy, updatedBy}`.
   - `fromMeasureUnitToOtherMeasureUnit` throws `400 "Invalid Measure Unit Conversion!"` if the entered unit's category differs from the product's unit category. This aborts the transaction.
7. **Stock deduction:** `before = product.inventory`; `product.inventory -= posTransactionQtyWithSiUnit`; push the log entry built by `inventoryUtil.buildInventoryLog({type: POS_TRANSACTION (2), quantity: posQtySi, before, after, productId: product._id, userId: auth.id, message: 'Inventory updated: <qty><code> removed from product "<name>" via POS transaction to trip "<tripConfirmedNumber>".'})` (`inventoryLogDate` = now). `<code>` = `helperUtil.getSiUnitCode(product.measureUnit)` (`g`/`ml` for SI-stored categories, else the product unit's own code). Save the product, which clears the `product-` cache.
8. Commit. Any error → abort + rethrow.

**Response:** `201 "Pos transaction saved successfully!"`, `data` = raw saved POS document (for an existing POS, `tripId` is populated; for a new POS it is the plain id). Lines include DELETED (voided) lines.

### 4.2 DELETE `/pos/voidPosProduct/:id/trip/:tripId` — `voidProductInPos` (`pos.controller.ts:161`)

**Params:** `id` = the **line `_id`** inside `products[]` (not the POS document id); `tripId`.

**Logic:**
1. Load trip with status in `[PENDING, START, FINISHED, START]` (START is listed twice). Not found → `400 "Trip not found!"`. If `trip.status !== START` → `400 "You can not void pos transaction, because trip is not in started status!"`. So voiding is only possible on **STARTED** trips.
2. Load ACTIVE POS for trip (tripId populated).
3. Transaction:
   1. Find line with `_id == id` among **all** lines (status not checked). Not found → `400 "Pos transaction not found to void!"`. If there is no POS at all, `tripPosData.products` throws a TypeError → `500`.
   2. Set line `status = DELETED`, `updatedBy`, `updatedAt = now`.
   3. Recompute `totalAmount` over ACTIVE lines (§5.2). Save POS.
   4. Load product (`ACTIVE` only) → else `400 "Product not found!"` (aborts the whole void).
   5. `product.inventory += line.quantityWithSiUnitOfMeasure`; push a `buildInventoryLog` entry with type **`POS_TRANSACTION` (2)** (not the return type), message `Inventory updated: <qty><code> added to product "<name>" via voiding POS transaction in trip "<tripConfirmedNumber>".`; save product.
4. Commit.

**Response:** `201 "Pos transaction void successfully!"`, `data` = raw POS document.

### 4.3 PUT `/pos/tripEndAudit` — `tripEndPosAudit` (`pos.controller.ts:252`)

**Body** (Joi `tripEndAuditShema`, `pos.validation.ts:22`):

| Field | Rule | Messages |
|---|---|---|
| `tripId` | string, required | "tripId is required" / "tripId is invalid" |
| `auditRecords` | array (not marked required) | |
| `auditRecords[].id` | string, required: the POS line `_id` | "id is required" / "id is invalid" |
| `auditRecords[].returnQuantity` | number, required | "returnQuantity is required" / "... is invalid" |
| `auditRecords[].returnUnitOfMeasure` | number, required | "returnUnitOfMeasure is required" / "... is invalid" |
| `auditRecords[].isReturned` | boolean, required | "isReturned is required" / "... is invalid" |
| `auditRecords[].notReturnedReason` | string, allows `null`/`''` | "notReturnedReason is invalid" |

**Logic:**
1. Joi validate → `400`.
2. `posService.findByTripIdAndStatusInWIthProducts(tripId, [ACTIVE])`: populates `tripId` and `products.product` (`_id productName isReturnableProduct`), then **replaces `pos.products` with only the ACTIVE lines**. Not found → `400 "Pos transaction not found for given trip!"`.
3. **No trip-status check** and **no check that the audit was already done**.
4. Transaction. First, **one query** for all products: `productService.findAllByIdsAndStatusIn(ids, [ACTIVE])`, where `ids` are the populated product `_id`s of the lines matched by the audit records (unmatched records add `undefined`, which is skipped; duplicates are merged). The result is a `Map` of full documents, read outside the session. Then for each `auditRecord` (sequentially):
   1. Find the active line with `_id == auditRecord.id`; not found → `400 "Pos transaction not found for given trip!"`.
   2. `product = productsById.get(line.product._id)`. Not found (inactive/deleted) → `400 "Product not found!"`. Several records for the same product share the **same document instance**, so stock changes accumulate correctly across records.
   3. `returnedSi = helperUtil.fromMeasureUnitToSiMeasureUnit(returnUnitOfMeasure, returnQuantity)`; `<code>` = `helperUtil.getSiUnitCode(product.measureUnit)`.
   4. If `line.quantityWithSiUnitOfMeasure < returnedSi` → `400 'Return quantity is more than available quantity for product "<name>"!'`.
   5. Always push one `endAuditProducts` entry `{product, transactionId: line._id, isReturnableProduct, isReturned, notReturnedReson, returnedquantity: returnQuantity, returnedUnitOfMeasure, returnedQuantityWithSiUnitOfMeasure: returnedSi, createdBy, createdAt: now}`. `notReturnedReson` = `auditRecord.notReturnedReason` for returnable lines, but `auditRecord.notReturnedReson` (misspelt key, always empty) for non-returnable lines (`pos.controller.ts:315`).
   6. Choose the log message. `null` means no stock change:
      - **Returnable, full return** (`lineSi == returnedSi`): `Inventory Updated : <qty><code> added to product "<name>" via return of POS transaction in trip "<no>".`
      - **Returnable, partial return** (any other value, including 0 or negative): `... added to product and <lineSi - returnedSi><code> left in product "<name>" via return ... Reason for not return: <notReturnedReason or "N/A">`
      - **Non-returnable, returnedSi > 0**: `... via return product of POS transaction ...`
      - **Non-returnable, returnedSi ≤ 0**: `null` (entry only).
   7. If a message was chosen: `product.inventory += returnedSi`; push `buildInventoryLog({type: POS_TRANSACTION_RETURN (3), quantity: returnedSi, before, after, productId, userId: auth.id, message})`; save product (in session).

   (The four duplicated branches were merged into this single path; stock behaviour is unchanged.)
5. If at least one entry was built: `tripPosData.endAuditProducts = endAuditProducts` (**replaces** any previous audit), `isTripEndAuditDone = true`, save POS, commit, `200 "Trip end pos audit done successfully!"` with raw POS document. If `auditRecords` is an empty array → `500 "Something went wrong while end trip pos audit!"` (`InternalServerError`). If `auditRecords` is omitted → TypeError iterating `undefined` → `500`.

The audit does not need to cover every line; lines that are not sent get no audit entry.

### 4.4 GET `/pos/getPosByTrip/:tripId` — `getPosByTrip` (`pos.controller.ts:379`)

**Logic:**
1. `findByTripIdAndStatusInWIthProducts(tripId, [ACTIVE])` (only ACTIVE lines kept).
2. **No POS:** load trip with status `[PENDING, START, FINISHED]` → not found → `400 "Trip not found!"`. Return a stub: `{tripId, products: [], tripConfirmedNumber, isTripEndAuditDone: false, status: 0}` (no `_id`, `totalAmount`, etc.).
3. **POS exists:** `posUtils.modelToPosGetByIdReponseDto(pos)` (§6.2). Trip status is not checked.

**Response:** `200 ''`, `data: PosGetByIdReponseDto`:

| Field | Meaning |
|---|---|
| `_id` | POS id |
| `tripId`, `tripConfirmedNumber` | from populated trip |
| `products[]` | `PosProductDto` per ACTIVE line (below) |
| `totalAmount` | stored total |
| `isTripEndAuditDone` | |
| `totalConsumedAmount` | always `undefined` (field does not exist in schema) |
| `endAuditProducts` | raw audit entries |
| `status` | POS status |

`PosProductDto`:

| Field | Value |
|---|---|
| `id` | line `_id` |
| `productName`, `product` | populated product name / id |
| `isReturnableProduct`, `unitPrice`, `productUnitOfMeasure`, `enteredUnitOfMeasure`, `enteredQuantity`, `quantityWithSiUnitOfMeasure`, `status`, `createdAt` | line fields |
| `productUnitOfMeasureCode`, `enteredUnitOfMeasureCode` | unit `code` or `""` |
| `productMeasureUnitDetails` | full unit object of the product unit |
| `returnedQuantity`, `returnedUnitOfMeasure`, `returnedQuantityWithSiUnitOfMeasure`, `notReturnedReason` | from matching audit entry (by `transactionId`) if audit done, else 0 / "" |
| `returnedUnitOfMeasureCode` | code of returned unit, or "" |
| `consiumedQuantity` (sic) | if audit done: consumed quantity in the **entered** unit (formula §5.3), else 0 |

---

## 5. Business Rules & State Transitions

### 5.1 Lifecycle

```
Trip PENDING/START ──savePosProduct──► POS ACTIVE (lines ACTIVE, stock −)
Trip START         ──voidPosProduct──► line DELETED (stock +)
any trip status    ──tripEndAudit────► isTripEndAuditDone = true (returned stock +)
Trip START→FINISHED  requires isTripEndAuditDone if an ACTIVE POS exists        (trip.controller.ts:900-909)
Trip PENDING→CANCELED  all ACTIVE lines' stock +, POS & lines → DELETED          (trip.controller.ts:461-512)
Month-end audit      isMonthEndDone = true, batchId = <batch> (FINISHED trips)    (monthAudit.controller.ts:279-286)
```

| Operation | Allowed trip statuses (`WellKnownTripStatus`: 1 PENDING, 2 CANCELED, 3 START, 4 FINISHED, 5 REACHED) |
|---|---|
| Add line | PENDING, START |
| Void line | START only |
| Trip-end audit | not checked |
| Get | any when POS exists; PENDING/START/FINISHED when it doesn't |

### 5.2 Total amount

For each ACTIVE line:
```
lineValue = helperUtil.fromMeasureUnitToOtherMeasureUnit(enteredUnitOfMeasure, productUnitOfMeasure, enteredQuantity) * unitPrice
totalAmount = Σ lineValue
```
i.e. the entered quantity is converted to the product's unit and multiplied by the price per product unit. Example: product priced per kg (unit 13) at 500, issued 250 g → `(250 / 1000) * 500 = 125`. Totals are not changed by the trip-end audit (returns do not reduce `totalAmount`).

### 5.3 Consumed quantity (response only, `pos.utils.ts:16-17`)

```
consumedSi = line.product.isReturnableProduct
               ? line.quantityWithSiUnitOfMeasure                         // returnable: full issued qty
               : line.quantityWithSiUnitOfMeasure - audit.returnedQuantityWithSiUnitOfMeasure
siUnitId   = productUnit.isSaveWithSiUnit ? (SI unit of same category).unitId : productUnit.unitId
consiumedQuantity = helperUtil.fromSiMeasureUnitToOtherMeasureUnit(siUnitId, line.enteredUnitOfMeasure, consumedSi)
```
This is only computed when a matching audit entry exists. Otherwise `consiumedQuantity` is 0.

### 5.4 Stock movements (base unit)

| Event | Change | Log type |
|---|---|---|
| Add line | `inventory -= qtySi` | `POS_TRANSACTION (2)` |
| Void line | `inventory += line.qtySi` | `POS_TRANSACTION (2)` |
| Audit return (any branch with returnedSi > 0) | `inventory += returnedSi` | `POS_TRANSACTION_RETURN (3)` |
| Trip cancellation (trip module) | `inventory += line.qtySi` per ACTIVE line | `POS_TRANSACTION (2)` |

Availability check on add: `product.inventory >= qtySi`, checked before the transaction.

---

## 6. Utilities & DTOs

### 6.1 Shared helpers (`src/util/helper.util.ts`, `src/util/inventory.util.ts`)

The private copies in `pos.controller.ts` were removed. The controller now imports:
- `helperUtil.fromMeasureUnitToSiMeasureUnit(fromUnitId, qty)` (`helper.util.ts:15`): if the unit `isSaveWithSiUnit`, return `qty` when it is the SI unit, else `qty * conversionToSi`. Otherwise return `qty`. An unknown unit returns `qty`.
- `helperUtil.fromMeasureUnitToOtherMeasureUnit(fromUnitId, toUnitId, qty)` (`:33`): throws `400 "Invalid Measure Unit Conversion!"` if categories differ; if both units have `conversionToSi`, return `toSi(qty) / toUnit.conversionToSi`, else `qty`.
- `helperUtil.getSiUnitCode(unitId)` (`:98`): base-unit code for log messages (SI unit code of the category if `isSaveWithSiUnit`, else the unit's own code). Throws `TypeError` (→ 500) for an unknown unit id.
- `inventoryUtil.buildInventoryLog({type, quantity, before, after, productId, userId, message})` (`inventory.util.ts:2`): returns the `inventoryLogs` entry with `inventoryLogDate = new Date()` (field mapping in `Documents/inventory.md` §6.3).

### 6.2 `pos.utils.ts`

`modelToPosGetByIdReponseDto(pos)`: expects `products.product` and `tripId` populated. Builds the DTOs described in §4.4, matching audit entries by `audit.transactionId.toString() === line._id.toString()`. Throws (500) if a line's `productUnitOfMeasure` is not a known unit id while the audit is done (`productMeasureUnit.isSaveWithSiUnit` on `undefined`).

### 6.3 `pos.service.ts`

| Function | Behaviour |
|---|---|
| `save(pos, session)` | Save with optional session. No cache clearing. The `pos-` cache prefix in `constant.ts` is unused. |
| `findByTripIdAndStatusIn(tripId, statuses)` | `findOne({tripId, status:{$in}})`, populate `tripId` (`_id tripConfirmedNumber status`). |
| `findByTripIdAndStatusInWIthProducts(tripId, statuses)` | Same plus populate `products.product` (`_id productName isReturnableProduct`, model `InventoryProduct`), then `pos.products = pos.products.filter(status === ACTIVE)`. |
| `findAllIdsByTripIdsAndStatusIn(tripIds, statuses)` (`:43`, new) | Month end. `[]` for no trips; otherwise one `find({tripId: {$in}, status: {$in}}).select('_id tripId').lean()` and keeps the **first** `_id` per trip (like the old per-trip `findOne`). Not bound to the session. |
| `markMonthEndDone(ids, userId, batchId, session)` (`:63`, new) | Month end. No-op for an empty list; otherwise one `Pos.updateMany({_id: {$in: ids}}, {$set: {isMonthEndDone: true, batchId, updatedBy: userId}}, {session})`. Replaces the per-document load + save. |

### 6.4 DTOs

`dto/posGetByIdReponseDto.ts`: `PosGetByIdReponseDto`, `PosProductDto` (see §4.4).

---

## 7. Dependencies

**Reads/writes:**
- `Pos` (own).
- `Trip`: read via `tripService.findByIdAndStatusIn` (status and `tripConfirmedNumber`).
- `InventoryProduct`: read + write `inventory` and `inventoryLogs` via `productService` (`findByIdAndStatusIn`, `findAllByIdsAndStatusIn`, `save`; clears `product-` cache).
- `User` (refs only), `Auth` (auth middleware).
- `measureUnitData` static catalogue.

**Depended on by:**
- `src/modules/trip/trip.controller.ts`: cancel trip (`:461-512`, uses `findByTripIdAndStatusInWIthProducts` + `productService.createBatchLoader`; returns stock, marks POS/lines DELETED) and finish trip (`:900-909`, requires `isTripEndAuditDone`).
- `src/modules/monthAudit/monthAudit.controller.ts:275-286` (`monthEndDoneForTrip`): collects the ACTIVE POS ids of the month's FINISHED trips with `findAllIdsByTripIdsAndStatusIn`, then sets `isMonthEndDone`, `batchId`, `updatedBy` on all of them with one `markMonthEndDone` `updateMany` inside the month-end session.

---

## 8. Notes / Gotchas

1. **Double void restores stock twice** (`pos.controller.ts:188`): the line lookup does not check `status`, so voiding an already-DELETED line adds its quantity back to stock again (and writes another log).
2. **Re-running the trip-end audit double-counts returns**: there is no `isTripEndAuditDone` guard. Each call adds returned quantities to stock again and replaces `endAuditProducts`. Lines can also still be added (trip PENDING/START) after an audit without resetting `isTripEndAuditDone`.
3. **Voided lines are probably erased on audit save**: `findByTripIdAndStatusInWIthProducts` assigns a filtered (ACTIVE-only) array to `pos.products`. `tripEndPosAudit` then saves that document, which should overwrite `products` in the DB and drop the DELETED (voided) lines' history. The same applies in trip cancellation, which uses this loader before saving.
4. **Audit has no trip-status check**: it can run on PENDING, CANCELED (if POS is still ACTIVE) or FINISHED trips.
5. **No quantity bounds**: Joi allows `quantity` ≤ 0 on save (a negative issue increases stock and passes the stock check) and negative `returnQuantity` on audit (a negative "return" on a returnable product reduces stock).
6. **Oversell race**: the stock check is done before the transaction with a read-modify-write (`inventory -=`), not an atomic conditional `$inc`. Concurrent issues can push stock negative.
7. **Return unit category is not validated** in the audit: `fromMeasureUnitToSiMeasureUnit` has no category check, so a `kg` return against a `pc` line converts ×1000 and is likely rejected only by the "more than available" check.
8. **Void is restricted to STARTED trips** even though lines can be added on PENDING trips. The status list passed to the lookup contains `START` twice and `FINISHED`, which are then rejected anyway.
9. **The void log type is `POS_TRANSACTION`** (same as an issue) even though stock goes up. Only the message text tells the two apart. Trip cancellation does the same.
10. **Non-returnable lines read `auditRecord.notReturnedReson`** (misspelt; Joi only allows `notReturnedReason`, so sending the misspelt key is rejected with 400), so the reason is always lost for non-returnable products. The quirk is now explicit in one ternary (`pos.controller.ts:315`).
11. **Returnable full vs partial differ only in the log message** (the code now makes that explicit). Both add `returnedSi` to stock, including a 0 or negative value (which writes a log entry). `isReturned` is taken from the client and never derived.
12. **Consumed quantity semantics** (`pos.utils.ts:16`): for returnable products "consumed" equals the full issued quantity even when items were returned (and returned to stock). For consumables it is issued minus returned. This may be intended (returnables count as "used" for the trip) or inverted. Check with the business.
13. **Phantom fields**: `totalConsumedAmount` is set on create and read in the DTO but does not exist in the schema (always `undefined`). `totalAfterAudit` exists but is never written. `endAuditProducts.product` refs the unregistered model `'Product'`.
14. **Audit product reads are outside the session**: the batched `findAllByIdsAndStatusIn` read is not bound to the transaction. This is the same as before, but a concurrent issue/void on the same product between the read and the save can be overwritten. (The old in-memory `gettedProductsFromDb` list bug, which pushed duplicates, is gone: products now come from a single Map.)
15. **Missing POS on void → 500** (TypeError on `tripPosData.products`) instead of a clean 4xx.
16. **Empty `auditRecords` → 500 `InternalServerError`** instead of a 400. A missing `auditRecords` key → TypeError → 500.
17. **Status codes**: void returns `201 CREATED`.
18. **`getPosByTrip` stub response** when no POS exists lacks `_id`, `totalAmount` and `endAuditProducts`, and uses `status: 0`.
19. **Inactive product blocks void/audit**: if a product was deactivated or deleted after issue, voiding or auditing its line fails with `400 "Product not found!"`. Trip cancellation silently skips such products instead (`trip.controller.ts:477-479`), so their stock is never restored.

---

## Changelog

### 2026-10-25 — synced with code changes in commit `50632dc` ("Code Ai Optimization revamp")
- Added the non-unique index `Pos {tripId: 1, status: 1}`.
- Removed the private unit-conversion copies from `pos.controller.ts`. It now uses `helperUtil.fromMeasureUnitToSiMeasureUnit` / `fromMeasureUnitToOtherMeasureUnit` / `getSiUnitCode`, and log entries come from `inventoryUtil.buildInventoryLog` (new `src/util/inventory.util.ts`).
- Trip-end audit loads all products in one query (`productService.findAllByIdsAndStatusIn`) instead of the `gettedProductsFromDb` list. Its four copy-pasted branches were merged into one path that only picks the log message (same stock behaviour).
- New service functions `findAllIdsByTripIdsAndStatusIn` and `markMonthEndDone` (`updateMany`). Month-end now flags POS documents in bulk (`monthAudit.controller.ts:279-286`).
- Updated the controller line references and the trip/month-audit references.
- Gotchas: #14 (in-memory product list duplicates) is resolved and replaced by a note that audit product reads happen outside the session. #10 and #11 were reworded (behaviour unchanged).
