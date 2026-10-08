import express from 'express';
import {
  getDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
} from '../controllers/deliveryZoneController.js';

const router = express.Router();

router.route('/zones').get(getDeliveryZones).post(createDeliveryZone);
router.route('/zones/:id').put(updateDeliveryZone).delete(deleteDeliveryZone);

export default router;
