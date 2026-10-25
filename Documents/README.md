# SLPD Web Service — Developer Documentation

Backend API for a **tour / transport company management system**. It covers tours (trips) with itineraries, hotels, activities and checklists; drivers and staff; vehicles with maintenance and garages; trip expenses, expense extension requests and monthly operating expenses; an inventory (products + Goods Received Notes) and a point-of-sale used on trips; staff leave; month-end audit; dashboards, reports and real-time notifications.

Stack: **Node.js 20 + Express 4 + TypeScript + Mongoose 8 (MongoDB) + Socket.IO 4**.

> These docs live in `Documents/`, which is git-ignored (`.gitignore`). Shared and infrastructure code is covered in depth in [core.md](core.md).

---

## Table of contents

| Doc | Covers |
|---|---|
| [core](core.md) | Config, middleware, errors, utils, enums, static data, uploads, cache, JWT, hashing, gotchas |
| [auth](auth.md) | Login, refresh, change/reset password, menu modules per role |
| [user](user.md) | User CRUD, block/unblock, users by role, drivers for a trip |
| [common](common.md) | Genders, roles, common lookup data, measure units, audit log, company working info |
| [store](store.md) | File upload endpoints |
| [leave](leave.md) | Leave apply/approve/reject/cancel, leave counts, eligibility |
| [monthAudit](monthAudit.md) | Month-end close, working month info, pending leaves/trips |
| [vehicle](vehicle.md) | Vehicle CRUD, activate/deactivate, by passenger count |
| [vehicleMaintenance](vehicleMaintenance.md) | Maintenance records and invoices (`src/modules/vehicleMaintain`) |
| [garage](garage.md) | Garage CRUD |
| [trip](trip.md) | Trips, assignment, status flow, checklist, places, print/QR |
| [tripSummary](tripSummary.md) | Per-trip summaries |
| [internalTrip](internalTrip.md) | Internal (non-customer) vehicle trips |
| [expenses](expenses.md) | Trip expenses, driver salary |
| [expenseRequest](expenseRequest.md) | Expense extension requests (with Socket.IO notifications) |
| [monthlyExpenses](monthlyExpenses.md) | Monthly operating expenses |
| [inventory](inventory.md) | Products and GRNs (`src/modules/inventory/{product,grn}`) |
| [pos](pos.md) | Point-of-sale on trips, voids, trip-end audit |
| [dashboard](dashboard.md) | Dashboard stats, inventory summary, income vs expense |
| [notification](notification.md) | Notification feed |
| [report](report.md) | Monthly trip / expense / salary / income / vehicle reports |

---

## Tech stack and dependencies

From `package.json`.

### Runtime dependencies

| Package | Used for | Used in code? |
|---|---|---|
| `express` ^4.19 | HTTP server / routing | yes |
| `express-async-errors` ^3.1 | Forwards rejected promises in async handlers to the error middleware (`src/app.ts:4`) | yes |
| `cors` ^2.8 | CORS restricted to `CLIENT_URL` | yes |
| `mongoose` ^8.5 | MongoDB ODM | yes |
| `socket.io` ^4.8 | Real-time push (expense-request events) | yes |
| `jsonwebtoken` ^9.0 | JWT sign/verify | yes |
| `bcryptjs` ^2.4 | Password hashing | yes |
| `joi` ^17.13 | Request body validation (`*.validation.ts` in modules) | yes |
| `multer` ^1.4.5-lts.1 | Multipart uploads to local disk | yes |
| `node-cache` ^5.1 | In-process cache used by services | yes |
| `node-schedule` ^2.1 | Cron for daily DB backup | yes |
| `dotenv` ^16.4 | Loads `.env.dev` / `.env.prod` | yes |
| `http-status-codes` ^2.3 | `StatusCodes` constants | yes |

Every runtime dependency is now imported somewhere. `package.json` also declares `"engines": { "node": ">=20" }` (npm only warns on a mismatch).

### Dev dependencies

