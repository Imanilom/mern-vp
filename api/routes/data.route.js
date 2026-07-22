import express from 'express';
import { getFilteredAndRawData, fetchDailyData } from '../controllers/user.controller.js';
import { getRawPolarData } from '../controllers/data.controller.js';

const router = express.Router();

// Rute untuk mendapatkan data yang sudah difilter dan data mentah
router.get('/filtered-raw', getFilteredAndRawData);
router.get('/daily-data', fetchDailyData);
router.get('/raw/:userId', getRawPolarData);
export default router;