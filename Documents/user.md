# User Module

## 1. Overview

The User module manages the company's **staff records**: super admins, admins, drivers (permanent or freelance), finance officers, trip managers, driver assistants and trip assistants. It holds a person's profile (identity, contact details, scanned documents such as NIC, GS certificate, driving licence, SLTDA certificate and police report), bank details for salary payments, HR data (basic salary, yearly leave allowance), spoken languages and role.

Each `User` has a matching `Auth` record (login credentials, role, blocked flag). This module creates, updates and soft-deletes both records together in a MongoDB transaction. Blocking and unblocking a user changes only the `Auth` record.

The module also answers the trip-planning question **"which drivers are free between these dates?"** (`GET /user/getDriversForTrip`). It does this by excluding drivers already assigned to overlapping normal trips or internal trips.

All paths below are relative to the API prefix `/api/v1` (`src/constant.ts:3`, `src/app.ts:43`).

## 2. Files

| File | Role |
|---|---|
| `src/modules/user/user.model.ts` | Mongoose `User` schema/model |
| `src/modules/user/user.router.ts` | Express router: maps routes to controllers and role guards |
| `src/modules/user/user.controller.ts` | Request handlers: create, update, block, unblock, list, get, validate, delete, by-role, available drivers |
| `src/modules/user/user.service.ts` | DB access: save (with cache clear), uniqueness checks, finders, available-driver query |
| `src/modules/user/user.util.ts` | Mappers from the `User` document to `UserResponseDto` |
| `src/modules/user/dto/userResponseDto.ts` | `UserResponseDto` TypeScript interface |

## 3. Data Model

### `User` (collection `users`), `src/modules/user/user.model.ts`

Schema options: `timestamps: true` (`createdAt`, `updatedAt`), `versionKey: false`. **No indexes** are declared, and no unique constraints. Uniqueness is enforced only in application code (see §5). There are no hooks or virtuals.

| Field | Type | Required / Default | Validation / Notes |
|---|---|---|---|
| `fullName` | String | **required** ("Full Name is required") | maxlength 120 |
| `userName` | String | **required** | maxlength 50 |
| `gender` | ObjectId → `Gender` | optional | Set from the gender's numeric custom `id` |
| `dateOfBirth` | Date | optional | |
| `address` | String | optional | maxlength 200 |
| `phoneNumber1` | String | optional | |
| `phoneNumber2` | String | optional | |
| `email` | String | **required** | maxlength 100. Custom regex validator; message `"<value> is not a valid email"` |
| `isFreelanceDriver` | Boolean | default `false` | |
| `profileImageUrl` | String | optional | URL returned by `/store/upload` |
| `nic` | String | **required** | maxlength 20 |
| `nicImageUrl` | String | optional | |
| `gsCertificateUrl` | String | optional | |
| `drivingLicenseUrl` | String | optional | |
| `sltdaCertificateUrl` | String | optional | |
| `policeReportUrl` | String | optional | |
| `bankName` | String | optional | maxlength 100 |
| `bankId` | Number | **required** ("Bank Id is required") | Presumably an id from `src/util/data/bankdata.ts`. Nothing validates it against that list |
| `branch` | String | optional | maxlength 100 |
| `accountNumber` | String | optional | maxlength 50 |
| `accountHolderName` | String | optional | maxlength 120 |
| `accountHolderAddress` | String | optional | maxlength 200 |
| `basicSalary` | Number | optional | |
| `leaveCount` | Number | optional | Yearly leave allowance (days). Used by the Leave module for admin-type roles |
| `languages` | [String] | optional | |
| `role` | ObjectId → `Role` | optional | Set from the role's numeric custom `id` |
| `status` | Number | **required**, default `WellKnownStatus.ACTIVE` (1) | `WellKnownStatus`: 1 ACTIVE, 2 INACTIVE, 3 DELETED. No `enum` validator |
| `createdBy` | ObjectId → `User` | optional | |
| `updatedBy` | ObjectId → `User` | optional | |

