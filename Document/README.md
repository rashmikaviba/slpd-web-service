# SLPD Web Service — Developer Documentation

Backend REST + Socket.IO API for the SLPD tour/transport operations system: users & roles, leave, month-end audit, vehicles & maintenance, trips (with expenses, POS sales, summaries), inventory (products, GRN), garages, monthly expenses, notifications, dashboard and reports.

Stack: Node 20, Express 4, TypeScript 5 (CommonJS, target es2016), Mongoose 8 (MongoDB), Socket.IO 4, Joi validation, JWT auth, bcryptjs, node-cache, multer, node-schedule.

## Module index

| Module | Base path | Doc |
|---|---|---|
| Auth | `/api/v1/auth` | [auth.md](auth.md) |
| User | `/api/v1/user` | [user.md](user.md) |
| Common (genders, roles, static data, audit log, company working info) | `/api/v1/common` | [common.md](common.md) |
| Store (file uploads) | `/api/v1/store` | [store.md](store.md) |
| Leave | `/api/v1/leave` | [leave.md](leave.md) |
| Month Audit | `/api/v1/monthAudit` | [monthAudit.md](monthAudit.md) |
| Vehicle | `/api/v1/vehicle` | [vehicle.md](vehicle.md) |
| Vehicle Maintenance | `/api/v1/vehicleMaintenance` | [vehicleMaintenance.md](vehicleMaintenance.md) |
| Garage | `/api/v1/garage` | [garage.md](garage.md) |
| Trip | `/api/v1/trip` | [trip.md](trip.md) |
| Trip Summary | `/api/v1/tripSummary` | [tripSummary.md](tripSummary.md) |
| Internal Trip | `/api/v1/internalTrip` | [internalTrip.md](internalTrip.md) |
| Expenses (trip expenses, driver salary) | `/api/v1/expense` | [expenses.md](expenses.md) |
| Expense Request | `/api/v1/expenseRequest` | [expenseRequest.md](expenseRequest.md) |
| POS | `/api/v1/pos` | [pos.md](pos.md) |
| Inventory (Product, GRN) | `/api/v1/inventory/product`, `/api/v1/inventory/grn` | [inventory.md](inventory.md) |
| Monthly Expenses | `/api/v1/monthlyExpenses` | [monthlyExpenses.md](monthlyExpenses.md) |
| Notification | `/api/v1/notification` | [notification.md](notification.md) |
| Dashboard | `/api/v1/dashboard` | [dashboard.md](dashboard.md) |
| Report | `/api/v1/report` | [report.md](report.md) |

---

## Project layout

| Path | Purpose |
|---|---|
| `src/app.ts` | Entry point: middleware chain, static `/uploads`, route mount, 404, error handler, server start |
| `src/applicationRoutes.ts` | Single source of every route path string (base + sub-paths per module) |
| `src/mapping.ts` | Mounts each module router under its `applicationRoutes.<module>.base` |
| `src/constant.ts` | API prefix, role ids, GRN number prefix, cache key prefixes and durations |
| `src/config/` | env loading, MongoDB connect, Socket.IO server, scheduled DB backup |
| `src/middleware/` | `auth.middleware.ts` (JWT + roles), `error.middleware.ts`, `auditLog.middleware.ts` (access/response logging) |
| `src/error/` | Typed HTTP errors |
| `src/modules/<name>/` | Feature modules — `*.route.ts` → `*.controller.ts` → `*.service.ts` → `*.model.ts`; `*.validation.ts` (Joi), `*.util.ts` + `dto/` (response mapping) |
| `src/util/` | cache, response wrapper, JWT, password hashing, multer, helpers, enums, static data |
| `src/uploads/` | Uploaded files (one sub-folder per upload type) served at `/uploads` |
| `dbscripts/` | Mongo shell seed scripts (master data, privileges) — see [common.md](common.md) |
| `backups/` | `mongodump` output of the scheduled backup job |
| `Dockerfile`, `Jenkinsfile` | Container build and CI pipeline |

### Module file conventions

```
route  ──► authorize(roles) ──► (Joi validate in controller) ──► controller
                                                                    │
                                    service (Mongoose queries) ◄─────┤
                                    util / dto (response mapping) ◄──┤
                                    cache util (read/write/clear) ◄──┘
```

Controllers hold the business logic; services are thin query wrappers; utils/dtos shape responses. Errors are thrown (not passed to `next`) — `express-async-errors` forwards async throws to the error middleware.

---

## Runtime & configuration

