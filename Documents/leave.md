# Leave Module

## 1. Overview

The Leave module handles **staff leave requests**:

- Drivers, admins, trip managers and finance officers apply for leave over a date range, giving a day count and a reason.
- The super admin approves or rejects requests.
- The applicant can edit or cancel a request while it is still pending.

Admin-type staff (ADMIN, FINANCEOFFICER, TRIPMANAGER) have a **yearly leave allowance** (`User.leaveCount`). Applying, editing and approving check it against the approved leave days already taken in that year. **Drivers have no allowance check.**

The module also provides per-user leave statistics (approved, rejected and pending day totals, remaining and yearly allowance) and the remaining eligible days for the current working year.

At month end, the Month Audit module stamps each leave with `isMonthEndDone = true` and a `batchId`. The Notification module reads pending leaves starting within three days.

All paths are relative to `/api/v1`.

## 2. Files

| File | Role |
|---|---|
| `src/modules/leave/leave.model.ts` | Mongoose `Leave` schema/model |
| `src/modules/leave/leave.route.ts` | Routes and role guards |
| `src/modules/leave/leave.controller.ts` | Handlers: apply, update, list, get, approve, reject, cancel, counts, eligible |
| `src/modules/leave/leave.service.ts` | Queries: overlap checks, yearly totals (cached), finders, counters |
| `src/modules/leave/leave.validation.ts` | Joi schemas `leaveSchema` and `approveRejectLeaveSchema` |
| `src/modules/leave/leave.util.ts` | `Leave` → `LeaveResponseDto` mappers |
| `src/modules/leave/dto/leaveResponseDto.ts` | `LeaveResponseDto` interface |
| `src/modules/leave/dto/leaveCountResponseDto.ts` | `LeaveCountResponseDto` interface |

## 3. Data Model

### `Leave` (collection `leaves`), `src/modules/leave/leave.model.ts`

Options: `timestamps: true`, `versionKey: false`. **No indexes**, hooks or virtuals.

| Field | Type | Required / Default | Notes |
|---|---|---|---|
| `startDate` | Date | **required** ("Start Date is required") | |
| `endDate` | Date | **required** | Not validated to be ≥ `startDate` |
| `dateCount` | Number | **required** | Number of leave days. **Supplied by the client**, not derived from the dates |
| `reason` | String | **required** | maxlength 500 |
| `status` | Number | **required**, default `PENDING` (1) | `WellKnownLeaveStatus`: 1 PENDING, 2 APPROVED, 3 REJECTED, 4 CANCELLED. No schema `enum` validator |
| `appliedUser` | ObjectId → `User` | optional (always set by code) | Applicant = `req.auth.id` |
| `approveBy` | ObjectId → `User` | default `null` | |
| `approveDate` | Date | optional | |
| `approveRemark` | String | optional | maxlength 500 |
| `rejectBy` | ObjectId → `User` | default `null` | |
| `rejectDate` | Date | optional | |
| `rejectReason` | String | optional | maxlength 500 |
| `createdBy` | ObjectId → `User` | optional | |
| `isMonthEndDone` | Boolean | default `false` | Set to `true` by Month Audit |
| `batchId` | Number | default `0` | Month-audit batch id, set by Month Audit |
| `updatedBy` | ObjectId → `User` | optional | |

## 4. API Endpoints

Base path `/leave` (`src/applicationRoutes.ts:40-52`, mounted in `src/mapping.ts:97`). Role ids: 1 SUPERADMIN, 2 ADMIN, 3 DRIVER, 4 FINANCEOFFICER, 5 TRIPMANAGER, 6 DRIVERASSISTANT, 7 TRIPASSISTANT. The `authorize` middleware is described in `auth.md` §4.0.

