import express from 'express';
import {
  getOrders,
  getOrderStats,
  createOrder,
  createPublicOrder,
  getPublicOrders,
  updateOrder,
  updateOrderStatus,
  updatePublicOrderStatus,
  markOrderSeen,
  markKitchenSeen,
  markPublicKitchenSeen,
  deleteOrder,
  moveKotTable,
} from '../controllers/orderController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route for QR code table ordering and Kitchen KDS
router.get('/public', getPublicOrders);
router.post('/public', createPublicOrder);
router.put('/public/:id/status', updatePublicOrderStatus);
router.put('/public/:id/kitchen-seen', markPublicKitchenSeen);

router.use(protect);

router.get('/stats', getOrderStats);

router.route('/')
  .get(getOrders)
  .post(createOrder);

router.route('/:id/status')
  .put(updateOrderStatus);

router.route('/:id/move-table')
  .patch(moveKotTable);

router.route('/:id/seen')
  .put(markOrderSeen);

router.route('/:id/kitchen-seen')
  .put(markKitchenSeen);

router.route('/:id')
  .put(updateOrder)
  .delete(deleteOrder);

export default router;

