import express from 'express';
import { createRazorpayOrder, verifyRazorpaySignature } from '../controllers/paymentController.js';

const router = express.Router();

router.post('/create-razorpay-order', createRazorpayOrder);
router.post('/verify-signature', verifyRazorpaySignature);

export default router;
