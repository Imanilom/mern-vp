import express from 'express';
import { getFilteredAndRawData } from '../controllers/user.controller.js';

const router = express.Router();

// Rute untuk mendapatkan data yang sudah difilter dan data mentah
router.get('/filtered-raw', getFilteredAndRawData);

export default router;