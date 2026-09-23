import express from 'express';
import { getCoupons, createCoupon, deleteCoupon } from '../controllers/couponController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getCoupons)
  .post(createCoupon);

router.route('/:id')
  .delete(deleteCoupon);

export default router;
