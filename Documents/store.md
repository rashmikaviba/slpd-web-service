# Store Module (File Uploads)

## 1. Overview

The Store module is the system's **file-upload service**. The front-end uploads documents and images here, including:

- staff profile photos, NIC scans, GS certificates, driving licences, SLTDA certificates and police reports;
- expense receipts;
- vehicle damage photos;
- maintenance invoices.

Each upload gets back a public URL. That URL is then saved in the owning record, for example `User.profileImageUrl` or an expense's receipt URL.

Files are written to the local disk under `src/uploads/<UploadTypeName>/`. They are served statically by Express at `/uploads/...` (`src/app.ts:29-35`). The module has **no database model**.

All API paths are relative to `/api/v1`.

## 2. Files

| File | Role |
|---|---|
| `src/modules/store/store.route.ts` | Routes, wiring the multer middleware to controllers |
| `src/modules/store/store.controller.ts` | `UploadFile`, `UploadMultipleFiles`: build public URLs |
| Shared: `src/util/multer.util.ts` | Multer `diskStorage` config (`upload`). The unused `DeleteFileFromName` helper was removed |
| Shared: `src/util/enums/well-known-upload-type.enum.ts` | Upload type → folder name |
| Shared: `src/app.ts:29-35` | Static serving of `/uploads` |

## 3. Data Model

There is none. The module does not touch MongoDB.

### Upload types (`WellKnownUploadType`)

The `type` query parameter selects the target folder, `src/uploads/<Name>/`:

| `type` | Folder name |
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

### Storage configuration (`src/util/multer.util.ts:6-23`)

- **destination**:
  - `type = Number(req.query.type)`.
  - If `!helperUtil.isValueInEnum(WellKnownUploadType, type)` (i.e. `Object.values(...).includes(type)`), call `cb(new BadRequestError('Invalid upload type'))`.
  - Otherwise use `'src/uploads/' + WellKnownUploadType[type] + '/'`. This path is **relative to the process working directory**.
- **filename**: `` `${Date.now()}-${file.originalname}` ``. Busboy runs with the default `preservePath: false`, so any directory part of the client filename is stripped.
- **limits / fileFilter**: **none**. There is no size limit and no MIME or extension restriction.

## 4. API Endpoints

Base path `/store` (`src/applicationRoutes.ts:11-15`, mounted in `src/mapping.ts:29`).

| Method | Full path | Middleware | Controller | Auth | Description |
|---|---|---|---|---|---|
| POST | `/store/upload?type=<1-9>` | `upload.single('file')` | `UploadFile` | **none (public)** | Upload one file |
| POST | `/store/uploadMultiple?type=<1-9>` | `upload.array('files', 10)` | `UploadMultipleFiles` | **none (public)** | Upload up to 10 files |

### 4.1 `POST /store/upload` — UploadFile (`store.controller.ts:10-27`)

**Request**: `multipart/form-data` with the file in field **`file`**. **Query**: `type` (required; a value from 1 to 9).

**Logic**
1. Multer runs `destination`. An invalid or missing `type` gives **400** `Invalid upload type`. The error is passed through multer to `errorHandlerMiddleware`.
2. Multer writes the file to `src/uploads/<TypeName>/<timestamp>-<originalname>`.
3. If `req.file` is missing (no file sent): **400** `Please upload a file!`.
4. `normalizedPath = path.normalize(file.path).replace(/\\/g, '/')`. This converts Windows backslashes.
5. `pathData = normalizedPath.split('src/').pop()`, giving e.g. `uploads/ProfileImage/1729850000000-photo.jpg`.

**Response**: **200** `"File uploaded successfully"`. `data` is the string `` `${BASE_URL}/${pathData}` ``, e.g. `https://api.example.com/uploads/ProfileImage/1729850000000-photo.jpg`.

### 4.2 `POST /store/uploadMultiple` — UploadMultipleFiles (`store.controller.ts:30-52`)

**Request**: `multipart/form-data` with files in field **`files`** (maximum 10). **Query**: `type` (required, 1–9). All files go to the same type folder.

**Logic**
1. Multer stores every file as in §4.1.
2. If `req.files` is missing or empty: **400** `Please upload a file!`.
3. For each file: `file.path.split('src/').pop()`, prefixed with `BASE_URL + '/'`. Backslashes are **not** normalized here.

