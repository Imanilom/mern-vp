import express from 'express';
import Patient from '../models/patient.model.js';
import { getAllPatients, getNonePatient, setPatient } from '../controllers/patient.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

router.get('/all', verifyToken, getAllPatients);
router.get('/add/pasient', verifyToken, getNonePatient);
router.post('/add/pasient', verifyToken, setPatient);

export default router;