import express from 'express';
import { getReviews, createReview, replyToReview, deleteReview } from '../controllers/reviewController.js';
import { protect, optionalProtect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(optionalProtect, getReviews)
  .post(optionalProtect, createReview);

router.route('/:id')
  .delete(protect, deleteReview);

router.route('/:id/reply')
  .put(protect, replyToReview);

export default router;
