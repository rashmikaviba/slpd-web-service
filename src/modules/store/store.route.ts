import { Router } from 'express';
import { UploadFile, UploadMultipleFiles } from './store.controller';
import { secureUpload } from '../../util/multer.util';
import authMiddleware from '../../middleware/auth.middleware';
import applicationRoutes from '../../applicationRoutes';

const StoreRouter = Router();

StoreRouter.post(
    applicationRoutes.store.uploadFile,
    authMiddleware.authorize(),
    secureUpload.single('file'),
    UploadFile
);

StoreRouter.post(
    applicationRoutes.store.uploadMultipleFiles,
    authMiddleware.authorize(),
    secureUpload.array('files', 10),
    UploadMultipleFiles
);

export default StoreRouter;