| Method | Full path | Controller | Allowed roles | Description |
|---|---|---|---|---|
| POST | `/leave/apply` | `applyLeave` | DRIVER, ADMIN, TRIPMANAGER, FINANCEOFFICER | Apply for leave |
| GET | `/leave/leaveCount` | `getLeaveCount` | any authenticated | Caller's yearly leave statistics |
| GET | `/leave/` | `getAllLeaves` | any authenticated | Own leaves for a year (super admin sees all) |
| GET | `/leave/:id` | `getLeaveById` | any authenticated | One leave (any status except CANCELLED) |
| PUT | `/leave/approve/:id` | `approveLeave` | intended SUPERADMIN, **effectively any authenticated** ⚠️ | Approve a PENDING or REJECTED leave |
| PUT | `/leave/reject/:id` | `rejectLeave` | intended SUPERADMIN, **effectively any authenticated** ⚠️ | Reject a PENDING or APPROVED leave |
| PUT | `/leave/cancel/:id` | `cancelLeave` | any authenticated | Cancel a PENDING leave |
| PUT | `/leave/update/:id` | `updateLeave` | any authenticated | Edit a PENDING leave |
| POST | `/leave/eligibleLeaves` | `getEligibleLeaves` | any authenticated | Remaining days for the current working year |

⚠️ Approve and reject are registered with `authMiddleware.authorize(constants.USER.ROLES.SUPERADMIN)`, a bare number rather than an array (`leave.route.ts:51,57`). The middleware's `rolesArray.length` is then `undefined`, so **no role check happens**.

Route order: `/leaveCount` is registered before `/:id`, so it is not captured. `/user` (`getAllUserLeave` in `applicationRoutes`) is defined but **never registered**.

### 4.1 `POST /leave/apply` — applyLeave (`leave.controller.ts:18-79`)

**Body**, validated by `leaveSchema` (Joi; unknown keys are **rejected**):

| Field | Rule | Messages |
|---|---|---|
| `startDate` | `Joi.date().required()` | `Start Date is required!` / `Start Date is invalid!` |
| `endDate` | `Joi.date().required()` | `End Date is required` / `End Date is invalid` |
| `dateCount` | `Joi.number().min(1).required()` | `Date Count is required` / `... is invalid` / `Date Count cannot be less than 1` |
| `reason` | `Joi.string().min(1).max(500).required()` | `Reason is required` / `... is invalid` / `... less than 1 characters` / `... more than 500 characters` |

**Logic**
1. If Joi fails: **400** with the Joi message.
2. **Overlap check** (`leaveService.checkUserAlreadyApplied(auth.id, startDate, endDate)`): a leave of the same user with status PENDING or APPROVED matching any of:
   ```js
   { startDate: { $lte: to }, endDate: { $gte: from } }  // general overlap (inclusive)
   { startDate: { $gte: from, $lte: to } }
   { endDate:   { $gte: from, $lte: to } }
   ```
   If any match: **400** `Leave is already applied for the given dates.`
3. Transaction:
   - **DRIVER** (`auth.role === 3`), `applyDriverLeave`: create a `Leave { startDate, endDate, dateCount, reason, appliedUser, createdBy, updatedBy = auth.id }` with no quota check.
   - **Any other role** (ADMIN, TRIPMANAGER, FINANCEOFFICER), `applyAdminLeave`:
     - `appliedAdmin = userService.findById(auth.id)`.
     - `fromYear = new Date(startDate).getFullYear()`.
     - `used = leaveService.getTotalLeaveDaysFromYear(auth.id, fromYear)` (approved days, cached).
     - If `used >= appliedAdmin.leaveCount || used + dateCount > appliedAdmin.leaveCount`: **400** `You have exceeded the leave limit for <year> year!`.
     - Create the same `Leave`.
   - Commit, or abort and rethrow.

**Response**: **201** `"Leave applied successfully!"`. `data` is the raw saved Leave document.

### 4.2 `PUT /leave/update/:id` — updateLeave (`leave.controller.ts:142-216`)

**Params**: `id`. **Body**: the same as apply (`leaveSchema`).

