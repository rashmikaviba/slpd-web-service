# Inventory Module (Products & GRN)

Source: `src/modules/inventory/`

All endpoints are mounted under the global prefix `/api/v1` (`src/constant.ts:3`, `src/app.ts:43`). Paths in this document are shown **without** that prefix.

---

## 1. Overview

The inventory module manages the company's stock of consumable/returnable items (e.g. water bottles, snacks, blankets, coolers) that are handed out to tours.

It has two sub-domains:

- **Product** (`InventoryProduct` collection) – the master list of stock items, with a unit of measure, a unit price, a running stock level (`inventory`) and an embedded stock ledger (`inventoryLogs`).
- **GRN – Goods Receipt Note** (`GRN` collection) – a document recording goods received into the store. A GRN is created as *Pending*, then *Approved* (stock is added to each product), *Rejected*, or *Cancelled*.

Stock is **reduced** by the POS module (items issued to a trip) and **increased** by GRN approval, POS voids, POS trip-end returns, and trip cancellation (see `Documents/pos.md`). Every stock movement appends a row to the product's `inventoryLogs`.

Stock is always stored in a "base/SI" unit per unit category (pieces for countable units, grams for mass, millilitres for volume), and converted back to the product's display unit in responses.

---

## 2. Files

| File | Role |
|---|---|
| `product/product.model.ts` | Mongoose schema/model `InventoryProduct` (with embedded `inventoryLogs`). |
| `product/product.route.ts` | Express router for `/inventory/product`. |
| `product/product.controller.ts` | Handlers: save, update, getById, activate/deactivate, delete, getAll, audit log. |
| `product/product.service.ts` | DB access + node-cache for products; duplicate check; batch product loaders (`findAllByIdsAndStatusIn`, `createBatchLoader`) also used by POS and trip. |
| `product/product.validation.ts` | Joi schema `productSaveSchema` (used for save and update). |
| `product/product.util.ts` | Model → `ProductResponseDto` mappers (SI → product-unit conversion delegated to `helperUtil.fromSiToMeasureUnit`). |
| `grn/grn.model.ts` | Mongoose schema/model `GRN`. |
| `grn/grn.route.ts` | Express router for `/inventory/grn`. |
| `grn/grn.controller.ts` | Handlers: save, update, approve, reject, cancel, getById, advance search, next number. Unit conversion and log-entry building come from shared utils (§6.3). |
| `grn/grn.service.ts` | DB access, next GRN number, cached advance search. |
| `grn/grn.validation.ts` | Joi schemas `grnSaveSchema`, `grnApproveRejectSchema`, `advanceSearchSchema`. |
| `grn/grn.util.ts` | Model → `GrnResponseDto` / `GrnSearchResponseDto` mappers. |
| `dto/productResponseDto.ts` | `ProductResponseDto` interface. |
| `dto/grnResponseDto.ts` | `GrnResponseDto` / `GrnProductDto` interfaces. |
| `dto/grnSearchResponseDto.ts` | `GrnSearchResponseDto` interface. |

Shared code used: `src/util/data/measureUnitData.ts` (unit catalogue), `src/util/helper.util.ts` (unit conversion, `getSiUnitCode`), `src/util/inventory.util.ts` (`buildInventoryLog`), `src/util/cache.ts`, `src/util/commonResponse.ts`, `src/util/enums/well-known-status.enum.ts`, `well-known-grn-status.enum.ts`, `well-known-grn-log-type.enum.ts`, `src/constant.ts`, `src/middleware/auth.middleware.ts`.

---

## 3. Shared concepts

### 3.1 Authorization (`src/middleware/auth.middleware.ts`)

`authorize(rolesArray)`:
1. Requires header `Authorization: Bearer <jwt>`; otherwise `401 "Authentication invalid!"`.
2. Verifies JWT (issuer `cybertronix.com`). Expired → `401 "Your session is expired!"`; other failure → `403 "You're unauthorized to access this resource!"`.
3. Loads the `Auth` record by `payload.authId`; missing → `401 "Authentication invalid!"`; `isBlocked` → `401 "Your account is blocked, Please contact admin!"`.
4. If `rolesArray` is non-empty and `payload.role` (numeric role id) is not in it → `403 "You're unauthorized to access this resource!"`.
5. Sets `req.auth = { id (User _id), userName, role, authId }`.

`authorize([])` = any authenticated, non-blocked user.

Role ids (`src/constant.ts:7-15`): `SUPERADMIN=1, ADMIN=2, DRIVER=3, FINANCEOFFICER=4, TRIPMANAGER=5, DRIVERASSISTANT=6, TRIPASSISTANT=7`.

### 3.2 Response envelope & error mapping

All responses use `CommonResponse` (`src/util/commonResponse.ts`):
```json
{ "isSuccessful": true, "timeStamp": "ISO", "message": "...", "data": ... }
```
Errors go through `src/middleware/error.middleware.ts`: custom errors keep their status; Mongoose `ValidationError` → `400` with the first validator message; Mongo duplicate key `11000` → `409`; `CastError` (bad ObjectId) → `404 'No item found with ID "<value>"!'`; anything else → `500`.

### 3.3 Measure units (`src/util/data/measureUnitData.ts`)

