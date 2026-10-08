import express from 'express';
import {
  getStores,
  getStoreById,
  createStore,
  updateStore,
  deleteStore,
  assignStoreOwnerEmail,
  assignZonesToStore,
} from '../controllers/storeController.js';

const router = express.Router();

router.route('/').get(getStores).post(createStore);
router.post('/assign-owner', assignStoreOwnerEmail);
router.route('/:id').get(getStoreById).put(updateStore).delete(deleteStore);
router.post('/:storeId/zones', assignZonesToStore);

export default router;