### Environment (`src/config/environment.config.ts`)

Loads `.env.prod` when `NODE_ENV=production`, otherwise `.env.dev` (path relative to `src/config` → project root).

| Var | Used for |
|---|---|
| `PORT` | HTTP + Socket.IO port (fallback `5000`) |
| `MONGO_URL` | Mongoose connection and `mongodump` URI |
| `JWT_SECRET` | JWT sign/verify |
| `SALT_ROUNDS` | bcrypt salt rounds (fallback `10`) |
| `BASE_URL` | Prefix for returned upload URLs |
| `CLIENT_URL` | Allowed CORS origin for REST and Socket.IO |

### Scripts

| Script | Command |
|---|---|
| `npm run dev` | nodemon on `src/app.ts` (ignores `backups/`) |
| `npm run build` | `tsc` → `dist/` |
| `npm start` | `node dist/src/app.js` |
| `npm run lint` | eslint |

### Bootstrap order (`src/app.ts`)

1. `app` and `server` come from `config/soket.config.ts` (Express app wrapped in `http.createServer`, Socket.IO attached).
2. `cors({ origin: CLIENT_URL })`, `express.json()`, `express.urlencoded({ extended: true })`.
3. Static: `/uploads` → `/app/src/uploads` in production (Docker), else `src/uploads`.
4. `accessLogMiddleware`, `responseLogMiddleware`.
5. All routes under `/api/v1` (`constants.API.PREFIX`) via `mapping.ts`.
6. Catch-all `*` → throws `NotFoundError("Can't find <url> on this server!")`.
7. `errorHandlerMiddleware`.
8. `server.listen(PORT)` → then `connectDB()` and `runDBBackup()` (schedules the cron).

### Database (`config/database.config.ts`)

`mongoose.set('strictQuery', true)` then `mongoose.connect(MONGO_URL)`. A failed connection throws inside the `.catch` after the server is already listening.

### Scheduled backup (`config/dbBackups.config.ts`)

- Cron `0 2 * * *` (02:00 server time daily) via `node-schedule`.
- Runs `mongodump --uri=<MONGO_URL> --out=./backups/mongo-backup-<ISO date with ':'→'-'>` (requires `mongodb-database-tools`, installed in the Dockerfile).
- Retention: lists `./backups/mongo-backup-*` sorted; **only when there are more than 7**, deletes all but the newest 3.
- Errors are logged, never thrown.

---

## Response format

Every response (success and error) goes through `util/commonResponse.ts`:

```json
{ "isSuccessful": true, "timeStamp": "2026-11-18T10:00:00.000Z", "message": "…", "data": { } }
```

Errors return `isSuccessful: false`, `data: null`.

## Errors

| Class (`src/error/`) | HTTP |
|---|---|
| `BadRequestError` | 400 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `InternalServerError` | 500 |

All extend `CustomAPIError` (extends `Error`) and carry `statusCode`.

### Error middleware (`middleware/error.middleware.ts`)

1. Default: `err.statusCode` or 500, `err.message` or `"Something went wrong!"`.
2. 500s (except Mongoose `ValidationError`) are logged with correlationId, method, path, stack.
3. Mongoose `ValidationError` → 400, message = first field error.
4. Mongo duplicate key (`code 11000`) → 409, `"<field> already exists! Please choose another value."`.
5. Mongoose `CastError` (bad ObjectId) → 404, `No item found with ID "<value>"!`.

Joi validation errors are thrown by controllers as `BadRequestError` (see each module).

---

## Authentication & authorization

### Token (`util/jwt.util.ts`)

- `generateToken(auth)` signs `{ id: auth.user._id, userName, role: auth.role.id, authId: auth._id }`, expiry **2 days**, issuer `cybertronix.com`, returns the string **already prefixed** with `Bearer `.
- `extractToken(header)` → second token of `"Bearer <jwt>"`.
- `verifyToken` checks signature + issuer.

Passwords: `util/passwordHash.util.ts` — bcrypt `genSalt(SALT_ROUNDS)` + `hash`; `comparePassword`.

### `authorize(rolesArray = [], isNoNeedAuth = false)` (`middleware/auth.middleware.ts`)

Used on every protected route as `middleware.authorize([roles...])`.

