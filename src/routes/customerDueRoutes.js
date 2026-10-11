import express from 'express';
import {
  getCustomerDues,
  recordCustomerDue,
  settleCustomerDue,
} from '../controllers/customerDueController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getCustomerDues)
  .post(recordCustomerDue);

router.post('/settle', settleCustomerDue);

export default router;