| unitId | code | name | categoryId | isSaveWithSiUnit | isSiUnit | conversionToSi |
|---|---|---|---|---|---|---|
| 1 | pc | Piece | 1 (Countable) | false | true | 1 |
| 2 | pkt | Packet | 1 | false | true | 1 |
| 3 | box | Box | 1 | false | true | 1 |
| 4 | btl | Bottle | 1 | false | true | 1 |
| 5 | can | Can | 1 | false | true | 1 |
| 6 | roll | Roll | 1 | false | true | 1 |
| 7 | set | Set | 1 | false | true | 1 |
| 8 | item | Item | 1 | false | true | 1 |
| 9 | unit | Unit | 1 | false | true | 1 |
| 10 | bag | Bag | 1 | false | true | 1 |
| 11 | mg | Milligram | 2 (Mass) | true | false | 0.001 |
| 12 | g | Gram | 2 | true | **true** | 1 |
| 13 | kg | Kilogram | 2 | true | false | 1000 |
| 14 | t | Tonne | 2 | true | false | 1000000 |
| 15 | ml | Milliliter | 3 (Volume) | true | **true** | 1 |
| 16 | l | Liter | 3 | true | false | 1000 |
| 17 | cc | Cubic Centimeter | 3 | true | false | 1 |

(`isAllowDecimal` is `false` for category 1 and `true` for categories 2/3, but it is not enforced anywhere in this module.)

**Storage rule:** `product.inventory` and all `inventoryLogs` quantities are stored in the base unit: grams for mass, millilitres for volume, the raw count for countable units.

---

## 4. PRODUCT

### 4.1 Data Model — `InventoryProduct` (`product/product.model.ts`)

Collection model name: `InventoryProduct`. Options: `timestamps: true` (adds `createdAt`, `updatedAt`), `versionKey: false`. One non-unique index `{status: 1}` (`product.model.ts:100`) for the status filters. No hooks or virtuals, and no unique index on name/short code — uniqueness is enforced only in application code.

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `productName` | String | required ("Product Name is required") | Uniqueness (case-insensitive, among non-deleted) checked in controller. |
| `productShortCode` | String | required ("Product Short Code is required") | Uniqueness checked in controller. |
| `measureUnit` | Number | required | A `unitId` from `measureUnitData`. Not validated against the catalogue. |
| `isReturnableProduct` | Boolean | required | Drives POS trip-end audit behaviour. |
| `unitPrice` | Number | required | Price per **one product measure unit** (e.g. per kg if `measureUnit=13`). |
| `description` | String | optional, maxlength 500 | |
| `inventory` | Number | default `0` | Current stock, in base (SI) unit. |
| `inventoryLogs` | [InventoryLog] | `[]` | Embedded stock ledger (see below). |
| `status` | Number | required, default `WellKnownStatus.ACTIVE` | `1=ACTIVE, 2=INACTIVE, 3=DELETED`. |
| `createdBy` | ObjectId → `User` | optional | |
| `updatedBy` | ObjectId → `User` | optional | |
| `createdAt` / `updatedAt` | Date | auto | timestamps |

**Embedded `inventoryLogs[]` sub-document** (each gets its own `_id`):

| Field | Type | Notes |
|---|---|---|
| `inventoryLogType` | Number | `WellKnownGrnLogType`: `1=GRN_APPROVED`, `2=POS_TRANSACTION`, `3=POS_TRANSACTION_RETURN`. |
| `inventoryLogDate` | Date | |
| `inventoryLogQuantity` | Number | Quantity moved, base unit, always positive. |
| `beforeTransactionInventory` | Number | Stock before (base unit). |
| `afterTransactionInventory` | Number | Stock after (base unit). |
| `inventoryLogProductId` | ObjectId → `InventoryProduct` | |
| `inventoryLogCreatedBy` | ObjectId → `User` | |
| `message` | String | Human-readable text, e.g. `Inventory updated: 500g added for product "Sugar" via approved GRN GRN-004.` |

Writers of `inventoryLogs`: GRN approval (this module), POS save/void/trip-end audit (`src/modules/pos/pos.controller.ts`), trip cancellation (`src/modules/trip/trip.controller.ts:461-512`). All of them now build the entry with `inventoryUtil.buildInventoryLog` (§6.3), so the shape above is defined in one place.

### 4.2 API Endpoints

Base path: `/inventory/product` (`src/applicationRoutes.ts:153`, mounted at `src/mapping.ts:42`).

| Method | Full path | Controller | Auth / Roles | Description |
|---|---|---|---|---|
| POST | `/inventory/product/` | `saveProduct` | SUPERADMIN, ADMIN | Create a product. |
| PUT | `/inventory/product/:id` | `updateProduct` | SUPERADMIN, ADMIN | Update a product. |
| PUT | `/inventory/product/activeInactive/:id` | `activeInactiveProduct` | SUPERADMIN, ADMIN | Toggle ACTIVE ↔ INACTIVE. |
| GET | `/inventory/product/:id` | `getProductById` | any authenticated | Get one product (raw model). |
| DELETE | `/inventory/product/:id` | `deleteProductById` | SUPERADMIN, ADMIN | Soft delete (status = DELETED). |
| GET | `/inventory/product/` | `getAllProducts` | any authenticated | List products (DTOs). |
| GET | `/inventory/product/productAuditLog/:id` | `getProductAuditLog` | any authenticated | Stock ledger of a product. |

(Route definitions: `product/product.route.ts:10-50`.)

#### 4.2.1 POST `/inventory/product/` — `saveProduct` (`product.controller.ts:16`)

**Body** (Joi `productSaveSchema`, `product.validation.ts:3`):

| Field | Rule | Error messages |
|---|---|---|
| `productName` | string, required | "Product Name is required" / "Product Name is invalid" |
| `productShortCode` | string, required | "Product Short Code is required" / "... is invalid" |
| `measureUnit` | number, required | "Measure Unit is required" / "Measure Unit is invalid" |
| `isReturnableProduct` | boolean, required | "Is Returnable Product is required" / "... is invalid" |
| `unitPrice` | number, required | "Unit Price is required" / "Unit Price is invalid" |
| `description` | string, max 500, allows `null`/`''` | "Description should not be more than 500 characters" / "Description is invalid" |

Unknown keys are rejected by Joi (default `allowUnknown: false`), e.g. sending `inventory` → 400.

