# Core / Shared Code

This page covers everything outside `src/modules`: bootstrap, configuration, middleware, errors, utilities, enums, static data and build files. Back to the [index](README.md).

---

## 1. Bootstrap — `src/app.ts`

| Line | Behaviour |
|---|---|
| `:4` | `require('express-async-errors')` patches Express Router/Layer so rejected promises from async handlers and middleware go to the error handler. Every async controller and the async `authorize` middleware rely on this. |
| `:18` | `app` and `server` are imported from `src/config/soket.config.ts` (the local `express()` is commented out at `:19`). |
| `:21-25` | `cors({ origin: envConfig.CLIENT_URL })`. A single string origin. If `CLIENT_URL` is unset, the `cors` package treats a falsy origin as `*`. |
| `:26-27` | `express.json()` and `express.urlencoded({ extended: true })` with default limits (100 kb). |
| `:30-35` | Static `/uploads`. When `NODE_ENV === 'production'` it serves `/app/src/uploads` (hard-coded Docker path); otherwise `path.join(__dirname, 'uploads')`, which is `src/uploads` under ts-node. There is a stray `;;` at `:33`. |
| `:38-39` | `accessLogMiddleware`, `responseLogMiddleware`. These run after static, so `/uploads` hits are not logged. |
| `:43` | `app.use('/api/v1', mapping)` |
| `:46-48` | `app.use('*')` throws `NotFoundError("Can't find <url> on this server!")` |
| `:50` | `errorHandlerMiddleware` |
| `:52-63` | `start()`: `server.listen(port)`. In the callback it calls `connectDB()` (not awaited) and `runDBBackup()`. The surrounding `try/catch` cannot catch async errors from either. |

---

## 2. Configuration — `src/config/`

### 2.1 Environment — `environment.config.ts`

- `:5-8` selects the env file: `NODE_ENV === 'production'` → `path.resolve(__dirname, '../../.env.prod')`, otherwise `../../.env.dev`.
- `:9` `dotenv.config({ path })`. A missing file fails silently, and variables already in `process.env` win.
- `:11-18` exports `envConfig` = `{ PORT, MONGO_URL, JWT_SECRET, SALT_ROUNDS, BASE_URL, CLIENT_URL }`, all `string | undefined` and with no validation.

The path is relative to `__dirname`. Under ts-node this is `src/config` → project root, which is correct. In the compiled build it is `dist/src/config` → `dist/`, so a compiled app looks for `dist/.env.prod` or `dist/.env.dev`. In practice, compiled and Docker runs depend on real environment variables.

### 2.2 Database — `database.config.ts`

| Line | Behaviour |
|---|---|
| `:4` | `url = envConfig.MONGO_URL \|\| ''` |
| `:7` | `mongoose.set('strictQuery', true)`: unknown fields in query filters are dropped |
| `:9-16` | `mongoose.connect(url)` with **no options** (driver defaults: pool size 100, `serverSelectionTimeoutMS` 30 s, buffering on). Logs `MONGODB CONNECTED SUCCESSFULLY..!`. On failure it rethrows as `new Error(err)` inside `.catch`, which becomes an unhandled rejection because `connectDB()` is not awaited. On Node 20 that terminates the process. |

The DB connects only after the HTTP server is listening. Requests in that window are buffered by Mongoose (`bufferTimeoutMS` default 10 s).

### 2.3 DB backups — `dbBackups.config.ts`

| Symbol | Line | Behaviour |
|---|---|---|
| `execShellCommand(cmd)` | `:7-20` | Wraps `child_process.exec` in a Promise. Resolves with stdout, or stderr if stdout is empty (mongodump writes progress to stderr). On error it logs `Error executing command: ${cmd}`, which includes the full `MONGO_URL` with credentials, then rejects. |
| `cronJob(cronTime, cb)` (exported) | `:22-24` | Thin wrapper over `node-schedule.scheduleJob` |
| `performBackup()` | `:26-51` | Builds `./backups/mongo-backup-<ISO date with ':' → '-'>`, then runs `mongodump --uri="<MONGO_URL>" --out=<dir>`. |
| retention | `:36-47` | Lists `./backups` entries starting with `mongo-backup-` and sorts them by name (ISO dates sort chronologically). **Only when there are more than 7** does it delete all but the newest **3** (`rmSync recursive`). The comment says "keep only latest 3", so in practice the folder grows to 8 and is then trimmed to 3. |
| `runDBBackup()` (default) | `:54-59` | Schedules `'0 2 * * *'`, daily at 02:00 server local time (UTC in the Docker image unless `TZ` is set). |

Requirements: the `mongodump` binary on `PATH` (the Dockerfile installs it) and a writable `./backups` relative to CWD (`/app/backups` in Docker). The directory must exist, otherwise `readdirSync` throws (caught and logged). The repo tracks `backups/backup-test.ts` (empty), so the folder exists.