`typescript` ^5.5, `ts-node`, `nodemon`, `cross-env`, `eslint` 8.57, `typescript-eslint` v7 (meta package; brings its own `@typescript-eslint/*` v7), `@eslint/js` 9.6, `globals`, and `@types/*` (`bcryptjs`, `cors`, `express`, `jsonwebtoken`, `multer`, `node`, `node-schedule`). There is no test framework.

---

## Folder structure

```
slpd-web-service/
├── src/
│   ├── app.ts                  # bootstrap: middleware, routes, 404, error handler, listen
│   ├── applicationRoutes.ts    # every route path string, grouped by module
│   ├── mapping.ts              # mounts each module router under its base path
│   ├── constant.ts             # API prefix, role ids, cache prefixes/durations, GRN prefix
│   ├── config/
│   │   ├── environment.config.ts   # dotenv loading -> envConfig
│   │   ├── database.config.ts      # mongoose.connect
│   │   ├── dbBackups.config.ts     # daily mongodump cron + retention
│   │   └── soket.config.ts         # Express app + http server + Socket.IO (sic "soket")
│   ├── middleware/             # auth (JWT + roles), audit/access logging, error handler
│   ├── error/                  # CustomAPIError + 6 HTTP error subclasses
│   ├── util/
│   │   ├── cache.ts, commonResponse.ts, helper.util.ts, inventory.util.ts
│   │   ├── jwt.util.ts, multer.util.ts, passwordHash.util.ts
│   │   ├── data/               # static data: menus per role, banks, vehicle types, measure units
│   │   └── enums/              # WellKnown* numeric enums
│   ├── uploads/                # uploaded files land here (sub-folder per upload type)
│   └── modules/<feature>/      # one folder per feature (see TOC)
├── dbscripts/                  # mongosh seed scripts (genders, working month, roles)
├── backups/                    # mongodump output (git-ignored except an empty backup-test.ts)
├── Dockerfile, .dockerignore, Jenkinsfile
├── tsconfig.json, eslint.config.mjs, .prettierrc
└── .env.exmple                 # (sic) env template
```

### Module layout convention

Each module under `src/modules/<name>/` typically has:

| File | Role |
|---|---|
| `<name>.route.ts` / `.router.ts` | Express `Router`; binds paths from `applicationRoutes` to `authorize(...)` + controller |
| `<name>.controller.ts` | Request handling: Joi validation, orchestration, `CommonResponse` |
| `<name>.validation.ts` | Joi schemas |
| `<name>.service.ts` | Mongoose queries, cache read/write/invalidation |
| `<name>.util.ts` | Model → response-DTO mapping |
| `<name>.model.ts` | Mongoose schema/model |
| `dto/*.ts` | Response DTO types |

---

## Request lifecycle

### Bootstrap order (`src/app.ts`)

1. `require('express-async-errors')` patches Express so thrown errors and rejected promises in async handlers reach the error middleware (`src/app.ts:4`).
2. Importing `environment.config` runs `dotenv.config()` (`src/config/environment.config.ts:9`).
3. The Express `app` and `http.Server` come from `src/config/soket.config.ts:7-9`, so Socket.IO and HTTP share one server (`src/app.ts:18`).
4. Middleware, in order:
   1. `cors({ origin: CLIENT_URL })` (`src/app.ts:21-25`)
   2. `express.json()` (default 100 kb limit) and `express.urlencoded({ extended: true })` (`:26-27`)
   3. `GET /uploads/*` static file serving, **unauthenticated** (`:30-35`)
   4. `accessLogMiddleware` (logs method/path/origin with a correlation id) (`:38`)
   5. `responseLogMiddleware` (wraps `res.send` to log status and latency) (`:39`)
   6. `app.use('/api/v1', mapping)` (all module routers) (`:43`)
   7. Catch-all `app.use('*')` throws `NotFoundError` (`:46-48`)
   8. `errorHandlerMiddleware` (`:50`)