**Logic:**
1. Joi validate → `400 <joi message>`.
2. `productService.isShortCodeOrProductNameExists(shortCode, name, "")` (`product.service.ts:18`) runs two parallel `findOne`s on non-DELETED products using a case-insensitive anchored regex (`^value$`, option `i`) plus collation `{locale:'en', strength:2}`.
3. If a short-code match exists (and lower-cased equal) → `400 "Product short code cannot be duplicate!"`. Else if a name match → `400 "Product name cannot be duplicate!"`. (Short code is checked first.)
4. Starts a Mongo session/transaction; builds a new `InventoryProduct` with the body fields, `inventoryLogs: []`, `status: ACTIVE`, `createdBy`/`updatedBy = req.auth.id` (`inventory` defaults to 0).
5. `productService.save` – clears all cache keys starting with `product-`, then saves within the session. Commit.
6. On any error: abort transaction and rethrow.

**Response:** `201 "Product saved successfully!"`, `data` = the saved Mongoose document (raw model, not a DTO).

#### 4.2.2 PUT `/inventory/product/:id` — `updateProduct` (`product.controller.ts:85`)

**Params:** `id` – product ObjectId. **Body:** same Joi schema as save (all required fields must be resent, including `measureUnit`).

**Logic:**
1. Joi validate → `400`.
2. `findByIdAndStatusIn(id, [ACTIVE, INACTIVE])`; not found → `404 "Product not found for update!"` (invalid ObjectId → CastError → `404 'No item found with ID ...'`).
3. Duplicate check excluding this `_id` (`_id: {$ne: id}`) → same `400` messages as save.
4. In a transaction sets `productName`, `productShortCode`, `isReturnableProduct`, `unitPrice`, `description`, `updatedBy`. **`measureUnit` is NOT updated** even though it is required in the body (the handler no longer even reads it from the body). Saves (clears `product-` cache). Commit.

**Response:** `200 "Product updated successfully!"`, `data` = raw product document (includes the full `inventoryLogs` array).

#### 4.2.3 PUT `/inventory/product/activeInactive/:id` — `activeInactiveProduct` (`product.controller.ts:159`)

**Params:** `id`. No body.

**Logic:** load ACTIVE/INACTIVE product → else `404 "Product not found for update!"`. In a transaction: if `ACTIVE` → set `INACTIVE` (message "Product inactivated successfully!"), otherwise set `ACTIVE` ("Product activated successfully!"). Set `updatedBy`, save, commit.

**Response:** `200 <message>`, `data` = raw product document.

#### 4.2.4 GET `/inventory/product/:id` — `getProductById` (`product.controller.ts:151`)

**Logic:** `findByIdAndStatusIn(id, [ACTIVE, INACTIVE])`. No not-found check.

**Response:** `200 ''`, `data` = raw product document (with `inventoryLogs`, `inventory` in base unit), or `null` if not found / deleted.

#### 4.2.5 DELETE `/inventory/product/:id` — `deleteProductById` (`product.controller.ts:204`)

**Logic:** load ACTIVE/INACTIVE product → else `404 "Product not found for update!"`. In a transaction set `status = DELETED`, `updatedBy`, save, commit. No check of remaining stock, pending GRNs or open POS transactions.

**Response:** `200 "Product deleted successfully!"`, `data` = raw product document.

#### 4.2.6 GET `/inventory/product/` — `getAllProducts` (`product.controller.ts:241`)

**Query:** `isWithInactive` – the string `'true'` includes INACTIVE products; anything else → only ACTIVE.

**Logic:** `productService.findAllAndByStatusIn(statuses)` (`product.service.ts:47`):
- Cache key `product-` + `JSON.stringify(statuses)` (e.g. `product-[1]`, `product-[1,2]`); cache hit returns immediately.
- Otherwise `InventoryProduct.find({status: {$in: statuses}}, {inventoryLogs: 0})` populating `createdBy` and `updatedBy` (`userName` only). No sort (natural order), no pagination. Not `.lean()`: full Mongoose documents are returned and cached. The `{status: 1}` index serves the filter.
- Result cached for `ONE_WEEK` (604800 s). The cache is cleared whenever any product is saved through `productService.save`.
- `src/util/cache.ts` now uses `useClones: false`, so a cache hit returns the **same shared array of documents** (no deep copy). Callers must treat it as read-only; `getAllProducts` and the dashboard only map it to DTOs.

Each document is mapped with `productUtil.modelsToProductResponseDtos`.

**Response:** `200 ''`, `data: ProductResponseDto[]`:

| Field | Source |
|---|---|
| `_id`, `productName`, `productShortCode`, `measureUnit`, `isReturnableProduct`, `unitPrice`, `description`, `status`, `createdAt`, `updatedAt` | model |
| `measureUnitDetails` | full unit object from `measureUnitData` matching `measureUnit` |
| `inventory` | stock converted from base unit to the product's unit (see 6.1) |
| `statusName` | enum key name (`"ACTIVE"`, `"INACTIVE"`) |
| `createdBy` / `updatedBy` | populated user `_id` or `""` |
| `createdUser` / `updatedByUser` | populated `userName` or `""` |

#### 4.2.7 GET `/inventory/product/productAuditLog/:id` — `getProductAuditLog` (`product.controller.ts:258`)

**Logic:** `productService.findProductLogsByProductId(id)` → `findOne({_id:id}).select('inventoryLogs')` populating `inventoryLogs.inventoryLogCreatedBy` (`userName`). **No status filter** (logs of DELETED products are returned). The controller then sorts `inventoryLogs` by `inventoryLogDate` descending (newest first).

**Response:** `200 ''`, `data` = array of raw `inventoryLogs` entries (fields from 4.1; `inventoryLogCreatedBy` is `{_id, userName}`). Quantities are in the base unit, not converted. If the product does not exist, `data` is `undefined` (the key is omitted from the JSON) with status 200.

