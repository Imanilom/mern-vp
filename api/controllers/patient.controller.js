import Patient from '../models/patient.model.js';

export const getAllPatients = async (req, res) => {
    try {
        const patient = await Patient.find();
        console.log(patient);
        res.status(200).json(patients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Add other controller functions as necessary