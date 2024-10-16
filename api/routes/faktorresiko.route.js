import {createLab, delDoc, delLab, fillDoc, getAllLab, showDoc} from '../controllers/faktorresiko.controller.js';
import express from 'express';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

router.get('/labs/:patientid', verifyToken, getAllLab);
router.get('/docs/:lab', verifyToken, showDoc);
router.post('/createLab', verifyToken, createLab);
router.post('/fillDoc', verifyToken, fillDoc);
router.delete('/lab/:id', verifyToken, delLab);
router.delete('/lab/doc/:id', verifyToken, delDoc);

export default router;