Mongoose validation errors (`ValidationError`) are turned into **400** with the first validator message by `src/middleware/error.middleware.ts:37-46`.

Related model `Auth` (owned by the Auth module, see `auth.md`): `userName`, `password` (bcrypt), `isBlocked`, `user` → User, `role` → Role, `status`.

## 4. API Endpoints

Base path: `/user` (`src/applicationRoutes.ts:18-30`, mounted in `src/mapping.ts:95`).

Role ids (`src/constant.ts:7-15`): 1 SUPERADMIN, 2 ADMIN, 3 DRIVER, 4 FINANCEOFFICER, 5 TRIPMANAGER, 6 DRIVERASSISTANT, 7 TRIPASSISTANT.

Authorization (`src/middleware/auth.middleware.ts`): the request needs `Authorization: Bearer <jwt>`. The JWT is verified with issuer `cybertronix.com`. The `Auth` record is loaded by `payload.authId` (cached one week) and must exist with status ACTIVE and not be blocked. If a roles array is given, `payload.role` (the numeric role id in the token) must be in it. `req.auth` = `{ id: <userId>, userName, role: <numeric>, authId }`.

| Method | Full path | Controller | Allowed roles | Description |
|---|---|---|---|---|
| GET | `/user/getDriversForTrip` | `getDriversForTrip` | SUPERADMIN, ADMIN, TRIPMANAGER | Active, unblocked drivers with no overlapping trip or internal trip |
| POST | `/user/` | `saveUser` | SUPERADMIN | Create user and auth (default password) |
| PUT | `/user/:id` | `updateUser` | SUPERADMIN | Update user, plus auth username and role |
| PUT | `/user/block/:id` | `blockUser` | SUPERADMIN | Block login |
| PUT | `/user/unblock/:id` | `unblockUser` | SUPERADMIN | Unblock login |
| GET | `/user/validateUser` | `checkUserName` | SUPERADMIN | Check that username, email and NIC are free |
| GET | `/user/` | `getAllUsers` | SUPERADMIN | List all active users except the caller |
| GET | `/user/:id` | `getUserById` | any authenticated | One user, as a DTO |
| DELETE | `/user/:id` | `deleteUser` | SUPERADMIN | Soft-delete user and auth |
| GET | `/user/userByRole/:id` | `getAllUsersByRole` | SUPERADMIN, ADMIN, TRIPMANAGER | Active, unblocked users of a role (numeric role id) |

Route registration order (`user.router.ts`) matters for `GET`. `/getDriversForTrip` and `/validateUser` are registered before `/:id`, so they are not captured by it. `/userByRole/:id` has two path segments, so `/:id` cannot match it.

All responses use `CommonResponse` (`src/util/commonResponse.ts`): `{ isSuccessful, timeStamp, message, data }`.

### 4.1 `POST /user/` — saveUser (`user.controller.ts:22-152`)

**Body** (no Joi or class-validator; only Mongoose schema validation applies): `fullName, userName, gender (numeric gender id, e.g. 1/2), dateOfBirth, address, phoneNumber1, phoneNumber2, email, profileImageUrl, nic, nicImageUrl, gsCertificateUrl, drivingLicenseUrl, sltdaCertificateUrl, policeReportUrl, bankName, bankId, branch, accountNumber, accountHolderName, accountHolderAddress, basicSalary, leaveCount, languages, role (numeric role id), isFreelanceDriver`.

