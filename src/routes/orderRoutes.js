import express from 'express';
import {
  getOrders,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
} from '../controllers/orderController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getOrders)
  .post(createOrder);

router.route('/:id/status')
  .put(updateOrderStatus);

router.route('/:id')
  .put(updateOrder)
  .delete(deleteOrder);

export default router;
