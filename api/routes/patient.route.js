import express from 'express';
import Patient from '../models/patient.model.js';

const router = express.Router();

// Route to get all patients
router.get('/', async (req, res) => {
    try {
        const patients = await Patient.find();
        res.json(patients);
    } catch (err) {
        res.status(500).send(err);
    }
});

export default router;