# Common module

Master/reference data shared by the whole app: genders, roles, static lookup lists (vehicle types, measure units), the company "working month" (`CompanyWorkingInfo`) and an (unused) audit-log store. Also documents the Mongo seed scripts in `dbscripts/`. Generic plumbing is in [README.md](README.md).

## Files

| File | Responsibility |
|---|---|
| `src/modules/common/route/common.route.ts` | Routes (`CommonRouter`, mounted at `/api/v1/common`). |
| `src/modules/common/controller/common.controller.ts` | `GetAllGenders`, `GetAllRoles`, `GetDataByType`, `GetAllMeasureUnits`. |
| `src/modules/common/model/gender.model.ts` | `Gender` schema. |
| `src/modules/common/model/role.model.ts` | `Role` schema. |
| `src/modules/common/model/companyWorkingInfo.model.ts` | `CompanyWorkingInfo` schema (current accounting month). |
| `src/modules/common/model/auditLog.model.ts` | `AuditLog` schema. |
| `src/modules/common/service/common.service.ts` | Gender queries (cached). |
| `src/modules/common/service/role.service.ts` | Role queries (cached). |
| `src/modules/common/service/companyWorkingInfo.service.ts` | Active working info (cached) + save. |
| `src/modules/common/service/auditLog.service.ts` | AuditLog save/find. |
| `src/util/data/commonData.ts` | `vehicleTypes`. |
| `src/util/data/measureUnitData.ts` | `measureUnit`, `unitCategories`. |
| `src/util/data/bankdata.ts` | `banks` list (not imported anywhere). |
| `src/util/data/menudata.ts` | Role menus — used by login, see [auth.md](auth.md). |
| `dbscripts/masterDataDBScript.js`, `dbscripts/privilegeDataScript.js` | mongosh seed scripts. |

## Data model

All schemas: `timestamps: true`, `versionKey: false`, no indexes, no hooks/virtuals.

### `Gender` → collection `genders`

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | Number | required | Business id sent by clients (1 Male, 2 Female per seed). |
| `name` | String | required | |
| `status` | Number | required, default ACTIVE (1) | |

### `Role` → collection `roles`

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `id` | Number | required | Business id = `constants.USER.ROLES` value (1–7). Put into the JWT as `role`. |
| `name` | String | required | |
| `status` | Number | required, default ACTIVE | |

(The seed also writes a `modules: []` field that is not in the schema.)

### `CompanyWorkingInfo` → collection `companyworkinginfos`

The "open" accounting month. Exactly one ACTIVE row is expected; month-end ([monthAudit.md](monthAudit.md)) marks the current row DELETED and inserts the next.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `workingYear` | Number | required | |
| `workingMonth` | Number | required | 1-based month (1–12) as written by `createNewMonth`. |
| `workingDate` | Date | required | `new Date(year, month-1, 1)` (first day, server local time). |
| `status` | Number | required, default ACTIVE | DELETED (3) once closed. |
| `batchId` | Number | default 0 | Month-audit batch that closed this row. |
| `createdBy` / `updatedBy` | ObjectId | ref `User` | |

### `AuditLog` → collection `auditlogs`

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `auditType` | Number | required, enum `Object.values(WellKnownAuditLogType)` ("Invalid Audit Type") | 1 `MothEndAuditTrail`, 2 `UserAuditTrail`, 3 `LeaveAuditTrail`. Note: `Object.values` of a numeric TS enum also contains the names, so strings like `"UserAuditTrail"` also pass the enum check but fail Number casting. |
| `description` | String | — | |
| `object` | Object (Mixed) | — | Snapshot before. |
| `changedObject` | Object (Mixed) | — | Snapshot after. |
| `action` | Number | required | Free action code (no enum defined). |
| `status` | Number | default ACTIVE | |
| `createdBy` / `updatedBy` | ObjectId | ref `User` | |

**Nobody writes or reads audit logs**: `auditLogService` is not imported anywhere outside its own file. Month-end and leave changes only log to the console (`helperUtil.consoleLogMessage`). The product "audit log" endpoint reads inventory logs, not this collection.

## Endpoints

