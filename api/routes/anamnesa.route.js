import express from 'express';
import {createRiwayatMedis, getRiwayatMedisPasien, getOneAnamnesa, deleteRiwayat, createAnamnesa, updateAnamnesa, deleteAnamnesa} from '../controllers/riwayatmedis.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

router.post('/riwayatmedis', verifyToken, createRiwayatMedis);
router.get('/getanamnesa/:id', verifyToken, getRiwayatMedisPasien);
router.delete('/deleteriwayat/:id', verifyToken, deleteRiwayat);

// crud for admin to manage anamnesa
router.get('/getOneAnamnesa/:id', verifyToken, getOneAnamnesa);
router.post('/createAnamnesa/:riwayatid', verifyToken, createAnamnesa);
router.post('/updateAnamnesa/:id', verifyToken, updateAnamnesa);
router.delete('/deleteAnamnesa/:id', verifyToken, deleteAnamnesa);

export default router;