import express from 'express';
import {
  createPublicInspectionRequest,
  trackInspectionRequest,
  listInspectionRequests,
  getInspectionRequestById,
  updateInspectionRequest,
} from '../controllers/inspectionRequestController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/public', createPublicInspectionRequest);
router.get('/public/track/:trackingNumber', trackInspectionRequest);
router.get('/', protect, listInspectionRequests);
router.get('/:id', protect, getInspectionRequestById);
router.patch('/:id', protect, updateInspectionRequest);

export default router;
