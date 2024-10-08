import express from 'express';
import { createActivity, deleteActivity, editActivity, getActivity, get} from '../controllers/activity.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

router.get('/getActivity', verifyToken, getActivity);
router.get('/getActivity/:patient', verifyToken, getActivity); // untuk route docter

router.get('/get/:id', get);
router.post('/create', createActivity);

router.delete('/delete/:id', verifyToken ,deleteActivity);
router.post('/update/:id', verifyToken, editActivity);
export default router;