There is no restore helper. Restore manually with `mongorestore --uri=... <dir>`.

### 2.4 Socket.IO

File: `src/config/soket.config.ts` (sic).

| Line | Behaviour |
|---|---|
| `:7` | Creates the single Express `app` |
| `:9` | `server = http.createServer(app)` |
| `:11-16` | `new Server(server, { cors: { origin: [CLIENT_URL], methods: ['GET','POST'] } })`. If `CLIENT_URL` is unset the origin list is `[undefined]` and browser clients are rejected. |
| `:29` | `useSocketMap: any = {}`: in-memory map from the `userWithRoleId` key to a socket id |
| `:32-37` | On `connection`, reads `socket.handshake.query.userWithRoleId`. If it is present and not the string `'undefined'`, stores `useSocketMap[userWithRoleId] = socket.id`. |
| `:39-41` | On `disconnect`, `delete useSocketMap[userWithRoleId]` |
| `:18-26` | `getActiveSocketIdsByRoles(roles: number[]): string[]` returns socket ids whose key **starts with** any of the role ids as a string, so the client must build a key that begins with the role id. |

Exports: `app`, `io`, `server`, `getActiveSocketIdsByRoles`.

**Events emitted (server → client)**. The only emitter is `src/modules/expenseRequest/expenseRequest.controller.ts`, and every event targets roles SA, A, FO, TM:

| Event | When | Payload |
|---|---|---|
| `new-expense-request` | driver submits a request | `{ message, data: ExpensesExtensionResponseDto }` |
| `expense-request-approved` | approve | `{ message: '', data }` |
| `expense-request-rejected` | reject | `{ message, data }` |

There are no client → server events. The handshake is **not authenticated**: anyone can register under any `userWithRoleId`.

---

## 3. Middleware — `src/middleware/`

### 3.1 Auth — `auth.middleware.ts`

`authorize(rolesArray: any = [], isNoNeedAuth = false)` returns an async middleware. It is exported as `{ authorize }` and used as `authMiddleware.authorize([...])`.

Step by step:

1. `:17` turns a falsy `rolesArray` into `[]`.
2. `:21` if `isNoNeedAuth` → `next()` immediately (`req.auth` stays undefined). Used only by `GET /trip/tripForQrCode/:id`.
3. `:22-26` reads `req.headers.authorization`. If it is missing or does not start with `'Bearer '` → **401** `Authentication invalid!` (thrown).
4. `:28` `jwtUtil.extractToken` returns the part after the first space. An empty token → **401** `You're unauthorized to access this resource!` (`:72-78`).
5. `:33-44` `jwtUtil.verifyToken(token)` checks the HS256 signature and issuer `cybertronix.com`.
   - `TokenExpiredError` → **401** `Your session is expired!`
   - any other error (bad signature, wrong issuer, malformed) → **403** `You're unauthorized to access this resource!`
6. `:47` `authService.findById(payload.authId)` finds an `Auth` doc with `_id` and `status: ACTIVE`, populating `user role`. It is **cached for one week** under `auth-<authId>`, and the auth service clears all `auth-` keys whenever an auth record is saved. Since the cache no longer clones (§6.2), every request gets the same shared object; code that needs to modify and save the auth doc uses `authService.findByIdFresh` instead.
   - not found → **401** `Authentication invalid!`
   - `isBlocked` → **401** `Your account is blocked, Please contact admin!`
7. `:59-68` if `rolesArray.length` is non-zero and `!rolesArray.includes(payload.role)` → **403**. The role comes from the **token**, not the DB, so a role change only takes effect on the next login or refresh.
8. `:70` `req.auth = payload`, then `next()`.

`req.auth` shape (from `jwt.util.ts:9-14` plus JWT claims):

| Field | Meaning |
|---|---|
| `id` | User `_id` (`auth.user._id`) |
| `userName` | Login name |
| `role` | Numeric role id (`auth.role.id`) |
| `authId` | Auth document `_id` |
| `iat`, `exp`, `iss` | Standard JWT claims (`iss = 'cybertronix.com'`) |

### 3.2 Audit / access logging — `auditLog.middleware.ts`

This is console logging only; nothing is written to the DB. Persisted audit trails live in the common module's `auditLog.model.ts`.

- `:4-11` augments `Express.Request` with `auth?: any` and `correlationId: string`.
- `accessLogMiddleware` (`:12-29`):
  - `req.correlationId = req.headers['X-Correlation-ID'] || ''`. Node lower-cases header names, so this mixed-case lookup **never matches** and a new id is always generated.
  - `:16` the generated id is 20 random decimal digits.
  - Logs `INFO | Access Log | {correlationId, method, path, origin}`.
