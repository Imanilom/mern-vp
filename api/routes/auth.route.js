import express from 'express';
import { google, signOut, signin, signup, backofficeRegister, getMe } from '../controllers/auth.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/backoffice-register', verifyToken, backofficeRegister);
router.post('/signin', signin);
router.get('/signout', signOut);
router.post('/google', google);
router.get('/me', verifyToken, getMe);

export default router;