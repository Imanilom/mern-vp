import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  createPatientAppCheckIn,
  createPatientAppEvent,
  createPatientAppAction,
  createPatientHilExplanation,
  createPatientHilSession,
  createPatientHilScenarioLog,
  createPatientScenarioEvent,
  createPatientScenarioQuestionnaire,
  createPatientAppWearableSample,
  completePatientScenarioSession,
  completePatientHilSession,
  deletePatientAppCheckIn,
  getPatientAppDailySummary,
  getPatientAppCheckIn,
  getPatientAppCaparInsights,
  getPatientAppCaparHistory,
  getPatientAppOverview,
  getPatientAppImpactSummary,
  getPatientAppScenarios,
  getPatientAppProfile,
  getPatientAppGamification,
  getPatientAppWearableHistory,
  getPatientAppHilBaselines,
  listPatientAppCheckIns,
  listPatientAppEvents,
  listPatientHilExplanations,
  listPatientHilScenarioLogs,
  listPatientAppActions,
  listPatientAppWearableSamples,
  listPatientScenarioEvents,
  listPatientScenarioQuestionnaires,
  listPatientScenarioSessions,
  linkPatientAppToCaparUser,
  registerPatientAppAccount,
  retrainPatientAppHiladModel,
  streamPatientAppWearableData,
  evaluatePatientAppHilRealtime,
  listPatientAppHilRealtimeEvaluations,
  getPatientAppHiladClusters,
  getPatientAppHiladStatus,
  startPatientScenarioSession,
  submitPatientAppHiladFeedback,
  getPatientScenarioSession,
  updatePatientAppProfile,
  updatePatientAppGamification,
  updatePatientAppActionStatus,
} from '../controllers/patient_app.controller.js';
import { verifyToken } from '../utils/verifyUser.js';
import personalChatRouter from './personal_chat.route.js';

const router = express.Router();
router.use('/chat', personalChatRouter);

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan pendaftaran. Coba lagi nanti.' },
});

const scenarioWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak perubahan skenario. Coba lagi nanti.' },
});

const hilWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Sesi HIL sedang sibuk. Tunggu beberapa saat lalu coba lagi.' },
});

const hilRealtimeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan evaluasi HIL realtime.' },
});

router.post('/register', registrationLimiter, registerPatientAppAccount);
router.get('/profile', verifyToken, getPatientAppProfile);
router.patch('/profile', verifyToken, updatePatientAppProfile);
router.get('/gamification', verifyToken, getPatientAppGamification);
router.patch('/gamification', verifyToken, updatePatientAppGamification);
router.get('/overview', verifyToken, getPatientAppOverview);
router.get('/daily-summary', verifyToken, getPatientAppDailySummary);
router.get('/capar-insights', verifyToken, getPatientAppCaparInsights);
router.get('/capar-history', verifyToken, getPatientAppCaparHistory);
router.get('/impact-summary', verifyToken, getPatientAppImpactSummary);
router.get('/scenarios', verifyToken, getPatientAppScenarios);
router.post(
  '/scenarios/:scenarioId/sessions',
  verifyToken,
  scenarioWriteLimiter,
  startPatientScenarioSession
);
router.get('/scenario-sessions', verifyToken, listPatientScenarioSessions);
router.get('/scenario-sessions/:sessionId', verifyToken, getPatientScenarioSession);
router.get(
  '/scenario-sessions/:sessionId/events',
  verifyToken,
  listPatientScenarioEvents
);
router.post(
  '/scenario-sessions/:sessionId/events',
  verifyToken,
  scenarioWriteLimiter,
  createPatientScenarioEvent
);
router.get(
  '/scenario-sessions/:sessionId/questionnaires',
  verifyToken,
  listPatientScenarioQuestionnaires
);
router.post(
  '/scenario-sessions/:sessionId/questionnaires',
  verifyToken,
  scenarioWriteLimiter,
  createPatientScenarioQuestionnaire
);
router.patch(
  '/scenario-sessions/:sessionId/complete',
  verifyToken,
  scenarioWriteLimiter,
  completePatientScenarioSession
);
router.post('/link-capar-account', verifyToken, linkPatientAppToCaparUser);
router.post('/check-ins', verifyToken, createPatientAppCheckIn);
router.get('/check-ins', verifyToken, listPatientAppCheckIns);
router.get('/check-ins/:checkInId', verifyToken, getPatientAppCheckIn);
router.delete('/check-ins/:checkInId', verifyToken, deletePatientAppCheckIn);
router.post('/events', verifyToken, createPatientAppEvent);
router.get('/events', verifyToken, listPatientAppEvents);
router.post('/hil-explanations', verifyToken, hilWriteLimiter, createPatientHilExplanation);
router.get('/hil-explanations', verifyToken, listPatientHilExplanations);
router.post('/hil-sessions', verifyToken, hilWriteLimiter, createPatientHilSession);
router.patch(
  '/hil-sessions/:runId/complete',
  verifyToken,
  hilWriteLimiter,
  completePatientHilSession
);
router.post('/hil-scenario-logs', verifyToken, hilWriteLimiter, createPatientHilScenarioLog);
router.get('/hil-scenario-logs', verifyToken, listPatientHilScenarioLogs);
router.get('/hil-baselines', verifyToken, getPatientAppHilBaselines);
router.post('/actions', verifyToken, createPatientAppAction);
router.get('/actions', verifyToken, listPatientAppActions);
router.patch('/actions/:actionId/status', verifyToken, updatePatientAppActionStatus);
router.post('/wearable/samples', verifyToken, createPatientAppWearableSample);
router.post('/wearable/stream', verifyToken, streamPatientAppWearableData);
router.post(
  '/wearable/hil-realtime',
  verifyToken,
  hilRealtimeLimiter,
  evaluatePatientAppHilRealtime
);
router.get(
  '/wearable/hil-realtime',
  verifyToken,
  hilRealtimeLimiter,
  listPatientAppHilRealtimeEvaluations
);
router.get('/wearable/hilad/status', verifyToken, hilRealtimeLimiter, getPatientAppHiladStatus);
router.get('/wearable/hilad/clusters', verifyToken, hilRealtimeLimiter, getPatientAppHiladClusters);
router.post(
  '/wearable/hilad/windows/:windowId/feedback',
  verifyToken,
  hilRealtimeLimiter,
  submitPatientAppHiladFeedback
);
router.post(
  '/wearable/hilad/retrain',
  verifyToken,
  hilRealtimeLimiter,
  retrainPatientAppHiladModel
);
router.get('/wearable/samples', verifyToken, listPatientAppWearableSamples);
router.get('/wearable/history', verifyToken, getPatientAppWearableHistory);

export default router;