- `responseLogMiddleware` (`:32-55`):
  - Records `startTime` and monkey-patches `res.send`.
  - When `send` runs, logs `{correlationId, method, status, time: "<n> ms"}` as `ERROR` if status ≥ 400, otherwise `SUCCESS`.
  - `res.json` calls `res.send` once, so one line per response. A direct `res.send(object)` would log twice (send → json → send). Streams and static files are not logged.
  - The correlation id is not echoed back in a response header.

### 3.3 Error middleware

File: `src/middleware/error.middleware.ts`.

Signature `(err, req, res, next)`; registered last in `app.ts:50`.

1. `:14-18` defaults: `statusCode = err.statusCode || 500`, `message = err.message || 'Something went wrong!'`.
2. `:20-35` if the error is an `InternalServerError` or the status is 500, and `err.name !== 'ValidationError'`, it logs `ERROR | Internal Server Error | {correlationId, method, path, status, error: stack}`.
3. `:37-46` `err.name === 'ValidationError'` (Mongoose) → **400**, with the message set to the first entry of `Object.values(err.errors).message`.
4. `:48-54` `err.code === 11000` → **409**, `"<keys of err.keyValue> already exists! Please choose another value."`.
5. `:57-60` `err.name === 'CastError'` → **404**, `No item found with ID "<value>"!`.
6. `:62-68` `CommonResponse(res, false, status, message, null)`.

Notes:
- Raw `err.message` from unexpected errors (TypeError, Mongo errors) is returned to the client.
- `MulterError` has no `statusCode`, so it becomes a 500 (for example more than 10 files, or the wrong field name).
- `customError.data` is built but never used.
- Joi errors never reach here as `ValidationError`, because controllers call `schema.validate()` and throw `BadRequestError(error.message)` themselves.

---

## 4. Error classes — `src/error/`

All classes extend `CustomAPIError` (`CustomAPIError.ts:1-5`, a plain `Error` subclass) and set `statusCode` from `http-status-codes`.

| Class | File | Status |
|---|---|---|
| `CustomAPIError` | `CustomAPIError.ts` | (none → 500 in the handler) |
| `BadRequestError` | `BadRequestError.ts:8` | 400 |
| `UnauthorizedError` | `UnauthorizedError.ts:8` | 401 |
| `ForbiddenError` | `ForbiddenError.ts:8` | 403 |
| `NotFoundError` | `NotFoundError.ts:8` | 404 |
| `ConflictError` | `ConflictError.ts:8` | 409 (defined but **unused**) |
| `InternalServerError` | `InternalServerError.ts:8` | 500 (used only in `pos.controller.ts`) |

`name` is not overridden, so every instance has `name === 'Error'`. TS `target: es2022` emits real classes, so `instanceof` works.

---

## 5. Routing glue

### 5.1 `src/constant.ts`

| Key | Value |
|---|---|
| `API.PREFIX` | `/api/v1` |
| `USER.ROLES` | `SUPERADMIN 1, ADMIN 2, DRIVER 3, FINANCEOFFICER 4, TRIPMANAGER 5, DRIVERASSISTANT 6, TRIPASSISTANT 7` |
| `NUMBERPREFIX.GRN` | `GRN-` |
| `CACHE.PREFIX` | `gender-, role-, user-, vehicle-, trip-, companyWorkingInfo, garage-, auth-, product-, grn-, vehicleMaintenance-, leave-, monthlyExpenses-, expenseRequest-, expenses-, internalTrip-, tripSummary-, pos-` |
| `CACHE.DURATION` (seconds) | `ONE_DAY 86400, ONE_WEEK 604800, ONE_MONTH 2592000 (30 d), THREE_MONTHS 7776000, SIX_MONTHS 15552000, ONE_YEAR 31536000` |

`COMPANY_WORKING_INFO` has no trailing `-`, unlike the other prefixes. Prefix-based invalidation (`clearCacheByPrefixs`) is plain `startsWith`, so `trip-` does **not** match `tripSummary-` (good), but any future prefix that is a prefix of another would collide.

### 5.2 `src/applicationRoutes.ts`

