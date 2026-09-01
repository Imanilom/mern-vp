/**
 * zeroshot.route.js
 * Route untuk fitur Zero-Shot Prompting CAPAR
 */

import express from 'express';
import {
  zeroShotAnalyze,
  listZeroShotEpisodes,
  promptPreview,
} from '../controllers/zeroshot.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

// POST /api/ai/zero-shot/analyze — jalankan analisis zero-shot ke LLM
router.post('/analyze', verifyToken, zeroShotAnalyze);

// GET  /api/ai/zero-shot/episodes — daftar episode yang bisa dianalisis
router.get('/episodes', verifyToken, listZeroShotEpisodes);

// GET  /api/ai/zero-shot/prompt-preview — preview prompt tanpa memanggil LLM
router.get('/prompt-preview', verifyToken, promptPreview);

export default router;