**Response**: **200** `"Files uploaded successfully"`. `data` is a `string[]` of URLs, in upload order.

### Errors (both endpoints)

| Status | Message | Cause |
|---|---|---|
| 400 | `Invalid upload type` | `type` missing, non-numeric or not 1–9 |
| 400 | `Please upload a file!` | No file in the expected field |
| 500 | `Unexpected field` (MulterError `LIMIT_UNEXPECTED_FILE`) | Wrong field name, or more than 10 files on `/uploadMultiple`. MulterError has no `statusCode`, so the error middleware defaults to 500 |
| 500 | `ENOENT: no such file or directory ...` | The target type folder does not exist (see §8) |

## 5. Business Rules

- **URL formula**: `publicUrl = BASE_URL + '/' + <saved path after the last "src/">`. `BASE_URL` comes from the env file (`.env.dev` or `.env.prod`, `src/config/environment.config.ts`). It must be the server origin, **without** `/api/v1`, because files are served at `/<origin>/uploads/...`.
- **Static serving**: `app.use('/uploads', express.static(uploadsPath))`. `uploadsPath` is `/app/src/uploads` when `NODE_ENV=production`, and `path.join(__dirname, 'uploads')` (i.e. `src/uploads`) otherwise. Uploaded files are publicly readable without authentication.
- **File naming**: a millisecond timestamp plus the original name. Two uploads of the same name in the same millisecond would overwrite each other.
- There is no record of uploads and no ownership. Files are never deleted: there is no delete helper anywhere in the codebase now.

## 6. Utilities

| Function | File | Behaviour |
|---|---|---|
| `upload` | `src/util/multer.util.ts:25` | `multer({ storage })` with the destination and filename rules from §3 |
| `helperUtil.isValueInEnum` / `getNameFromEnum` | `src/util/helper.util.ts:5-12` | Type validation and folder-name lookup |

There are no DTOs.

## 7. Dependencies

**Uses**: `multer` 1.4.5-lts.1 (busboy 1.x), `envConfig.BASE_URL`, `WellKnownUploadType`, `BadRequestError`, `CommonResponse`.

**Used by**: the front-end only. No backend module calls this one. Its URLs end up in:
- `User.profileImageUrl`, `nicImageUrl`, `gsCertificateUrl`, `drivingLicenseUrl`, `sltdaCertificateUrl` and `policeReportUrl` (see `user.md`);
- expense receipts, vehicle damage photos and maintenance invoices stored by their respective modules.

## 8. Notes / Gotchas

1. ⚠️ **Unauthenticated uploads**: neither route uses `authMiddleware.authorize`. Anyone who can reach the API can write files to the server disk.
2. ⚠️ **No size limit or file-type filter**: an attacker can fill the disk. Files such as `.html` or `.svg` are then served from the API origin by `express.static`, which is a stored-XSS / content-hosting risk.
3. ⚠️ **Missing folders are not created**: when `destination` is a function, multer does **not** create the directory. The repo contains only `src/uploads/MaintenanceInvoice/`. Uploads for any other type fail with `ENOENT` (500) unless the folders already exist on the server, for example created manually or in the Docker image.
4. The upload path is relative to the CWD (`src/uploads/`), but the static path in development is relative to `__dirname`. These agree only when the process starts from the project root. In production both rely on the CWD being `/app`.
5. `UploadMultipleFiles` does not normalize backslashes the way `UploadFile` does. On Windows, the returned URLs would contain `\`.
6. The `ExpensesRecept` folder name is misspelled. Changing it now would break stored URLs.
7. There is no file-delete path at all (the unused `DeleteFileFromName` helper and the `fs-extra` dependency were removed), so replaced or orphaned documents (e.g. an old profile photo after `PUT /user/:id`) accumulate on disk.
8. Wrong field names or too many files return a 500 instead of a 400, because `MulterError` is not mapped in `error.middleware.ts`.

## Changelog

### 2026-10-25 — synced with code changes in commit `50632dc` ("Code Ai Optimization revamp")

- No changes in `src/modules/store`.
- `src/util/multer.util.ts`: unused `DeleteFileFromName` and its `path`/`fs-extra` imports removed; `fs-extra` dropped from `package.json`. Storage config and `upload` line references updated.
- `src/applicationRoutes.ts` line references shifted; `mapping.ts` reference corrected.
- Gotcha #7 reworded (no delete helper exists any more).