| Method | Path | Roles allowed | Validation | Handler |
|---|---|---|---|---|
| GET | `/api/v1/common/gender` | public (no middleware) | none | `GetAllGenders` |
| GET | `/api/v1/common/role` | public (no middleware) | none | `GetAllRoles` |
| GET | `/api/v1/common/data?type=` | any authenticated (`authorize([])`) | none | `GetDataByType` |
| GET | `/api/v1/common/measureUnits` | any authenticated (`authorize([])`) | none | `GetAllMeasureUnits` |

## Endpoint logic

### GET `/common/gender` — `GetAllGenders`
1. `commonService.findAllGendersByStatusIn([ACTIVE])` → cache key `gender-[1]` (TTL one week) or `Gender.find({ status: { $in: [1] } })`.

Response 200, `data` = raw Gender docs `[{ _id, id, name, status, createdAt, updatedAt }]`.

### GET `/common/role` — `GetAllRoles`
1. `roleService.findAllByStatusIn([ACTIVE])` → cache key `role-[1]` or `Role.find({ status: { $in: [1] } })`.

Response 200, raw Role docs.

### GET `/common/data` — `GetDataByType`
Query: `type`. Only `VehicleTypes` is recognised → `vehicleTypes` = `[{1,'Car'},{2,'Van'},{3,'Bus'},{4,'SUV'}]` (`{id,name}`). Any other/missing type → `[]`. Always 200.

### GET `/common/measureUnits` — `GetAllMeasureUnits`
1. Take `unitCategories` (`1 'Countable Units (Quantity)'`, `2 'Mass Units (Weight)'`, `3 'Volume Units'`).
2. For each, set `category.items = measureUnit.filter(u => u.categoryId === category.categoryId)` — mutates the imported module-level array in place.

Response 200: `[{ categoryId, categoryName, items: [{ unitId, code, name, isSaveWithSiUnit, isSiUnit, isAllowDecimal, categoryId, conversionToSi }] }]`.

Measure units (`measureUnitData.ts`): category 1 (no SI conversion, integer): 1 pc, 2 pkt, 3 box, 4 btl, 5 can, 6 roll, 7 set, 8 item, 9 unit, 10 bag. Category 2 (stored in grams): 11 mg ×0.001, 12 g ×1 (SI), 13 kg ×1000, 14 t ×1 000 000. Category 3 (stored in ml): 15 ml ×1 (SI), 16 l ×1000, 17 cc ×1 (flagged `isSiUnit: false`). Conversions are done by `helper.util.ts` (`fromMeasureUnitToSiMeasureUnit` etc., used by inventory).

## Service layer

### `common.service.ts`
| Function | Query |
|---|---|
| `findAllGendersByStatusIn(status[])` | key `gender-<JSON(status)>`, TTL 1 week; `Gender.find({ status: { $in } })`. Caches even an empty array (`if (data)` is always true for arrays). |
| `findGenderByCustomId(id)` | key `gender-<id>`; `Gender.findOne({ id, status: ACTIVE })`; caches if found. Used by user create/update. |

### `role.service.ts`
| Function | Query |
|---|---|
| `findAllByStatusIn(status[])` | key `role-<JSON(status)>`, TTL 1 week; `Role.find({ status: { $in } })`. |
| `findByIdAndStatus(id, status)` | key `role-<id><status>`; `Role.findOne({ _id: id, status })`. **Unused.** |
| `findByCustomId(id)` | key `role-<id>`; `Role.findOne({ id, status: ACTIVE })`. Used by user module (create/update/userByRole/getDriversForTrip) and dashboard. |
| `findIdsByCustomIds` | commented out (was used by the commented block in `auth.middleware.ts:69`). |

### `companyWorkingInfo.service.ts`
| Function | Query |
|---|---|
| `getCompanyWorkingInfo()` | key `companyWorkingInfo` (exact key; prefix has no dash), TTL `ONE_MONTH`. Miss → `CompanyWorkingInfo.findOne({ status: ACTIVE }).sort({ $natural: -1 }).populate('createdBy updatedBy')` (latest inserted active row); caches if found. Returns a cached **clone** on hit. |
| `save(doc, session)` | `deleteCache('companyWorkingInfo')`, then `doc.save({session})` / `doc.save()`. |

