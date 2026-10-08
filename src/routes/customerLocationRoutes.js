import express from 'express';
import {
  checkDeliveryAvailability,
  getAvailableProducts,
} from '../controllers/customerLocationController.js';

const router = express.Router();

router.get('/delivery-availability', checkDeliveryAvailability);
router.get('/available-products', getAvailableProducts);

export default router;
