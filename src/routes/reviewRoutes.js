import express from 'express';
import { getReviews, createReview, replyToReview } from '../controllers/reviewController.js';

const router = express.Router();

router.route('/')
  .get(getReviews)
  .post(createReview);

router.route('/:id/reply')
  .put(replyToReview);

export default router;
