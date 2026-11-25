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
import CaparWindowNode from '../models/capar_window_node.model.js';
import CaparWindowDailyAnalysis from '../models/capar_window_daily_analysis.model.js';
import Baseline from '../models/baseline.model.js';
import {
  buildCaparDailyAnalysis,
  getJakartaDayRange,
  getTimePeriodForWindow,
  normalizeEpochMs,
} from '../utils/caparWindowAnalytics.js';

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
  hil_realtime: 'account_id account_type session_id run_id activity device_id evaluation_kind evaluated_at readings.recorded_at readings.heart_rate_bpm readings.signal_confidence analysis createdAt',
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

export async function getDoctorPatientAccounts() {
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

export async function listDoctorCaparWindowNodes(req, res) {
  try {
    const allowedQuery = new Set(['patient_id', 'date', 'all_dates']);
    const unknownFields = Object.keys(req.query).filter((field) => !allowedQuery.has(field));
    if (unknownFields.length) {
      return res.status(400).json({
        success: false,
        message: `Query tidak dikenal: ${unknownFields.join(', ')}.`,
      });
    }
    if (
      req.query.all_dates !== undefined
      && !['true', 'false'].includes(String(req.query.all_dates))
    ) {
      return res.status(400).json({ success: false, message: 'all_dates harus bernilai true atau false.' });
    }
    const allDates = req.query.all_dates === 'true';
    if (allDates && req.query.date !== undefined) {
      return res.status(400).json({ success: false, message: 'Pilih date atau all_dates, bukan keduanya.' });
    }

    const patientId = String(req.query.patient_id || '');
    if (!mongoose.isValidObjectId(patientId)) {
      return res.status(400).json({ success: false, message: 'patient_id tidak valid.' });
    }

    const patients = await getDoctorPatientAccounts();
    const patient = patients.find((item) => String(item._id) === patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Pasien tidak ditemukan.' });
    }
    const userAccount = patient.account_refs?.find((ref) => ref.account_type === 'user');
    if (!userAccount) {
      return res.json({
        success: true,
        count: 0,
        dates: [],
        selected_date: null,
        selected_dates: [],
        data: [],
        baselines: [],
        daily_analysis: null,
        activity_summaries: [],
        activity_runs: [],
        transitions: [],
      });
    }

    const dates = await Segment.aggregate([
      { $match: { user_id: userAccount.account_id, window_start: { $type: 'number' } } },
      {
        $project: {
          day: {
            $dateToString: {
              date: {
                $toDate: {
                  $cond: [
                    { $lt: ['$window_start', 100_000_000_000] },
                    { $multiply: ['$window_start', 1000] },
                    '$window_start',
                  ],
                },
              },
              format: '%Y-%m-%d',
              timezone: 'Asia/Jakarta',
            },
          },
        },
      },
      { $group: { _id: '$day' } },
      { $sort: { _id: -1 } },
    ]);
    const availableDates = dates.map(({ _id }) => _id);
    const requestedDate = req.query.date === undefined ? null : String(req.query.date);
    const selectedDate = allDates ? null : requestedDate || availableDates[0] || null;
    let dayRange = null;
    if (allDates && availableDates.length) {
      try {
        const oldestDay = getJakartaDayRange(availableDates[availableDates.length - 1]);
        const newestDay = getJakartaDayRange(availableDates[0]);
        dayRange = { startMs: oldestDay.startMs, endMs: newestDay.endMs };
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    } else if (selectedDate) {
      try {
        dayRange = getJakartaDayRange(selectedDate);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    let segments = [];
    if (dayRange) {
      segments = await Segment.find({
        user_id: userAccount.account_id,
        $or: [
          {
            window_start: {
              $gte: dayRange.startMs,
              $lt: dayRange.endMs,
            },
          },
          {
            window_start: {
              $gte: Math.floor(dayRange.startMs / 1000),
              $lt: Math.floor(dayRange.endMs / 1000),
            },
          },
        ],
      })
        .select('_id window_start window_end window_type activity_label raw_count is_valid analyzed classification anomaly_score rr_status signal_quality_detail features.mean_hr features.mean_rr features.sdnn features.rmssd features.dfa_alpha1 features.motion_intensity')
        .limit(10001)
        .lean();
      segments.sort((first, second) => (
        (normalizeEpochMs(first.window_start) ?? 0)
        - (normalizeEpochMs(second.window_start) ?? 0)
        || String(first._id).localeCompare(String(second._id))
      ));
    }
    const truncated = segments.length > 10000;
    if (truncated) segments = segments.slice(0, 10000);
    const savedNodes = segments.length
      ? await CaparWindowNode.find({
        segment_id: { $in: segments.map((segment) => segment._id) },
      })
        .select('segment_id createdAt is_valid')
        .lean()
      : [];
    const savedBySegment = new Map(
      savedNodes.map((node) => [String(node.segment_id), node])
    );
    const baselines = await Baseline.find({ user_id: userAccount.account_id })
      .select('activity time_period stats.mean_hr stats.mean_rr stats.rmssd stats.dfa_alpha1 stats.motion_intensity segment_count is_mature MATURITY_THRESHOLD maturity_detail.level')
      .lean();
    const summary = buildCaparDailyAnalysis(segments);
    const dailyAnalysis = selectedDate && !allDates
      ? await CaparWindowDailyAnalysis.findOne({
        account_id: userAccount.account_id,
        analysis_date: selectedDate,
      }).lean()
      : null;

    res.json({
      success: true,
      count: segments.length,
      dates: availableDates,
      selected_date: selectedDate,
      selected_dates: allDates ? availableDates : selectedDate ? [selectedDate] : [],
      date_mode: allDates ? 'all' : 'day',
      truncated,
      data: segments.map((segment) => {
        const savedNode = savedBySegment.get(String(segment._id));
        return {
          ...segment,
          time_period: getTimePeriodForWindow(segment.window_start),
          saved: Boolean(savedNode),
          saved_at: savedNode?.createdAt || null,
        };
      }),
      baselines,
      daily_analysis: dailyAnalysis,
      source_window_count: summary.source_window_count,
      valid_window_count: summary.valid_window_count,
      invalid_window_count: summary.invalid_window_count,
      activity_summaries: summary.activity_summaries,
      activity_runs: summary.activity_runs,
      transitions: summary.transitions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function saveDoctorCaparWindowNode(req, res) {
  try {
    const patientId = String(req.body?.patient_id || '');
    const segmentId = String(req.body?.segment_id || '');
    if (!mongoose.isValidObjectId(patientId) || !mongoose.isValidObjectId(segmentId)) {
      return res.status(400).json({
        success: false,
        message: 'patient_id dan segment_id harus berupa ObjectId yang valid.',
      });
    }

    const patients = await getDoctorPatientAccounts();
    const patient = patients.find((item) => String(item._id) === patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Pasien tidak ditemukan.' });
    }
    const userAccount = patient.account_refs?.find((ref) => ref.account_type === 'user');
    if (!userAccount) {
      return res.status(404).json({ success: false, message: 'Akun CAPAR pasien tidak tersedia.' });
    }

    const segment = await Segment.findOne({
      _id: segmentId,
      user_id: userAccount.account_id,
    })
      .select('_id user_id window_start window_end window_type activity_label raw_count is_valid analyzed classification anomaly_score rr_status signal_quality_detail features.mean_hr features.mean_rr features.sdnn features.rmssd features.dfa_alpha1 features.motion_intensity')
      .lean();
    if (!segment) {
      return res.status(404).json({
        success: false,
        message: 'Window CAPAR tidak ditemukan untuk pasien ini.',
      });
    }

    const node = await CaparWindowNode.findOneAndUpdate(
      { segment_id: segment._id },
      {
        $setOnInsert: {
          account_id: segment.user_id,
          segment_id: segment._id,
          created_by: req.user.id,
          window_start: segment.window_start,
          window_end: segment.window_end,
          window_type: segment.window_type,
          time_period: getTimePeriodForWindow(segment.window_start),
          raw_count: segment.raw_count,
          is_valid: segment.is_valid,
          activity_label: segment.activity_label,
          analyzed: segment.analyzed,
          classification: segment.classification,
          anomaly_score: segment.anomaly_score,
          rr_status: segment.rr_status,
          signal_quality_detail: {
            q_signal: segment.signal_quality_detail?.q_signal,
            q_complete: segment.signal_quality_detail?.q_complete,
            q_context: segment.signal_quality_detail?.q_context,
            reasons: segment.signal_quality_detail?.reasons,
          },
          features: {
            mean_hr: segment.features?.mean_hr,
            mean_rr: segment.features?.mean_rr,
            sdnn: segment.features?.sdnn,
            rmssd: segment.features?.rmssd,
            dfa_alpha1: segment.features?.dfa_alpha1,
            motion_intensity: segment.features?.motion_intensity,
          },
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ success: true, data: node });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function saveDoctorCaparDailyAnalysis(req, res) {
  try {
    const patientId = String(req.body?.patient_id || '');
    const analysisDate = String(req.body?.date || '');
    if (!mongoose.isValidObjectId(patientId)) {
      return res.status(400).json({ success: false, message: 'patient_id tidak valid.' });
    }

    let dayRange;
    try {
      dayRange = getJakartaDayRange(analysisDate);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const patients = await getDoctorPatientAccounts();
    const patient = patients.find((item) => String(item._id) === patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Pasien tidak ditemukan.' });
    }
    const userAccount = patient.account_refs?.find((ref) => ref.account_type === 'user');
    if (!userAccount) {
      return res.status(404).json({ success: false, message: 'Akun CAPAR pasien tidak tersedia.' });
    }

    const segments = await Segment.find({
      user_id: userAccount.account_id,
      $or: [
        {
          window_start: {
            $gte: dayRange.startMs,
            $lt: dayRange.endMs,
          },
        },
        {
          window_start: {
            $gte: Math.floor(dayRange.startMs / 1000),
            $lt: Math.floor(dayRange.endMs / 1000),
          },
        },
      ],
    })
      .select('_id window_start window_end activity_label raw_count is_valid features.mean_hr features.mean_rr features.motion_intensity features.rmssd features.dfa_alpha1')
      .lean();

    if (!segments.length) {
      return res.status(404).json({
        success: false,
        message: 'Tidak ada window CAPAR pada tanggal yang dipilih.',
      });
    }

    const analysis = buildCaparDailyAnalysis(segments);
    const activities = [...new Set(segments.map((segment) => segment.activity_label || 'Unknown'))];
    const baselineRows = await Baseline.find({
      user_id: userAccount.account_id,
      activity: { $in: activities },
    })
      .select('activity time_period stats.mean_hr stats.mean_rr stats.rmssd stats.dfa_alpha1 stats.motion_intensity segment_count is_mature maturity_detail.level')
      .lean();
    const baselineSnapshots = baselineRows.map((baseline) => ({
      activity: baseline.activity,
      time_period: baseline.time_period,
      segment_count: baseline.segment_count,
      is_mature: baseline.is_mature,
      maturity_level: baseline.maturity_detail?.level || null,
      mean_hr: baseline.stats?.mean_hr?.mean,
      std_hr: baseline.stats?.mean_hr?.std,
      mean_rr: baseline.stats?.mean_rr?.mean,
      mean_motion_intensity: baseline.stats?.motion_intensity?.mean,
      mean_rmssd: baseline.stats?.rmssd?.mean,
      mean_dfa_alpha1: baseline.stats?.dfa_alpha1?.mean,
    }));
    const savedAnalysis = await CaparWindowDailyAnalysis.findOneAndUpdate(
      {
        account_id: userAccount.account_id,
        analysis_date: analysisDate,
      },
      {
        $set: {
          source_window_count: analysis.source_window_count,
          valid_window_count: analysis.valid_window_count,
          invalid_window_count: analysis.invalid_window_count,
          source_segment_ids: segments.map((segment) => segment._id),
          activity_summaries: analysis.activity_summaries,
          activity_runs: analysis.activity_runs,
          transitions: analysis.transitions,
          baseline_snapshots: baselineSnapshots,
          generated_by: req.user.id,
          analysis_version: 'capar-window-daily-v1',
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ success: true, data: savedAnalysis });
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
