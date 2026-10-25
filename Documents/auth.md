# Auth Module

## 1. Overview

The Auth module holds staff **login credentials** and runs authentication:

- **Login**: checks the username and password and issues a JWT. It also returns the role's UI menu (the "modules" the front-end should show) and the company's current working month, year and date.
- **Password reset**: a super admin resets a user's password to the default.
- **Password change**: a logged-in user changes their own password.
- **Session refresh**: a logged-in user re-enters their password to get a fresh token.

Each `Auth` document is linked 1:1 to a `User` (staff profile, see `user.md`) and to a `Role`. `Auth` records are created, renamed, blocked and soft-deleted by the User module. The shared `authorize` middleware (`src/middleware/auth.middleware.ts`) reads this collection on **every** protected request.

All paths are relative to `/api/v1`.

## 2. Files

| File | Role |
|---|---|
| `src/modules/auth/auth.model.ts` | Mongoose `Auth` schema/model |
| `src/modules/auth/auth.router.ts` | Routes and guards |
| `src/modules/auth/auth.controller.ts` | `userLogin`, `resetPassword`, `changePassword`, `refreshUserAuth`, plus the `filterModules` helper |
| `src/modules/auth/auth.service.ts` | `save` (clears the auth cache), `findByUserName`, `findById` (cached, lean, read-only), `findByIdFresh` (uncached, saveable document), `findByUserId` |
| Shared: `src/middleware/auth.middleware.ts` | `authorize(rolesArray, isNoNeedAuth)` guard used by every module |
| Shared: `src/util/jwt.util.ts` | Generate, extract and verify JWTs |
| Shared: `src/util/passwordHash.util.ts` | bcrypt hash and compare |
| Shared: `src/util/data/menudata.ts` | Static per-role menu lists returned at login |
| Shared: `src/util/cache.ts` | node-cache wrapper (`useClones: false`: cached values are shared by reference) |

## 3. Data Model

### `Auth` (collection `auths`), `src/modules/auth/auth.model.ts`

Options: `timestamps: true`, `versionKey: false`. There are no hooks or virtuals.

**Indexes** (`auth.model.ts:53-56`, all non-unique; added to back the service filters):

| Index | Serves |
|---|---|
| `{ userName: 1, status: 1 }` | `findByUserName` (login) |
| `{ user: 1, status: 1 }` | `findByUserId`, the user list's blocked-flag lookup |
| `{ role: 1, status: 1, isBlocked: 1 }` | `user.service.findAllByRoleId` and the available-drivers query |

None is unique, so `userName` is still not unique at the DB level.

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `userName` | String | **required** ("Username is required") | Kept in sync with `User.userName` by `PUT /user/:id` |
| `password` | String | **required** | bcrypt hash (`bcryptjs`, salt rounds = env `SALT_ROUNDS`, default 10) |
| `isBlocked` | Boolean | default `false` | Blocked users cannot log in or use tokens |
| `user` | ObjectId → `User` | optional | |
| `role` | ObjectId → `Role` | optional | The token stores the role's numeric `id` |
| `status` | Number | **required**, default `WellKnownStatus.ACTIVE` (1) | 1 ACTIVE, 2 INACTIVE, 3 DELETED. All lookups filter ACTIVE |
| `createdBy` | ObjectId → `User` | optional | |
| `updatedBy` | ObjectId → `User` | optional | |

### JWT payload (`src/util/jwt.util.ts:6-22`)

```ts
{ id: auth.user._id, userName: auth.userName, role: auth.role.id /* numeric */, authId: auth._id }
// signed with env JWT_SECRET, expiresIn 2 days (172800 s), issuer 'cybertronix.com'
// returned to the client as the string "Bearer <token>"
```

`generateToken` requires `auth.user` and `auth.role` to be **populated** (it reads `auth.user._id` and `auth.role.id`).

## 4. API Endpoints

Base path `/auth` (`src/applicationRoutes.ts:31-37`, mounted in `src/mapping.ts:31`).

| Method | Full path | Controller | Auth / roles | Description |
|---|---|---|---|---|
| POST | `/auth/login` | `userLogin` | **public** | Log in and get a token, menu and working period |
| PUT | `/auth/resetPassword/:id` | `resetPassword` | SUPERADMIN | Reset a user's password to `12345` |
| PUT | `/auth/changePassword` | `changePassword` | any authenticated | Change own password |
| POST | `/auth/refreshAuth` | `refreshUserAuth` | any authenticated | Re-issue a token after confirming the password |

