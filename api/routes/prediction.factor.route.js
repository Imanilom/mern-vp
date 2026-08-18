import express from 'express';

import { verifyToken } from '../utils/verifyUser.js';
import {createFactorPrediction, deleteFactorPrediction, getAppointmentPredictionPatient} from '../controllers/prediction.controller.js';

const router = express.Router();

// router.
router.get('/getinfo', verifyToken, getAppointmentPredictionPatient);
router.post('/sendinfo', verifyToken, createFactorPrediction);
router.delete('/deleteinfo/:id', verifyToken, deleteFactorPrediction);

export default router;