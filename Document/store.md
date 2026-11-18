# Store module (file upload)

Stores uploaded files on the server's local disk under `src/uploads/<TypeName>/` and returns public URLs. Other modules only persist the returned URL strings (e.g. `User.profileImageUrl`, expense receipts, vehicle damage photos, maintenance invoices). Multer basics are in [README › File uploads](README.md#file-uploads-utilmulterutilts).

## Files

| File | Responsibility |
|---|---|
| `src/modules/store/store.route.ts` | Routes (`StoreRouter`, mounted at `/api/v1/store`), attaches multer middleware. |
| `src/modules/store/store.controller.ts` | `UploadFile`, `UploadMultipleFiles` — build URLs. |
| `src/util/multer.util.ts` | `upload` (multer disk storage), `DeleteFileFromName`. |
| `src/util/enums/well-known-upload-type.enum.ts` | `WellKnownUploadType` → folder names. |
| `src/app.ts:30-35` | Static serving of `/uploads`. |

## Data model

None (no collection). Files live on disk.

`WellKnownUploadType` (`?type=` value → folder):

| Value | Folder |
|---|---|
| 1 | `ProfileImage` |
| 2 | `NICImage` |
| 3 | `GSCertificate` |
| 4 | `DrivingLicense` |
| 5 | `SLTDACertificate` |
| 6 | `PoliceReport` |
| 7 | `ExpensesRecept` |
| 8 | `VehicleDamage` |
| 9 | `MaintenanceInvoice` |

## Endpoints

| Method | Path | Roles allowed | Validation | Handler |
|---|---|---|---|---|
| POST | `/api/v1/store/upload?type=<1-9>` | **public — no `authorize()`** | multer `upload.single('file')` + type check | `UploadFile` |
| POST | `/api/v1/store/uploadMultiple?type=<1-9>` | **public** | multer `upload.array('files', 10)` + type check | `UploadMultipleFiles` |
| GET | `/uploads/<TypeName>/<file>` | public (express.static, outside `/api/v1`) | — | static |

## Endpoint logic

### Multer storage (`multer.util.ts:8-25`)

For each incoming file:
1. `destination`: `type = req.query.type`. If `Number(type)` is not a value of `WellKnownUploadType` (`helperUtil.isValueInEnum`) → `cb(new BadRequestError('Invalid upload type'))` → request fails with 400 `Invalid upload type`.
2. Path = `'src/uploads/' + WellKnownUploadType[type] + '/'` — **relative to the process working directory**. Multer does not create the directory when `destination` is a function; if it is missing the write fails with `ENOENT` (500).
3. `filename`: `` `${Date.now()}-${file.originalname}` ``.

No file-size limit, no MIME/extension filter. Body must be `multipart/form-data`.

### POST `/store/upload` — `UploadFile` (`store.controller.ts:10`)

Form field: `file` (single). Query: `type`.
1. No `req.file` → `BadRequestError('Please upload a file!')`.
2. `normalizedPath = path.normalize(file.path)` with `\` → `/`; `pathData` = part after the last `src/` (e.g. `uploads/ProfileImage/1700000000000-me.jpg`).

Response 200, `File uploaded successfully`, `data` = `` `${BASE_URL}/${pathData}` `` (string).

### POST `/store/uploadMultiple` — `UploadMultipleFiles` (`store.controller.ts:30`)

Form field: `files` (max 10; an 11th file → multer `LIMIT_UNEXPECTED_FILE` error, 500). Query: `type`.
1. No files / empty → `BadRequestError('Please upload a file!')`.
2. For each file: `file.path.split('src/').pop()` → `` `${BASE_URL}/${path}` `` (no Windows path normalisation here).

Response 200, `Files uploaded successfully`, `data` = `string[]`.

### Static serving (`app.ts:30-35`)

`app.use('/uploads', express.static(uploadsPath))`, where `uploadsPath` = `/app/src/uploads` when `NODE_ENV === 'production'` (Docker layout), else `path.join(__dirname, 'uploads')` (= `src/uploads` under ts-node). It is registered before the access-log middleware, so file hits are not logged. Therefore `BASE_URL` must be the server origin (without `/api/v1`) for the returned URLs to resolve.

## Service layer

None.

## Utilities

- `upload` — configured multer instance (above).
- `DeleteFileFromName(imageUrl)` (`multer.util.ts:29`) → takes the part after the last `/uploads`, joins `__dirname/../uploads/<rest>` (i.e. `src/uploads/...` relative to the compiled `util` dir), `fs.remove`; returns `true`/`false`. **Not called anywhere** — replaced/removed files are never deleted from disk.

## Business rules

- Upload first, then send the returned URL in the owning entity's create/update request.
- Upload type decides only the folder; there is no ownership or link back to the entity.

## Cross-module dependencies

- Consumers store only the URL string: [user](user.md) document fields (types 1–6), `Expenses.expenses[].receiptUrl` and `Trip.*.receiptImageUrl` (receipts), vehicle-damage and maintenance-invoice URLs (types 8, 9). The server never checks that a stored URL came from this endpoint or matches the type.
- Env: `BASE_URL`, `NODE_ENV`.

## Known issues / notes

1. **Uploads are unauthenticated** — no `authMiddleware.authorize` on either route (`store.route.ts:8-18`); anyone can write files to the server.
2. No size limit or file-type filter (`multer.util.ts:27`); `originalname` is used in the filename unchanged (busboy strips directories, but spaces/unicode end up in URLs unencoded).
3. Upload folders are not created automatically; only `src/uploads/MaintenanceInvoice/` exists in the repo, so other types fail with `ENOENT` on a fresh checkout unless the folders are created (`multer.util.ts:11-20`).
4. Multer writes relative to CWD (`src/uploads/`) while static serving uses `__dirname`/`/app/src/uploads`; they only match when the process is started from the project root (`multer.util.ts:11`, `app.ts:30-33`).
5. `UploadMultipleFiles` does not normalise Windows separators like `UploadFile` does (`store.controller.ts:41`).
6. `DeleteFileFromName` is dead code; orphaned files accumulate (`multer.util.ts:29`).
7. `src/uploads/uploadtest.ts` is an empty placeholder file; a sample invoice JPG is committed under `src/uploads/MaintenanceInvoice/`.
