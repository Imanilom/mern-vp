import express from "express";
import {postCheck, getListPatientByActivity} from '../controllers/action.recomendation.controller.js';
import { verifyToken } from "../utils/verifyUser.js";

const router = express.Router();

// Your route here >>
router.post('/check', verifyToken ,postCheck);
router.get('/listPatient/:activity_id', verifyToken , getListPatientByActivity);


export default router;