import express from 'express';
import { getFilteredAndRawData, fetchDailyData } from '../controllers/user.controller.js';

const router = express.Router();

// Rute untuk mendapatkan data yang sudah difilter dan data mentah
router.get('/filtered-raw', getFilteredAndRawData);
router.get('/daily-data', fetchDailyData);
export default router;