### 4.0 How `authorize` works (`src/middleware/auth.middleware.ts`)

```
authorize(rolesArray = [], isNoNeedAuth = false)
```

1. If `isNoNeedAuth` is set, call `next()` (`auth.middleware.ts:21`). No caller in the codebase passes `true`.
2. If the `Authorization` header is missing or does not start with `"Bearer "`: **401** `Authentication invalid!`.
3. `token = header.split(' ')[1]`. If it is empty: **401** `You're unauthorized to access this resource!`.
4. `jwt.verify(token, JWT_SECRET, { issuer })`:
   - On `TokenExpiredError`: **401** `Your session is expired!`.
   - On any other error: **403** `You're unauthorized to access this resource!`.
5. `authService.findById(payload.authId)` (`auth.middleware.ts:47`) returns the ACTIVE auth, populated with user and role, as a **lean plain object**, **cached one week** under `auth-<authId>`. Because the cache runs with `useClones: false`, every request gets the same shared object (no per-hit deep clone).
   - If not found (deleted or wrong id): **401** `Authentication invalid!`.
   - If `isBlocked`: **401** `Your account is blocked, Please contact admin!`.
6. If `rolesArray.length` is truthy (`auth.middleware.ts:59`) and `!rolesArray.includes(payload.role)`: **403** `You're unauthorized to access this resource!`. The role comes from the **token**, not the database.
7. Set `req.auth = payload` (`{ id, userName, role, authId, iat, exp, iss }`).

> ⚠️ If a caller passes a **number** instead of an array (e.g. `authorize(constants.USER.ROLES.SUPERADMIN)` in `leave.route.ts:51,57`), `rolesArray.length` is `undefined`. The role check is then **skipped** and any authenticated user passes.

Errors flow to `errorHandlerMiddleware`, which responds with `{ isSuccessful: false, timeStamp, message, data: null }` and the error's `statusCode`.

### 4.1 `POST /auth/login` — userLogin (`auth.controller.ts:21-61`)

**Body**: `{ userName: string, password: string }`. There is no Joi or other validation.

**Logic**
1. Two lookups run **in parallel** (`Promise.all`, `auth.controller.ts:24-27`):
   - `authService.findByUserName(userName)` runs `Auth.findOne({ userName, status: ACTIVE }).populate('user role')` (served by the `{userName, status}` index), with no cache.
   - `companyWorkingInfoService.getCompanyWorkingInfo()` fetches the latest ACTIVE `CompanyWorkingInfo`, cached for one month. It always runs, even when the login then fails.
2. Both results are awaited before any check below.
3. If no auth is found: **400** `Invalid username, Please try again with correct username!`.
4. If `isBlocked`: **400** `User is blocked, Please contact admin!`. This check runs *before* the password check.
5. `bcrypt.compare(password, auth.password)`. On mismatch: **400** `Invalid password, Please try again with correct password!`.
6. `token = jwtUtil.generateToken(existAuth)`.
7. `filterModules(existAuth)` picks the menu list by `role.id`:

   | role.id | Menu |
   |---|---|
   | 1 | `superAdminMenu` (ids 1–15) |
   | 2 | `adminMenu` (ids 30–41) |
   | 3 | `driverMenu` (ids 60–62) |
   | 4 | `financeOfficerMenu` (subset of 30–41) |
   | 5 | `tripManagerMenu` (subset of 30–41) |
   | 6 | `driverAssistantMenu` (ids 150–154) |
   | 7 | `tripAssistantMenu` (ids 100–104) |
   | anything else | `[]` |

   Each menu item is `{ id, name, status }`.

**Response**: **200** `"Login Successful!"`

```jsonc
{
  "token": "Bearer eyJ...",
  "user": { /* full populated User document: profile, bank info, etc. (gender/role are ObjectIds) */ },
  "role": 3,                 // numeric role id
  "modules": [{ "id": 60, "name": "Driver Leave Management", "status": 1 }, ...],
  "moduleIds": [60, 61, 62],
  "workingMonth": 5,         // from CompanyWorkingInfo (1-based month)
  "workingYear": 2026,
  "workingDate": "2026-05-01T..."
}
```

