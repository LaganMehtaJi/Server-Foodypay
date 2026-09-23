import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingController.js';
import upload from '../middlewares/uploadMiddleware.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getSettings)
  .put(upload.single('logo'), updateSettings);

export default router;
