import express from 'express';
import {
  getUserLive,
  getUserHistory,
  getUserPredictions,
  getUserConfidence,
} from '../controllers/userpatient.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

router.use(verifyToken);

router.get('/live', getUserLive);
router.get('/history', getUserHistory);
router.get('/predictions', getUserPredictions);
router.get('/confidence', getUserConfidence);

export default router;
