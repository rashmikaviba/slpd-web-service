import { Router } from 'express';
import { UploadFile, UploadMultipleFiles } from './store.controller';
import { upload } from '../../util/multer.util';
import applicationRoutes from '../../applicationRoutes';

const StoreRouter = Router();

StoreRouter.post(
    applicationRoutes.store.uploadFile,
    upload.single('file'),
    UploadFile
);

StoreRouter.post(
    applicationRoutes.store.uploadMultipleFiles,
    upload.array('files', 10),
    UploadMultipleFiles
);

export default StoreRouter;