### 4.3 Business rules — Product

- Status lifecycle (`WellKnownStatus`): created `ACTIVE (1)`; `ACTIVE ↔ INACTIVE (2)` via activeInactive; `ACTIVE|INACTIVE → DELETED (3)` via delete. DELETED is terminal (no endpoint restores it).
- Name and short code must be unique (case-insensitive) among non-DELETED products. A deleted product's name/short code can be reused.
- Only `ACTIVE` products can be received on a GRN, issued through POS, voided, or returned at audit (all use `findByIdAndStatusIn(..., [ACTIVE])`).
- `inventory` is never edited directly via the product API; it changes only via GRN approval and the POS/trip flows.

---

## 5. GRN (Goods Receipt Note)

### 5.1 Data Model — `GRN` (`grn/grn.model.ts`)

Model name `GRN`. Options: `timestamps: true`, `versionKey: false`. Two non-unique indexes (`grn.model.ts:105-106`): `{grnNumber: -1}` (serves the next-number lookup) and `{grnDate: 1, status: 1}` (serves advance search). There is still **no unique index on `grnNumber`**. No hooks/virtuals.

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `grnNumber` | Number | required ("GRN Number is required") | Sequential number. |
| `grnNumberWithPrefix` | String | required ("GRN Number is required") | `"GRN-"` + number padded to 3 digits, e.g. `GRN-007`, `GRN-1234`. |
| `grnDate` | Date | required | Set to `new Date()` at creation. |
| `grnRemarks` | String | maxlength 500 | |
| `products` | [GrnProduct] | — | Embedded lines (below). |
| `status` | Number | default `WellKnownGrnStatus.PENDING` | `1=PENDING, 2=APPROVED, 3=REJECTED, 4=CANCELLED`. |
| `createdBy` | ObjectId → `User` | | |
| `approvedBy` | ObjectId → `User` | default `null` | |
| `rejectedBy` | ObjectId → `User` | default `null` | |
| `approvedDate` | Date | default `null` | |
| `rejectedDate` | Date | default `null` | |
| `approvedRejectedRemarks` | String | maxlength 500 ("Reason cannot be more than 500 characters") | Shared by approve and reject. |
| `updatedBy` | ObjectId → `User` | | |
| `createdAt` / `updatedAt` | Date | auto | |

**Embedded `products[]` (each has its own `_id`):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | ObjectId → `InventoryProduct` | required ("Product is required") | |
| `enteredMeasureUnitId` | Number | required ("Unit is required") | Unit the quantity was entered in. |
| `actualMeasureUnitId` | Number | required ("Unit is required") | Product's own `measureUnit` at the time of entry. |
| `siConvertedQuantity` | Number | optional | Quantity converted to base unit; this is what is added to stock on approval. |
| `quantity` | Number | required ("Quantity is required") | Quantity as entered. |
| `remarks` | String | maxlength 500 | |

### 5.2 API Endpoints

Base path: `/inventory/grn` (`src/applicationRoutes.ts:164`, mounted at `src/mapping.ts:43`). "Ops roles" below = SUPERADMIN, ADMIN, FINANCEOFFICER, TRIPMANAGER.

| Method | Full path | Controller | Auth / Roles | Description |
|---|---|---|---|---|
| GET | `/inventory/grn/getNextGrnNumber` | `getNextGrnNumber` | any authenticated | Preview the next GRN number. |
| POST | `/inventory/grn/` | `saveGrn` | Ops roles | Create a pending GRN. |
| POST | `/inventory/grn/advanceSearch` | `grnAdvanceSearch` | Ops roles | Search GRNs by date range + status. |
| PUT | `/inventory/grn/:id` | `updatedGrn` | Ops roles | Edit a pending GRN. |
| PUT | `/inventory/grn/approve/:id` | `approveGrn` | SUPERADMIN, ADMIN | Approve and add stock. |
| PUT | `/inventory/grn/reject/:id` | `rejectGrn` | SUPERADMIN, ADMIN | Reject. |
| DELETE | `/inventory/grn/:id` | `cancelGrn` | SUPERADMIN, ADMIN | Cancel a pending GRN. |
| GET | `/inventory/grn/:id` | `getGrnById` | Ops roles (list contains SUPERADMIN/ADMIN twice) | Get one GRN (DTO). |

(Route definitions: `grn/grn.route.ts:9-56`. `getNextGrnNumber` is registered before `/:id`, so it is not shadowed.)

#### 5.2.1 GET `/inventory/grn/getNextGrnNumber` — `getNextGrnNumber` (`grn.controller.ts:367`)

**Logic:** `grnService.getNextGrnNumber()` (`grn.service.ts:6`): `GRN.findOne().sort({grnNumber:-1})` across **all** statuses (uses the `{grnNumber: -1}` index); returns `max + 1`, or `1` if there are no GRNs. Formats as `"GRN-" + n.toString().padStart(3,'0')`.

**Response:** `200 ''`, `data` = string, e.g. `"GRN-012"`. This is a preview only; nothing is reserved.

#### 5.2.2 POST `/inventory/grn/` — `saveGrn` (`grn.controller.ts:24`)

**Body** (Joi `grnSaveSchema`, `grn.validation.ts:3`):

| Field | Rule | Messages |
|---|---|---|
| `grnRemarks` | string, max 500, allows `null`/`''` | "GRN Remarks should not be more than 500 characters" / "GRN Remarks is invalid" |
| `products` | array of objects (the array itself is **not** marked required) | |
| `products[]._id` | string, **required** | "Id is required" / "Id is invalid" |
| `products[].productId` | string, required | "Product is required" / "Product is invalid" |
| `products[].enteredMeasureUnitId` | number, required | "Unit is required" / "Unit is invalid" |
| `products[].quantity` | number, required (no min; negatives/zero accepted) | "Quantity is required" / "Quantity is invalid" |
| `products[].remarks` | string, max 500, allows `null`/`''` | "Remarks should not be more than 500 characters" / "Remarks is invalid" |