5. `server.listen(PORT || 5000)`; **inside the listen callback** it calls `connectDB()` (not awaited) and `runDBBackup()` (schedules the 02:00 cron) (`:52-65`).

### Router mounting

`src/mapping.ts` creates one `Router` and mounts each module router at `applicationRoutes.<module>.base` (`src/mapping.ts:28-48`). The full base is `/api/v1` + module base, for example `/api/v1/trip`. Inventory sub-modules mount at `/inventory/product` and `/inventory/grn`.

### Per-request flow

```
Client
  │  Authorization: Bearer <jwt>
  ▼
cors → json/urlencoded → accessLog → responseLog
  ▼
/api/v1/<module> router
  ▼
authMiddleware.authorize(roles[, isNoNeedAuth])   ── 401/403 on failure
  │   sets req.auth = { id, userName, role, authId, iat, exp, iss }
  ▼
(multer upload.single/array — store module only)
  ▼
controller: Joi schema.validate(body) → throw BadRequestError(error.message)
  ▼
service: cache.getCache(prefix+key) → Mongoose query → cache.setCache / clearCacheByPrefixs
  ▼
util: model → DTO mapping
  ▼
CommonResponse(res, true, StatusCodes.OK|CREATED, message, data)
```

### Response envelope (`src/util/commonResponse.ts:3-14`)

Every success and every error response has the same JSON shape:

```json
{
  "isSuccessful": true,
  "timeStamp": "2026-10-25T08:00:00.000Z",
  "message": "Trip saved successfully!",
  "data": { }
}
```

On errors `isSuccessful` is `false` and `data` is `null`.

### Error handling flow

1. A controller, service or middleware throws one of the classes in `src/error/` (each carries `statusCode`), or a Mongoose / Mongo / runtime error is thrown.
2. `express-async-errors` forwards it to `errorHandlerMiddleware` (`src/middleware/error.middleware.ts`).
3. Mapping:

| Error | HTTP status | Message |
|---|---|---|
| Custom error (`BadRequestError`, etc.) | its `statusCode` | its message |
| Mongoose `ValidationError` | 400 | first field validation message |
| Mongo duplicate key (`code 11000`) | 409 | `<field> already exists! Please choose another value.` |
| Mongoose `CastError` (bad ObjectId) | 404 | `No item found with ID "<value>"!` |
| Anything else | 500 | `err.message` (raw) or `Something went wrong!` |