**Errors**: the 400s above. If `password` is missing, `bcryptjs.compare(undefined, hash)` throws `Illegal arguments: undefined, string`, which becomes a **500** (verified with the installed bcryptjs).

### 4.2 `PUT /auth/resetPassword/:id` — resetPassword (`auth.controller.ts:96-118`)

**Params**: `id` is the **User** `_id` (not the Auth `_id`). **Guard**: SUPERADMIN.

1. `authService.findByUserId(id)` runs `Auth.findOne({ user: id, status: ACTIVE })`. If not found: **400** `User not found!`.
2. `password = bcrypt('12345')` and `updatedBy = req.auth.id`.
3. `authService.save(auth, null)` clears every `auth-*` cache key, then saves.

**Response**: **200** `"User password reset successfully as default password!"`, `data: null`. The block flag is not changed.

### 4.3 `PUT /auth/changePassword` — changePassword (`auth.controller.ts:120-152`)

**Body**: `{ oldPassword, newPassword }`. There is no validation (no length or complexity rules, no check that `newPassword` differs from the old one).

1. `authService.findByIdFresh(req.auth.authId)`: the same ACTIVE + populate query as `findById`, but **uncached** and returning a real Mongoose document, because it is modified and saved (the cached `findById` result is a shared read-only lean object). If not found: **400** `User not found!`.
2. `bcrypt.compare(oldPassword, auth.password)`. On mismatch: **400** `Invalid old password, Please try again with correct password!`.
3. `auth.password = bcrypt(newPassword)`, then `authService.save` (clears the `auth-` cache).

**Response**: **200** `"Password changed successfully!"`, `data: null`. `updatedBy` is **not** set.

Existing tokens stay valid until they expire.

### 4.4 `POST /auth/refreshAuth` — refreshUserAuth (`auth.controller.ts:154-178`)

**Body**: `{ password }`. A valid, **non-expired** token is required, because the middleware runs first.

1. `authService.findById(req.auth.authId)` (cached lean object; only read here). If not found: **401** `Invalid authentication request!`.
2. Compare the password. On mismatch: **400** `Invalid password!`.
3. `token = generateToken(auth)` (new two-day expiry, current DB role).

**Response**: **200** `"Session refresh successful!"`. `data` is the token string (`"Bearer ..."`).

## 5. Business Rules & State Transitions

- **Default password** for new and reset accounts: `12345` (`user.controller.ts:119`, `auth.controller.ts:105`).
- **Token lifetime**: 2 days. Tokens cannot be revoked. Blocking or deleting takes effect immediately, because the middleware re-checks `Auth` (and `auth.save` clears the `auth-` cache). A password change does **not** revoke old tokens.
- **Role in token**: `req.auth.role` is a snapshot taken at login or refresh. After a role change in `PUT /user/:id`, the old role applies until the next login or refresh.
- **Auth status**: ACTIVE → DELETED (via `DELETE /user/:id`). Blocking is the `isBlocked` flag, toggled by `/user/block` and `/user/unblock`.
- **Cache**:
  - `auth-<authId>` holds the populated auth (lean) for one week. Every `authService.save` clears all `auth-` keys.
  - The cache does not clone (`useClones: false`, `src/util/cache.ts:9`): callers share the stored object and must not mutate it. Code that changes and saves an `Auth` loads it with `findByIdFresh` or `findByUserId` instead.
  - `clearCacheByPrefixs` now makes one pass over the keys and deletes all matches in a single `del` call.
  - `user.service.Save` clears all prefixes, including `auth-`.

## 6. Utilities & DTOs

There are no DTO files. The login response is built inline.