1. Joi validation: **400** on failure.
2. `checkUserAlreadyAppliedForUpdate(auth.id, id, startDate, endDate)` is the same overlap query plus `_id ≠ id`. If any match: **400** `Leave is already applied for the given dates.!`.
3. `leaveService.findByIdAndStatusIn(id, [PENDING])`. If not found (missing or not PENDING): **404** `Leave not found!`.
4. Transaction, branching on the **caller's** role:
   - DRIVER (`updateDriverLeave`): overwrite `startDate`, `endDate`, `dateCount`, `reason`, `updatedBy`, then save.
   - Other roles (`updateAdminLeave`):
     - `used = getTotalLeaveDaysFromYear(auth.id, year(startDate))`.
     - **Branch A**: if `used == 0 && used - leave.dateCount + dateCount <= admin.leaveCount`, **400** `You have exceeded the leave limit for <year> year!` ⚠️ (see §8).
     - **Branch B**: else if `used - leave.dateCount + dateCount > admin.leaveCount`, **400** with the same message.
     - Otherwise overwrite the fields and save.
5. Commit.

**Response**: **200** `"Leave updated successfully!"`. `data` is the mutated raw `leave` document, with populated refs as loaded.

No ownership check: the leave does not have to belong to the caller.

### 4.3 `GET /leave/` — getAllLeaves (`leave.controller.ts:285-392`)

**Query**: `year` (optional int; defaults to the current year when missing or unparseable).

Caller type:
- 1 = DRIVER
- 2 = ADMIN, FINANCEOFFICER, TRIPMANAGER
- 3 = SUPERADMIN
- 0 = anything else (DRIVERASSISTANT, TRIPASSISTANT), which returns `[]`

`findAllByUserIdYearAndStatus(userId | '', year, [APPROVED, REJECTED, PENDING])` (`leave.service.ts:84-129`):

```js
{ appliedUser: userId /* omitted when '' */,
  $and: [{ startDate: { $gte: new Date(year,0,1) } }, { endDate: { $lte: new Date(year,11,31) } }],
  status: { $in: [...] } }
.sort({ status: 1, createdAt: -1 })
.populate([{ path:'appliedUser', populate:{ path:'role' } }, 'approveBy', 'rejectBy', 'createdBy', 'updatedBy'])
```

- Types 1 and 2: the caller's own leaves.
- Type 3: **all** users' leaves. For each leave whose applicant role is ADMIN, FINANCEOFFICER or TRIPMANAGER, it computes `leave.availableLeaveCount = appliedUser.leaveCount - getTotalLeaveDaysFromYear(appliedUser._id, year)`. This is one query per leave, possibly cached.

CANCELLED leaves are never listed.

**Response**: **200**, `data: LeaveResponseDto[]`.

### 4.4 `GET /leave/:id` — getLeaveById (`leave.controller.ts:394-408`)

`findByIdAndStatusIn(id, [APPROVED, REJECTED, PENDING])` with populate `appliedUser approveBy rejectBy createdBy updatedBy`. The applicant's role is **not** populated, so `appliedUserRole` is `''`.

If not found: **404** `Leave not found!`. An invalid id gives a CastError, which becomes **404** `No item found with ID "<id>"!`.

**Response**: **200**, `data: LeaveResponseDto`. There is no ownership check.

### 4.5 `PUT /leave/approve/:id` — approveLeave (`leave.controller.ts:410-492`)

**Body**: `approveRejectLeaveSchema`: `remark` uses `Joi.string().min(0).max(500).required()`, with messages `Remark is required`, `Remark is invalid` and `Remark cannot be more than 500 characters`. Joi rejects empty strings by default, so `remark: ""` fails with Joi's default `"remark" is not allowed to be empty`.

**Logic**
1. Joi failure: **400**.
2. `leave = findByIdAndStatusIn(id, [PENDING, REJECTED])`. If not found: **404** `Leave not found!`.
3. `appliedUser = userService.findByIdWithGenderRole(leave.appliedUser._id)` (ACTIVE users only). `fromYear = year(leave.startDate)`.
4. If the applicant's role is ADMIN, FINANCEOFFICER or TRIPMANAGER (strict `===` on the numeric role id): if `getTotalLeaveDaysFromYear(applicant, fromYear) + leave.dateCount > appliedUser.leaveCount`, **400** `This user have exceeded the leave limit for <year> year!`.
5. Transaction:
   - Set `status = APPROVED`, `approveBy = updatedBy = req.auth.id`, `approveDate = now` and `approveRemark = remark`.
   - Clear the rejection info: `rejectBy = null`, `rejectDate = null`, `rejectReason = ''`.
   - Save and commit.
