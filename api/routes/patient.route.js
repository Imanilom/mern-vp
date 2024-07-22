import express from 'express';
import Patient from '../models/patient.model.js';
import { getAllPatients } from '../controllers/patient.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

router.get('/all', verifyToken, getAllPatients);

export default router;