**Logic**
1. Uniqueness checks among **ACTIVE** users only (`userService.validateUserData`): type 1 is `userName`, type 2 is `email`, type 3 is `nic`. The first conflict found, in that order, is thrown.
2. `roleService.findByCustomId(role)` is `Role.findOne({ id: role, status: ACTIVE })`, cached one week under `role-<id>`. `commonService.findGenderByCustomId(gender)` is the same pattern under `gender-<id>`.
3. A transaction is started (`mongoose.startSession()`; this needs a replica set).
   - Build a `User` with all body fields, `gender = genderData._id`, `role = roleData._id`, and `createdBy`/`updatedBy = req.auth.id`.
   - Build an `Auth` with `userName`, `password = bcrypt('12345')` (hard-coded default), `user = user._id`, `role = roleData._id`, and `createdBy`/`updatedBy`.
   - `userService.Save(user, session)` first clears **every cache prefix** in `constants.CACHE.PREFIX`. Then `authService.save(auth, session)` clears the `auth-` prefix.
   - Commit. On any error, abort and rethrow.

**Response**: **201** `"User created successfully!"`. `data` is the raw saved `User` document, not the DTO.

**Errors**
| Status | Message |
|---|---|
| 400 | `User Name already exists!` / `Email already exists!` / `NIC already exists!` |
| 400 | `Valid Role is required!` (unknown or inactive role id) |
| 400 | `Valid Gender is required!` |
| 400 | Mongoose validation message (e.g. `Full Name is required`, `Bank Id is required`, `x is not a valid email`) |
| 401/403 | Auth middleware errors |

### 4.2 `PUT /user/:id` — updateUser (`user.controller.ts:155-294`)

**Params**: `id` (User `_id`). **Body**: the same fields as create.

**Logic**
1. Uniqueness checks via `validateUserDataForUpdate`: the same three queries plus `_id: { $ne: id }`, ACTIVE only.
2. Resolve role and gender by custom id, as in create.
3. Transaction:
   - `userService.findById(id)` finds the ACTIVE user. This read is not bound to the session. If not found, **404** `User not found!`.
   - Overwrite **every** profile field with the body values. Fields omitted from the body become `undefined` and are unset.
   - Set `role`, `gender` and `updatedBy`. Save, which clears the whole cache.
   - `authService.findByUserId(id)` finds the ACTIVE auth. If missing, **400** `User not found!`, and the transaction aborts.
   - Set `auth.userName`, `auth.role` and `auth.updatedBy`, then save.
   - Commit.

**Response**: **200** `"User updated successfully!"`. `data` is the raw saved `User` document.

**Errors**: the same 400s as create, plus 404 or 400 `User not found!`.

> Note: the role inside existing JWTs is **not** refreshed. A user whose role changed keeps the old role in `req.auth.role` until they log in again or call `/auth/refreshAuth`.

### 4.3 `PUT /user/block/:id` — blockUser (`user.controller.ts:297-319`)

1. `authService.findByUserId(id)` (ACTIVE auth). If missing, **404** `User not found!`.
2. If `auth.isBlocked` is already set, **400** `User already blocked!`.
3. Set `isBlocked = true` and `updatedBy`, then `authService.save`, which clears the `auth-` cache. From the next request on, the auth middleware rejects that user with 401 `Your account is blocked, Please contact admin!`, and login is rejected with 400.

**Response**: **200** `"User blocked successfully!"`, `data: null`.

### 4.4 `PUT /user/unblock/:id` — unblockUser (`user.controller.ts:322-344`)

This mirrors block. **400** `User already unblocked!` if the user is not blocked. **200** `"User unblocked successfully!"`.

### 4.5 `GET /user/validateUser` — checkUserName (`user.controller.ts:379-433`)

**Query**: `id` (optional; when present, update mode), `userName`, `email`, `nic`.

**Logic**: runs the same three uniqueness queries as create or update. If `id` is present, the user with that id is excluded. The first conflict sets `result = false` and a message.

**Response**: always **200**, `isSuccessful: true`. `data` is a boolean (`true` = all values free). `message` is one of:
- `Username already exists, please try another username!`
- `Email already exists, please try another email!`
- `NIC already exists, please try another NIC!`
- `''`

### 4.6 `GET /user/` — getAllUsers (`user.controller.ts:346-361`)

