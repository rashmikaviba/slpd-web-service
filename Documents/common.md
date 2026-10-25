# Common Module

## 1. Overview

The Common module holds **shared master and reference data** and the company-wide **working period**:

- **Genders** and **Roles**: master lists seeded by DB scripts. Users reference them, and the front-end reads them for dropdowns.
- **CompanyWorkingInfo**: the "open" accounting month and year (`workingMonth`, `workingYear`, `workingDate`) that the business is currently operating in. Month Audit closes a month and opens the next. Login, leave and other modules read it to know the current period.
- **AuditLog**: a generic audit-trail collection. It is defined but currently unused.
- **Static lookups** served from code: vehicle types and measurement units (used by inventory and products).

All paths are relative to `/api/v1`.

## 2. Files

| File | Role |
|---|---|
| `src/modules/common/model/role.model.ts` | `Role` schema |
| `src/modules/common/model/gender.model.ts` | `Gender` schema |
| `src/modules/common/model/companyWorkingInfo.model.ts` | `CompanyWorkingInfo` schema |
| `src/modules/common/model/auditLog.model.ts` | `AuditLog` schema |
| `src/modules/common/route/common.route.ts` | Routes |
| `src/modules/common/controller/common.controller.ts` | `GetAllGenders`, `GetAllRoles`, `GetDataByType`, `GetAllMeasureUnits` |
| `src/modules/common/service/common.service.ts` | Gender queries (cached) |
| `src/modules/common/service/role.service.ts` | Role queries (cached) |
| `src/modules/common/service/companyWorkingInfo.service.ts` | Get the active working period (cached, read-only), get it fresh (uncached, for writes), save |
| `src/modules/common/service/auditLog.service.ts` | Audit log save and find (unused) |
| Shared data: `src/util/data/commonData.ts` | `vehicleTypes` |
| Shared data: `src/util/data/measureUnitData.ts` | `measureUnit`, `unitCategories` |
| Seeds: `dbscripts/masterDataDBScript.js`, `dbscripts/privilegeDataScript.js` | Insert genders, the working-info row and roles |

## 3. Data Models

All four schemas use `timestamps: true` and `versionKey: false`, and declare no hooks or virtuals.

**Indexes** (all non-unique, added to back the service filters):

| Model | Index | Declared at |
|---|---|---|
| `Role` | `{ id: 1 }` | `role.model.ts:27` |
| `Gender` | `{ id: 1 }` | `gender.model.ts:27` |
| `CompanyWorkingInfo` | `{ status: 1, createdAt: -1 }` | `companyWorkingInfo.model.ts:37` |
| `AuditLog` | none | |

The custom `id` fields are still **not unique** at the DB level.

### `Role` (collection `roles`)

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `id` | Number | **required** | Custom numeric id, matching `constants.USER.ROLES`. It overrides Mongoose's `id` virtual, so `role.id` is this number |
| `name` | String | **required** | |
| `status` | Number | **required**, default ACTIVE (1) | `WellKnownStatus` |

Seeded (`dbscripts/privilegeDataScript.js`): 1 Super Admin, 2 Admin, 3 Driver, 4 Finance Officer, 5 Trip Manager. **Roles 6 (Driver Assistant) and 7 (Trip Assistant) are not seeded**, even though they exist in `src/constant.ts`.

### `Gender` (collection `genders`)

| Field | Type | Required / Default |
|---|---|---|
| `id` | Number | **required** (custom id) |
| `name` | String | **required** |
| `status` | Number | **required**, default ACTIVE (1) |

Seeded (`dbscripts/masterDataDBScript.js`): 1 Male, 2 Female.

### `CompanyWorkingInfo` (collection `companyworkinginfos`)

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `workingYear` | Number | **required** | |
| `workingMonth` | Number | **required** | **1-based**, as written by Month Audit (`workingDate: new Date(year, month - 1, 1)`) |
| `workingDate` | Date | **required** | First day of the working month |
| `status` | Number | **required**, default ACTIVE (1) | The previous period is set to DELETED (3) when a new month opens |
| `batchId` | Number | default `0` | Month-audit batch that closed this period |
| `createdBy`, `updatedBy` | ObjectId → `User` | optional | |

