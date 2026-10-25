import multer, { StorageEngine } from 'multer';
import helperUtil from './helper.util';
import { WellKnownUploadType } from './enums/well-known-upload-type.enum';
import BadRequestError from '../error/BadRequestError';

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