1. `userService.findAllWithGenderRole()`:
   - Cache key `user-findAllWithGenderRole` (one week).
   - On a miss: `User.find({ status: ACTIVE })`, populate `gender` (`_id name id`), `role` (`_id name id`), `createdBy` and `updatedBy` (`_id fullName`), sorted by `createdAt` descending.
   - For **each** user it runs one more `Auth.findOne({ user, status: ACTIVE })` and sets `element.isBlock = auth.isBlocked` (an N+1 query pattern).
   - The result is cached only if non-empty.
2. Users whose `_id` equals `req.auth.id` (the caller) are removed.
3. The rest are mapped with `userUtil.userModelToUserResponseDtos`.

**Response**: **200**, `data: UserResponseDto[]` (see §6).

### 4.7 `GET /user/:id` — getUserById (`user.controller.ts:363-377`)

`userService.findByIdWithGenderRole(id)` uses the same populate as the list, ACTIVE only, and **no cache**. The result is mapped to a DTO. If not found, **404** `User not found!`. An invalid ObjectId gives a CastError, which becomes **404** `No item found with ID "<id>"!`.

`isBlackListed` is always `false` here, because `isBlock` is only set by `findAllWithGenderRole`.

### 4.8 `DELETE /user/:id` — deleteUser (`user.controller.ts:435-478`)

1. Load the ACTIVE auth (`findByUserId`) and the ACTIVE user (`findById`). If either is missing, **404** `User not found!`.
2. Transaction: set `status = DELETED (3)` and `updatedBy` on both, save the user (clears all caches), save the auth (clears `auth-`), commit.

Afterwards the auth middleware's `authService.findById` (ACTIVE only) returns null for this user, so any token they still hold gets **401** `Authentication invalid!`.

**Response**: **200** `"User deleted successfully!"`, `data: null`.

There is no check for self-deletion or for open trips or leaves.

### 4.9 `GET /user/userByRole/:id` — getAllUsersByRole (`user.controller.ts:480-491`)

**Params**: `id` is the numeric role id (e.g. `3` for drivers).

1. `roleService.findByCustomId(id)`. If the role is not found, `data: []`.
2. Otherwise `userService.findAllByRoleId(role._id)` (`user.service.ts:156-176`):
   - Reads cache key `user-<role ObjectId>`, then evaluates `cached.length > 0`.
   - On a miss: `Auth.find({ role, status: ACTIVE, isBlocked: false }).populate('user')`, mapped to `auth.user`, cached for one week if non-empty.

**Response**: **200**, `data` is an array of raw `User` documents (not DTOs).

> ⚠️ **Bug**: on a cache miss, `cacheUtil.getCache` returns `undefined`, and `cached.length` throws `TypeError`. Nothing else ever writes this key before line 159 runs, so as written this endpoint returns **500** whenever the role exists. The same applies to `dashboard.controller.ts:74`. See §8.

### 4.10 `GET /user/getDriversForTrip` — getDriversForTrip (`user.controller.ts:493-511`)

**Query**: `startDate`, `endDate` (date strings, cast by Mongoose), `tripId` (optional; defaults to `''`).

1. Resolve the DRIVER role (`findByCustomId('3')`).
2. `userService.findDriversByNotInInternalTripsAndNormalTrips(role._id, startDate, endDate, tripId)` (`user.service.ts:178-235`):
   - **Only if both dates are given**:
     - Internal-trip drivers: `InternalTrip.find({ $or: OVERLAP, status: WellKnownStatus.ACTIVE }).select('driver')`, mapped to `driver.toString()`.
     - Normal-trip drivers: `Trip.find({ $or: OVERLAP, _id: { $ne: tripId }, status: { $in: [PENDING(1), START(3)] } }).select('drivers.driver drivers.isActive')`, flattened to the drivers with `isActive === true`.
     - `OVERLAP` is:
       ```js
       { startDate: { $gte: S, $lt: E } }          // starts inside [S, E)
       { endDate:   { $gte: S, $lt: E } }          // ends inside [S, E)
       { startDate: { $lte: S }, endDate: { $gte: E } } // covers the whole range
       ```
   - `Auth.find({ role, status: ACTIVE, isBlocked: false, user: { $nin: excluded } }).populate('user')`, mapped to `auth.user`.
   - If the dates are missing, **all** active, unblocked drivers are returned, including freelance ones.

