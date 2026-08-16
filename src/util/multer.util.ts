import multer, { StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';
import helperUtil from './helper.util';
import { WellKnownUploadType } from './enums/well-known-upload-type.enum';
import BadRequestError from '../error/BadRequestError';
import { envConfig } from '../config/environment.config';

const MAX_FILE_SIZE = Number(envConfig.UPLOAD_MAX_FILE_SIZE_MB || 10) * 1024 * 1024;
const MAX_FILE_COUNT = Number(envConfig.UPLOAD_MAX_FILE_COUNT || 10);
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const storage: StorageEngine = multer.diskStorage({
    destination: (req, file, cb) => {
        let type = req.query.type as string;
        let uploadPath = 'src/uploads/';

        if (!helperUtil.isValueInEnum(WellKnownUploadType, Number(type))) {
            return cb(new BadRequestError('Invalid upload type'), '');
        }

        uploadPath +=
            helperUtil.getNameFromEnum(WellKnownUploadType, type) + '/';

        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    },
});

export const upload = multer({ storage });
export const secureUpload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILE_COUNT },
    fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            return cb(new BadRequestError('Unsupported file type'));
        }
        cb(null, true);
    },
});

export const DeleteFileFromName = async (imageUrl: string) => {
    let filename: any = imageUrl.split('/uploads').pop();

    let filePath = path.join(__dirname, '..', 'uploads', filename);

    try {
        await fs.remove(filePath);
        return true;
    } catch (err: any) {
        return false;
    }
};
