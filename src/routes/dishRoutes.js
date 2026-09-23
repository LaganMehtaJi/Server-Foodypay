import express from 'express';
import {
  getDishes,
  createDish,
  updateDish,
  toggleDishStock,
  deleteDish,
} from '../controllers/dishController.js';
import upload from '../middlewares/uploadMiddleware.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getDishes)
  .post(upload.single('image'), createDish);

router.route('/:id')
  .put(upload.single('image'), updateDish)
  .delete(deleteDish);

router.route('/:id/stock')
  .patch(toggleDishStock);

export default router;
