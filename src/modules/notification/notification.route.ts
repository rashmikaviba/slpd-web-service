import { Router } from 'express';
import applicationRoutes from '../../applicationRoutes';
import authMiddleware from '../../middleware/auth.middleware';
import constants from '../../constant';
import { getAllNotifications } from './notification.controller';

const NotificationRouter = Router();

// get all notifications
NotificationRouter.get(
    applicationRoutes.notification.getAllNotifications,
    authMiddleware.authorize([]),
    getAllNotifications
);

export default NotificationRouter;
