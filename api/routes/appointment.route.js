import express from 'express';

import { verifyToken } from '../utils/verifyUser.js';
import {requestAppointmentUser, acceptAndCreateAppointment, EndedAppointment} from '../controllers/appointment.controller.js';
const router = express.Router();

// your route
router.post('/requestAppointment', verifyToken, requestAppointmentUser);
router.post('/acceptAppointment', verifyToken, acceptAndCreateAppointment);
router.post('/endedAppointment', verifyToken, EndedAppointment);

export default router;