1. `isNoNeedAuth` → skip everything.
2. Missing / non-`Bearer ` header → 401 `Authentication invalid!`.
3. Verify JWT: expired → 401 `Your session is expired!`; any other failure → 403 `You're unauthorized to access this resource!`.
4. Loads the auth record (`authService.findById(payload.authId)`): missing → 401 `Authentication invalid!`; `isBlocked` → 401 `Your account is blocked, Please contact admin!`. (So blocking a user takes effect immediately, not at token expiry.)
5. If `rolesArray` is non-empty and does not include `payload.role` → 403. Empty array = any authenticated user. **Must be an array** — passing a bare number (e.g. `authorize(SUPERADMIN)`) makes `rolesArray.length` undefined and silently skips the role check (this happens on leave approve/reject, see [leave.md](leave.md)).
6. Sets `req.auth = payload` (`{ id, userName, role, authId }`). Controllers use `req.auth.id` as the acting user id and `req.auth.role` for role-dependent behaviour.

### Roles (`constant.ts → USER.ROLES`)

| Id | Role |
|---|---|
| 1 | SUPERADMIN |
| 2 | ADMIN |
| 3 | DRIVER |
| 4 | FINANCEOFFICER |
| 5 | TRIPMANAGER |
| 6 | DRIVERASSISTANT |
| 7 | TRIPASSISTANT |

The frontend menu for each role is served from `util/data/menudata.ts` (`superAdminMenu`, `adminMenu`, `driverMenu`, `financeOfficerMenu`, `tripManagerMenu`, `tripAssistantMenu`, `driverAssistantMenu`) — see [auth.md](auth.md) / [common.md](common.md).

---

## Logging (`middleware/auditLog.middleware.ts`, `util/helper.util.ts`)

- `accessLogMiddleware`: sets `req.correlationId` from header `X-Correlation-ID` or a random 20-digit string; logs `INFO | Access Log | {correlationId, method, path, origin}`.
- `responseLogMiddleware`: wraps `res.send`; logs `SUCCESS` (status < 400) or `ERROR` with status and response time.
- `helperUtil.consoleLogMessage(type, message, data)` → `"<ISO> | <TYPE> | <message> | <json>"` to console. No file/remote log sink (winston is installed but unused).

An `AuditLog` model/service and `WellKnownAuditLogType` exist in the Common module, but **nothing calls them** — no business audit trail is written to Mongo today; month-end only logs to console. See [common.md](common.md).

---

## Caching (`util/cache.ts`)

In-process `node-cache` (default TTL 300 s, check period 120 s). **Per-instance** — running more than one replica gives stale reads between instances.

| Function | Behaviour |
|---|---|
| `setCache(key, data, ttl?)` | ttl seconds, default 300 |
| `getCache(key)` | value or `undefined` |
| `deleteCache(key)` | single key |
| `clearCache()` | flush all |
| `clearCacheByPrefixs("a-,b-")` | comma-separated prefixes; deletes every key starting with any |

Key prefixes and TTL presets are in `constant.ts → CACHE` (`gender-`, `role-`, `user-`, `vehicle-`, `trip-`, `companyWorkingInfo`, `garage-`, `auth-`, `product-`, `grn-`, `vehicleMaintenance-`, `leave-`, `monthlyExpenses-`, `expenseRequest-`, `expenses-`, `internalTrip-`, `tripSummary-`, `pos-`; durations ONE_DAY … ONE_YEAR). Each module doc lists the keys it reads, writes and invalidates.

---

## Real-time (Socket.IO, `config/soket.config.ts`)

- Same port as HTTP; CORS origin `CLIENT_URL`, methods GET/POST.
- On connection the client passes query `userWithRoleId`; the server stores `useSocketMap[userWithRoleId] = socket.id` and removes it on disconnect. One socket id per key (a second tab overwrites the first).
- `getActiveSocketIdsByRoles(roles: number[])` returns socket ids whose key **starts with** the role id string — i.e. the key format is role id first.
- Modules emit via `io.to(socketIds).emit(...)`. The full list of emits is in [notification.md](notification.md).

---

## File uploads (`util/multer.util.ts`)

- Disk storage; destination `src/uploads/<WellKnownUploadType name>/`, chosen by query `?type=<number>`; invalid type → 400 `Invalid upload type`.
- File name: `<Date.now()>-<originalname>`.
- `DeleteFileFromName(url)` removes the file for a stored URL (part after `/uploads`); returns `true/false`, never throws.
- Upload types: 1 ProfileImage, 2 NICImage, 3 GSCertificate, 4 DrivingLicense, 5 SLTDACertificate, 6 PoliceReport, 7 ExpensesRecept, 8 VehicleDamage, 9 MaintenanceInvoice.

Endpoints and URL construction: [store.md](store.md).

---

