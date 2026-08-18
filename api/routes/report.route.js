import express from 'express';
import { generateReportData, getReports } from '../controllers/report.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

router.get('/generate', verifyToken, generateReportData);
router.get('/list/:userId', verifyToken, getReports);

export default router;
