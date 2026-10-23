import express from 'express';
import {
  syncCatalog,
  getCatalog,
  syncSalesBatch,
  getSales,
  syncSettings,
  syncAll,
  getLiveSales,
  getPublicMenu,
} from '../controllers/crmController.js';
import { protect } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';
import { uploadToCloudinary } from '../utils/cloudinaryUpload.js';

const router = express.Router();

// Public routes for QR code table ordering and POS catalog sync
router.get('/menu/:uniqueId', getPublicMenu);
router.get('/public-menu', getPublicMenu);
router.post('/catalog', syncCatalog);

// Image upload to Cloudinary for Catalog Dishes & CRM Products
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

router.use(protect);

// Catalog get
router.get('/catalog', getCatalog);

// Sales batch sync & retrieval
router.post('/sales/batch', syncSalesBatch);
router.get('/sales', getSales);
router.get('/sales/live', getLiveSales);

// Settings sync
router.post('/settings', syncSettings);

// Single-call complete restore
router.get('/sync-all', syncAll);

export default router;
