import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  createPatientAppCheckIn,
  createPatientAppEvent,
  createPatientAppWearableSample,
  deletePatientAppCheckIn,
  getPatientAppDailySummary,
  getPatientAppCheckIn,
  getPatientAppCaparInsights,
  getPatientAppOverview,
  getPatientAppProfile,
  listPatientAppCheckIns,
  listPatientAppEvents,
  listPatientAppWearableSamples,
  linkPatientAppToCaparUser,
  registerPatientAppAccount,
  streamPatientAppWearableData,
  updatePatientAppProfile,
} from '../controllers/patient_app.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan pendaftaran. Coba lagi nanti.' },
});

router.post('/register', registrationLimiter, registerPatientAppAccount);
router.get('/profile', verifyToken, getPatientAppProfile);
router.patch('/profile', verifyToken, updatePatientAppProfile);
router.get('/overview', verifyToken, getPatientAppOverview);
router.get('/daily-summary', verifyToken, getPatientAppDailySummary);
router.get('/capar-insights', verifyToken, getPatientAppCaparInsights);
router.post('/link-capar-account', verifyToken, linkPatientAppToCaparUser);
router.post('/check-ins', verifyToken, createPatientAppCheckIn);
router.get('/check-ins', verifyToken, listPatientAppCheckIns);
router.get('/check-ins/:checkInId', verifyToken, getPatientAppCheckIn);
router.delete('/check-ins/:checkInId', verifyToken, deletePatientAppCheckIn);
router.post('/events', verifyToken, createPatientAppEvent);
router.get('/events', verifyToken, listPatientAppEvents);
router.post('/wearable/samples', verifyToken, createPatientAppWearableSample);
router.post('/wearable/stream', verifyToken, streamPatientAppWearableData);
router.get('/wearable/samples', verifyToken, listPatientAppWearableSamples);

export default router;
