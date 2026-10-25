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
| `pos.controller.ts` | Handlers: save line, void line, trip-end audit, get by trip; private unit-conversion helpers. |
| `pos.service.ts` | DB access (`save`, `findByTripIdAndStatusIn`, `findByTripIdAndStatusInWIthProducts`). |
| `pos.validation.ts` | Joi schemas `savePosProductSchema`, `tripEndAuditShema`. |
| `pos.utils.ts` | `modelToPosGetByIdReponseDto` mapper (computes returned/consumed quantities). |
| `dto/posGetByIdReponseDto.ts` | `PosGetByIdReponseDto`, `PosProductDto` interfaces. |

Shared code used: `src/util/data/measureUnitData.ts`, `src/util/helper.util.ts` (`fromSiMeasureUnitToOtherMeasureUnit`), `src/util/commonResponse.ts`, enums `WellKnownStatus`, `WellKnownTripStatus`, `WellKnownGrnLogType`, errors `BadRequestError`, `InternalServerError`, `src/modules/trip/trip.service.ts`, `src/modules/inventory/product/product.service.ts`.

---

## 3. Data Model — `Pos` (`pos.model.ts`)

Model name `Pos`. Options: `timestamps: true`, `versionKey: false`. No indexes (no unique index on `tripId`; "one POS per trip" is enforced only by the controller looking up the existing ACTIVE document). No hooks/virtuals.

### 3.1 Root fields

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `tripId` | ObjectId → `Trip` | required ("Trip is required") | |
| `products` | [PosProduct] | — | Issue transactions (3.2). |
| `totalAmount` | Number | default `0` | Sum of ACTIVE line values (formula in 5.2). |
| `isTripEndAuditDone` | Boolean | default `false` | Set `true` by trip-end audit. |
| `endAuditProducts` | [EndAuditProduct] | — | Audit results (3.3). Replaced in full on each audit. |
| `totalAfterAudit` | Number | default `0` | **Never written by any code.** |
| `isMonthEndDone` | Boolean | default `false` | Set by month-end audit (`src/modules/monthAudit/monthAudit.controller.ts:302-312`). |
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
3. `posTransactionQtyWithSiUnit = fromMeasureUnitToSiMeasureUnit(unitOfMeasure, quantity)` (§6.1).
4. Load product with status `ACTIVE`. Not found → `400 "Product is not found!"`. If `product.inventory < posTransactionQtyWithSiUnit` → `400 "You can not save pos transaction, because product inventory is not enough!"`.
5. `posService.findByTripIdAndStatusIn(tripId, [ACTIVE])`: existing POS, with `tripId` populated (`_id tripConfirmedNumber status`).
6. Start transaction.
   - **No existing POS:** create `new Pos({tripId, products: [], totalAmount: 0, isTripEndAuditDone: false, endAuditProducts: [], totalConsumedAmount: 0, createdBy, updatedBy})` (`totalConsumedAmount` is not in the schema and is dropped). Push the new line (fields below). `totalAmount += fromMeasureUnitToOtherMeasureUnit(unitOfMeasure, product.measureUnit, quantity) * product.unitPrice`. Save.
   - **Existing POS:** push the new line, then recompute `totalAmount` from scratch over all lines with `status == ACTIVE` (formula §5.2). Save.
   - New line = `{product: productId, isReturnableProduct, unitPrice, productUnitOfMeasure: product.measureUnit, enteredUnitOfMeasure: unitOfMeasure, enteredQuantity: quantity, quantityWithSiUnitOfMeasure: posTransactionQtyWithSiUnit, status: ACTIVE, createdBy, updatedBy}`.
   - `fromMeasureUnitToOtherMeasureUnit` throws `400 "Invalid Measure Unit Conversion!"` if the entered unit's category differs from the product's unit category. This aborts the transaction.
