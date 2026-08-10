import mongoose from 'mongoose';
import Patient from '../models/patient.model.js';
import User from '../models/user.model.js';
import { getAnalysisSummary } from './analysis.controller.js';

export const getAllPatients = async (req, res) => {
    try {
        console.log('[getAllPatients] req.user:', req.user);
        let role = req.user?.role;
        const id = req.user?.id;

        if (!id) {
            console.log('[getAllPatients] Missing ID in token');
            return res.status(401).json({ message: 'User ID missing in token' });
        }

        if (role) {
            role = role.toLowerCase();
            if (role === 'administrator') role = 'admin';
            if (role === 'patient') role = 'user';
        }

        const doctorObjId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
        console.log('[getAllPatients] Doctor ID:', id, 'ObjId:', doctorObjId, 'Role:', role);

        let patients = [];
        
        // 1. If doctor, find patients specifically linked to this doctor via 'docter' field
        if (role === 'doctor') {
            patients = await User.find({
                $or: [
                    { docter: doctorObjId },
                    { docter: id.toString() },
                    { doctor: doctorObjId },
                    { doctor: id.toString() }
                ]
            }).lean().catch((e) => { console.log('Err1:', e); return []; });
            console.log('[getAllPatients] Step 1 (Doctor specific), found:', patients?.length);
        }

        // 2. If not doctor or no doctor-linked patients found, find all users except current doctor/admin
        if (!patients || patients.length === 0) {
            patients = await User.find({
                _id: { $ne: doctorObjId },
                role: { $ne: 'doctor' }
            }).lean().catch((e) => { console.log('Err2:', e); return []; });
            console.log('[getAllPatients] Step 2 (Non-doctor users), found:', patients?.length);
        }

        // 3. Absolute fallback: load all users in database except self
        if (!patients || patients.length === 0) {
            patients = await User.find({ _id: { $ne: doctorObjId } }).lean().catch((e) => { console.log('Err3:', e); return []; });
            console.log('[getAllPatients] Step 3 (Absolute fallback), found:', patients?.length);
        }

        console.log('[getAllPatients] Total patients found before mapping:', patients?.length);

        // Fetch dynamic alert summary for each patient safely
        const patientsWithAlerts = await Promise.all(
            patients.map(async (p) => {
                let summary = { latest_status: 'stable', alert_count: 0, caution_count: 0 };
                try {
                    if (p && p._id) {
                        summary = await getAnalysisSummary(p._id.toString());
                    }
                } catch (err) {
                    console.error('[getAllPatients] getAnalysisSummary error for', p?._id, err.message);
                }
                
                const hasAlert = summary?.latest_status === 'alert' || summary?.latest_status === 'caution';
                let alertPriority = 'Normal';
                if (summary?.latest_status === 'alert') alertPriority = 'High';
                else if (summary?.latest_status === 'caution') alertPriority = 'Medium';

                return {
                    ...p,
                    id: p.guid || p._id?.toString(),
                    hasAlert,
                    alertPriority,
                    recentDeviation: summary?.latest_status === 'alert' ? 'Anomali terdeteksi' : (summary?.latest_status === 'caution' ? 'Deviasi terdeteksi' : null)
                };
            })
        );

        console.log('[getAllPatients] Successfully mapped patients, returning count:', patientsWithAlerts?.length);
        return res.status(200).json(patientsWithAlerts);
    } catch (error) {
        console.error('[getAllPatients] Controller Error:', error);
        return res.status(500).json({ message: error.message, patients: [] });
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