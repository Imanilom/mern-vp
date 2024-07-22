import Patient from '../models/patient.model.js';

export const getAllPatients = async (req, res) => {
    try {
        const {role, id} = req.user; // doctor
        const patients = await Patient.find({
            docter : id
        });
        res.status(200).json(patients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Add other controller functions as necessary