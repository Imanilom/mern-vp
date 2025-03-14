import express from 'express';
import { deleteUser, getLogWithActivity, pushActivity, logdfa, dfaActivity, test, Dailymetrics, updateUser, getUser, getRiwayatDeteksiWithDfa} from '../controllers/user.controller.js';
import { verifyToken } from '../utils/verifyUser.js';
const router = express.Router();

// router.get('/test', imputeData);
router.get('/testLogActivity', verifyToken, getLogWithActivity)
router.post('/pushActivity', verifyToken, pushActivity);
router.get('/logdfa', verifyToken, logdfa);
router.get('/dfa/activity', verifyToken, dfaActivity);
router.get('/test', verifyToken, test);
router.get('/metrics/:device', verifyToken, Dailymetrics);
// router.get('/test', test);
router.get('/test/:device', verifyToken, test);
router.get('/riwayatdeteksi/:userId', verifyToken, getRiwayatDeteksiWithDfa);
router.post('/update/:id', verifyToken, updateUser)
router.delete('/delete/:id', verifyToken, deleteUser)
router.get('/:id', verifyToken, getUser)


// test activitas

export default router;
