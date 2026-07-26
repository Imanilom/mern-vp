import express from 'express';
import { trainDecisionTree } from '../controllers/ml.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

// Route to train the model manually (protected, maybe should check for admin/doctor role)
router.post('/train', verifyToken, trainDecisionTree);

export default router;
