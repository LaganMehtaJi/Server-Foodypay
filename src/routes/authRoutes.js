import express from 'express';
import {
  registerUser,
  loginUser,
  googleAuth,
  getUserProfile,
} from '../controllers/authController.js';
import upload from '../middlewares/uploadMiddleware.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public auth routes
router.post('/register', upload.single('logo'), registerUser);
router.post('/login', loginUser);
router.post('/google', googleAuth);

// Protected auth route
router.get('/me', protect, getUserProfile);

export default router;