6. After the commit: `leaveService.clearTotalLeaveDaysCache(appliedUser._id, fromYear)` deletes `leave-totalLeaveDays-<user>-<year>`.

**Response**: **201** `"Leave approved successfully!"`, `data: LeaveResponseDto`. The populated `approveBy` was replaced by a raw id, so `approvedUser` comes back as `''`.

### 4.6 `PUT /leave/reject/:id` — rejectLeave (`leave.controller.ts:494-547`)

**Body**: `{ remark }` (same Joi schema).

1. `findByIdAndStatusIn(id, [PENDING, APPROVED])`. If not found: **404** `Leave not found!`.
2. Transaction:
   - Set `status = REJECTED`, `rejectBy = updatedBy = auth.id`, `rejectDate = now` and `rejectReason = remark`.
   - Clear the approval info: `approveBy = null`, `approveDate = null`, `approveRemark = ''`.
   - Save and commit.

**Response**: **201** `"Leave rejected successfully!"`, `data: LeaveResponseDto`.

There is no quota re-check. The totals cache is **not** cleared (see §8).

### 4.7 `PUT /leave/cancel/:id` — cancelLeave (`leave.controller.ts:549-584`)

1. `findByIdAndStatusIn(id, [PENDING])`. If not found: **404** `Leave not found!`.
2. Transaction: `status = CANCELLED`, `updatedBy = auth.id`, save.

**Response**: **201** `"Leave cancelled successfully!"`, `data: LeaveResponseDto`.

There is no ownership check: any authenticated user can cancel any pending leave.

### 4.8 `GET /leave/leaveCount` — getLeaveCount (`leave.controller.ts:586-716`)

**Query**: `year` (optional; defaults to the current year; `Number(...)`).

`countByYearUserIdAndStatusIn(userId, year, statuses)` **sums `dateCount`** over the matching leaves, using the same year window as §4.3. It returns days, not record counts.

| Caller | approve / reject / pending | remaining | yearlyEligible |
|---|---|---|---|
| ADMIN, FINANCEOFFICER, TRIPMANAGER | day sums for APPROVED / REJECTED / PENDING | `user.leaveCount - getTotalLeaveDaysFromYear(user, year)` | `user.leaveCount` |
| DRIVER | day sums | `0` | `0` |
| SUPERADMIN and others | `0` | `0` | `0` |

**Response**: **200**, `data: { approveLeaveCount, rejectLeaveCount, pendingLeaveCount, remainingLeaveCount, yearlyEligibleLeaveCount }`.

### 4.9 `POST /leave/eligibleLeaves` — getEligibleLeaves (`leave.controller.ts:718-738`)

1. `companyWorkingInfoService.getCompanyWorkingInfo()`. If there is none: **400** `Company not found!`.
2. `user = findByIdWithGenderRole(auth.id)` and `used = getTotalLeaveDaysFromYear(auth.id, workingYear)`.
3. `data = user.leaveCount - used`. If `leaveCount` is undefined (e.g. drivers), this is `NaN`, which serialises to `null`.

**Response**: **200**, `data: number`.

## 5. Business Rules & State Transitions

### Status machine (`WellKnownLeaveStatus`)

```
PENDING(1) --approve--> APPROVED(2)
PENDING(1) --reject---> REJECTED(3)
PENDING(1) --cancel---> CANCELLED(4)   (terminal)
PENDING(1) --update---> PENDING(1)     (fields only)
APPROVED(2) <--approve/reject--> REJECTED(3)
```

| From | Action | To | Source |
|---|---|---|---|
| PENDING | update (fields) | PENDING | `updateLeave` |
| PENDING | cancel | CANCELLED | `cancelLeave` |
| PENDING, REJECTED | approve | APPROVED | `approveLeave` |
| PENDING, APPROVED | reject | REJECTED | `rejectLeave` |
| CANCELLED | none | n/a | terminal |

`isMonthEndDone` is **not** checked by any transition, so leaves already closed by month-end audit can still be approved, rejected or cancelled.

### Calculations

