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
