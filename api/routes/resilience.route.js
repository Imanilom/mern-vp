/**
 * resilience.route.js
 * Express router for Cardiovascular Resilience State (CRS) module
 */

import express from 'express';
import {
  getCardiovascularResilienceState,
  calculateResilienceAssessment
} from '../controllers/resilience.controller.js';

const router = express.Router();

router.get('/state', getCardiovascularResilienceState);
router.post('/assess', calculateResilienceAssessment);

export default router;