- **Approved days used in a year** (`getTotalLeaveDaysFromYear`, `leave.service.ts:56-82`):
  ```
  used = Σ dateCount  over Leave{ appliedUser=u, status=APPROVED,
                                  startDate ≥ new Date(Y,0,1), endDate ≤ new Date(Y,11,31) }
  ```
  It is cached under `leave-totalLeaveDays-<userId>-<Y>` for `THREE_MONTHS` (7,776,000 s). The cache is cleared only by `approveLeave`, or by any `user.service.Save`, which clears all prefixes.
- **Apply quota** (admin types): reject if `used >= leaveCount || used + dateCount > leaveCount`. Pending leaves are **not** counted.
- **Update quota** (admin types): reject if `(used == 0 && used - old + new <= leaveCount)` or `used - old + new > leaveCount`.
- **Approve quota** (admin types): reject if `used + leave.dateCount > leaveCount`.
- **Remaining** = `leaveCount - used`.
- **Year window**: uses server-local `new Date(Y,0,1)` and `new Date(Y,11,31)` (midnight on Dec 31). A leave spanning New Year is counted in **neither** year. A leave ending on Dec 31 after 00:00 local time is excluded.
- **Overlap rule**: a new or edited leave may not intersect (inclusive) any PENDING or APPROVED leave of the same user.

## 6. Utilities & DTOs

### `leaveUtil.leaveModelToLeaveResponseDto(leave)` (`leave.util.ts:4-36`)

| DTO field | Source |
|---|---|
| `_id, startDate, endDate, dateCount, reason, status, createdAt, updatedAt` | Copied |
| `statusName` | `WellKnownLeaveStatus[status]`, e.g. `"PENDING"` |
| `appliedUser` | `leave.appliedUser._id` (needs populate, else crash) |
| `appliedUserName` | `appliedUser.fullName \|\| ''` |
| `appliedUserRole` | `appliedUser.role?.name \|\| ''` (only when role is nested-populated) |
| `availableLeaveCount` | `leave.availableLeaveCount \|\| ''`. A value of `0` becomes `''` |
| `approveBy` / `approvedUser` | `approveBy?._id \|\| null` / `approveBy?.fullName \|\| ''` |
| `approveDate`, `approveRemark` | `\|\| null` / `\|\| ''` |
| `rejectBy` / `rejectedUser`, `rejectDate`, `rejectReason` | Same pattern |
| `isMonthEndDone` | Boolean |
| `createdBy` / `createdUser`, `updatedBy` / `updatedUser` | `_id` / `fullName \|\| ''` |

`leaveModelToLeaveResponseDtos(leaves)` maps the function above over an array.

`LeaveCountResponseDto`: `{ approveLeaveCount, rejectLeaveCount, pendingLeaveCount, remainingLeaveCount, yearlyEligibleLeaveCount }`. All values are **days**.

### Service functions (`leave.service.ts`)

| Function | Purpose / query |
|---|---|
| `checkUserAlreadyApplied(userId, from, to)` | Overlap with PENDING or APPROVED leaves, returns boolean |
| `checkUserAlreadyAppliedForUpdate(userId, leaveId, from, to)` | Same, excluding `leaveId` |
| `save(leave, session)` | `leave.save({session})` or `leave.save()`. **No cache clearing** |
| `getTotalLeaveDaysFromYear(userId, year)` | See §5. Cached |
| `findAllByUserIdYearAndStatus(userId, year, statuses)` | See §4.3. An empty `userId` means all users |
| `findByIdAndStatusIn(id, statuses)` | Single leave, populates the five user refs (not the role) |
| `countByYearUserIdAndStatusIn(userId, year, statuses)` | **Sum of `dateCount`**, despite the name |
| `countByMonthYearUserIdAndStatusIn(userId, year, month, statuses)` | `countDocuments` with `startDate ≥ new Date(y,m,1)` and `endDate ≤ new Date(y,m,31)`. **Unused** (callers are commented out) |
| `findAllLeavesByMonthYearAndStatusIn(year, month, statuses)` | Leaves with `startDate` in `[new Date(y,m,1), new Date(y,m+1,0)]`, populated. `month` is treated as **0-based**. Used by Month Audit |
| `clearTotalLeaveDaysCache(userId, year)` | Deletes the cache key for that user and year |

## 7. Dependencies

