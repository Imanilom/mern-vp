import express from 'express';
import {createRiwayatMedis} from '../controllers/riwayatmedis.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

router.post('/riwayatmedis', verifyToken, createRiwayatMedis);

export default router;