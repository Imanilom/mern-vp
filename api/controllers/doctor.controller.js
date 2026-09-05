import User from '../models/user.model.js';
import Segment from '../models/segment.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';
import DataTransformation from '../models/datatransformation.model.js';
import ActivityContext from '../models/activitycontext.model.js';
import mongoose from 'mongoose';

async function resolvePatientId(paramId) {
  if (mongoose.Types.ObjectId.isValid(paramId)) {
    const user = await User.findById(paramId);
    if (user) return user;
  }
  return User.findOne({ $or: [{ guid: paramId }, { username: paramId }, { email: paramId }] });
}

export const getDoctorPatients = async (req, res) => {
  try {
    const query = { role: 'user' };
    if (req.user?.id) {
      query.docter = req.user.id;
    }
    let patients = await User.find(query).select('-password');
    if (patients.length === 0 && req.user?.id) {
      // If doctor has no specific assigned patients, fetch all users for review
      patients = await User.find({ role: 'user' }).select('-password');
    }
    res.json({ success: true, count: patients.length, data: patients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDoctorPatientById = async (req, res) => {
  try {
    const patient = await resolvePatientId(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    res.json({ success: true, data: patient });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDoctorPatientLive = async (req, res) => {
  try {
    const patient = await resolvePatientId(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const latestTransform = await DataTransformation.find({ user_id: patient._id })
      .sort({ timestamp: -1 })
      .limit(10);

    const latestSegment = await Segment.findOne({ user_id: patient._id, is_valid: true })
      .sort({ window_start: -1 });

    res.json({
      success: true,
      data: {
        patient: { id: patient.guid, name: patient.name, device: patient.current_device },
        latest_segment: latestSegment,
        live_transform_stream: latestTransform,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDoctorPatientHistory = async (req, res) => {
  try {
    const patient = await resolvePatientId(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const limit = parseInt(req.query.limit) || 30;
    const history = await Segment.find({ user_id: patient._id, is_valid: true })
      .sort({ window_start: -1 })
      .limit(limit);

    res.json({ success: true, count: history.length, data: history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDoctorPatientPredictions = async (req, res) => {
  try {
    const patient = await resolvePatientId(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const predictions = await Segment.find({ user_id: patient._id, analyzed: true })
      .select('window_start window_end anomaly_score classification dt_prediction signal_quality activity_label')
      .sort({ window_start: -1 })
      .limit(30);

    res.json({ success: true, count: predictions.length, data: predictions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const postDoctorPatientValidation = async (req, res) => {
  try {
    const patient = await resolvePatientId(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const { segment_id, ground_truth_label, activity_label, doctor_notes } = req.body;

    const updatedSegment = await Segment.findOneAndUpdate(
      { _id: segment_id, user_id: patient._id },
      {
        $set: {
          ground_truth_label: ground_truth_label, // Normal, Stress, Fatigue, Artifact, Anomaly, Noise
          activity_label: activity_label || undefined,
          'doctor_validation.status': 'validated',
          'doctor_validation.validated_by': req.user ? req.user.id : null,
          'doctor_validation.doctor_notes': doctor_notes || '',
          'doctor_validation.validated_at': new Date(),
        }
      },
      { new: true }
    );

    if (!updatedSegment) {
      return res.status(404).json({ success: false, message: 'Segment not found for this patient' });
    }

    res.json({ success: true, message: 'Doctor validation saved as ground truth for retraining', data: updatedSegment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDoctorPatientConfidence = async (req, res) => {
  try {
    const patient = await resolvePatientId(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const segments = await Segment.find({ user_id: patient._id, is_valid: true })
      .select('window_start missing_data_info')
      .sort({ window_start: -1 })
      .limit(30);

    const confScores = segments.map(s => {
      const minfo = s.missing_data_info;
      if (typeof minfo?.confidence_score === 'number' && !isNaN(minfo.confidence_score)) {
        return minfo.confidence_score;
      }
      if (typeof minfo?.missing_ratio === 'number' && !isNaN(minfo.missing_ratio)) {
        return Math.max(0, Math.min(100, (1.0 - minfo.missing_ratio) * 100));
      }
      if (minfo?.expected_count && minfo?.received_count) {
        return Math.max(0, Math.min(100, (minfo.received_count / minfo.expected_count) * 100));
      }
      return 90.0;
    });

    const avgConfidence = confScores.length ? (confScores.reduce((a, b) => a + b, 0) / confScores.length) : 0.0;

    res.json({
      success: true,
      data: {
        avg_confidence_score: parseFloat(avgConfidence.toFixed(2)),
        quality_status: confScores.length === 0
          ? 'No Data Recorded'
          : avgConfidence < 80
          ? 'Warning Low Quality Data'
          : avgConfidence < 90
          ? 'Moderate Quality Data'
          : 'Good Quality Data',
        recent_windows: segments,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