**Uses**
- `user` module: `userService.findById`, `findByIdWithGenderRole` (`User.leaveCount`, role).
- `common` module: `companyWorkingInfoService.getCompanyWorkingInfo` (`workingYear`).
- `util/cache`, `util/helper.util.getNameFromEnum`, `WellKnownLeaveStatus`, Joi.

**Used by**
- `monthAudit.controller.ts`:
  - `monthEndDoneForLeave` (`:164-190`) loads the working month's leaves in all four statuses and sets `isMonthEndDone = true`, `batchId` and `updatedBy`, saving within the month-close transaction.
  - `getPendingLeaves` (`:320-375`) lists the working month's PENDING leaves with `availableLeaveCount`.
- `notification.service.ts:75-92` reads `Leave` directly: PENDING leaves with `startDate ≤ today+3d` and `endDate ≥ today`.
- `vehicle.controller.ts:8` imports `leaveService` but does not use it.

## 8. Notes / Gotchas

1. ⚠️ **Approve and reject are not restricted to SUPERADMIN**: `authorize(constants.USER.ROLES.SUPERADMIN)` passes a number, not an array, so the role check is skipped (`leave.route.ts:51,57`). Any authenticated user, including the applicant, can approve their own leave.
2. ⚠️ **`updateAdminLeave` Branch A is inverted** (`leave.controller.ts:253-260`). When the user has 0 approved days in the year and the edit is *within* the limit, it throws "exceeded". If the edit is over the limit, Branch B throws. So an admin-type user with no approved leave that year can **never** update a pending leave.
3. ⚠️ **Update subtracts the old `dateCount` from `used`**, but `used` counts only APPROVED leaves, and an editable leave is always PENDING. This makes the check too lenient.
4. ⚠️ **Stale yearly total after reject**: rejecting an APPROVED leave does not clear `leave-totalLeaveDays-*`, and `leaveService.save` clears nothing. Remaining-days figures and quota checks stay overstated for up to three months, or until some user save flushes the cache.
5. ⚠️ **Month index mismatch**: `findAllLeavesByMonthYearAndStatusIn` treats `month` as 0-based (`new Date(year, month, 1)`), but Month Audit passes `CompanyWorkingInfo.workingMonth`, which is 1-based (`new Date(year, month - 1, 1)` in `monthAudit.controller.ts:111`). Month-end stamping and pending-leave listing therefore look at the **following** month.
6. No ownership checks on `GET /:id`, `PUT /update/:id` or `PUT /cancel/:id`. In update, the quota and overlap checks use the **caller's** id, not the leave owner's.
7. `dateCount` is trusted from the client. Nothing verifies `endDate ≥ startDate` or that `dateCount` matches the date range.
8. Pending leaves are not counted toward the quota at apply time, so several pending requests can together exceed the allowance. Approval does catch this.
9. Year-window edge cases: leaves spanning two years, or ending late on Dec 31, are ignored by every yearly query (lists, counts, totals). The behaviour also depends on the server's time zone.
10. `getAllLeaves` and `getLeaveCount` return empty or zero data for DRIVERASSISTANT and TRIPASSISTANT. The apply route also excludes those roles, although their login menus include "Leave Management".
11. Users without `leaveCount` (e.g. drivers) get `NaN` from `getEligibleLeaves`, which serialises to `null`. For admin types without `leaveCount`, every comparison with `undefined` is false, so the allowance is effectively **unlimited**.
12. `approveLeave` calls `clearTotalLeaveDaysCache(appliedUser._id, …)` after the commit. If the applicant has since been soft-deleted, `appliedUser` is null and this throws a 500 *after* the approval was saved.
13. Approve, reject and cancel respond with **201 Created** for updates. Update returns the raw document, not the DTO.
14. `getEligibleLeaves` is a `POST` with no body. The `applicationRoutes.leave.getAllUserLeave` (`/user`) route is defined but not registered.
15. `availableLeaveCount` is set as an ad-hoc property on Mongoose documents. The DTO converts `0` to `''`, which mixes number and string types.
16. `countByMonthYearUserIdAndStatusIn` uses `new Date(y, m, 31)`, which overflows into the next month for months with fewer than 31 days. It is currently unused.
