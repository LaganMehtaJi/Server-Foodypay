import express from 'express';
import { getCoupons, getPublicCustomerCoupons, createCoupon, deleteCoupon } from '../controllers/couponController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route for customers to fetch assigned store coupons
router.get('/public', getPublicCustomerCoupons);

// Protected routes for dashboard merchant
router.use(protect);

router.route('/')
  .get(getCoupons)
  .post(createCoupon);

router.route('/:id')
  .delete(deleteCoupon);

export default router;