A static object of path fragments per module (`base` plus named sub-paths). Routers import it so paths are defined in one place. The full method/role map is in [README § API route map](README.md#api-route-map). Keys defined but not routed anywhere: `leave.getAllUserLeave` (`:44`), `trip.undoTripStatus` (`:82`), `monthlyExpenses.activeInactiveGarage` (`:182`), and `inventory.base` (`:150`, unused because the sub-modules carry full bases). The file no longer imports `constant.ts` (line 1 is blank).

### 5.3 `src/mapping.ts`

Imports the 21 routers and mounts each at its `base` on a single `Router` (`:28-48`). Order does not matter because bases are distinct. The `vehicleMaintenance` router comes from `src/modules/vehicleMaintain/`.

---

## 6. Utilities — `src/util/`

### 6.1 `commonResponse.ts`

`CommonResponse(res, isSuccessful: boolean, statusCode: any, message: string, data: any)` → `res.status(statusCode).json({ isSuccessful, timeStamp: new Date().toISOString(), message, data })` (`:3-14`). It returns the Express response. This is the single envelope for both success and error responses.

### 6.2 `cache.ts` (node-cache)

Instance `new NodeCache({ stdTTL: 300, checkperiod: 120, useClones: false })` (`:8`). With `useClones: false`, `set` stores and `get` returns **the same object reference**; nothing is deep-cloned. The comment at `:3-7` gives the reason (cloning a Mongoose document on every hit, including the per-request auth lookup, was the main cost) and the rule that follows from it: cached values are shared between requests and must be treated as read-only. Code that mutates and saves a document must load it uncached:

| Fresh loader | Used by |
|---|---|
| `authService.findByIdFresh(id)` (`src/modules/auth/auth.service.ts:47`) | `auth.controller.ts:125` |
| `companyWorkingInfoService.getCompanyWorkingInfoFresh()` (`src/modules/common/service/companyWorkingInfo.service.ts:32`) | `monthAudit.controller.ts:41` |

| Function | Line | Behaviour |
|---|---|---|
| `setCache(key, data, ttl?)` | `:10-12` | `ttl \|\| 300` seconds. A `ttl` of 0 is treated as 300, so you cannot set "no expiry". |
| `getCache(key)` | `:14-16` | Returns the stored reference or `undefined` |
| `deleteCache(key)` | `:18-20` | |
| `clearCache()` | `:22-24` | `flushAll` |
| `clearCacheByPrefixs(prefixs: string)` | `:27-33` | Splits on `,`, then one pass over `cache.keys()` keeps keys that start with any prefix and deletes them with a single `cache.del(array)`. |
| `getCacheKeys()` | `:35-37` | |

The cache is per process with no cross-instance invalidation, so running more than one replica gives stale reads (including the auth/blocked check).

### 6.3 `jwt.util.ts`

| Function | Line | Behaviour |
|---|---|---|
| `generateToken(auth)` | `:6-22` | Payload `{ id: auth.user._id, userName: auth.userName, role: auth.role.id, authId: auth._id }`. `expiresIn` is 172800 s (**2 days**), issuer `cybertronix.com`, default algorithm HS256. Returns the string `"Bearer <jwt>"`, prefix included. Expects `auth` populated with `user` and `role`. |
| `extractToken(header)` | `:24-27` | `split(' ')[1] \|\| ''` |
| `verifyToken(token)` | `:29-33` | `jwt.verify` with issuer check; throws on failure |

Secret: `envConfig.JWT_SECRET || ''` (`:4`). An empty secret makes `sign` throw `secretOrPrivateKey must have a value`. There are no refresh tokens: `/auth/refreshAuth` re-issues a token while the current one is still valid.

### 6.4 `passwordHash.util.ts`

- `hashPassword(password)` → `bcrypt.genSalt(parseInt(SALT_ROUNDS || '10'))` then `bcrypt.hash` (`:4-7`). A non-numeric `SALT_ROUNDS` gives `NaN`, and bcryptjs then falls back to its default of 10.
- `comparePassword(password, hash)` → `bcrypt.compare` (`:9-11`).

`bcryptjs` is pure JS, so it is slower and blocks the event loop for each hash/compare.

### 6.5 `multer.util.ts` — file uploads

**Storage** (`:6-23`), `multer.diskStorage`:

- `destination`: reads `req.query.type` and checks `isValueInEnum(WellKnownUploadType, Number(type))`. If invalid → `cb(new BadRequestError('Invalid upload type'))` → 400. Otherwise the folder is `src/uploads/<EnumName>/`, **relative to the process CWD**. Multer does **not** create the folder when `destination` is a function, so a missing folder → `ENOENT` → 500. Only `MaintenanceInvoice/` exists in this working copy, and it is not tracked: git tracks only `src/uploads/uploadtest.ts`, because `.gitignore` excludes the per-type folders' contents. The Dockerfile copies `src/uploads` into the image, which therefore contains only the folders present in the build context.
- `filename` (`:20-22`): `` `${Date.now()}-${file.originalname}` ``. The original name is not sanitised.

**`upload = multer({ storage })`** (`:25`) sets **no `limits`** (file size or count) and **no `fileFilter`** (any MIME type or extension). The only cap is `upload.array('files', 10)` in the store route.

**Upload type → folder** (`WellKnownUploadType`):

| `type` | Folder |
|---|---|
| 1 | `ProfileImage` |
| 2 | `NICImage` |
| 3 | `GSCertificate` |
| 4 | `DrivingLicense` |
| 5 | `SLTDACertificate` |
| 6 | `PoliceReport` |
| 7 | `ExpensesRecept` (sic) |
| 8 | `VehicleDamage` |
| 9 | `MaintenanceInvoice` |

The store controller returns `` `${BASE_URL}/${path after 'src/'}` ``, i.e. `<BASE_URL>/uploads/<Folder>/<ts>-<name>`. That path is served publicly by the `/uploads` static route.

`upload` is the only export. The old `DeleteFileFromName` helper (and with it the `fs-extra` dependency) was removed, so nothing in the codebase deletes uploaded files.

### 6.6 `helper.util.ts`

| Function | Line | Behaviour / edge cases |
|---|---|---|
| `getNameFromEnum(enum, value)` | `:5-7` | `enum[value]`. For numeric TS enums this is the reverse lookup (`1` or `'1'` → `'ProfileImage'`). |
| `isValueInEnum(enum, value)` | `:10-12` | `Object.values(enum).includes(value)`. For numeric enums `Object.values` contains **both names and numbers**, so the name string (e.g. `'ACTIVE'`) also passes. Uses strict equality, so `'1'` does not match `1`. |
| `fromMeasureUnitToSiMeasureUnit(fromUnitId, qty)` | `:15-31` | If the unit has `isSaveWithSiUnit` (mass or volume): SI units return `qty`, others return `qty * conversionToSi`. Countable units or unknown ids return `qty` unchanged. |
| `fromMeasureUnitToOtherMeasureUnit(fromId, toId, qty)` | `:33-53` | Different `categoryId` → `BadRequestError('Invalid Measure Unit Conversion!')`. Otherwise `toSi(qty) / to.conversionToSi`. Two unknown ids (both categories `undefined`) do not throw and return `qty`. Countable units are a 1:1 conversion (pc ↔ box returns the same number). |
| `fromSiMeasureUnitToOtherMeasureUnit(fromId, toId, siQty)` | `:55-75` | Same category check. If both units exist: `siQty` when the target is SI, otherwise `siQty / to.conversionToSi`. Returns `0` if both ids are unknown. `fromId` is only used for the category check. |
| `fromSiToMeasureUnit(toUnitId, siQty)` | `:79-94` | SI quantity → quantity in `toUnitId`, **without** a category check: `siQty` if the target is an SI unit, otherwise `siQty / to.conversionToSi`. An unknown `toUnitId` returns `0`. Used to turn stored stock into the product's own unit in `product.util.ts:18` and `dashboard.util.ts:11`. |
| `getSiUnitCode(unitId)` | `:98-109` | Code of the unit stock is stored in: for `isSaveWithSiUnit` units, the code of the SI unit in the same category (`g` for mass, `ml` for volume); otherwise the unit's own code (e.g. `box`). No null guard: an unknown `unitId` throws `TypeError` (reading `isSaveWithSiUnit` of `undefined`). Used when writing inventory log messages in `grn.controller.ts`, `pos.controller.ts` and `trip.controller.ts`. |
| `consoleLogMessage(type, message?, data?)` | `:113-139` | `type ∈ info / error / warn / debug / success`. Prints `<ISO ts> \| LEVEL \| message \| JSON(data)` via the matching `console.*`; `success` uses `console.info`. `JSON.stringify` throws on circular data. |

### 6.7 `inventory.util.ts` (new)

`buildInventoryLog({ type, quantity, before, after, productId, userId, message })` (`:2-21`) returns one entry for a product's `inventoryLogs` array:

| Output field | From |
|---|---|
| `inventoryLogType` | `type` (a `WellKnownGrnLogType`) |
| `inventoryLogDate` | `new Date()` |
| `inventoryLogQuantity` | `quantity` |
| `beforeTransactionInventory` / `afterTransactionInventory` | `before` / `after` |
| `inventoryLogProductId` | `productId` |
| `inventoryLogCreatedBy` | `userId` |
| `message` | `message` |

It is a pure object builder (no DB access). Callers: `grn.controller.ts:215` (GRN approval), `pos.controller.ts:129, :221, :342` (`saveProductForPos`, `voidProductInPos`, `tripEndPosAudit`) and `trip.controller.ts:487` (`cancelTrip`). Each caller builds `message` itself, usually with `getSiUnitCode` for the unit.

`common.util.ts` (`generateUniqueId`) was deleted; it had no callers.

---

## 7. Enums — `src/util/enums/`

All are numeric TS enums stored as numbers in MongoDB.

| Enum | Values | Used for |
|---|---|---|
| `WellKnownStatus` | `ACTIVE 1, INACTIVE 2, DELETED 3` | Generic record status (soft delete = 3) |
| `WellKnownTripStatus` | `PENDING 1, CANCELED 2, START 3, FINISHED 4, REACHED 5` | Trip lifecycle (see [trip.md](trip.md)) |
| `WellKnownLeaveStatus` | `PENDING 1, APPROVED 2, REJECTED 3, CANCELLED 4` | Leave status. Also reused for expense-request status (`expenseRequest.controller.ts`) |
| `WellKnownGrnStatus` | `PENDING 1, APPROVED 2, REJECTED 3, CANCELLED 4` | GRN workflow |
| `WellKnownGrnLogType` | `GRN_APPROVED 1, POS_TRANSACTION 2, POS_TRANSACTION_RETURN 3` | Product stock-movement audit entries (grn, pos, trip controllers) |
| `WellKnownAuditLogType` | `MothEndAuditTrail 1` (sic), `UserAuditTrail 2`, `LeaveAuditTrail 3` | `common/model/auditLog.model.ts` |
| `WellKnownNotificationType` | `ExpenseExtensionRequest 1, VehicleInsuranceRenewal 2, VehicleLicenseRenewal 3, PendingTrip 4, PendingLeave 5` | Notification feed items (`notification.util.ts`) |
| `WellKnownUploadType` | `ProfileImage 1 … MaintenanceInvoice 9` (table in §6.5) | Upload folder selection |

---

## 8. Static data — `src/util/data/`

### 8.1 Menu data per role

File: `src/util/data/menudata.ts`.

Returned at login/refresh by `auth.controller.ts:67-87` (`filterModules`) as `modules` and `moduleIds`. Each entry has the shape `{ id, name, status: 1 }`. The front-end uses these for navigation; the server does not enforce them.

| Export | Role | Ids → names |
|---|---|---|
| `superAdminMenu` | 1 SA | 1 User Management, 2 SA Leave Mgmt, 3 Month Audit, 4 SA Dashboard, 5 SA Vehicle Tracking, 6 SA Vehicle Mgmt, 7 SA Trip Mgmt, 8 SA Report Mgmt, 9 SA Inventory Mgmt, 10 SA Product Mgmt, 11 SA Good Received Note, 12 SA Monthly Expenses Mgmt, 13 SA Master Configuration, 14 SA Garage Mgmt, 15 SA Vehicle Maintenance |
| `adminMenu` | 2 A | 30 Admin Leave Mgmt, 31 Vehicle Mgmt, 32 Trip Mgmt, 33 Report Mgmt, 34 Inventory Mgmt, 35 Product Mgmt, 36 Good Received Note, 37 Monthly Expenses Mgmt, 38 Dashboard, 39 Master Configuration, 40 Garage Mgmt, 41 Vehicle Maintenance |
| `driverMenu` | 3 D | 60 Driver Leave Mgmt, 61 Driver Trip Mgmt, 62 Recommended Garage |
| `financeOfficerMenu` | 4 FO | Admin ids 30, 33, 34, 36, 37, 38, 41. **Contains an array hole** (`menudata.ts:176`, a stray `,`), so the JSON has a `null` entry in `modules` and `moduleIds`. |
| `tripManagerMenu` | 5 TM | Admin ids 30, 31, 32, 33, 34, 36, 37, 39, 40, 41 (no 35 Product, no 38 Dashboard) |
| `driverAssistantMenu` | 6 DA | 150 Leave Mgmt, 151 Master Configuration, 152 Garage Mgmt, 153 Trip Mgmt, 154 Vehicle Maintenance |
| `tripAssistantMenu` | 7 TA | 100 Leave Mgmt, 101 Master Configuration, 102 Garage Mgmt, 103 Trip Mgmt, 104 Vehicle Maintenance |

The menus and route RBAC do not always line up. For example, FO gets the Dashboard menu (38) but the `/dashboard` routes allow only SA and A.

### 8.2 Banks — `bankdata.ts`

`banks`: 45 Sri Lankan banks and finance companies as `{ id, name }` (1 Bank of Ceylon … 45 Central Bank of Sri Lanka). It is **not imported anywhere** (the common data endpoint does not expose it). The entry for id 7 has a typo, `'Hongkong   Shanghai Bank'`.

### 8.3 Common data — `commonData.ts`

`vehicleTypes`: `1 Car, 2 Van, 3 Bus, 4 SUV`. Used by `GET /common/data?type=VehicleTypes` and by the vehicle module.

### 8.4 Measure units — `measureUnitData.ts`

`unitCategories`: `1 Countable Units (Quantity)`, `2 Mass Units (Weight)`, `3 Volume Units`.

`measureUnit` fields: `unitId, code, name, categoryId, conversionToSi, isSiUnit, isSaveWithSiUnit, isAllowDecimal`.

| Id | Code | Name | Cat | → SI | SI? | Save as SI | Decimal |
|---|---|---|---|---|---|---|---|
| 1–10 | pc, pkt, box, btl, can, roll, set, item, unit, bag | Piece…Bag | 1 | 1 | true | false | false |
| 11 | mg | Milligram | 2 | 0.001 | false | true | true |
| 12 | g | Gram | 2 | 1 | **true** | true | true |
| 13 | kg | Kilogram | 2 | 1000 | false | true | true |
| 14 | t | Tonne | 2 | 1 000 000 | false | true | true |
| 15 | ml | Milliliter | 3 | 1 | **true** | true | true |
| 16 | l | Liter | 3 | 1000 | false | true | true |
| 17 | cc | Cubic Centimeter | 3 | 1 | false | true | true |

The SI bases are **gram** for mass and **millilitre** for volume. Mass and volume quantities are stored in the SI base; countable units are stored as entered. Used by inventory (product, GRN), POS, trip and dashboard.

---

## 9. Other files

| File | Content |
|---|---|
| `src/uploads/uploadtest.ts` | Empty placeholder (0 lines), probably there to keep the folder in git. Listed in `.gitignore` but still tracked. |
| `backups/backup-test.ts` | Empty placeholder that keeps `backups/` in git. No longer compiled (`tsconfig.json` now has `include: ["src"]`). |
| `dbscripts/masterDataDBScript.js` | mongosh script. Drops `genders`, `companyInfo`, `companyWorkingInfos`. Inserts genders `{id:1 Male}`, `{id:2 Female}` and one `companyWorkingInfos` doc `{workingYear, workingMonth: getMonth()+1, workingDate: new Date(year, month, 1), status:1}`. Because JS months are 0-based, `workingDate` is the **1st of the following month**. `companyInfo` is dropped but never re-seeded. |
| `dbscripts/privilegeDataScript.js` | Drops `roles` and inserts roles `id 1–5` (Super Admin, Admin, Driver, Finance Officer, Trip Manager) with `modules: []`. A commented-out `modules` collection seed remains. **Roles 6 (Driver Assistant) and 7 (Trip Assistant) are not seeded.** |
| `dbscripts/note.txt` | How to run the scripts with mongosh `load()`. **Contains a plaintext MongoDB admin username and password and is committed to git.** |
| `tsconfig.json` | `target es2022` (Node 20 runs it natively, so async/await, spread and `?.` are no longer down-levelled), `useDefineForClassFields: false` (keeps the old constructor-assignment semantics for class fields), `module commonjs`, `outDir ./dist`, `rootDir "."`, `esModuleInterop`, `forceConsistentCasingInFileNames`, `strict`, `skipLibCheck`, `include ["src"]`, `exclude ["dist", "node_modules", "backups"]`. Output entry is always `dist/src/app.js`. `src/uploads/uploadtest.ts` is inside `include`, so it is compiled to an empty `dist/src/uploads/uploadtest.js`. |
| `eslint.config.mjs` | Flat config via `tseslint.config(...)`: ignores `dist`, `node_modules`, `backups`, `dbscripts`; `@eslint/js` recommended + `typescript-eslint` recommended; `.ts` files get ES2022 module parsing and Node globals; rules as in [README § Code style](README.md#code-style). |
| `.prettierrc` | `trailingComma es5, tabWidth 4, semi true, singleQuote true`. Prettier is not installed and not run by any script. |
| `Dockerfile`, `Jenkinsfile`, `.dockerignore` | See [README § Running, building, deploying](README.md#running-building-deploying) |

---

## 10. Notes / gotchas

### Security

1. **The upload endpoints are unauthenticated.** `POST /api/v1/store/upload` and `/uploadMultiple` have no `authorize` (`src/modules/store/store.route.ts`). Multer has no size limit and no type filter (`src/util/multer.util.ts:27`), and files are then served publicly from `/uploads`. Anyone can fill the disk or host arbitrary files, including HTML/SVG (stored XSS on the API origin).
2. **Uploaded files are publicly readable** (`src/app.ts:35`). This includes NIC images, driving licences and police reports.
3. **Leave approve/reject role check is a no-op.** `authorize(constants.USER.ROLES.SUPERADMIN)` passes a number, not an array (`src/modules/leave/leave.route.ts:51,57`). `(1).length` is `undefined`, so the role check is skipped and any authenticated user passes. Controllers may re-check; see [leave.md](leave.md).
4. **Socket.IO has no authentication.** A client chooses its own `userWithRoleId` (`src/config/soket.config.ts:33`), so anyone can register with a key starting with `1` and receive admin expense-request notifications. Multiple tabs for the same key overwrite each other, and the first tab's disconnect deletes the mapping for the others.
5. **Committed credential.** `dbscripts/note.txt` contains a plaintext MongoDB admin password in git history. Rotate it and remove the file from history.
6. **The backup command logs credentials.** On failure `execShellCommand` logs the whole `mongodump --uri="<MONGO_URL>"` command (`src/config/dbBackups.config.ts:11`). `MONGO_URL` is also interpolated into a shell string inside double quotes only, so `$`, backticks or `"` in the URI would break or alter the command.
7. **Raw error messages leak to clients** for 500s (`error.middleware.ts:16`).
8. Original upload filenames are used without sanitisation (`multer.util.ts:23`). `DeleteFileFromName` accepts `../` (unused today).
9. A JWT is valid for 2 days and is not revocable except by blocking the user. Blocking takes effect only if the `auth-` cache is cleared, and with multiple instances other replicas keep the old value for up to a week.
10. The role in the JWT is trusted; DB role changes are ignored until a new token is issued.
11. An empty or missing `JWT_SECRET` is not caught at startup. It only fails at the first login.

### Correctness / reliability

12. `connectDB()` is not awaited and rethrows inside `.catch` (`database.config.ts:14-16`, `app.ts:57`). A DB outage at boot becomes an unhandled rejection and the process exits. The server accepts traffic before the DB is ready.
13. **Env file path breaks in the compiled build.** `path.resolve(__dirname, '../../.env.*')` points to `dist/` after `tsc` (`environment.config.ts:7-8`). The Docker image excludes env files anyway, so set real env vars.
14. **Static uploads path depends on `NODE_ENV`.** If the Docker container does not set `NODE_ENV=production`, `/uploads` serves `dist/src/uploads` while multer writes to `src/uploads` (`app.ts:30-33` vs `multer.util.ts:11`), and uploaded files return 404.
15. Multer does not create the upload sub-folders. On a fresh clone only `src/uploads/MaintenanceInvoice/` exists, so other types fail with `ENOENT` (500) until the folders are created.
16. Backup retention trims only after there are more than 7 backups, then keeps 3 (`dbBackups.config.ts:40-41`), which does not match the comment. Backups are written inside the container unless a volume is mounted.
17. `X-Correlation-ID` is never honoured because Node lower-cases header keys (`auditLog.middleware.ts:13`).
18. `financeOfficerMenu` has an array hole that produces `null` in the login response (`menudata.ts:176`).
19. Roles 6 and 7 are referenced in code but never seeded (`dbscripts/privilegeDataScript.js`).
20. `masterDataDBScript.js` sets `workingDate` to the 1st of next month while `workingMonth` is the current month.
21. The FO menu includes Dashboard (38), but `/dashboard/*` routes allow only SA and A.
22. `isValueInEnum` accepts enum key names as well as values for numeric enums (`helper.util.ts:11`).
23. Measure unit conversions between countable units are 1:1 (box → pc is not multiplied), and unknown unit ids silently return the input quantity.
24. `MulterError` (too many files, unexpected field) surfaces as 500 instead of 400.
25. node-cache is in-process with `useClones: true`. It does not scale horizontally, and cloning large Mongoose documents costs CPU.

### Build / tooling

26. **`npm start` depends on an empty file.** `dist/src/app.js` exists only because `backups/backup-test.ts` widens tsc's inferred rootDir to the project root. Delete that file and the output moves to `dist/app.js`, breaking `npm start` and the Docker `CMD`. Set `rootDir`/`include` explicitly.
27. **`npm run lint` is broken.** ESLint 8.57 loads `eslint.config.mjs` as flat config, which rejects the legacy `env`, `extends` and `parser` keys and the `--ext` flag. `eslint-plugin-prettier`, `eslint-config-prettier` and `prettier` are not installed.
28. `npm run dev` uses `cross-env NODE_ENV=development&& nodemon …`, so `cross-env` never wraps nodemon. It is harmless only because `.env.dev` is the default.
29. These dependencies are unused: `class-validator`, `class-transformer`, `morgan`, `winston`, `@types/morgan`, and `@types/mongoose` (an obsolete stub for Mongoose 5). `ConflictError`, `generateUniqueId`, `DeleteFileFromName`, `banks` and `cronJob` (outside backups) are unused code.
30. `.env.exmple` (sic) is missing `CLIENT_URL`. Without it, HTTP CORS allows `*` but Socket.IO CORS rejects browsers.
31. The Dockerfile uses `npm install` (not `npm ci`), keeps dev dependencies in the image, uses the deprecated `apt-key`, and copies `backups/`, `Documents/` and existing `src/uploads` into the image (none of them are in `.dockerignore`).
32. The Jenkins pipeline has no lint, test or deploy stage. Its defaults are pinned to `release-1.0.0.9` / `1.0.0.9`, so bump them each release.
33. Misspelled names baked into identifiers and paths: `soket.config.ts`, `ExpensesRecept`, `MothEndAuditTrail`, `clearCacheByPrefixs`, `vehicleMonthlyPaymentMaintance`, `getDashboardstats`, `.env.exmple`. Renaming any of them is a breaking change for the API or for stored data (upload folder names are part of stored URLs).
