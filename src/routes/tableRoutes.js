import express from 'express';
import {
  getTables,
  createTable,
  updateTable,
  updateTableStatus,
  deleteTable,
} from '../controllers/tableController.js';
import { protect, optionalProtect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/public', getTables);
router.get('/', optionalProtect, getTables);

router.use(protect);

router.route('/')
  .post(createTable);

router.route('/:id/status')
  .put(updateTableStatus);

router.route('/:id')
  .put(updateTable)
  .delete(deleteTable);

export default router;
