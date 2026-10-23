import express from 'express';
import {
  getTables,
  createTable,
  updateTable,
  updateTableStatus,
  deleteTable,
} from '../controllers/tableController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getTables)
  .post(createTable);

router.route('/:id/status')
  .put(updateTableStatus);

router.route('/:id')
  .put(updateTable)
  .delete(deleteTable);

export default router;
