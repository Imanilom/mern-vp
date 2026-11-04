import User from '../models/user.model.js';
import Patient from '../models/patient.model.js';
import Segment from '../models/segment.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';
import DataTransformation from '../models/datatransformation.model.js';
import ActivityContext from '../models/activitycontext.model.js';
import mongoose from 'mongoose';
import PatientAppAction from '../models/patient_app_action.model.js';
import PatientAppCheckIn from '../models/patient_app_checkin.model.js';
import PatientAppEvent from '../models/patient_app_event.model.js';
import PatientAppWearableSample from '../models/patient_app_wearable_sample.model.js';
import PatientHilBaseline from '../models/patient_hil_baseline.model.js';
import PatientHilExplanation from '../models/patient_hil_explanation.model.js';
import PatientHilRealtimeEvaluation from '../models/patient_hil_realtime_evaluation.model.js';
import PatientHilScenarioLog from '../models/patient_hil_scenario_log.model.js';
import PatientHilSession from '../models/patient_hil_session.model.js';
import PatientScenarioEvent from '../models/patient_scenario_event.model.js';
import PatientScenarioQuestionnaire from '../models/patient_scenario_questionnaire.model.js';
import PatientScenarioSession from '../models/patient_scenario_session.model.js';

const DOCTOR_LOG_SOURCES = [
  { type: 'hil_session', model: PatientHilSession, timeField: 'started_at' },
  { type: 'hil_scenario', model: PatientHilScenarioLog, timeField: 'createdAt' },
  { type: 'hil_explanation', model: PatientHilExplanation, timeField: 'createdAt' },
  { type: 'hil_realtime', model: PatientHilRealtimeEvaluation, timeField: 'evaluated_at' },
  { type: 'hil_baseline', model: PatientHilBaseline, timeField: 'recorded_at' },
  { type: 'check_in', model: PatientAppCheckIn, timeField: 'recorded_at' },
  { type: 'patient_event', model: PatientAppEvent, timeField: 'occurred_at' },
  { type: 'wearable', model: PatientAppWearableSample, timeField: 'recorded_at' },
  { type: 'patient_action', model: PatientAppAction, timeField: 'createdAt' },
  { type: 'scenario_session', model: PatientScenarioSession, timeField: 'createdAt' },
  { type: 'scenario_event', model: PatientScenarioEvent, timeField: 'event_time' },
  { type: 'scenario_questionnaire', model: PatientScenarioQuestionnaire, timeField: 'submitted_at' },
];

const DOCTOR_LOG_PROJECTIONS = {
  wearable: 'account_id account_type provider recording_purpose is_simulated recorded_at heart_rate_bpm activity_intensity posture sensor_contact signal_confidence data_quality device_id ingestion_source rmssd_ms sdnn_ms dfa_alpha1 motion_index spo2_pct steps activity sleep_duration_minutes sleep_quality skin_temperature_c createdAt',
};

function getDoctorLogCursor(rawCursor) {
  if (!rawCursor) return null;
  if (typeof rawCursor !== 'string' || rawCursor.length > 300) {
    throw new Error('Cursor log tidak valid.');
  }
  try {
    const cursor = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
    const date = new Date(cursor.date);
    if (!Number.isFinite(date.getTime()) || !mongoose.isValidObjectId(cursor.id)) {
      throw new Error('invalid cursor');
    }
    if (!DOCTOR_LOG_SOURCES.some((source) => source.type === cursor.type)) {
      throw new Error('invalid cursor');
    }
    return { date, id: new mongoose.Types.ObjectId(cursor.id), type: cursor.type };
  } catch {
    throw new Error('Cursor log tidak valid.');
  }
}

async function getDoctorPatientAccounts() {
  const [users, legacyPatients] = await Promise.all([
    User.find({ role: 'user' })
      .select('_id name email')
      .sort({ name: 1 })
      .lean(),
    Patient.find({ role: 'patient' })
      .select('_id user_id name email')
      .sort({ name: 1 })
      .lean(),
  ]);
  const userById = new Map(users.map((user) => [String(user._id), {
    ...user,
    account_refs: [{ account_id: user._id, account_type: 'user' }],
  }]));
  const patients = [...userById.values()];

  for (const patient of legacyPatients) {
    const linkedUser = patient.user_id && userById.get(String(patient.user_id));
    if (linkedUser) {
      linkedUser.account_refs.push({ account_id: patient._id, account_type: 'patient' });
    } else {
      patients.push({
        ...patient,
        account_refs: [{ account_id: patient._id, account_type: 'patient' }],
      });
    }
  }

  return patients.sort((first, second) => (
    String(first.name || '').localeCompare(String(second.name || ''))
  ));
}

