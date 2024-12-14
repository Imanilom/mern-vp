import express from 'express';
import {createRecomendation, deleteRecommend, getRecomendationByPatient, detailRecomendation, updateRecomendation} from '../controllers/recomendation.controller.js';
import { verifyToken } from '../utils/verifyUser.js';


const router = express.Router();

// Your route here >>

router.post('/create', verifyToken , createRecomendation);
router.post('/update/:id', verifyToken , updateRecomendation);
router.get('/getAll/:patient', verifyToken , getRecomendationByPatient);
router.get('/getOne/:id', verifyToken , detailRecomendation);
router.delete('/delete/:id/:pasient_id', verifyToken , deleteRecommend);

export default router;