Callers of `getCompanyWorkingInfo`: login ([auth.md](auth.md)), [leave](leave.md) `getEligibleLeaves`, [monthAudit](monthAudit.md) (all 4 endpoints), `dashboard.controller.ts:290`, `vehicleMaintenance.controller.ts:35,128`.

### `auditLog.service.ts`
| Function | Query |
|---|---|
| `save(auditLog, session)` | `AuditLog.create(auditLog, { session })` or `AuditLog.create(auditLog)`. (With a session, Mongoose `create` expects an array of docs when passing options — a single object + options is the documented-incorrect form.) |
| `findAllByType(fromDate, toDate, auditType)` | `AuditLog.find({ createdAt: { $gte, $lte }, auditType })`. |

Both unused.

## Seed scripts (`dbscripts/`)

Run with `mongosh <db> <file>`. They are **destructive** (drop collections first). `dbscripts/note.txt` holds an environment-specific connection string — do not copy it into docs or commits.

### `masterDataDBScript.js`
1. Drops `genders`, `companyInfo`, `companyWorkingInfos`.
2. Inserts genders `{id:1, name:'Male', status:1}`, `{id:2, name:'Female', status:1}` with `createdAt/updatedAt = now`.
3. Inserts one working-info row into `companyWorkingInfos`: `workingYear = current year`, `workingMonth = current month (1-based)`, `workingDate = new Date(year, month, 1)`, `status: 1`.

### `privilegeDataScript.js`
1. Drops `roles`.
2. Inserts roles `{id, name, status:1, modules: []}`: 1 Super Admin, 2 Admin, 3 Driver, 4 Finance Officer, 5 Trip Manager.
3. A `modules` collection insert (Super Admin User/Leave/Month Audit/Report, Admin Leave, Driver Leave/Emergency) is fully commented out.

Neither script creates a user/auth; the first SUPERADMIN must be inserted manually.

## Business rules

- Clients send numeric `Gender.id` / `Role.id`; services resolve to ObjectIds.
- Role ids must match `constants.USER.ROLES`; authorization compares the JWT's numeric `role` against those constants, not against the DB.
- The current working month is the most recently inserted ACTIVE `CompanyWorkingInfo`; only month-end changes it.

## Cross-module dependencies

- Used by: [user](user.md) (role/gender lookup), [auth](auth.md) + auth middleware (working info, `roleService` import), [leave](leave.md), [monthAudit](monthAudit.md), dashboard, vehicleMaintenance.
- Cache: keys `gender-*`, `role-*`, `companyWorkingInfo`. All are also flushed by any `User` save and by month-audit save (they clear every prefix).
- No socket events.

## Known issues / notes

1. **Seed writes working info to the wrong collection**: Mongoose model `CompanyWorkingInfo` maps to `companyworkinginfos` (lower-case), the script uses `db.companyWorkingInfos` (`dbscripts/masterDataDBScript.js:7,31`). Collections are case-sensitive, so the app sees no working info after seeding.
2. Seed `workingDate = new Date(year, month, 1)` with 1-based `month` is the first day of the **next** month, inconsistent with `createNewMonth` (`new Date(year, month-1, 1)`) (`masterDataDBScript.js:29`).
3. Seed lacks roles 6 DRIVERASSISTANT and 7 TRIPASSISTANT although code/menus use them (`privilegeDataScript.js:8-50`). Creating users with those roles fails with `Valid Role is required!`.
4. `AuditLog` model/service and `WellKnownAuditLogType` are dead code; no audit trail is persisted (`common/service/auditLog.service.ts`).
5. `auditLogService.save` with a session calls `AuditLog.create(obj, { session })`; Mongoose requires an array when passing options (`auditLog.service.ts:5`).
6. `GET /common/gender` and `/common/role` are unauthenticated (`common.route.ts:14,16`).
7. `GetAllMeasureUnits` mutates the shared `unitCategories` constant (`common.controller.ts:42-44`).
8. `roleService.findByIdAndStatus` unused (`role.service.ts:20`); `bankdata.ts` unused.
9. Cache key collision risk: `role-<id>` (custom id) and `role-<ObjectId><status>` share a prefix — harmless today, but keys are unscoped strings.
10. `getCompanyWorkingInfo` returns a cached clone of a populated document that callers (`createNewMonth`) then `.save()` (`companyWorkingInfo.service.ts:9-10`).
