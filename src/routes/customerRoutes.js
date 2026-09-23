import express from 'express';
import { getCustomers, createCustomer } from '../controllers/customerController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getCustomers)
  .post(createCustomer);

export default router;
