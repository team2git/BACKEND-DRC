import express from 'express';
import {
    getSubcities,
    createSubcity,
    deleteSubcity,
    getWoredas,
    createWoreda,
    deleteWoreda,
    getLocationHierarchy
} from '../controllers/locationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Publicly accessible for authenticated users (dropdown lists)
router.get('/hierarchy', protect, getLocationHierarchy);
router.get('/subcities', protect, getSubcities);
router.get('/woredas', protect, getWoredas);

// Protected administrative actions
router.post('/subcities', protect, createSubcity);
router.delete('/subcities/:id', protect, deleteSubcity);
router.post('/woredas', protect, createWoreda);
router.delete('/woredas/:id', protect, deleteWoreda);

export default router;
