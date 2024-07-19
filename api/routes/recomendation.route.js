import express from 'express';
import {createRecomendation} from '../controllers/recomendation.controller.js';
import { verifyToken } from '../utils/verifyUser.js';


const router = express.Router();

// Your route here >>
router.post('/create', verifyToken ,createRecomendation);

export default router;