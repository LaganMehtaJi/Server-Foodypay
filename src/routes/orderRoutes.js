import express from 'express';
import {
  getOrders,
  getOrderStats,
  createOrder,
  createPublicOrder,
  getPublicOrders,
  updateOrder,
  updateOrderStatus,
  markOrderSeen,
  deleteOrder,
} from '../controllers/orderController.js';
import { protect, optionalProtect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes for QR code table ordering, Kitchen KDS, and POS operations
router.get('/public', getPublicOrders);
router.post('/public', createPublicOrder);
router.put('/public/:id/status', updateOrderStatus);
router.put('/public/:id/kitchen-seen', markOrderSeen);
router.put('/public/:id', updateOrder);

// Allow GET and PUT with optional token so unauthenticated or local sessions don't get 401
router.get('/', optionalProtect, getOrders);
router.route('/:id')
  .put(optionalProtect, updateOrder);

router.route('/:id/status')
  .put(optionalProtect, updateOrderStatus);

router.use(protect);

router.get('/stats', getOrderStats);

router.route('/')
  .post(createOrder);

router.route('/:id/seen')
  .put(markOrderSeen);

router.route('/:id')
  .delete(deleteOrder);

export default router;
