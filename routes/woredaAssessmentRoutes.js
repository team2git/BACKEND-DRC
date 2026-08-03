import express from 'express';
import {
    getWoredaAssessments,
    getWoredaAssessmentById,
    createWoredaAssessment,
    updateWoredaAssessment,
    deleteWoredaAssessment
} from '../controllers/WoredaAssessmentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getWoredaAssessments);
router.post('/', protect, createWoredaAssessment);
router.get('/:id', protect, getWoredaAssessmentById);
router.put('/:id', protect, updateWoredaAssessment);
router.delete('/:id', protect, deleteWoredaAssessment);

export default router;

import express from 'express';
import {
    getWoredaAssessments,
    getWoredaAssessmentById,
    createWoredaAssessment,
    updateWoredaAssessment,
    deleteWoredaAssessment
} from '../controllers/WoredaAssessmentController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { applyScopeFilter, checkDocumentAccess } from '../middleware/dataScope.js';
import WoredaAssessment from '../models/WoredaAssessment.js';

const router = express.Router();

router.get('/', protect, checkPermission('woredaassessment', 'view'), applyScopeFilter(WoredaAssessment), getWoredaAssessments);
router.post('/', protect, checkPermission('woredaassessment', 'create'), createWoredaAssessment);
router.get('/:id', protect, checkPermission('woredaassessment', 'view'), checkDocumentAccess(WoredaAssessment), getWoredaAssessmentById);
router.put('/:id', protect, checkPermission('woredaassessment', 'update'), checkDocumentAccess(WoredaAssessment), updateWoredaAssessment);
router.delete('/:id', protect, checkPermission('woredaassessment', 'delete'), checkDocumentAccess(WoredaAssessment), deleteWoredaAssessment);

export default router;