500s are logged with correlation id and stack. See [core.md § Error middleware](core.md#33-error-middleware).

---

## Roles and permissions

Roles are numeric ids defined in `src/constant.ts:6-16` and stored in the `roles` collection (`id` field). The JWT carries the role id; `authorize([...])` checks it per route.

| Id | Constant | Name | Abbrev. in route map |
|---|---|---|---|
| 1 | `SUPERADMIN` | Super Admin | SA |
| 2 | `ADMIN` | Admin | A |
| 3 | `DRIVER` | Driver | D |
| 4 | `FINANCEOFFICER` | Finance Officer | FO |
| 5 | `TRIPMANAGER` | Trip Manager | TM |
| 6 | `DRIVERASSISTANT` | Driver Assistant | DA |
| 7 | `TRIPASSISTANT` | Trip Assistant | TA |

How the model works:

- **Route-level RBAC**: `authorize([roleIds])`. An empty list or no argument means any authenticated, non-blocked user. `authorize([], true)` skips authentication completely. Routes without `authorize` are public.
- **UI menus**: at login/refresh the auth module returns a static menu list per role (`src/util/data/menudata.ts`) as `modules` and `moduleIds`, which the front-end uses to show or hide screens. These ids are not enforced on the server. See [core.md § Menu data](core.md#81-menu-data-per-role).
- **Data-level scoping**: some handlers filter by role, for example `GET /trip` returns trips by role. See the module docs.
- The `roles` collection documents have a `modules: []` array (seed script) that the code does not use for authorization.
- `dbscripts/privilegeDataScript.js` seeds only roles 1–5. Roles 6 and 7 are not seeded.

---

## API route map

Base prefix for all routes: **`/api/v1`**. Built from `src/applicationRoutes.ts` and each module's route file.

Access column: role abbreviations (see above). **Any auth** = `authorize()` / `authorize([])`. **Public** = no auth middleware. **No auth (flag)** = `authorize([], true)`.

### common — [common.md](common.md) · `src/modules/common/route/common.route.ts`

| Method | Path | Access |
|---|---|---|
| GET | `/common/gender` | Public |
| GET | `/common/role` | Public |
| GET | `/common/data?type=VehicleTypes…` | Any auth |
| GET | `/common/measureUnits` | Any auth |

### store — [store.md](store.md) · `src/modules/store/store.route.ts`

| Method | Path | Access |
|---|---|---|
| POST | `/store/upload?type=<UploadType>` (field `file`) | **Public** |
| POST | `/store/uploadMultiple?type=<UploadType>` (field `files`, max 10) | **Public** |

### auth — [auth.md](auth.md) · `src/modules/auth/auth.router.ts`

| Method | Path | Access |
|---|---|---|
| POST | `/auth/login` | Public |
| PUT | `/auth/resetPassword/:id` | SA |
| PUT | `/auth/changePassword` | Any auth |
| POST | `/auth/refreshAuth` | Any auth |

### user — [user.md](user.md) · `src/modules/user/user.router.ts`

| Method | Path | Access |
|---|---|---|
| GET | `/user/getDriversForTrip` | SA, A, TM |
| POST | `/user/` | SA |
| PUT | `/user/:id` | SA |
| PUT | `/user/block/:id` | SA |
| PUT | `/user/unblock/:id` | SA |
| GET | `/user/validateUser` | SA |
| GET | `/user/` | SA |
| GET | `/user/:id` | Any auth |
| DELETE | `/user/:id` | SA |
| GET | `/user/userByRole/:id` | SA, A, TM |

### leave — [leave.md](leave.md) · `src/modules/leave/leave.route.ts`

| Method | Path | Access |
|---|---|---|
| POST | `/leave/apply` | D, A, TM, FO |
| GET | `/leave/leaveCount` | Any auth |
| GET | `/leave/` | Any auth |
| GET | `/leave/:id` | Any auth |
| PUT | `/leave/approve/:id` | Intended SA; **effectively any auth** (see core.md gotchas) |
| PUT | `/leave/reject/:id` | Intended SA; **effectively any auth** |
| PUT | `/leave/cancel/:id` | Any auth |
| PUT | `/leave/update/:id` | Any auth |
| POST | `/leave/eligibleLeaves` | Any auth |
| — | `/leave/user` (`getAllUserLeave`) | Defined in `applicationRoutes` but **not routed** |

### monthAudit — [monthAudit.md](monthAudit.md) · `src/modules/monthAudit/monthAudit.route.ts`

| Method | Path | Access |
|---|---|---|
| POST | `/monthAudit/createNewMonth` | SA |
| GET | `/monthAudit/pendingLeaves` | SA |
| GET | `/monthAudit/workingInfo` | Any auth |
| GET | `/monthAudit/pendingTrip` | SA |

### vehicle — [vehicle.md](vehicle.md) · `src/modules/vehicle/vehicle.route.ts`

| Method | Path | Access |
|---|---|---|
| POST | `/vehicle/` | SA |
| PUT | `/vehicle/:id` | SA |
| GET | `/vehicle/:id` | Any auth |
| GET | `/vehicle/` | Any auth |
| DELETE | `/vehicle/:id` | SA |
| PUT | `/vehicle/activeInactive/:id` | SA |
| GET | `/vehicle/passengerCount/:count` | Any auth |

### trip — [trip.md](trip.md) · `src/modules/trip/trip.route.ts`

| Method | Path | Access |
|---|---|---|
| POST | `/trip/` | TM, SA, A, TA |
| PUT | `/trip/:id` | TM, SA, A, TA |
| DELETE | `/trip/:id` (cancel) | TM, SA, A, TA |
| GET | `/trip/:id` | Any auth |
| GET | `/trip/` | Any auth (results scoped by role) |
| PUT | `/trip/assignDriver/:id` | TM, SA, A |
| PUT | `/trip/checkList/:id` | D |
| GET | `/trip/checkList/:id` | Any auth |
| PUT | `/trip/updateHotelActivityPayment/:id` | TM, SA, A |
| PUT | `/trip/:id/status/:status` | TM, SA, A, D |
| GET | `/trip/places/:id` | Any auth |
| PUT | `/trip/:tripId/markAsReached/:placeId` | D |
| GET | `/trip/tripForPrint/:id` | Any auth |
| GET | `/trip/tripForQrCode/:id` | **No auth** (`authorize([], true)`) |
| GET | `/trip/hotelsAndActivities/:id` | Any auth |
| GET | `/trip/destinationSummary/:id` | Any auth |
| — | `/trip/:id/undoStatus/:status` | Defined but **not routed** |

### tripSummary — [tripSummary.md](tripSummary.md) · `src/modules/tripSummary/tripSummary.route.ts`

| Method | Path | Access |
|---|---|---|
| POST | `/tripSummary/` | TM, SA, A, FO, D |
| GET | `/tripSummary/trip/:tripId` | Any auth |
| GET | `/tripSummary/:id` | Any auth |
| PUT | `/tripSummary/:id` | TM, SA, A, FO, D |
| DELETE | `/tripSummary/:id` | TM, SA, A, FO, D |

### expenses — [expenses.md](expenses.md) · `src/modules/expenses/expenses.route.ts`

| Method | Path | Access |
|---|---|---|
| POST | `/expense/:tripId` | SA, A, TM, D |
| PUT | `/expense/:tripId/:expenseId` | SA, A, TM, D |
| DELETE | `/expense/:tripId/:expenseId` | SA, A, TM, D |
| GET | `/expense/:tripId` | Any auth |
| GET | `/expense/:tripId/:expenseId` | Any auth |
| POST | `/expense/saveSalary/:tripId` | SA, A, TM |

### expenseRequest — [expenseRequest.md](expenseRequest.md) · `src/modules/expenseRequest/expenseRequest.route.ts`

| Method | Path | Access |
|---|---|---|
| POST | `/expenseRequest/` | D |
| PUT | `/expenseRequest/approve/:id` | SA, A, TM, FO |
| PUT | `/expenseRequest/reject/:id` | SA, A, TM, FO |
| GET | `/expenseRequest/:id` | Any auth |

### notification — [notification.md](notification.md) · `src/modules/notification/notification.route.ts`

| Method | Path | Access |
|---|---|---|
| GET | `/notification/` | Any auth |

### report — [report.md](report.md) · `src/modules/report/report.route.ts`

| Method | Path | Access |
|---|---|---|
| GET | `/report/monthlyTripReport` | SA, A, TM, FO |
| GET | `/report/monthlyExpensesReport` | SA, A, FO, TM |
| GET | `/report/monthlyDriverSalary` | SA, A, FO, TM |
| GET | `/report/monthlyIncomeReport` | SA, A, FO, TM |
| POST | `/report/vehicleMonthlyPaymentMaintance` | SA, A, FO, TM |

### internalTrip — [internalTrip.md](internalTrip.md) · `src/modules/internalTrip/internalTrip.route.ts`

| Method | Path | Access |
|---|---|---|
| POST | `/internalTrip/` | SA, A, TM, FO |
| GET | `/internalTrip/:id` | SA, A, TM, FO |
| PUT | `/internalTrip/:id` | SA, A, TM, FO |
| DELETE | `/internalTrip/:id` | SA, A, TM, FO |
| GET | `/internalTrip/getByVehicle/:id` | SA, A, TM, FO |

### inventory — [inventory.md](inventory.md)

Product (`src/modules/inventory/product/product.route.ts`):

| Method | Path | Access |
|---|---|---|
| POST | `/inventory/product/` | SA, A |
| PUT | `/inventory/product/:id` | SA, A |
| PUT | `/inventory/product/activeInactive/:id` | SA, A |
| GET | `/inventory/product/:id` | Any auth |
| DELETE | `/inventory/product/:id` | SA, A |
| GET | `/inventory/product/` | Any auth |
| GET | `/inventory/product/productAuditLog/:id` | Any auth |

GRN (`src/modules/inventory/grn/grn.route.ts`):

| Method | Path | Access |
|---|---|---|
| GET | `/inventory/grn/getNextGrnNumber` | Any auth |
| POST | `/inventory/grn/` | SA, A, FO, TM |
| POST | `/inventory/grn/advanceSearch` | SA, A, FO, TM |
| PUT | `/inventory/grn/:id` | SA, A, FO, TM |
| PUT | `/inventory/grn/approve/:id` | SA, A |
| PUT | `/inventory/grn/reject/:id` | SA, A |
| DELETE | `/inventory/grn/:id` (cancel) | SA, A |
| GET | `/inventory/grn/:id` | SA, A, FO, TM |

### monthlyExpenses — [monthlyExpenses.md](monthlyExpenses.md) · `src/modules/monthlyExpenses/monthlyExpenses.route.ts`

| Method | Path | Access |
|---|---|---|
| POST | `/monthlyExpenses/advanceSearch` | SA, A, TM, FO |
| POST | `/monthlyExpenses/save/:id` | SA, A, TM, FO |
| GET | `/monthlyExpenses/:id` | SA, A, TM, FO |
| PUT | `/monthlyExpenses/update/:id/expense/:expenseId` | SA, A, TM, FO |
| DELETE | `/monthlyExpenses/delete/:id/expense/:expenseId` | SA, A, TM, FO |
| — | `/monthlyExpenses/activeInactiveGarage/:id` | Defined but **not routed** (copy-paste key) |

### pos — [pos.md](pos.md) · `src/modules/pos/pos.route.ts`

| Method | Path | Access |
|---|---|---|
| POST | `/pos/savePosProduct/:tripId` | SA, A, TM, FO |
| DELETE | `/pos/voidPosProduct/:id/trip/:tripId` | SA, A, TM, FO |
| PUT | `/pos/tripEndAudit` | SA, A, TM, FO |
| GET | `/pos/getPosByTrip/:tripId` | SA, A, TM, FO |

### garage — [garage.md](garage.md) · `src/modules/garage/garage.route.ts`

| Method | Path | Access |
|---|---|---|
| POST | `/garage/` | SA, A, TM, DA |
| GET | `/garage/` | Any auth |
| GET | `/garage/:id` | Any auth |
| PUT | `/garage/:id` | SA, A, TM, DA |
| DELETE | `/garage/:id` | SA, A, TM, DA |
| PUT | `/garage/activeInactiveGarage/:id` | SA, A, TM, DA |

### dashboard — [dashboard.md](dashboard.md) · `src/modules/dashboard/dashboard.route.ts`

| Method | Path | Access |
|---|---|---|
| GET | `/dashboard/inventorySummary` | SA, A |
| GET | `/dashboard/getDashboardstats` | SA, A |
| GET | `/dashboard/monthlyIncomeExpense` | SA, A |

### vehicleMaintenance — [vehicleMaintenance.md](vehicleMaintenance.md) · `src/modules/vehicleMaintain/vehicleMaintenance.route.ts`

`ACCESS_ROLES` = A, SA, TM, FO, DA, TA (`vehicleMaintenance.route.ts:10`).

| Method | Path | Access |
|---|---|---|
| POST | `/vehicleMaintenance/` | ACCESS_ROLES |
| PUT | `/vehicleMaintenance/:id` | ACCESS_ROLES |
| DELETE | `/vehicleMaintenance/:id` | ACCESS_ROLES |
| GET | `/vehicleMaintenance/:id` | Any auth |
| GET | `/vehicleMaintenance/` | Any auth |
| GET | `/vehicleMaintenance/maintainInvoice/:id` | Any auth |

### Non-API routes

| Method | Path | Notes |
|---|---|---|
| GET | `/uploads/<Folder>/<file>` | Static, unauthenticated (`src/app.ts:35`) |
| WS | `/socket.io/` | Socket.IO handshake; see [core.md § Socket](core.md#24-socketio) |
| * | anything else | 404 via `NotFoundError` |

---

## Environment variables

Loaded by `src/config/environment.config.ts`: `.env.prod` when `NODE_ENV=production`, otherwise `.env.dev`. Values are not documented here; `.env.exmple` (sic) is the template.

| Variable | In `.env.exmple` | Purpose | Default if unset |
|---|---|---|---|
| `PORT` | yes | HTTP + Socket.IO listen port | `5000` (`src/app.ts:53`) |
| `BASE_URL` | yes | Public base URL used to build uploaded-file URLs returned by `/store/*` | none (URLs become `undefined/uploads/...`) |
| `MONGO_URL` | yes | MongoDB connection URI; also passed to `mongodump` for backups | `''` (connect fails) |
| `JWT_SECRET` | yes | HMAC secret for signing and verifying JWTs | `''` (jsonwebtoken throws on sign) |
| `SALT_ROUNDS` | yes | bcrypt cost factor | `10` |
| `CLIENT_URL` | **no** (missing from template) | Allowed CORS origin for HTTP and Socket.IO | HTTP CORS falls back to `*` |
| `NODE_ENV` | n/a (process env) | `production` selects `.env.prod` and the `/app/src/uploads` static path | development behaviour |

---

## Running, building, deploying

### Scripts (`package.json:6-14`)

| Script | Command | Notes |
|---|---|---|
| `npm run dev` | `cross-env NODE_ENV=development nodemon --ignore backups/ --ignore node_modules/ src/app.ts` | nodemon runs `.ts` via ts-node; `cross-env` now really sets `NODE_ENV` for nodemon. |
| `npm run build` | `tsc` (after `prebuild`) | `prebuild` deletes `dist/` first (`fs.rmSync`, so stale output from deleted files does not linger). `tsconfig.json` sets `rootDir: "."` and `include: ["src"]`, so the entry is always `dist/src/app.js`. |
| `npm run typecheck` | `tsc --noEmit` | Type-check only; currently passes with 0 errors. |
| `npm start` | `node dist/src/app.js` | |
| `npm run lint` | `eslint .` | Flat config now loads and runs, but reports errors (mostly `prefer-const`) and exits non-zero; see core.md gotchas |
| `npm test` | placeholder that exits 1 | No tests |

### Local setup

1. Install MongoDB plus the MongoDB Database Tools (`mongodump` is needed for the backup cron).
2. Seed reference data with mongosh (`dbscripts/note.txt`):
   ```
   mongosh
   use slpd_db
   load("<repo>/dbscripts/masterDataDBScript.js")   // genders + current working month
   load("<repo>/dbscripts/privilegeDataScript.js")  // roles 1–5
   ```
   Both scripts **drop** their collections first. No seed creates a first user/auth record; create the first Super Admin manually.
3. Create `.env.dev` with the variables above, then run `npm run dev`.

### Docker (`Dockerfile`)

Two-stage build on `node:20.19.4-slim`:

| Stage | Steps |
|---|---|
| `build` (`Dockerfile:2-11`) | `WORKDIR /app` → `COPY package*.json` → `npm ci` (with dev deps) → `COPY tsconfig.json` + `COPY src` → `npm run build` |
| runtime (`Dockerfile:14-41`) | Installs `mongodb-database-tools` (for `mongodump`) from the MongoDB 6.0 Debian bullseye apt repo via `apt-key` → `WORKDIR /app` → `COPY package*.json` → `npm ci --omit=dev && npm cache clean --force` → `COPY --from=build /app/dist ./dist` → `COPY src/uploads ./src/uploads` (multer does not create the upload folders) → `mkdir -p backups` → `EXPOSE 8080` → `CMD ["npm","start"]` |

- The image holds only `dist/`, production `node_modules`, `src/uploads` and an empty `backups/`; no TypeScript sources or dev dependencies.
- `.dockerignore` excludes `.env.dev`, `.env.prod`, `.env`, `node_modules`, `npm-debug.log`, `.git`, `.vscode`, `dist`, `backups`, `dbscripts`, `Documents`, `*.md`, `Jenkinsfile`, `Dockerfile`, `.dockerignore`. Config must therefore come from container environment variables. Set `NODE_ENV=production` and `PORT=8080` at runtime; without `NODE_ENV=production` static `/uploads` serving points at the wrong folder.
- `COPY src/uploads` copies whatever is in the build context. In a clean git checkout (the Jenkins build) that is only `uploadtest.ts`, because the per-type folders are git-ignored, so the upload sub-folders are still missing in the image. In a local build, any files already uploaded locally are baked into the image. See core.md gotchas.
- Uploads (`/app/src/uploads`) and backups (`/app/backups`) are inside the container filesystem. Mount volumes for both or the data is lost when the container is recreated.

### Jenkins (`Jenkinsfile`)

Declarative pipeline. Parameters: `BRANCH_NAME` (default `release-1.0.0.9`) and `IMAGE_TAG` (default `1.0.0.9`). Credential id: `my-github-login`.

| Stage | Action |
|---|---|
| Checkout | `git` clone of `https://github.com/rashmikaviba/slpd-web-service.git` at `BRANCH_NAME` |
| Build Docker Image | `docker rmi -f` any old local tag, then `docker.build("ghcr.io/nimna-thiranjaya/slpd-web-service:<IMAGE_TAG>")` |
| Push Docker Image | `docker.withRegistry('https://ghcr.io', 'my-github-login')` and push |
| Cleanup | remove the local image |
| Success | echo |

The pipeline does not lint, test or deploy. The server pulls and runs the image outside this pipeline.

### Code style

`.prettierrc`: 4-space indent, single quotes, semicolons, `trailingComma: es5` (Prettier itself is not installed and not wired into ESLint). `eslint.config.mjs` is a real flat config built with `tseslint.config(...)`: ignores `dist`, `node_modules`, `backups`, `dbscripts`; `js.configs.recommended` + `tseslint.configs.recommended`; for `**/*.ts` it sets ES2022 modules and `globals.node`; `explicit-function-return-type` and `no-explicit-any` off; unused vars are errors unless prefixed `_`; `no-console` warns. The old `prettier/prettier` rule was dropped.

---

## Changelog

### 2026-10-25 — synced with code changes in commit `50632dc` ("Code Ai Optimization revamp")

- Dependencies: removed `fs-extra`, `class-validator`, `class-transformer`, `morgan`, `winston` and the dev packages `@types/fs-extra`, `@types/joi`, `@types/mongoose`, `@types/morgan`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`; added `engines.node >=20`.
- Scripts: `build` is now `tsc` with a `prebuild` that deletes `dist/`; new `typecheck`; `dev` fixed (`cross-env` now wraps nodemon); `lint` is `eslint .`.
- `tsconfig.json`: explicit `rootDir`/`include`/`exclude`, target `es2022`, `useDefineForClassFields: false`. The `dist/src/app.js` entry no longer depends on `backups/backup-test.ts`.
- Docker: multi-stage `node:20.19.4-slim` build with `npm ci`, production-only deps, `src/uploads` copied and `backups/` created; `.dockerignore` expanded.
- ESLint: rewritten as a working flat config (no Prettier rule).
- Folder structure: `src/util/common.util.ts` deleted, `src/util/inventory.util.ts` added. `Documents/` is now listed in `.gitignore`.
- Route map unchanged (`notification.route.ts` only lost an unused import).