export async function listDoctorLogPatients(req, res) {
  try {
    const patients = await getDoctorPatientAccounts();
    res.json({
      success: true,
      count: patients.length,
      data: patients.map(({ _id, name, email }) => ({
        _id,
        name,
        email,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listDoctorPatientLogs(req, res) {
  try {
    const allowedQuery = new Set(['patient_id', 'category', 'limit', 'cursor']);
    const unknownFields = Object.keys(req.query).filter((field) => !allowedQuery.has(field));
    if (unknownFields.length) {
      return res.status(400).json({
        success: false,
        message: `Query tidak dikenal: ${unknownFields.join(', ')}.`,
      });
    }

    const limit = req.query.limit === undefined ? 30 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ success: false, message: 'limit harus antara 1 dan 100.' });
    }
    const category = req.query.category === undefined ? null : String(req.query.category);
    if (category && !DOCTOR_LOG_SOURCES.some((source) => source.type === category)) {
      return res.status(400).json({ success: false, message: 'Kategori log tidak dikenal.' });
    }
    let cursor;
    try {
      cursor = getDoctorLogCursor(req.query.cursor);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const allPatients = await getDoctorPatientAccounts();
    let patients = allPatients;
    if (req.query.patient_id !== undefined) {
      if (!mongoose.isValidObjectId(req.query.patient_id)) {
        return res.status(400).json({ success: false, message: 'patient_id tidak valid.' });
      }
      const selectedPatient = allPatients.find(
        (patient) => String(patient._id) === String(req.query.patient_id)
      );
      if (!selectedPatient) {
        return res.status(404).json({ success: false, message: 'Pasien tidak ditemukan.' });
      }
      patients = [selectedPatient];
    }

    const refs = patients.flatMap((patient) => patient.account_refs || []);
    if (!refs.length) {
      return res.json({
        success: true,
        count: 0,
        has_more: false,
        next_cursor: null,
        data: [],
      });
    }
    const patientNameByAccount = new Map();
    for (const patient of patients) {
      for (const ref of patient.account_refs || []) {
        patientNameByAccount.set(`${ref.account_type}:${ref.account_id}`, {
          patient_id: String(patient._id),
          patient_name: patient.name,
        });
      }
    }
    const sources = DOCTOR_LOG_SOURCES.filter((source) => !category || source.type === category);
    const groups = await Promise.all(sources.map(async (source) => {
      const accountFilter = refs.map((ref) => ({
        account_id: ref.account_id,
        account_type: ref.account_type,
      }));
      const query = { $or: accountFilter };
      if (cursor) {
        const cursorClauses = [
          { [source.timeField]: { $lt: cursor.date } },
          { [source.timeField]: cursor.date, _id: { $lt: cursor.id } },
        ];
        if (source.type < cursor.type) {
          cursorClauses.push({ [source.timeField]: cursor.date, _id: cursor.id });
        }
        query.$and = [{
          $or: cursorClauses,
        }];
      }
      const rows = await source.model.find(query)
        .select(DOCTOR_LOG_PROJECTIONS[source.type] || undefined)
        .sort({ [source.timeField]: -1, _id: -1 })
        .limit(limit + 1)
        .lean();
      return rows.map((row) => {
        const owner = patientNameByAccount.get(`${row.account_type}:${row.account_id}`);
        const at = row[source.timeField];
        return {
          ...row,
          log_type: source.type,
          log_at: at,
          patient_id: owner?.patient_id || String(row.account_id),
          patient_name: owner?.patient_name || 'Pasien',
        };
      });
    }));

    const merged = groups.flat().sort((first, second) => {
      const timeDifference = new Date(second.log_at).getTime() - new Date(first.log_at).getTime();
      return timeDifference
        || String(second._id).localeCompare(String(first._id))
        || second.log_type.localeCompare(first.log_type);
    });
    const data = merged.slice(0, limit);
    const hasMore = merged.length > limit;
    const lastLog = data[data.length - 1];
    const nextCursor = hasMore && lastLog
      ? Buffer.from(JSON.stringify({
        date: new Date(lastLog.log_at).toISOString(),
        id: String(lastLog._id),
        type: lastLog.log_type,
      })).toString('base64url')
      : null;

    res.json({
      success: true,
      count: data.length,
      has_more: hasMore,
      next_cursor: nextCursor,
      data,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

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
