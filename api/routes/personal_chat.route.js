import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  generatePersonalChatAnswer,
  listDoctorChatPatients,
} from '../controllers/personal_chat.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

const geminiChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Batas penggunaan Gemini tercapai. Coba lagi beberapa saat.',
  },
});

router.post('/gemini', verifyToken, geminiChatLimiter, generatePersonalChatAnswer);
router.get('/patients', verifyToken, listDoctorChatPatients);

export default router;
