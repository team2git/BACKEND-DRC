import express from 'express';
import {
  createEmergencyContact,
  deleteEmergencyContact,
  getPublicEmergencyDirectory,
  listEmergencyContacts,
  updateEmergencyContact,
} from '../controllers/emergencyContactController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get('/public', getPublicEmergencyDirectory);
router.get('/', protect, checkPermission('emergencycontact', 'view'), listEmergencyContacts);
router.post('/', protect, checkPermission('emergencycontact', 'create'), createEmergencyContact);
router.put('/:id', protect, checkPermission('emergencycontact', 'update'), updateEmergencyContact);
router.delete('/:id', protect, checkPermission('emergencycontact', 'delete'), deleteEmergencyContact);

export default router;
