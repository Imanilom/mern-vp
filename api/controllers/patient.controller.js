import Patient from '../models/patient.model.js';
import User from '../models/user.model.js';
import { getAnalysisSummary } from './analysis.controller.js';

export const getAllPatients = async (req, res) => {
    try {
        const { role, id } = req.user;

        let patients;
        if (role === 'doctor') {
            patients = await User.find({ docter: id }).lean();
        } else {
            patients = await User.find({ _id: id }).lean();
        }

        // Fetch dynamic alert summary for each patient
        const patientsWithAlerts = await Promise.all(
            patients.map(async (p) => {
                const summary = await getAnalysisSummary(p._id.toString());
                
                // Map the summary to what the frontend expects
                const hasAlert = summary.latest_status === 'alert' || summary.latest_status === 'caution';
                let alertPriority = 'Normal';
                if (summary.latest_status === 'alert') alertPriority = 'High';
                else if (summary.latest_status === 'caution') alertPriority = 'Medium';

                return {
                    ...p,
                    hasAlert,
                    alertPriority,
                    recentDeviation: summary.latest_status === 'alert' ? 'Anomali terdeteksi' : (summary.latest_status === 'caution' ? 'Deviasi terdeteksi' : null)
                };
            })
        );

        res.status(200).json(patientsWithAlerts);
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