**Logic:**
1. Joi validate → `400`.
2. Compute `nextGrnNumber` (as in 5.2.1) and `grnNumberWithPrefix`.
3. If `products.length > 0`: load all referenced ACTIVE products in **one query** with `productService.findAllByIdsAndStatusIn(productIds, [ACTIVE])` (§6.5: de-duplicated ids, `find({_id: {$in}, status: {$in}})`, returns a `Map` keyed by id string; an invalid ObjectId still gives a `CastError` → `404`). Then, for each line in order, look the product up in the map; not found → `404 "Selected product not found!"`. Build line:
   - `productId` = product `_id`
   - `enteredMeasureUnitId` = body value
   - `actualMeasureUnitId` = `product.measureUnit`
   - `siConvertedQuantity` = `helperUtil.fromMeasureUnitToSiMeasureUnit(enteredMeasureUnitId, quantity)` (formula in 5.3)
   - `quantity`, `remarks` = body values.
   The body `_id` is ignored.
   Else (`products` is empty) → `400 "Please add at least one product to proceed!"`. If `products` is omitted entirely, `products.length` throws a TypeError → `500`.
4. Transaction: create `GRN` with `grnNumber`, `grnNumberWithPrefix`, `grnDate = now`, `grnRemarks`, lines, `status = PENDING`, `createdBy`/`updatedBy = auth.id`. `grnService.save` clears all cache keys starting with `grn-`, then saves. Commit.

**Response:** `201 "Good Receipt Note saved successfully!"`, `data` = raw GRN document.

No stock is changed at this stage.

#### 5.2.3 PUT `/inventory/grn/:id` — `updatedGrn` (`grn.controller.ts:101`)

**Params:** `id`. **Body:** same `grnSaveSchema`.

**Logic:**
1. Joi validate → `400`.
2. `findByIdAndStatusIn(id, [PENDING])` → else `404 "Pending Good Receipt Note not found for update!"`.
3. Rebuild lines as in save (same single batched product query), but (see Gotchas) each line is built with `enteredMeasureUnitId: product.enteredUnitId` (a field that is not in the request schema → `undefined`) and **without `quantity`**. Missing product → `404 "Selected product not found!"`; empty array → `400 "Please add at least one product to proceed!"`.
4. Transaction: replace `grnRemarks`, `products`, `updatedBy`; save; commit.

**Expected outcome as coded:** because `enteredMeasureUnitId` and `quantity` are required by the Mongoose schema and are missing on every line, `save` throws a Mongoose `ValidationError`, which the error middleware returns as `400` with the first message (e.g. `"Unit is required"` or `"Quantity is required"`). On the unreachable success path the response would be `201 "Good Receipt Note updated successfully!"` with the raw GRN.

#### 5.2.4 PUT `/inventory/grn/approve/:id` — `approveGrn` (`grn.controller.ts:172`)

**Params:** `id`. **Body** (Joi `grnApproveRejectSchema`): `remark` – string, max 500, allows `null`/`''` (optional).

**Logic:**
1. Joi validate → `400`.
2. Load GRN with status `PENDING` → else `404 "Pending Good Receipt Note not found for approval!"`.
3. Transaction:
   1. Set `approvedBy = auth.id`, `approvedDate = now`, `updatedBy`, `approvedRejectedRemarks = remark`, `status = APPROVED`; save GRN (clears `grn-` cache).
   2. Preload the lines' products: `loadProduct = await productService.createBatchLoader(lineProductIds, [ACTIVE])` (one `$in` query, run after the GRN save and **not** bound to the session). For each GRN line (sequentially): `selectedProduct = await loadProduct(line.productId)`. The first request for an id returns the preloaded document; a repeated id (same product on two lines) falls back to a fresh `findByIdAndStatusIn` (see Gotchas). **If not found the line is silently skipped** (no stock added, no error). Otherwise:
      - `before = product.inventory`
      - `product.inventory = product.inventory + line.siConvertedQuantity`
      - `product.updatedBy = auth.id`
      - Base-unit code for the log: `helperUtil.getSiUnitCode(product.measureUnit)` (§6.3): the code of the `isSiUnit` unit in the same category (`g` or `ml`) if the product's unit `isSaveWithSiUnit`, otherwise the product unit's own code (`pc`, `box`, …).
      - Push log built by `inventoryUtil.buildInventoryLog({type: GRN_APPROVED (1), quantity: siConvertedQuantity, before, after: new inventory, productId: line.productId, userId: auth.id, message: 'Inventory updated: <qty><code> added for product "<name>" via approved GRN <GRN-xxx>.'})` (`inventoryLogDate` = now).
      - Save product (clears `product-` cache).
   3. Commit. Any error aborts everything (GRN status and stock changes).

**Response:** `201 "Good Receipt Note approved successfully!"`, `data` = raw GRN document.

#### 5.2.5 PUT `/inventory/grn/reject/:id` — `rejectGrn` (`grn.controller.ts:249`)

**Body:** `remark` (same schema as approve).

**Logic:** Joi → `400`; load PENDING GRN → else `404 "Pending Good Receipt Note not found for rejection!"`; transaction: `rejectedBy = auth.id`, `rejectedDate = now`, `updatedBy`, `approvedRejectedRemarks = remark`, `status = REJECTED`; save; commit. No stock change.

**Response:** `201 "Good Receipt Note rejected successfully!"`, `data` = raw GRN.

#### 5.2.6 DELETE `/inventory/grn/:id` — `cancelGrn` (`grn.controller.ts:297`)

**Logic:** load PENDING GRN → else `404 "Pending Good Receipt Note not found for cancel!"`; transaction: `updatedBy`, `status = CANCELLED`; save; commit. No body, no remark, no stock change. (Soft cancel, not a delete.)