7. **Stock deduction:** `before = product.inventory`; `product.inventory -= posTransactionQtyWithSiUnit`; push inventory log `{inventoryLogType: POS_TRANSACTION (2), inventoryLogDate: now, inventoryLogQuantity: posQtySi, beforeTransactionInventory, afterTransactionInventory, inventoryLogProductId, inventoryLogCreatedBy: auth.id, message: 'Inventory updated: <qty><code> removed from product "<name>" via POS transaction to trip "<tripConfirmedNumber>".'}`. `<code>` = base-unit code (`g`/`ml` for SI-stored categories, else the product unit's own code). Save the product, which clears the `product-` cache.
8. Commit. Any error → abort + rethrow.

**Response:** `201 "Pos transaction saved successfully!"`, `data` = raw saved POS document (for an existing POS, `tripId` is populated; for a new POS it is the plain id). Lines include DELETED (voided) lines.

### 4.2 DELETE `/pos/voidPosProduct/:id/trip/:tripId` — `voidProductInPos` (`pos.controller.ts:169`)

**Params:** `id` = the **line `_id`** inside `products[]` (not the POS document id); `tripId`.

**Logic:**
1. Load trip with status in `[PENDING, START, FINISHED, START]` (START is listed twice). Not found → `400 "Trip not found!"`. If `trip.status !== START` → `400 "You can not void pos transaction, because trip is not in started status!"`. So voiding is only possible on **STARTED** trips.
2. Load ACTIVE POS for trip (tripId populated).
3. Transaction:
   1. Find line with `_id == id` among **all** lines (status not checked). Not found → `400 "Pos transaction not found to void!"`. If there is no POS at all, `tripPosData.products` throws a TypeError → `500`.
   2. Set line `status = DELETED`, `updatedBy`, `updatedAt = now`.
   3. Recompute `totalAmount` over ACTIVE lines (§5.2). Save POS.
   4. Load product (`ACTIVE` only) → else `400 "Product not found!"` (aborts the whole void).
   5. `product.inventory += line.quantityWithSiUnitOfMeasure`; push log with type **`POS_TRANSACTION` (2)** (not the return type), message `Inventory updated: <qty><code> added to product "<name>" via voiding POS transaction in trip "<tripConfirmedNumber>".`; save product.
4. Commit.

**Response:** `201 "Pos transaction void successfully!"`, `data` = raw POS document.

### 4.3 PUT `/pos/tripEndAudit` — `tripEndPosAudit` (`pos.controller.ts:268`)

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
4. Transaction. For each `auditRecord` (sequentially):
   1. Find the active line with `_id == auditRecord.id`; not found → `400 "Pos transaction not found for given trip!"`.
   2. Get the product from a local in-memory list `gettedProductsFromDb` (keyed by the populated product `_id`), or else load it with status `ACTIVE`. Not found → `400 "Product not found!"`.
   3. `returnedSi = fromMeasureUnitToSiMeasureUnit(returnUnitOfMeasure, returnQuantity)`.
   4. If `line.quantityWithSiUnitOfMeasure < returnedSi` → `400 'Return quantity is more than available quantity for product "<name>"!'`.
   5. Build an `endAuditProducts` entry `{product, transactionId: line._id, isReturnableProduct, isReturned, notReturnedReson, returnedquantity: returnQuantity, returnedUnitOfMeasure, returnedQuantityWithSiUnitOfMeasure: returnedSi, createdBy, createdAt: now}`.
   6. Branches:
      - **Returnable, full return** (`lineSi == returnedSi`): push entry; `product.inventory += returnedSi`; log type `POS_TRANSACTION_RETURN (3)`: `Inventory Updated : <qty><code> added to product "<name>" via return of POS transaction in trip "<no>".`; save product.
      - **Returnable, partial return**: push entry; `product.inventory += returnedSi`; log type 3 with message `... added to product and <lineSi - returnedSi><code> left in product "<name>" via return ... Reason for not return: <notReturnedReason or "N/A">`; save product.
      - **Non-returnable, returnedSi > 0**: push entry (here `notReturnedReson` is read from `auditRecord.notReturnedReson`, a misspelt key, so it is always empty); `product.inventory += returnedSi`; log type 3 `... via return product of POS transaction ...`; save product.
      - **Non-returnable, returnedSi == 0 (or negative)**: push entry only; no stock change.
   7. Update the in-memory product cache list (see Gotchas).
5. If at least one entry was built: `tripPosData.endAuditProducts = endAuditProducts` (**replaces** any previous audit), `isTripEndAuditDone = true`, save POS, commit, `200 "Trip end pos audit done successfully!"` with raw POS document. If `auditRecords` is an empty array → `500 "Something went wrong while end trip pos audit!"` (`InternalServerError`). If `auditRecords` is omitted → TypeError iterating `undefined` → `500`.

The audit does not need to cover every line; lines that are not sent get no audit entry.

### 4.4 GET `/pos/getPosByTrip/:tripId` — `getPosByTrip` (`pos.controller.ts:488`)

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
Trip START→FINISHED  requires isTripEndAuditDone if an ACTIVE POS exists        (trip.controller.ts:956-965)
Trip PENDING→CANCELED  all ACTIVE lines' stock +, POS & lines → DELETED          (trip.controller.ts:481-537)
Month-end audit      isMonthEndDone = true, batchId = <batch>                     (monthAudit.controller.ts:302-312)
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
lineValue = fromMeasureUnitToOtherMeasureUnit(enteredUnitOfMeasure, productUnitOfMeasure, enteredQuantity) * unitPrice
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

### 6.1 Private helpers in `pos.controller.ts:520-580`

Copies of `src/util/helper.util.ts` logic:
- `fromMeasureUnitToSiMeasureUnit(fromUnitId, qty)`: if the unit `isSaveWithSiUnit`, return `qty` when it is the SI unit, else `qty * conversionToSi`. Otherwise return `qty`. An unknown unit returns `qty`.
- `fromMeasureUnitToOtherMeasureUnit(fromUnitId, toUnitId, qty)`: throws `400 "Invalid Measure Unit Conversion!"` if categories differ; if both units have `conversionToSi`, return `toSi(qty) / toUnit.conversionToSi`, else `qty`.
- `fromSiMeasureUnitToOtherMeasureUnit(...)`: defined but **unused** in this file.

### 6.2 `pos.utils.ts`

`modelToPosGetByIdReponseDto(pos)`: expects `products.product` and `tripId` populated. Builds the DTOs described in §4.4, matching audit entries by `audit.transactionId.toString() === line._id.toString()`. Throws (500) if a line's `productUnitOfMeasure` is not a known unit id while the audit is done (`productMeasureUnit.isSaveWithSiUnit` on `undefined`).

### 6.3 `pos.service.ts`

| Function | Behaviour |
|---|---|
| `save(pos, session)` | Save with optional session. No cache clearing. The `pos-` cache prefix in `constant.ts` is unused. |
| `findByTripIdAndStatusIn(tripId, statuses)` | `findOne({tripId, status:{$in}})`, populate `tripId` (`_id tripConfirmedNumber status`). |
| `findByTripIdAndStatusInWIthProducts(tripId, statuses)` | Same plus populate `products.product` (`_id productName isReturnableProduct`, model `InventoryProduct`), then `pos.products = pos.products.filter(status === ACTIVE)`. |

### 6.4 DTOs

`dto/posGetByIdReponseDto.ts`: `PosGetByIdReponseDto`, `PosProductDto` (see §4.4).

---

## 7. Dependencies

**Reads/writes:**
- `Pos` (own).
- `Trip`: read via `tripService.findByIdAndStatusIn` (status and `tripConfirmedNumber`).
- `InventoryProduct`: read + write `inventory` and `inventoryLogs` via `productService` (clears `product-` cache).
- `User` (refs only), `Auth` (auth middleware).
- `measureUnitData` static catalogue.

**Depended on by:**
- `src/modules/trip/trip.controller.ts`: cancel trip (returns stock, marks POS/lines DELETED) and finish trip (requires `isTripEndAuditDone`).
- `src/modules/monthAudit/monthAudit.controller.ts:302-312`: sets `isMonthEndDone`, `batchId`, `updatedBy` on the trip's ACTIVE POS.

---

## 8. Notes / Gotchas

1. **Double void restores stock twice** (`pos.controller.ts:196`): the line lookup does not check `status`, so voiding an already-DELETED line adds its quantity back to stock again (and writes another log).
2. **Re-running the trip-end audit double-counts returns**: there is no `isTripEndAuditDone` guard. Each call adds returned quantities to stock again and replaces `endAuditProducts`. Lines can also still be added (trip PENDING/START) after an audit without resetting `isTripEndAuditDone`.
3. **Voided lines are probably erased on audit save**: `findByTripIdAndStatusInWIthProducts` assigns a filtered (ACTIVE-only) array to `pos.products`. `tripEndPosAudit` then saves that document, which should overwrite `products` in the DB and drop the DELETED (voided) lines' history. The same applies in trip cancellation, which uses this loader before saving.
4. **Audit has no trip-status check**: it can run on PENDING, CANCELED (if POS is still ACTIVE) or FINISHED trips.
5. **No quantity bounds**: Joi allows `quantity` ≤ 0 on save (a negative issue increases stock and passes the stock check) and negative `returnQuantity` on audit (a negative "return" on a returnable product reduces stock).
6. **Oversell race**: the stock check is done before the transaction with a read-modify-write (`inventory -=`), not an atomic conditional `$inc`. Concurrent issues can push stock negative.
7. **Return unit category is not validated** in the audit: `fromMeasureUnitToSiMeasureUnit` has no category check, so a `kg` return against a `pc` line converts ×1000 and is likely rejected only by the "more than available" check.
8. **Void is restricted to STARTED trips** even though lines can be added on PENDING trips. The status list passed to the lookup contains `START` twice and `FINISHED`, which are then rejected anyway.
9. **The void log type is `POS_TRANSACTION`** (same as an issue) even though stock goes up. Only the message text tells the two apart. Trip cancellation does the same.
10. **Non-returnable branch reads `auditRecord.notReturnedReson`** (misspelt; Joi field is `notReturnedReason`), so the reason is always lost for non-returnable products (`pos.controller.ts:412,446`).
11. **Returnable full vs partial branches are functionally identical** except for the log message. Both add `returnedSi` to stock. `isReturned` is taken from the client and never derived.
12. **Consumed quantity semantics** (`pos.utils.ts:16`): for returnable products "consumed" equals the full issued quantity even when items were returned (and returned to stock). For consumables it is issued minus returned. This may be intended (returnables count as "used" for the trip) or inverted. Check with the business.
13. **Phantom fields**: `totalConsumedAmount` is set on create and read in the DTO but does not exist in the schema (always `undefined`). `totalAfterAudit` exists but is never written. `endAuditProducts.product` refs the unregistered model `'Product'`.
14. **In-memory product reuse in audit** compares `item._id` with `selectedPosTransaction.product.toString()` (`pos.controller.ts:458`), but `product` is a populated document, so `toString()` is not its id. The match never succeeds and products are re-pushed. Lookups at line 306 still find the first (same, mutated) instance, so stock arithmetic stays correct, but the list grows with duplicates.
15. **Missing POS on void → 500** (TypeError on `tripPosData.products`) instead of a clean 4xx.
16. **Empty `auditRecords` → 500 `InternalServerError`** instead of a 400. A missing `auditRecords` key → TypeError → 500.
17. **Status codes**: void returns `201 CREATED`.
18. **`getPosByTrip` stub response** when no POS exists lacks `_id`, `totalAmount` and `endAuditProducts`, and uses `status: 0`.
19. **Inactive product blocks void/audit**: if a product was deactivated or deleted after issue, voiding or auditing its line fails with `400 "Product not found!"`. Trip cancellation silently skips such products instead (`trip.controller.ts:495-497`), so their stock is never restored.
