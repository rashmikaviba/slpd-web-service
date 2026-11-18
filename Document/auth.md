# Auth module

Credentials and sessions: login (JWT issue + role menu), SUPERADMIN password reset, self-service password change, and session refresh. The `Auth` collection is the credential side of a [User](user.md); it is also what the `authorize()` middleware loads on every request (see [README › Authentication & authorization](README.md#authentication--authorization)).

## Files

| File | Responsibility |
|---|---|
| `src/modules/auth/auth.router.ts` | Routes (`AuthRouter`, mounted at `/api/v1/auth`). |
| `src/modules/auth/auth.controller.ts` | `userLogin`, `resetPassword`, `changePassword`, `refreshUserAuth`, private `filterModules`. |
| `src/modules/auth/auth.service.ts` | `Auth` queries + cache. |
| `src/modules/auth/auth.model.ts` | `Auth` schema. |
| `src/util/jwt.util.ts` | `generateToken`, `extractToken`, `verifyToken`. |
| `src/util/passwordHash.util.ts` | `hashPassword`, `comparePassword` (bcryptjs). |
| `src/util/data/menudata.ts` | Static per-role menu/module lists returned on login. |

No Joi validation file.

## Data model

### `Auth` → collection `auths` (`auth.model.ts`)

`timestamps: true`, `versionKey: false`. No indexes, hooks or virtuals.

| Field | Type | Constraints | Meaning |
|---|---|---|---|
| `userName` | String | required | Login name; kept equal to `User.userName` by user create/update. |
| `password` | String | required | bcrypt hash. |
| `isBlocked` | Boolean | default `false` | Blocked users cannot log in nor pass `authorize()`. |
| `user` | ObjectId | ref `User` | Owning user (1:1). |
| `role` | ObjectId | ref `Role` | Role; duplicated from `User.role` and kept in sync by `updateUser`. `role.id` (numeric) goes into the JWT. |
| `status` | Number | required, default ACTIVE (1) | Set to DELETED (3) when the user is deleted. |
| `createdBy` / `updatedBy` | ObjectId | ref `User` | |

Relationship: `User 1 — 1 Auth — n:1 Role`. `Auth` is created only in `saveUser` and updated by `updateUser`, `blockUser`, `unblockUser`, `deleteUser` ([user.md](user.md)) and the endpoints below.

## Endpoints

| Method | Path | Roles allowed | Validation | Handler |
|---|---|---|---|---|
| POST | `/api/v1/auth/login` | public (no middleware) | none | `userLogin` |
| PUT | `/api/v1/auth/resetPassword/:id` | SUPERADMIN | none | `resetPassword` |
| PUT | `/api/v1/auth/changePassword` | any authenticated | none | `changePassword` |
| POST | `/api/v1/auth/refreshAuth` | any authenticated | none | `refreshUserAuth` |

## Endpoint logic

### POST `/auth/login` — `userLogin` (`auth.controller.ts:21`)

Body: `userName`, `password`.

1. `authService.findByUserName(userName)` → `Auth.findOne({ userName, status: ACTIVE }).populate('user role')` (not cached).
2. `companyWorkingInfoService.getCompanyWorkingInfo()` (cached key `companyWorkingInfo`, see [common.md](common.md)).
3. No auth → `BadRequestError('Invalid username, Please try again with correct username!')`.
4. `isBlocked` → `BadRequestError('User is blocked, Please contact admin!')`.
5. `comparePassword(password, auth.password)` false → `BadRequestError('Invalid password, Please try again with correct password!')`.
6. `jwtUtil.generateToken(auth)` (see Utilities).
7. `filterModules(auth)` picks the menu array by `auth.role.id`: 1 `superAdminMenu`, 2 `adminMenu`, 3 `driverMenu`, 4 `financeOfficerMenu`, 5 `tripManagerMenu`, 6 `driverAssistantMenu`, 7 `tripAssistantMenu`, else `[]`.

Response 200, `Login Successful!`:

```json
{
  "token": "Bearer <jwt>",
  "user": { /* full populated User document */ },
  "role": 1,
  "modules": [{ "id": 1, "name": "User Management", "status": 1 }],
  "moduleIds": [1, 2, 3],
  "workingMonth": 11, "workingYear": 2026, "workingDate": "..."
}
```

`working*` are `undefined` (omitted) when no active `CompanyWorkingInfo` exists.

Menu ids (`menudata.ts`): SUPERADMIN 1–15; ADMIN 30–41; DRIVER 60–62; FINANCEOFFICER 30, 33, 34, 36, 37, 38, 41; TRIPMANAGER 30–34, 36, 37, 39, 40, 41; TRIPASSISTANT 100–104; DRIVERASSISTANT 150–154. Each entry is `{ id, name, status: 1 }`. The front-end uses these to show modules; the backend does **not** use them for authorization.

### PUT `/auth/resetPassword/:id` — `resetPassword` (`auth.controller.ts:97`)

`:id` = **User** id.

1. `authService.findByUserId(id)` (ACTIVE) → missing → `BadRequestError('User not found!')`.
2. Hash the hard-coded default password (same literal as user creation; the comment on line 96 states a different value than the code).
3. `auth.password = hash`, `updatedBy = req.auth.id`; `authService.save(auth, null)` (clears `auth-` cache).

Response 200, `User password reset successfully as default password!`, `data: null`. Existing tokens of that user stay valid.

### PUT `/auth/changePassword` — `changePassword` (`auth.controller.ts:121`)

Body: `oldPassword`, `newPassword` (no length/complexity rules).

1. `authService.findById(req.auth.authId)` (cached `auth-<authId>`; it is always warm because the middleware just loaded it) → missing → `BadRequestError('User not found!')`.
2. `comparePassword(oldPassword, auth.password)` false → `BadRequestError('Invalid old password, Please try again with correct password!')`.
3. `auth.password = hashPassword(newPassword)`; `authService.save(auth, null)` (clears `auth-`). `updatedBy` is not set.

Response 200, `Password changed successfully!`, `data: null`.

### POST `/auth/refreshAuth` — `refreshUserAuth` (`auth.controller.ts:154`)

Body: `password`. Requires a still-valid (non-expired) token because `authorize()` runs first; this is a "re-enter password to extend session" call, not a refresh-token flow.

1. `authService.findById(req.auth.authId)` → missing → `UnauthorizedError('Invalid authentication request!')`.
2. Password mismatch → `BadRequestError('Invalid password!')`.
3. `generateToken(auth)` — new 2-day token with the current `role` from the (possibly cached) auth doc.

Response 200, `Session refresh successful!`, `data` = `"Bearer <jwt>"` (string).

## Service layer (`auth.service.ts`)

| Function | Query / behaviour |
|---|---|
| `save(auth, session)` | `clearCacheByPrefixs('auth-')`, then `auth.save({session})` or `auth.save()`. |
| `findByUserName(userName)` | `Auth.findOne({ userName, status: ACTIVE }).populate('user role')`. |
| `findById(id)` | Cache key `auth-<id>`, TTL `ONE_WEEK`. Miss → `Auth.findOne({ _id: id, status: ACTIVE }).populate('user role')`; caches if found. Used by `authorize()` on every authenticated request. |
| `findByUserId(userId)` | `Auth.findOne({ user: userId, status: ACTIVE })` (not populated, not cached). |

Any `User` save also clears `auth-` (it clears all prefixes).

## Utilities / DTOs

- `jwtUtil.generateToken(auth)` → `"Bearer " + jwt.sign({ id: auth.user._id, userName: auth.userName, role: auth.role.id, authId: auth._id }, JWT_SECRET, { expiresIn: 172800 /* 2 days */, issuer: 'cybertronix.com' })`. Requires `user` and `role` populated.
- `jwtUtil.extractToken(header)` → second space-separated token or `''`.
- `jwtUtil.verifyToken(token)` → `jwt.verify` with same secret + issuer check. Secret comes from env `JWT_SECRET` (falls back to `''` if unset).
- `passwordHashUtil.hashPassword(pw)` → `bcrypt.hash(pw, genSalt(parseInt(SALT_ROUNDS || '10')))`.
- `passwordHashUtil.comparePassword(pw, hash)` → `bcrypt.compare`.
- `req.auth` (set by middleware) = decoded JWT payload `{ id, userName, role, authId, iat, exp, iss }`; controllers across the app use `req.auth.id` as the acting user id and `req.auth.role` for role branching.

## Business rules

- Login requires ACTIVE `Auth` + not blocked + bcrypt match. Error messages distinguish "invalid username" from "invalid password" (user enumeration possible).
- JWT lifetime 2 days, no server-side revocation; blocking/deleting a user is enforced because the middleware re-reads `Auth` (cache cleared on save). Password change/reset does **not** revoke tokens.
- Role in token is a snapshot at login/refresh time.
- Only SUPERADMIN can reset another user's password, and only to the default.

## Cross-module dependencies

- Reads `CompanyWorkingInfo` via `companyWorkingInfoService` ([common.md](common.md)); `Role`/`User` via populate.
- Used by: `middleware/auth.middleware.ts` (`findById`), [user](user.md) (`save`, `findByUserId`, `Auth` model for create), `user.service.ts` (`Auth` model queries for role lists / blocked flag).
- No audit logs, no socket events.

## Known issues / notes

1. `changePassword`/`refreshUserAuth` operate on the object returned by `authService.findById`, which is normally a node-cache **clone** of a populated Mongoose document (`auth.service.ts:27-28`); calling `.save()` on it relies on the clone preserving Mongoose internals. Safer: load fresh with `Auth.findById` before mutating (`auth.controller.ts:125,158`).
2. Hard-coded default password used for create/reset (`auth.controller.ts:105`, `user.controller.ts:119`); comment at `auth.controller.ts:96` disagrees with the code.
3. Password change/reset does not invalidate existing JWTs; no refresh-token mechanism (`refreshAuth` needs a valid token).
4. `changePassword` does not set `updatedBy` (`auth.controller.ts:141`); no new-password validation.
5. Login response `user` is the whole `User` document (bank details, salary, etc.) (`auth.controller.ts:52`).
6. `filterModules` is called twice and `let modules = []` is unused (`auth.controller.ts:48,54-55`).
7. Login fetches working info before checking credentials (wasted query for bad logins) (`auth.controller.ts:26`).
8. `jwt.util.ts:4` falls back to an empty secret if `JWT_SECRET` is missing — tokens would then be signed with `''`.
9. Login error messages allow username enumeration (`auth.controller.ts:29-44`).