**Response:** `201 "Good Receipt Note cancelled successfully!"`, `data` = raw GRN.

#### 5.2.7 GET `/inventory/grn/:id` — `getGrnById` (`grn.controller.ts:335`)

**Logic:** `grnService.findByIdAndStatusInWithData(id, [PENDING, APPROVED, REJECTED, CANCELLED])` – populates `products.productId` with the full `InventoryProduct` document. Not found → `404 "Good Receipt Note not found!"`. Mapped with `grnUtil.modelToGrnResponseDto`.

**Response:** `200 ''`, `data: GrnResponseDto`:

| Field | Source |
|---|---|
| `_id`, `grnNumberWithPrefix`, `grnDate`, `grnRemarks`, `approvedRejectedRemarks`, `status` | model |
| `products[]._id` | line `_id` |
| `products[].productName` | populated product name |
| `products[].productId` | populated product `_id` |
| `products[].quantity`, `remarks`, `enteredMeasureUnitId` | line |
| `products[].measureUnit` | full unit object for `enteredMeasureUnitId` (the interface declares it as `string`) |

If a line's product has been hard-removed (populate yields `null`), `product.productId.productName` throws → `500`.

#### 5.2.8 POST `/inventory/grn/advanceSearch` — `grnAdvanceSearch` (`grn.controller.ts:347`)

**Body** (Joi `advanceSearchSchema`):

| Field | Rule | Messages |
|---|---|---|
| `startDate` | date, required | "Start Date is required!" / "Start Date is invalid!" |
| `endDate` | date, required | "End Date is required" / "End Date is invalid" |
| `status` | number, required | "Status is required" / "Status is invalid" |

**Logic** (`grn.service.ts:30`):
1. Cache key `grn-` + `startDate` + `endDate` + `status`; return cached value if present.
2. Status filter: `status === -1` → `[PENDING, APPROVED, REJECTED]` (**CANCELLED is excluded from "all"**); otherwise `[status]`.
3. Date range: `sDate = new Date(startDate)` set to 00:00:00.000, `eDate = new Date(endDate)` set to 23:59:59.999 (server local time).
4. `GRN.find({grnDate: {$gte: sDate, $lte: eDate}, status: {$in: statuses}})`, populating `products.productId` (`productName`), `createdBy`, `approvedBy`, `rejectedBy` (`userName`), then `.lean()` (plain objects, not Mongoose documents). The `{grnDate: 1, status: 1}` index serves the filter. No sort, no pagination.
5. Cache result for `ONE_WEEK`. Cache is cleared by any `grnService.save`. Hits return the shared cached array (no clone, see 4.2.6); the DTO mapper only reads it.
6. Map with `grnUtil.modelsToGrnSearchResponseDtos`.

**Response:** `200 ''`, `data: GrnSearchResponseDto[]`:

| Field | Source |
|---|---|
| `_id`, `grnNumberWithPrefix`, `grnDate`, `grnRemarks`, `status`, `approvedRejectedRemarks` | model |
| `productsNames` | comma-joined populated product names (`", "`), `''` if no lines |
| `statusName` | `WellKnownGrnStatus` key name (`PENDING`, `APPROVED`, ...) |
| `createdBy` / `createdByName` | populated creator `_id` / `userName` |
| `approvedOrRejectedDate` | `approvedDate` if APPROVED, `rejectedDate` if REJECTED, else `null` |
| `approvedOrRejectedBy` / `...ByName` | `approvedBy` or `rejectedBy` `_id`/`userName` by the same rule, else `null` |

### 5.3 Business rules — GRN

**State machine (`WellKnownGrnStatus`):**

```
           approve (SUPERADMIN/ADMIN) ──► APPROVED (2)  [stock += siConvertedQuantity per line]
PENDING (1) ── reject (SUPERADMIN/ADMIN) ──► REJECTED (3)
           └─ cancel  (SUPERADMIN/ADMIN) ──► CANCELLED (4)
```
- Only `PENDING` GRNs can be updated, approved, rejected or cancelled. APPROVED/REJECTED/CANCELLED are terminal.
- There is no reversal of an approved GRN (stock cannot be "un-received" through this module).

**Numbering:** `grnNumber = max(existing grnNumber) + 1`; prefix `GRN-`, zero-padded to 3 digits.

**Stock formula on approval** (per line, product must be ACTIVE):
```
siConvertedQuantity = isSaveWithSiUnit(enteredUnit)
                        ? (isSiUnit(enteredUnit) ? quantity : quantity * conversionToSi(enteredUnit))
                        : quantity
product.inventory += siConvertedQuantity
```
Examples: 2 kg → 2000 (g); 1.5 l → 1500 (ml); 3 box → 3; unknown unit id → quantity unchanged. (Implemented by `helperUtil.fromMeasureUnitToSiMeasureUnit`, §6.3.)

---

## 6. Utilities & DTOs

### 6.1 `product.util.ts`