Only one ACTIVE row is expected at a time. The getter takes the most recently inserted ACTIVE row.

### `AuditLog` (collection `auditlogs`)

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `auditType` | Number | **required**, enum `Object.values(WellKnownAuditLogType)` (message `Invalid Audit Type`) | 1 MothEndAuditTrail, 2 UserAuditTrail, 3 LeaveAuditTrail |
| `description` | String | optional | |
| `object` | Object (Mixed) | optional | Snapshot before |
| `changedObject` | Object (Mixed) | optional | Snapshot after |
| `action` | Number | **required** | No enum defined anywhere |
| `status` | Number | default ACTIVE (1) | |
| `createdBy`, `updatedBy` | ObjectId → `User` | optional | |

## 4. API Endpoints

Base path `/common` (`src/applicationRoutes.ts:3-9`, mounted in `src/mapping.ts:28`).

| Method | Full path | Controller | Auth | Description |
|---|---|---|---|---|
| GET | `/common/gender` | `GetAllGenders` | **public** (no middleware) | Active genders |
| GET | `/common/role` | `GetAllRoles` | **public** (no middleware) | Active roles |
| GET | `/common/data?type=` | `GetDataByType` | any authenticated (`authorize([])`) | Static lookup by type |
| GET | `/common/measureUnits` | `GetAllMeasureUnits` | any authenticated (`authorize([])`) | Measure-unit categories with their units |

All responses: `{ isSuccessful, timeStamp, message: '', data }`, status **200**. None of these endpoints throws its own errors. Errors can only come from auth (401/403) or the DB (500).

### 4.1 `GET /common/gender` (`common.controller.ts:11-17`)

`commonService.findAllGendersByStatusIn([ACTIVE])` runs `Gender.find({ status: { $in: [1] } })`, cached for one week under key `gender-[1]`.

**Response**: `data` is an array of raw Gender docs `{ _id, id, name, status, createdAt, updatedAt }`.

### 4.2 `GET /common/role` (`common.controller.ts:19-23`)

`roleService.findAllByStatusIn([ACTIVE])` runs `Role.find({ status: { $in: [1] } })`, cached for one week under key `role-[1]`.

**Response**: `data` is an array of raw Role docs.

### 4.3 `GET /common/data` (`common.controller.ts:25-36`)

**Query**: `type` (string).

| `type` | `data` |
|---|---|
| `VehicleTypes` | `[{id:1,name:'Car'},{id:2,name:'Van'},{id:3,name:'Bus'},{id:4,name:'SUV'}]` |
| anything else or missing | `[]` |

### 4.4 `GET /common/measureUnits` (`common.controller.ts:39-47`)

For each entry in `unitCategories`, it sets `category.items = measureUnit.filter(u => u.categoryId === category.categoryId)`, then returns the categories.

**Response**: `data` is

```jsonc
[
  { "categoryId": 1, "categoryName": "Countable Units (Quantity)", "items": [ /* unitIds 1–10: pc, pkt, box, btl, can, roll, set, item, unit, bag */ ] },
  { "categoryId": 2, "categoryName": "Mass Units (Weight)",        "items": [ /* 11 mg, 12 g (SI), 13 kg, 14 t */ ] },
  { "categoryId": 3, "categoryName": "Volume Units",               "items": [ /* 15 ml (SI), 16 l, 17 cc */ ] }
]
```

Each unit has the shape `{ unitId, code, name, isSaveWithSiUnit, isSiUnit, isAllowDecimal, categoryId, conversionToSi }`.

## 5. Business Rules & State Transitions

- **Working period**:
  - Both getters share the private `findLatestActive()` (`companyWorkingInfo.service.ts:6-13`): `CompanyWorkingInfo.findOne({ status: ACTIVE }).sort({ $natural: -1 }).populate('createdBy updatedBy')`, which is the last-inserted ACTIVE row. The result is a full Mongoose document (not lean).
  - `getCompanyWorkingInfo()` caches it under `companyWorkingInfo` for one month (`ONE_MONTH` = 2,592,000 s). The cache does not clone (`useClones: false`), so every caller gets the **same shared document** and must treat it as read-only.
  - `getCompanyWorkingInfoFresh()` runs the same query with no cache read or write. It is for code that modifies and saves the row.
  - Month Audit `createNewDate` (`monthAudit.controller.ts:34-159`) loads the row with `getCompanyWorkingInfoFresh()` (`:41`), changes it from ACTIVE to DELETED (setting `batchId`, `updatedBy`) and inserts a new ACTIVE row. Both go through `companyWorkingInfoService.save`, which deletes the cache key first.
