import express from 'express';
import {
  getDishes,
  createDish,
  updateDish,
  toggleDishStock,
  deleteDish,
  bulkMigrateDishes,
} from '../controllers/dishController.js';
import upload from '../middlewares/uploadMiddleware.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public & Bulk endpoints
router.get('/public', getDishes);
router.post('/bulk-migrate', bulkMigrateDishes);

// Optional auth helper middleware: if Authorization header present, verify, else proceed
const optionalAuth = (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return protect(req, res, next);
  }
  next();
};

router.route('/')
  .get(optionalAuth, getDishes)
  .post(optionalAuth, upload.single('image'), createDish);

router.route('/:id')
  .put(optionalAuth, upload.single('image'), updateDish)
  .delete(optionalAuth, deleteDish);

router.route('/:id/stock')
  .patch(optionalAuth, toggleDishStock);

export default router;
