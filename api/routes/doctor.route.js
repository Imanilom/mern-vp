import express from 'express';
import {
  getDoctorPatients,
  getDoctorPatientById,
  getDoctorPatientLive,
  getDoctorPatientHistory,
  getDoctorPatientPredictions,
  postDoctorPatientValidation,
  getDoctorPatientConfidence,
  listDoctorLogPatients,
  listDoctorPatientLogs,
  listDoctorCaparWindowNodes,
  saveDoctorCaparWindowNode,
  saveDoctorCaparDailyAnalysis,
} from '../controllers/doctor.controller.js';
import {
  listDoctorCaparTemporalTimeline,
  listDoctorCaparGraph,
  listDoctorCaparRows,
  listDoctorCaparActivityEpisodes,
  rebuildDoctorCaparActivityEpisodes,
  saveDoctorCaparDynamicProfile,
} from '../controllers/doctorCaparVisualization.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

// Middleware ensuring doctor role
const requireDoctor = (req, res, next) => {
  if (!req.user || req.user.role !== 'doctor') {
    return res.status(403).json({ success: false, message: 'Access denied: Doctor role required' });
  }
  next();
};

router.use(verifyToken);
router.use(requireDoctor);

router.get('/patients', getDoctorPatients);
router.get('/logs/patients', listDoctorLogPatients);
router.get('/logs', listDoctorPatientLogs);
router.get('/capar-window-nodes', listDoctorCaparWindowNodes);
router.post('/capar-window-nodes', saveDoctorCaparWindowNode);
router.post('/capar-window-analyses/daily', saveDoctorCaparDailyAnalysis);
router.get('/capar-visualization/rows', listDoctorCaparRows);
router.get('/capar-visualization/timeline', listDoctorCaparTemporalTimeline);
router.get('/capar-visualization/graph', listDoctorCaparGraph);
router.post('/capar-visualization/dynamic-profile', saveDoctorCaparDynamicProfile);
router.get('/capar-visualization/activities', listDoctorCaparActivityEpisodes);
router.post('/capar-visualization/activities/rebuild', rebuildDoctorCaparActivityEpisodes);
router.get('/patient/:id', getDoctorPatientById);
router.get('/patient/:id/live', getDoctorPatientLive);
router.get('/patient/:id/history', getDoctorPatientHistory);
router.get('/patient/:id/predictions', getDoctorPatientPredictions);
router.post('/patient/:id/validation', postDoctorPatientValidation);
router.get('/patient/:id/confidence', getDoctorPatientConfidence);

export default router;
