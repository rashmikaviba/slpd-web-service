import multer, { StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs-extra';
import helperUtil from './helper.util';
import { WellKnownUploadType } from './enums/well-known-upload-type.enum';
import BadRequestError from '../error/badRequest.error';

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
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

export const upload = multer({ storage });

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
