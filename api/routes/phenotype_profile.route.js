import express from 'express';
import {
  savePhenotypeProfile,
  getPhenotypeProfile,
  computePhenotypeProfileHandler,
  listPhenotypeHistory,
  getWeeklyFrozenPhenotypingHandler,
  confirmPatientBehaviorHandler,
  getCognitiveMemoryHandler,
  confirmBulkFactorsHandler,
  getBlock3StatusHandler,
  getPhiOutputHandler,
} from '../controllers/phenotype_profile.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

// Save / Upsert Phenotype Profile (Answers Q1-Q10)
router.post('/save', verifyToken, savePhenotypeProfile);

// Confirm patient behavioral factors & correlation (per-faktor, legacy)
router.post('/confirm-behavior', verifyToken, confirmPatientBehaviorHandler);

// Bulk confirm RAG factors — Gate Blok 2 → Blok 3 (min 12/15)
router.patch('/confirm-factors', verifyToken, confirmBulkFactorsHandler);

// Cek status gate Blok 3 untuk user
router.get('/block3-status/:userId', verifyToken, getBlock3StatusHandler);

// Φ Output terstruktur — siap dikonsumsi Blok 3 sebagai kovariate
router.get('/phi-output/:userId', verifyToken, getPhiOutputHandler);

// Compute dynamic Phenotype Profile from raw telemetry
router.get('/compute/:userId', verifyToken, computePhenotypeProfileHandler);

// Weekly Frozen Phenotyping Epochs & Damped Dynamics
router.get('/weekly/:userId', verifyToken, getWeeklyFrozenPhenotypingHandler);

// Cognitive Memory & Next-Week Feedback
router.get('/cognitive-memory/:userId', verifyToken, getCognitiveMemoryHandler);

// Get latest Phenotype Profile (returns saved or automatically computed)
router.get('/:userId', verifyToken, getPhenotypeProfile);

// List history
router.get('/history/:userId', verifyToken, listPhenotypeHistory);

export default router;

