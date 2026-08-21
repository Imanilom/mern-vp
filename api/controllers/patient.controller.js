import mongoose from 'mongoose';
import Patient from '../models/patient.model.js';
import User from '../models/user.model.js';
import Segment from '../models/segment.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';
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
        
        // 1. If user is 'user' (patient), they should ONLY see themselves
        if (role === 'user') {
            patients = await User.find({ _id: doctorObjId }).lean().catch((e) => { console.log('Err User:', e); return []; });
            console.log('[getAllPatients] Step 1 (User specific), found:', patients?.length);
        }
        // 2. If doctor, find patients specifically linked to this doctor via 'docter' field
        else if (role === 'doctor') {
            patients = await User.find({
                $or: [
                    { docter: doctorObjId },
                    { docter: id.toString() },
                    { doctor: doctorObjId },
                    { doctor: id.toString() }
                ]
            }).lean().catch((e) => { console.log('Err Doctor:', e); return []; });
            console.log('[getAllPatients] Step 2 (Doctor specific), found:', patients?.length);
        }
        // 3. If admin (or fallback if empty), find all users except current admin
        else {
            patients = await User.find({
                _id: { $ne: doctorObjId },
                role: { $ne: 'doctor' }
            }).lean().catch((e) => { console.log('Err Admin:', e); return []; });
            console.log('[getAllPatients] Step 3 (Admin / Fallback), found:', patients?.length);
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

                // Ambil anomaly score terbaru dari segment terakhir yang sudah dianalisis
                let latest_score = null;
                let latest_classification = null;
                let latest_physiological_state = null;
                let latest_context = null;
                let hrMean = null;
                let peakHr = null;
                let peakTime = null;
                let persistenceWindow = null;
                let lastSegTime = null;

                try {
                    if (p && p._id) {
                        const latestSeg = await Segment.findOne({
                            user_id: p._id,
                            analyzed: true,
                            is_valid: true,
                        }).sort({ window_start: -1 }).select('anomaly_score classification rr_status activity_label features.mean_hr window_start').lean();

                        if (latestSeg) {
                            latest_score = latestSeg.anomaly_score ?? null;
                            latest_classification = latestSeg.classification ?? null;
                            latest_physiological_state = latestSeg.rr_status ?? null;
                            latest_context = latestSeg.activity_label ?? null;
                            hrMean = latestSeg.features?.mean_hr ? Number(latestSeg.features.mean_hr.toFixed(1)) : null;
                            lastSegTime = latestSeg.window_start;
                        }

                        const recentEv = await AnomalyEvent.findOne({
                            user_id: p._id,
                        }).sort({ onset_time: -1 }).lean();

                        if (recentEv) {
                            peakHr = recentEv.peak_score ? Math.round(recentEv.peak_score * 12 + 75) : hrMean;
                            peakTime = recentEv.peak_time ? new Date(recentEv.peak_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : (lastSegTime ? new Date(lastSegTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null);
                            persistenceWindow = recentEv.window_count || recentEv.trajectory?.persistence || (latest_physiological_state?.includes('PERSISTENT') ? 3 : 1);
                        } else if (hrMean) {
                            peakHr = hrMean;
                            peakTime = lastSegTime ? new Date(lastSegTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null;
                            persistenceWindow = 1;
                        }
                    }
                } catch (err) {
                    console.error('[getAllPatients] Seg/Event fetch error:', err.message);
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
                    latest_score,
                    latest_classification,
                    latest_physiological_state,
                    latest_context,
                    hrMean,
                    peakHr,
                    peakTime,
                    persistenceWindow,
                    clockDrift: 0.0,
                    updatedAt: lastSegTime ? new Date(lastSegTime).toISOString() : p.updatedAt,
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