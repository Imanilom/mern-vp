import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  createPatientAppCheckIn,
  createPatientAppEvent,
  createPatientAppAction,
  createPatientAppWearableSample,
  deletePatientAppCheckIn,
  getPatientAppDailySummary,
  getPatientAppCheckIn,
  getPatientAppCaparInsights,
  getPatientAppOverview,
  getPatientAppImpactSummary,
  getPatientAppProfile,
  getPatientAppWearableHistory,
  listPatientAppCheckIns,
  listPatientAppEvents,
  listPatientAppActions,
  listPatientAppWearableSamples,
  linkPatientAppToCaparUser,
  registerPatientAppAccount,
  streamPatientAppWearableData,
  updatePatientAppProfile,
  updatePatientAppActionStatus,
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
router.get('/impact-summary', verifyToken, getPatientAppImpactSummary);
router.post('/link-capar-account', verifyToken, linkPatientAppToCaparUser);
router.post('/check-ins', verifyToken, createPatientAppCheckIn);
router.get('/check-ins', verifyToken, listPatientAppCheckIns);
router.get('/check-ins/:checkInId', verifyToken, getPatientAppCheckIn);
router.delete('/check-ins/:checkInId', verifyToken, deletePatientAppCheckIn);
router.post('/events', verifyToken, createPatientAppEvent);
router.get('/events', verifyToken, listPatientAppEvents);
router.post('/actions', verifyToken, createPatientAppAction);
router.get('/actions', verifyToken, listPatientAppActions);
router.patch('/actions/:actionId/status', verifyToken, updatePatientAppActionStatus);
router.post('/wearable/samples', verifyToken, createPatientAppWearableSample);
router.post('/wearable/stream', verifyToken, streamPatientAppWearableData);
router.get('/wearable/samples', verifyToken, listPatientAppWearableSamples);
router.get('/wearable/history', verifyToken, getPatientAppWearableHistory);

export default router;