- `modelToProductResponseDto(product)` – builds `ProductResponseDto` (fields in 4.2.6). `inventory` is converted with `helperUtil.fromSiToMeasureUnit(product.measureUnit, product.inventory)` (`src/util/helper.util.ts:79`; the file's private copy was removed).
- `modelsToProductResponseDtos(products)` – maps an array.
- `fromSiToMeasureUnit(toUnitId, siQuantity)`:
  ```
  toUnit not found  → 0
  toUnit.isSiUnit   → siQuantity
  otherwise         → siQuantity / toUnit.conversionToSi
  ```
  e.g. product in kg with 2500 g stock → `2.5`; product in pieces → raw count.

### 6.2 `grn.util.ts`

- `modelToGrnSearchResponseDto(grn)` / `modelsToGrnSearchResponseDtos(grns)` – see 5.2.8. Requires `products.productId` and `createdBy` populated (a null `createdBy` would throw).
- `modelToGrnResponseDto(grn)` – see 5.2.7.

### 6.3 Shared helpers (`src/util/helper.util.ts`, `src/util/inventory.util.ts`)

The private copies that used to live in `grn.controller.ts`, `product.util.ts`, `pos.controller.ts` and `dashboard.util.ts` were removed; every caller now imports these.

`helper.util.ts`:
- `fromMeasureUnitToSiMeasureUnit(fromUnitId, quantity)` (`:15`) – formula in 5.3. No category check. Used by GRN save/update and POS.
- `fromMeasureUnitToOtherMeasureUnit(fromUnitId, toUnitId, quantity)` (`:33`) – throws `400 "Invalid Measure Unit Conversion!"` if categories differ; if both units have a truthy `conversionToSi`, returns `toSi(quantity) / toUnit.conversionToSi`; otherwise `quantity`. Used by POS totals.
- `fromSiMeasureUnitToOtherMeasureUnit(fromUnitId, toUnitId, siQuantity)` (`:55`) – category check as above; `toUnit.isSiUnit ? siQuantity : siQuantity / toUnit.conversionToSi`; 0 if either unit is missing. Used by `pos.utils.ts`.
- `fromSiToMeasureUnit(toUnitId, siQuantity)` (`:79`, new) – SI → unit **without** a category check (formula in 6.1). Used by `product.util.ts` and `dashboard.util.ts`.
- `getSiUnitCode(unitId)` (`:98`, new) – code of the unit stock is kept in: if the unit `isSaveWithSiUnit`, the code of the `isSiUnit` unit of the same category (or `""` if none), else the unit's own `code` (or `""`). Throws a `TypeError` (→ `500`) if `unitId` is not in the catalogue (same as the inline code it replaced). Used for log messages by GRN approval, POS and trip cancellation.

`inventory.util.ts` (new, untracked file):
- `buildInventoryLog({type, quantity, before, after, productId, userId, message})` (`:2`) – returns one `inventoryLogs` entry `{inventoryLogType: type, inventoryLogDate: new Date(), inventoryLogQuantity: quantity, beforeTransactionInventory: before, afterTransactionInventory: after, inventoryLogProductId: productId, inventoryLogCreatedBy: userId, message}`. Pure function, no DB access. Used by GRN approval, POS save/void/trip-end audit and trip cancellation.

### 6.4 DTO interfaces

- `ProductResponseDto` (`dto/productResponseDto.ts`) – see 4.2.6.
- `GrnResponseDto` + `GrnProductDto` (`dto/grnResponseDto.ts`) – see 5.2.7 (`GrnProductDto.enteredMeasureUnitId` is typed `string` but holds a number; `measureUnit` typed `string` but holds a unit object).
- `GrnSearchResponseDto` (`dto/grnSearchResponseDto.ts`) – see 5.2.8.

### 6.5 Product service functions (`product.service.ts`)

| Function | Behaviour |
|---|---|
| `save(product, session)` | Clears cache prefix `product-`, saves (with session if given). |
| `isShortCodeOrProductNameExists(shortCode, name, productId)` | Returns `{productDuplicate, shortCodeDuplicate}` (docs or null), excluding `productId` and DELETED. |
| `findByIdAndStatusIn(id, statuses)` | `findOne({_id, status: {$in}})`, no populate. |
| `findAllAndByStatusIn(statuses)` | Cached list without `inventoryLogs` (4.2.6). Returns the shared cached documents (read-only). |
| `findAllByIdsAndStatusIn(ids, statuses)` (`:84`, new) | Accepts strings, ObjectIds or populated docs (`String(id._id ?? id)`), drops `null`/`undefined`, de-duplicates, then one `find({_id: {$in}, status: {$in}})` (full documents, not lean, no session). Returns `Map<idString, product>`; an empty id list returns an empty map without querying. Used by GRN save/update and POS trip-end audit. |
| `createBatchLoader(ids, statuses)` (`:104`, new) | Preloads with `findAllByIdsAndStatusIn` and returns `async (id) => product`. Each preloaded document is handed out **once** (then deleted from the map); a second request for the same id falls back to `findByIdAndStatusIn(id, statuses)`, i.e. a fresh read outside any session. Used by GRN approval and trip cancellation. |
| `findProductsLogByProductId(productId)` | Returns sorted `inventoryLogs` array (desc). **Not used anywhere.** Would throw if product not found. |
| `findProductLogsByProductId(productId)` | Returns product doc with only `inventoryLogs`, creator populated. |

### 6.6 GRN service functions (`grn.service.ts`)

| Function | Behaviour |
|---|---|
| `getNextGrnNumber()` | `max(grnNumber)+1` or 1. |
| `save(grn, session)` | Clears cache prefix `grn-`, saves. |
| `findByIdAndStatusIn(id, statuses)` | Plain `findOne`. |
| `advanceSearch(startDate, endDate, status)` | Cached search (5.2.8). |
| `findByIdAndStatusInWithData(id, statuses)` | `findOne` populating `products.productId` (model `InventoryProduct`). |

---

## 7. Dependencies

**This module reads/writes:**
- `InventoryProduct`, `GRN` (own collections).
- `User` (populate only: `createdBy`, `updatedBy`, `approvedBy`, `rejectedBy`, `inventoryLogs.inventoryLogCreatedBy`).
- `Auth` (via auth middleware).
- In-memory node-cache (`src/util/cache.ts`, default TTL 300 s, overridden to one week here; `useClones: false`, so hits return shared objects). `clearCacheByPrefixs` now deletes all matching keys in one pass.

**Modules that depend on it:**
- `src/modules/pos/pos.controller.ts` – `productService.findByIdAndStatusIn` (issue, void), `findAllByIdsAndStatusIn` (trip-end audit) and `save`; mutates `inventory` and `inventoryLogs` (POS issue, void, trip-end return).
- `src/modules/trip/trip.controller.ts:24,461-512` – on trip cancellation, uses `productService.createBatchLoader` to return all active POS quantities to stock and writes `POS_TRANSACTION` logs.
- `src/modules/dashboard/dashboard.controller.ts:18` – `productService.findAllAndByStatusIn([ACTIVE])` for the inventory summary.
- `src/modules/pos/pos.model.ts` – refs `InventoryProduct`.

---

## 8. Notes / Gotchas

1. **GRN update is effectively broken** (`grn.controller.ts:126-131`): lines are built with `enteredMeasureUnitId: product.enteredUnitId` (wrong property name → `undefined`) and without `quantity`. Both are required in the schema, so every update fails with a `400` Mongoose validation error. Also, `siConvertedQuantity` is computed from `product.enteredMeasureUnitId`, which is inconsistent with the field actually stored.
2. **No unit-category check on GRN lines**: `fromMeasureUnitToSiMeasureUnit` does not compare the entered unit with the product's unit category. Entering `kg` for a product measured in `pc` adds `quantity × 1000` pieces. `actualMeasureUnitId` is stored but never used.
3. **Countable units are not convertible**: all category-1 units have `conversionToSi = 1`, so a "box" entered against a "piece" product adds 1 piece per box.
4. **Approval silently skips non-ACTIVE products** (`grn.controller.ts:206-207`): a GRN can become APPROVED while some lines add no stock (no error, no log).
5. **No quantity validation**: Joi allows zero/negative `quantity`; an approved GRN with a negative quantity reduces stock.
6. **GRN numbering race**: `max+1` with no unique index or atomic counter; concurrent saves can produce duplicate `grnNumber`. The number is computed before the transaction starts.
7. **Joi requires `products[]._id`** on save (`grn.validation.ts:10`) even though the server ignores it. Clients must send a dummy id for new lines. `products` itself is not required; omitting it causes a `500` (TypeError on `.length`).
8. **"All" status (-1) in advance search excludes CANCELLED** GRNs.
9. **Approve/reject/cancel/update return `201 CREATED`** instead of 200.
10. **Product update ignores `measureUnit`** (`product.controller.ts:124-129`) even though it is required in the body. This is probably on purpose, because changing the unit would make stored base-unit stock inconsistent, but the API does not say so.
11. **Regex injection in duplicate check** (`product.service.ts:24,30`): user input goes into `$regex` unescaped. Names with regex metacharacters (`(`, `+`, `.`, `*`) can give false duplicates or matches, or throw a Mongo regex error (`500`). Collation has no effect on `$regex`.
12. `getProductById` returns `200` with `data: null` when the product is not found; `getProductAuditLog` returns 200 with no `data` key and also returns logs for DELETED products.
13. **Wrong error message**: `deleteProductById` and `activeInactiveProduct` reuse the message "Product not found for update!".
14. **Product delete has no guard**: a product with stock, pending GRN lines or active POS lines can be deleted, and those later flows then fail with "product not found" or skip it.
15. **Stale GRN search cache**: cached search results hold populated product names and user names for a week. Product renames do not clear the `grn-` cache.
16. **Near-duplicate helpers** (mostly fixed): the per-file copies are gone and everything uses `helper.util.ts`. What remains: `fromSiToMeasureUnit` and `fromSiMeasureUnitToOtherMeasureUnit` do the same SI → unit conversion, one with and one without the category check. `findProductsLogByProductId` is still unused.
17. `getGrnById` role list repeats SUPERADMIN and ADMIN (`grn.route.ts:54`). This is harmless.
18. **Single-document transactions**: product save/update/toggle/delete and GRN save/reject/cancel open a transaction around a single document save. The transaction is only meaningful in `approveGrn`. Transactions require a replica-set Mongo deployment.
19. **Same product on two lines of one GRN loses stock on approval** (pre-existing, kept on purpose by `createBatchLoader`): the second line re-reads the product outside the session, so it sees the stock from before the transaction. Saving it sets `inventory = original + qty2`, dropping `qty1`, while both log entries are still appended (the second with a wrong `before`). Product reads in approval are not bound to the session at all. Nothing stops duplicate product lines on save.
20. **Cached values are shared objects** (`useClones: false` in `src/util/cache.ts`): `findAllAndByStatusIn` caches full Mongoose documents and `advanceSearch` caches lean GRNs, and every hit returns the same instances. Mutating them (or calling `.save()` on a cached product) would corrupt the cache for every later request. Current callers only read them.

---

## Changelog

### 2026-10-25 — synced with code changes in commit `50632dc` ("Code Ai Optimization revamp")
- Added the non-unique indexes `InventoryProduct {status: 1}`, `GRN {grnNumber: -1}` and `GRN {grnDate: 1, status: 1}`.
- GRN save/update now load all line products in one `$in` query (`productService.findAllByIdsAndStatusIn`). GRN approval uses `productService.createBatchLoader`. Both are new service functions (§6.5).
- GRN advance search now ends with `.lean()`. The cache (`useClones: false`) returns shared objects on every hit.
- The private unit-conversion copies were removed from `grn.controller.ts` and `product.util.ts`. Callers now use `helperUtil.fromMeasureUnitToSiMeasureUnit`, `fromSiToMeasureUnit` (new) and `getSiUnitCode` (new). Log entries are built by the new `src/util/inventory.util.ts` → `buildInventoryLog`.
- `updateProduct` no longer reads `measureUnit` from the body (behaviour unchanged). Controller line references were updated.
- Gotchas: #16 (duplicated helpers) is mostly resolved. Added #19 (duplicate product lines on GRN approval lose stock, pre-existing) and #20 (shared cached objects).
