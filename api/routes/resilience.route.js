import express from 'express';
import {
  getCardiovascularResilienceState,
  calculateResilienceAssessment,
  createBehaviorEvent,
  getBehaviorEvents,
  deleteBehaviorEvent,
  getRagEvidenceMatrix,
  generateTemporalExplanation,
  confirmParticipantContext,
  retrieveRagEvidenceMultiDimensional,
  recordResilienceState,
  getResilienceStateHistory
} from '../controllers/resilience.controller.js';

const router = express.Router();

router.get('/state', getCardiovascularResilienceState);
router.post('/assess', calculateResilienceAssessment);
router.post('/record', recordResilienceState);
router.get('/history/:userId', getResilienceStateHistory);
router.post('/behavior', createBehaviorEvent);
router.get('/behavior/:userId', getBehaviorEvents);
router.delete('/behavior/:id', deleteBehaviorEvent);
router.get('/rag-evidence', getRagEvidenceMatrix);
router.post('/rag/retrieve', retrieveRagEvidenceMultiDimensional);
router.post('/explain-temporal', generateTemporalExplanation);
router.post('/confirm-context', confirmParticipantContext);

export default router;

