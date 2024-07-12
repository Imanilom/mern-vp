import express from 'express';
import { createActivity, deleteActivity, editActivity, getActivity, get} from '../controllers/activity.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

router.get('/getActivity', getActivity);
router.get('/get/:id', get);
router.post('/create', createActivity);
router.delete('/delete/:id', verifyToken ,deleteActivity);
router.post('/update/:id', editActivity);

    
export default router;
