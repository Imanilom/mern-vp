import express from 'express';
import {
  getDoctorPatients,
  getDoctorPatientById,
  getDoctorPatientLive,
  getDoctorPatientHistory,
  getDoctorPatientPredictions,
  postDoctorPatientValidation,
  getDoctorPatientConfidence,
} from '../controllers/doctor.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

// Middleware ensuring doctor role
const requireDoctor = (req, res, next) => {
  if (req.user && req.user.role !== 'doctor') {
    return res.status(403).json({ success: false, message: 'Access denied: Doctor role required' });
  }
  next();
};

router.use(verifyToken);
router.use(requireDoctor);

router.get('/patients', getDoctorPatients);
router.get('/patient/:id', getDoctorPatientById);
router.get('/patient/:id/live', getDoctorPatientLive);
router.get('/patient/:id/history', getDoctorPatientHistory);
router.get('/patient/:id/predictions', getDoctorPatientPredictions);
router.post('/patient/:id/validation', postDoctorPatientValidation);
router.get('/patient/:id/confidence', getDoctorPatientConfidence);

export default router;
