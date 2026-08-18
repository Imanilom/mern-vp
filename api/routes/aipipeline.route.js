import express from 'express';
import {
  analyzeMissingData,
  detectArtifact,
  detectAnomaly,
  processKalmanFilter,
  createActivityContext,
  getActivityContextByUser,
  predictHealthRisk,
} from '../controllers/aipipeline.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

router.post('/prediction', verifyToken, predictHealthRisk);
router.post('/artifact/detect', verifyToken, detectArtifact);
router.post('/anomaly/detect', verifyToken, detectAnomaly);
router.post('/missing/analyze', verifyToken, analyzeMissingData);
router.post('/kalman/filter', verifyToken, processKalmanFilter);
router.post('/activity-context', verifyToken, createActivityContext);
router.get('/activity-context/:userId', verifyToken, getActivityContextByUser);

export default router;