## Shared enums (`src/util/enums/`)

| Enum | Values |
|---|---|
| `WellKnownStatus` | 1 ACTIVE, 2 INACTIVE, 3 DELETED (soft delete everywhere) |
| `WellKnownTripStatus` | 1 PENDING, 2 CANCELED, 3 START, 4 FINISHED, 5 REACHED |
| `WellKnownLeaveStatus` | 1 PENDING, 2 APPROVED, 3 REJECTED, 4 CANCELLED |
| `WellKnownGrnStatus` | 1 PENDING, 2 APPROVED, 3 REJECTED, 4 CANCELLED |
| `WellKnownGrnLogType` | 1 GRN_APPROVED, 2 POS_TRANSACTION, 3 POS_TRANSACTION_RETURN |
| `WellKnownNotificationType` | 1 ExpenseExtensionRequest, 2 VehicleInsuranceRenewal, 3 VehicleLicenseRenewal, 4 PendingTrip, 5 PendingLeave |
| `WellKnownAuditLogType` | 1 MothEndAuditTrail, 2 UserAuditTrail, 3 LeaveAuditTrail |
| `WellKnownUploadType` | see File uploads |

## Shared helpers

- `helper.util.ts`
  - `getNameFromEnum(enum, value)`, `isValueInEnum(enum, value)`.
  - Measure-unit conversion over `util/data/measureUnitData.ts` (17 units in 3 categories: countable, mass [SI = g], volume [SI = ml]):
    - `fromMeasureUnitToSiMeasureUnit(unitId, qty)` — if the unit `isSaveWithSiUnit`: qty (SI unit) or `qty * conversionToSi`; otherwise qty unchanged.
    - `fromMeasureUnitToOtherMeasureUnit(from, to, qty)` — different category → 400 `Invalid Measure Unit Conversion!`; else SI(qty) / `to.conversionToSi`.
    - `fromSiMeasureUnitToOtherMeasureUnit(from, to, siQty)` — category check; `siQty` if target is SI, else `siQty / to.conversionToSi`.
- `common.util.ts` → `generateUniqueId(existingIds, prefix?)`: `[prefix-]<8 random base36>-<Date.now base36>`, regenerates until not in `existingIds`.

## Static data (`src/util/data/`)

`vehicleTypes` (Car, Van, Bus, SUV), `banks` (Sri Lankan banks list), `measureUnit` + `unitCategories`, role menus. Served by the Common module.

---

## Build & deploy

- **Dockerfile**: `node:20.19.4`, installs MongoDB database tools (for the backup job), `npm install`, `npm run build`, `EXPOSE 8080`, `npm start`. Uploads live at `/app/src/uploads` in the container — mount a volume there and on `/app/backups` to persist them.
- **Jenkinsfile**: parameters `BRANCH_NAME`, `IMAGE_TAG`; checkout → `docker build` `ghcr.io/<owner>/slpd-web-service:<tag>` → push to GHCR → remove local image.

---

## Known issues / notes (cross-cutting)

- `middleware/auditLog.middleware.ts:13` reads `req.headers['X-Correlation-ID']`; Node lower-cases header names, so a client-supplied id is never picked up — always random. Use `'x-correlation-id'`.
- `config/dbBackups.config.ts:35` comment says "keep only the latest 3", but cleanup only fires when there are **more than 7** backups (then trims to 3). Paths are relative to the process cwd.
- `config/database.config.ts`: DB connect runs after `listen`; a connection failure throws an unhandled rejection while the HTTP server keeps accepting requests.
- `util/cache.ts`: in-memory cache — not safe for multiple instances.
- `config/soket.config.ts`: one socket per `userWithRoleId`; multiple tabs/devices of the same user overwrite each other, so only the last connected receives events.
- `util/multer.util.ts`: multer does not create the destination folder when `destination` is a function; only `src/uploads/MaintenanceInvoice/` exists in the repo, other types fail with ENOENT until their folders are created.
- `Dockerfile` exposes 8080 while `.env.exmple` sets `PORT=9060`; `CLIENT_URL` is missing from `.env.exmple`.
- `package.json` `dev` script: `cross-env NODE_ENV=development&& nodemon …` — the `&&` means cross-env does not wrap nodemon (harmless because non-production already loads `.env.dev`).
- `winston` and `class-validator`/`class-transformer` are dependencies but unused; `src/uploads/uploadtest.ts` and `backups/backup-test.ts` are empty.
- `dbscripts/note.txt` contains a plaintext DB admin password — rotate it and remove it from the repo.
