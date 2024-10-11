import Patient from '../models/patient.model.js';
import User from '../models/user.model.js';

export const getAllPatients = async (req, res) => {
    try {
        const { role, id } = req.user; // doctor

        const patients = await User.find({
            docter: id
        });

        res.status(200).json(patients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getNonePatient = async (req, res) => {
    const page = req.query.p || 0;
    const maxItems = 5;

    try {
        const [patients, countDoc] = await Promise.all([
            User.find({
                docter: { $exists: false }, role: { $ne: 'doctor' }
            }).sort({ create_at: -1 }).skip(page * maxItems).limit(maxItems),
            User.countDocuments({ docter: { $exists: false }, role: { $ne: 'doctor' } })
        ]);

        const lengthPage = Math.floor(countDoc / maxItems) + 1;
        console.log({ countDoc })

        res.status(200).json({ patients, lengthPage });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export const setPatient = async (req, res) => {

    try {
        const id = req.body.id;
        const pasien = await User.findById(id);
        const doctor = await User.findById(req.user.id);

        pasien.docter = doctor._id;
        await pasien.save() 
        console.log({ id, pasien, doctor })

        res.status(200).json({ msg: 'oke' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


// Add other controller functions as necessary