**Response**: **200**, `data` is an array of raw `User` documents. No caching.

> ⚠️ If `tripId` is omitted but dates are given, `_id: { $ne: '' }` fails ObjectId casting. The `CastError` becomes **404** `No item found with ID ""!` (verified against the installed Mongoose 8.5.0). Callers must always pass a valid `tripId`.

## 5. Business Rules & State Transitions

- **Uniqueness**: `userName`, `email` and `nic` must be unique **among ACTIVE users** (`user.service.ts:21-70`). Values belonging to soft-deleted users can be reused. There is no DB index backing this, so two concurrent creates can race.
- **Default password**: new users get `12345` (`user.controller.ts:119`). The same value is used by `/auth/resetPassword`.
- **User status**: `ACTIVE (1)` changes to `DELETED (3)` via `DELETE /user/:id`. `INACTIVE (2)` is never set by this module. Every finder filters `status: ACTIVE`.
- **Blocked flag** (on `Auth`): `false ⇄ true` via block and unblock. Repeating the same transition is rejected with 400.
- **Role display**: drivers are shown as `"Driver (Freelance)"` or `"Driver (Permanent)"` depending on `isFreelanceDriver` (`user.util.ts:35-40`).
- **Availability window**: a driver is unavailable if any ACTIVE internal trip, or any PENDING or STARTED normal trip (excluding `tripId`) where the driver is an active assignee, overlaps `[startDate, endDate)` under the three-clause rule in §4.10.
- **Caching**:
  - `user.service.Save` clears **all** cache prefixes app-wide.
  - `user-findAllWithGenderRole` and `user-<roleObjectId>` are cached for one week.
  - Block, unblock and auth password changes clear only `auth-`.

## 6. Utilities & DTOs

### `userUtil.userModelToUserResponseDto(user)` (`user.util.ts:4-48`)

This expects a user with `gender`, `role`, `createdBy` and `updatedBy` populated.

| DTO field | Source |
|---|---|
| `_id, fullName, userName, dateOfBirth, address, phoneNumber1, phoneNumber2, email, profileImageUrl, nic, nicImageUrl, gsCertificateUrl, drivingLicenseUrl, sltdaCertificateUrl, policeReportUrl, bankName, bankId, branch, accountNumber, accountHolderName, accountHolderAddress, basicSalary, leaveCount, languages, createdAt, updatedAt` | Copied as-is |
| `gender` | `user.gender?.id` (numeric gender id) |
| `genderName` | `user.gender.name` (**no** optional chaining) |
| `role` | `user.role.id` (numeric) |
| `roleName` | `role.name`. For DRIVER, `+ " (Freelance)"` or `" (Permanent)"` |
| `isFreelanceDriver` | Coerced to boolean |
| `isBlackListed` | `user.isBlock ? true : false` (only set by `findAllWithGenderRole`) |
| `createdBy` / `createdUser` | `createdBy?._id` / `createdBy?.fullName` |
| `updatedBy` / `updatedUser` | `updatedBy?._id` / `updatedBy?.fullName` |

`userModelToUserResponseDtos(users)` maps the function above over an array.

### Service functions (`user.service.ts`)