- **Unit conversion** (consumers in `src/util/helper.util.ts`):
  - `toSI(q) = isSaveWithSiUnit ? (isSiUnit ? q : q * conversionToSi) : q`.
  - `fromUnit → toUnit` requires the same `categoryId`, otherwise **400** `Invalid Measure Unit Conversion!`. The formula is `toSI(q) / to.conversionToSi`.
  - New `fromSiToMeasureUnit(toUnitId, siQ)` (`helper.util.ts:79-94`): `isSiUnit ? siQ : siQ / conversionToSi`, with **no category check**; unknown `toUnitId` returns `0`.
  - New `getSiUnitCode(unitId)` (`helper.util.ts:98-109`): the code of the SI unit of the unit's category when `isSaveWithSiUnit`, otherwise the unit's own code.
- **Role and gender lookup by custom id**:
  - `findByCustomId` and `findGenderByCustomId` query `{ id, status: ACTIVE }` and cache the hit for one week (`role-<id>`, `gender-<id>`).
  - User creation and update use them to turn numeric ids into ObjectIds.

## 6. Utilities & Services

| Function | File:line | Behaviour |
|---|---|---|
| `commonService.findAllGendersByStatusIn(status[])` | `common.service.ts:7-19` | Cache key `gender-<JSON status>`. Caches any truthy result, **including `[]`** |
| `commonService.findGenderByCustomId(id)` | `:21-36` | One ACTIVE gender by custom id. Cached when found |
| `roleService.findAllByStatusIn(status[])` | `role.service.ts:6-18` | Cache key `role-<JSON status>`. Caches `[]` too |
| `roleService.findByIdAndStatus(_id, status)` | `:20-33` | Role by ObjectId and status. Cache key `role-<_id><status>`. **No callers** |
| `roleService.findByCustomId(id)` | `:35-47` | One ACTIVE role by numeric id. Cached when found |
| `companyWorkingInfoService.getCompanyWorkingInfo()` | `companyWorkingInfo.service.ts:16-29` | Cached one month, shared read-only document. See §5 |
| `companyWorkingInfoService.getCompanyWorkingInfoFresh()` | `:32-34` | Same query, never cached. For load-modify-save |
| `companyWorkingInfoService.save(doc, session)` | `:37-46` | Deletes the `companyWorkingInfo` cache key, then `doc.save({session})` |
| `auditLogService.save(auditLog, transaction)` | `auditLog.service.ts:3-9` | `AuditLog.create(auditLog, { session: transaction })`. ⚠️ In the installed Mongoose 8.5, `create(doc, opts)` with a non-array first argument treats `opts` as a **second document** and only logs a warning (`node_modules/mongoose/lib/model.js:2554-2565`). The session is not applied, and a bogus `{session}` doc would fail validation. **No callers** |
| `auditLogService.findAllByType(from, to, type)` | `:11-23` | `createdAt` in `[from, to]` and `auditType`. **No callers** |

There are no DTOs. Raw documents are returned.

## 7. Dependencies

**Uses**: `util/cache` (node-cache with `useClones: false`: cached values are shared references), `WellKnownStatus`, `WellKnownAuditLogType`, `util/data/commonData`, `util/data/measureUnitData`.