| Function | File | Behaviour |
|---|---|---|
| `filterModules(userAuth)` | `auth.controller.ts:63-93` | Switch on `userAuth.role?.id`, returning the static menu array |
| `authService.save(auth, session)` | `auth.service.ts:6-15` | `clearCacheByPrefixs('auth-')`, then `auth.save({ session })` or `auth.save()` |
| `authService.findByUserName(userName)` | `:17-22` | ACTIVE auth by userName, populated with user and role. Not cached |
| `authService.findById(id)` | `:27-44` | ACTIVE auth by `_id`, populated, `.lean()`, cached one week if found. Shared read-only object |
| `authService.findByIdFresh(id)` | `:47-52` | Same query, not lean, never cached. For load-modify-save (`changePassword`) |
| `authService.findByUserId(userId)` | `:54-59` | ACTIVE auth by `user`, not populated. Not cached |
| `jwtUtil.generateToken / extractToken / verifyToken` | `src/util/jwt.util.ts` | See §3 |
| `passwordHashUtil.hashPassword / comparePassword` | `src/util/passwordHash.util.ts` | bcryptjs `genSalt(SALT_ROUNDS \|\| 10)` + `hash` / `compare` |

## 7. Dependencies

**Uses**
- `common` module: `companyWorkingInfoService.getCompanyWorkingInfo` (working period in the login response).
- `Role` and `User` collections (populate).
- `src/util/data/menudata.ts`.
- Env vars `JWT_SECRET` and `SALT_ROUNDS` (`src/config/environment.config.ts`).

**Used by**
- `src/middleware/auth.middleware.ts`: every protected route in the app calls `authService.findById`.
- `src/util/cache.ts` comment points at `findByIdFresh` as the pattern for mutable loads.
- `user` module: creates, updates, blocks, unblocks and deletes `Auth` documents. `user.service` queries `Auth` directly for block status, by-role lists and available drivers.

## 8. Notes / Gotchas

1. ⚠️ **Role guard bypass in callers**: `authorize()` treats a non-array argument as "no role restriction". `leave.route.ts:51` and `:57` pass a bare number, so leave approve and reject are open to any logged-in user. Consider validating with `Array.isArray`.
2. **User enumeration**: login returns different messages for an unknown username, a blocked user and a wrong password. The blocked check also runs before the password check, so it reveals that the account exists and is blocked without needing the password.
3. No input validation on login or change-password. A missing password causes a bcrypt "Illegal arguments" error, which surfaces as a 500. There is no password policy.
4. The comment at `auth.controller.ts:96` says "reset password to default password as 123", but the code uses `12345`.
5. `filterModules` is called twice per login (`auth.controller.ts:53-54`). (The unused `let modules = []` was removed.)
6. `userName` is not unique at the DB level: the new `{ userName, status }` index is non-unique. `findByUserName` uses `findOne`, so if duplicates ever exist, the first match wins.
7. Login returns the entire populated `User` document, including bank account details and salary, to the client.
8. `changePassword` does not set `updatedBy`. `resetPassword` does.
9. `refreshAuth` needs an *unexpired* token, so it cannot recover an expired session. It re-confirms the password and extends the session.
10. `authorize`'s `isNoNeedAuth` parameter is never passed as `true` by any caller (`auth.middleware.ts:16,21`). (The unused `roleService` import and the commented-out blocks were removed.)
11. The cached `Auth` (now a lean plain object) is shared **by reference** between requests for up to a week (`useClones: false`), invalidated only by `auth.save` or `user.Save`. Any direct `Auth` update that bypasses these services (e.g. a DB script) will not be seen until the TTL expires. Any future code that mutates the result of `findById` would leak the change into every request; use `findByIdFresh` for writes.
12. The cached auth object includes the bcrypt `password` hash and the full populated `User`, held in process memory for a week per active session (unchanged in content, but now never copied).
13. `dbscripts/note.txt` contains a plaintext MongoDB admin credential committed alongside the code.

## Changelog

### 2026-10-25 — synced with code changes in commit `50632dc` ("Code Ai Optimization revamp")

- `Auth` schema gained three non-unique indexes: `{userName, status}`, `{user, status}`, `{role, status, isBlocked}`.
- `authService.findById` now returns a `.lean()` object; new `authService.findByIdFresh` (uncached, saveable) is used by `changePassword`.
- Login runs `findByUserName` and `getCompanyWorkingInfo` in parallel (`Promise.all`); unused `let modules` removed.
- `src/util/cache.ts` now uses `useClones: false` (cached values shared by reference); `clearCacheByPrefixs` is a single-pass delete.
- `auth.middleware.ts`: unused `roleService` import and commented-out code removed (no behaviour change).
- Gotchas: #5, #6, #10, #11 updated; #12 added; old #12 renumbered to #13.
