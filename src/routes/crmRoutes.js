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

const router = express.Router();

// Public routes for QR code table ordering and POS catalog sync
router.get('/menu/:uniqueId', getPublicMenu);
router.get('/public-menu', getPublicMenu);
router.post('/catalog', syncCatalog);

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
