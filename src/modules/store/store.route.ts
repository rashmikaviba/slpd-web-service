import { Router } from 'express';
import { UploadFile, UploadMultipleFiles } from './store.controller';
import { upload } from '../../util/multer.util';

const StoreRouter = Router();

StoreRouter.post('/upload', upload.single('file'), UploadFile);

StoreRouter.post(
    '/uploadMultiple',
    upload.array('files', 10),
    UploadMultipleFiles
);

export default StoreRouter;