**Used by**
- `roleService.findByCustomId`: `user.controller` (create, update, by-role, drivers-for-trip). (The dashboard's driver-count use and the unused import in `auth.middleware.ts` were removed.)
- `commonService.findGenderByCustomId`: `user.controller` (create, update).
- `companyWorkingInfoService.getCompanyWorkingInfo`:
  - `auth.controller` (login response, in parallel with the auth lookup).
  - `leave.controller` (`getEligibleLeaves`).
  - `monthAudit.controller` (`getPendingLeaves`, `getWorkingInformation`, `getTripInfoForWorkingMonth`).
  - `dashboard.controller.ts:181` (read lazily, at most once per request, only when a month is not cached).
  - `vehicleMaintenance.controller.ts:35,128`.
- `companyWorkingInfoService.getCompanyWorkingInfoFresh`: `monthAudit.controller.ts:41` (`createNewDate`).
- `companyWorkingInfoService.save` and the `CompanyWorkingInfo` model: `monthAudit.controller`.
- `Role` and `Gender` collections: referenced by `User.role`, `User.gender` and `Auth.role`.
- `measureUnit` data: also used by `helper.util` conversion functions, including the new `fromSiToMeasureUnit` and `getSiUnitCode` (inventory, GRN, POS).

## 8. Notes / Gotchas

1. **`/common/gender` and `/common/role` are unauthenticated.** This is harmless reference data, but it is inconsistent with `/data` and `/measureUnits`, which require a login.
2. **`AuditLog` is dead code.** The model and service have no callers anywhere in `src`. `WellKnownAuditLogType` has the typo `MothEndAuditTrail`. The enum validator uses `Object.values` of a numeric TS enum, so the allowed values also include the **string names** (`'MothEndAuditTrail'`, …). Those cannot be stored in a `Number` field anyway. If it is ever wired up, `auditLogService.save` with a transaction must pass `[auditLog]` as an array (see §6).
3. **Empty results are cached**: `findAllGendersByStatusIn` and `findAllByStatusIn` check `if (data)`, and `[]` is truthy. If the lists are queried before seeding, an empty list is cached for a week, until a user save clears all prefixes.
4. **Cached values are shared references.** `util/cache` now runs with `useClones: false`, so the role, gender and working-info getters return the *same* Mongoose document (or array) to every caller. Nothing in the current code mutates them (Month Audit now loads the row with `getCompanyWorkingInfoFresh`), but any future caller that sets a field on a cached result changes it for all requests until the key is evicted. (The old issue of Month Audit mutating the cached document is fixed.)
5. `getCompanyWorkingInfo` relies on `$natural` (insertion) order rather than `createdAt` or `workingDate` to choose between multiple ACTIVE rows. The new `{ status: 1, createdAt: -1 }` index does not match that sort: a `$natural` sort is always a collection scan, so the index is not used by this query. Sorting by `createdAt: -1` would use it.
6. **Seed inconsistency**: `masterDataDBScript.js` stores `workingMonth = getMonth() + 1` (1-based) but `workingDate = new Date(year, month, 1)`, which is the first day of the **next** month. Month Audit instead uses `new Date(year, month - 1, 1)`. The seed also drops a `companyInfo` collection that no model uses.
7. `GetAllMeasureUnits` mutates the imported `unitCategories` module array, adding `items` on every call. The result is idempotent but it is shared mutable state.
8. `role.service.findByIdAndStatus` is unused. The commented-out `findIdsByCustomIds` body was removed, but a stray `// findIdsByCustomIds,` comment remains in the export (`role.service.ts:53`).
9. Roles 6 and 7 are not seeded (see §3), so `/common/role` will not list them, and users cannot be created with them unless the roles are inserted manually.
10. `helperUtil.getSiUnitCode(unitId)` reads `productMeasureUnit.isSaveWithSiUnit` without a null check, so an unknown `unitId` throws `TypeError` (500).

## Changelog

### 2026-10-25 — synced with code changes in commit `50632dc` ("Code Ai Optimization revamp")

- New non-unique indexes: `Role {id}`, `Gender {id}`, `CompanyWorkingInfo {status, createdAt: -1}`.
- `companyWorkingInfo.service`: query extracted to `findLatestActive`; new uncached `getCompanyWorkingInfoFresh()`, used by Month Audit `createNewDate` before it mutates and saves the row.
- `util/cache` now uses `useClones: false` (shared cached references); redundant `await` on `getCache` removed in the gender and role services.
- `role.service`: commented-out `findIdsByCustomIds` removed. Dashboard no longer calls `roleService.findByCustomId`; `auth.middleware` no longer imports `roleService`.
- `helper.util` gained `fromSiToMeasureUnit` and `getSiUnitCode` (measure-unit consumers).
- Gotchas: #4 rewritten (Month Audit mutation fixed; shared-reference caveat now applies to everything), #5 extended (index vs `$natural`), #8 adjusted, #10 added.
