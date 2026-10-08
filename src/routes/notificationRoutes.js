import express from 'express';
import {
  sendNotification,
  getNotifications,
  getExtensionFeed,
  markNotificationRead,
} from '../controllers/notificationController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public Extension Feed for Chrome Extension Real-time polling/alerting
router.get('/extension-feed', getExtensionFeed);

// Protected Dashboard notification routes
router.use(protect);

router.route('/')
  .get(getNotifications);

router.post('/send', sendNotification);
router.put('/:id/read', markNotificationRead);

export default router;
