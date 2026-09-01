import express from 'express';
import {
  savePhenotypeProfile,
  getPhenotypeProfile,
  listPhenotypeHistory,
} from '../controllers/phenotype_profile.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

// Save / Upsert Phenotype Profile (Answers Q1-Q10)
router.post('/save', verifyToken, savePhenotypeProfile);

// Get latest Phenotype Profile
router.get('/:userId', verifyToken, getPhenotypeProfile);

// List history
router.get('/history/:userId', verifyToken, listPhenotypeHistory);

export default router;
