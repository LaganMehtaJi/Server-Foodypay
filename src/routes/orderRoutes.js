import express from 'express';
import {
  getOrders,
  getOrderStats,
  createOrder,
  createPublicOrder,
  claimPublicOrder,
  updatePublicOrder,
  deletePublicOrder,
  getPublicOrders,
  syncPosTableStatus,
  updateOrder,
  updateOrderStatus,
  markOrderSeen,
  deleteOrder,
} from '../controllers/orderController.js';
import { protect, optionalWaiterProtect, protectWaiter } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route for QR code table ordering, Waiter App, and Merchant POS Sync
router.get('/public', getPublicOrders);
router.post('/public', optionalWaiterProtect, createPublicOrder);
router.post('/public/claim', claimPublicOrder);
router.post('/public/call-waiter', callWaiter);
router.get('/public/waiter-calls', getWaiterCalls);
router.post('/public/dismiss-waiter-call', dismissWaiterCall);
router.put('/public/:id', optionalWaiterProtect, updatePublicOrder);
router.delete('/public/:id', protectWaiter, deletePublicOrder);
router.post('/pos/sync-table-status', syncPosTableStatus);

router.use(protect);

router.get('/stats', getOrderStats);

router.route('/')
  .get(getOrders)
  .post(createOrder);

router.route('/:id/status')
  .put(updateOrderStatus);

router.route('/:id/seen')
  .put(markOrderSeen);

router.route('/:id')
  .put(updateOrder)
  .delete(deleteOrder);

export default router;