| Function | Behaviour |
|---|---|
| `Save(user, session)` | Clears every `CACHE.PREFIX`, then `user.save({ session })`. Both branches pass `{ session }` |
| `validateUserData(type, data)` | `type` 1, 2 or 3 is userName, email or NIC. ACTIVE users with that value |
| `validateUserDataForUpdate(type, data, id)` | Same, plus `_id ≠ id` |
| `findById(id)` | ACTIVE user, no populate |
| `findByIdWithGenderRole(id)` | ACTIVE user, populates gender, role, createdBy and updatedBy |
| `findAll()` | All ACTIVE users (no caller found in this module) |
| `findAllWithGenderRole()` | See §4.6 |
| `findAllByRoleId(roleId)` | See §4.9 |
| `findDriversByNotInInternalTripsAndNormalTrips(...)` | See §4.10 |

## 7. Dependencies

**Uses**
- `auth` module: `Auth` model and `authService` (`save`, `findByUserId`).
- `common` module:
  - `roleService.findByCustomId`.
  - `commonService.findGenderByCustomId`.
  - `Role` and `Gender` collections (via populate).
- `trip` module: `Trip` model (`startDate`, `endDate`, `status`, `drivers[].driver`, `drivers[].isActive`).
- `internalTrip` module: `InternalTrip` model (`startDate`, `endDate`, `driver`, `status`).
- Utilities:
  - `util/passwordHash.util` (bcryptjs, `SALT_ROUNDS` env, default 10).
  - `util/cache` (node-cache).
  - `WellKnownStatus` and `WellKnownTripStatus` enums.

**Used by**
- `leave` module: `userService.findById` and `findByIdWithGenderRole` (leave quotas use `User.leaveCount`).
- `monthAudit`: `findByIdWithGenderRole`.
- `trip.controller.ts:707`: `userService.findById` (driver lookup on assignment).
- `dashboard.controller.ts:74`: `findAllByRoleId`.
- `auth` module: `Auth.user` refers to User. Login returns the populated User.
- Many collections reference `User` via `createdBy` and `updatedBy`, plus Leave `appliedUser`, Trip `drivers.driver` and InternalTrip `driver`.

## 8. Notes / Gotchas

1. ⚠️ **`findAllByRoleId` crashes on a cache miss** (`user.service.ts:158-159`): `cached` is `undefined`, so `.length` throws `TypeError` and the result is a 500. This affects `GET /user/userByRole/:id` and dashboard driver counts. The guard should probably be `if (cached?.length)`.
2. ⚠️ **`getDriversForTrip` without `tripId`** (with dates) gives a 404 CastError (`user.service.ts:205`).
3. ⚠️ **Stale block status in the user list**: block and unblock save only `Auth`, and `authService.save` clears only the `auth-` prefix. The cached `user-findAllWithGenderRole` list (one week) keeps the old `isBlackListed` until another User save clears all caches.
4. `findAllWithGenderRole` does `auth.isBlocked` without a null check (`user.service.ts:145`). An active user with no active Auth makes the whole list fail with 500. It also runs one Auth query per user (N+1).
5. `userModelToUserResponseDto` uses `user.gender.name` and `user.role.id` without optional chaining. A user with no gender or role crashes the mapper.
6. `Save` clears **the entire application cache** (every prefix) on any user save. This is heavy, but it does keep other modules' populated user data fresh.
7. Uniqueness is application-level only and limited to ACTIVE users, with no unique index on `userName`, `email` or `nic` in `User` or `Auth`.
8. `updateUser` overwrites every field from the body. A partial update wipes out omitted fields. The user lookup inside the transaction is not bound to the session.
9. A role change does not invalidate existing JWTs, because the role is embedded in the token (`jwt.util.ts:12`).
10. `getUserById` is open to **any authenticated role** and returns full bank and identity data for any user id.
11. `saveUser` and `updateUser` return the raw Mongoose document, while list and get return the DTO. The response shapes are inconsistent.
12. `getAllUsersByRole` declares `userAuth` but never uses it. `findAll` is unused.
13. Roles 6 (DRIVERASSISTANT) and 7 (TRIPASSISTANT) exist in `constants` but are **not seeded** in `dbscripts/privilegeDataScript.js`, which seeds only ids 1–5. Creating users with those roles returns `Valid Role is required!` unless the roles are inserted manually.
