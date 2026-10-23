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
import { uploadToCloudinary } from '../utils/cloudinaryUpload.js';

const router = express.Router();

// Public & Bulk endpoints
router.get('/public', getDishes);
router.post('/bulk-migrate', bulkMigrateDishes);

// Direct Cloudinary Image Upload for Dishes / Catalog Items
router.post('/upload-image', upload.single('image'), async (req, res, next) => {
  try {
    let buffer = req.file ? req.file.buffer : null;
    if (!buffer && (req.body?.image || req.body?.dataUrl)) {
      const raw = req.body.image || req.body.dataUrl;
      const matches = raw.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches) buffer = Buffer.from(matches[2], 'base64');
    }
    if (!buffer) {
      return res.status(400).json({ success: false, message: 'Please provide an image file' });
    }
    const result = await uploadToCloudinary(buffer, 'foodypay_dishes');
    return res.json({
      success: true,
      url: result.url,
      secure_url: result.url,
      public_id: result.public_id,
    });
  } catch (err) {
    next(err);
  }
});

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
