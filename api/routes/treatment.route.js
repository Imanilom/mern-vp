import express from 'express';
import { verifyToken } from '../utils/verifyUser.js';
import {getTreatment,  createTreatment, updateTreatment, deleteTreatment, switchStatus, getTreatmentDetail} from '../controllers/treatment.controller.js';

const router = express.Router();

router.get('/getTreatment/:patient', verifyToken, getTreatment);
router.get('/:id', verifyToken, getTreatmentDetail);
router.post('/createTreatment', verifyToken, createTreatment);
router.post('/switchTreatment', verifyToken, switchStatus);
router.post('/UpdateTreatment', verifyToken, updateTreatment);
router.delete('/:id', verifyToken, deleteTreatment);

export default router;