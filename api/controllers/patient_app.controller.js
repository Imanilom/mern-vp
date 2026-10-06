import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Patient from '../models/patient.model.js';
import PatientAppCheckIn from '../models/patient_app_checkin.model.js';
import PatientAppEvent from '../models/patient_app_event.model.js';
import PatientAppProfile from '../models/patient_app_profile.model.js';
import PatientAppWearableSample from '../models/patient_app_wearable_sample.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';
import Baseline from '../models/baseline.model.js';
import BehaviorEvent from '../models/behavior_event.model.js';
import CognitiveMemory from '../models/cognitive_memory.model.js';
import EpisodeMeta from '../models/episodemeta.model.js';
import EpisodeAnalysis from '../models/episode_analysis.model.js';
import PolarData from '../models/data.model.js';
import Segment from '../models/segment.model.js';
import StateTransition from '../models/state_transition.model.js';
import User from '../models/user.model.js';
import { errorHandler } from '../utils/error.js';
import { publishLogTransport } from '../utils/logTransport.js';
import { retrieveMultiAxisRag } from './resilience.controller.js';
import {
  fitPatientMahalanobisModel,
  scorePatientMahalanobis,
} from '../utils/patientMahalanobis.js';
import {
  attributePatientContext,
  explainPatientDeviation,
  isPatientCaparNocturnalTime,
  mapPatientContextToRagAxes,
  patientCaparTimePeriod,
} from '../utils/patientDeviationExplanation.js';
import {
  buildPatientDeviationFollowUpPrompt,
  identifyPatientRedFlags,
  recommendPatientAction,
  summarizePatientEpisodeOutcomes,
  summarizePatientPersistence,
  summarizePatientRecovery,
} from '../utils/patientPedagogy.js';
import { assessRRQuality, extractRRFeatures } from '../utils/rrBaselinePipeline.js';
import {
  validateCheckIn,
  validateCheckInQuery,
  validateProfileUpdate,
  validateRegistration,
  validatePatientEvent,
  validateWearableStream,
  validateWearableSample,
  registrationEmailPattern,
} from '../utils/patientApp.validation.js';

async function getAccount(req) {
  const accountId = req.user?.id;
  if (!mongoose.isValidObjectId(accountId)) {
    throw errorHandler(401, 'Sesi pengguna tidak valid. Silakan masuk kembali.');
  }

  let account;
  let accountType;
  if (req.user?.role === 'patient') {
    account = await Patient.findById(accountId).select('-password');
    accountType = 'patient';
  } else {
    account = await User.findById(accountId).select('-password');
    accountType = 'user';
    if (!account && !req.user?.role) {
      account = await Patient.findById(accountId).select('-password');
      accountType = 'patient';
    }
  }

  if (!account) throw errorHandler(401, 'Akun tidak ditemukan. Silakan masuk kembali.');
  if (account.is_active === false) throw errorHandler(403, 'Akun ini tidak aktif.');
  if (accountType === 'user' && account.role && account.role !== 'user') {
    throw errorHandler(403, 'API aplikasi pasien hanya tersedia untuk akun pasien.');
  }
  const linkedPatient = accountType === 'user'
    ? await Patient.findOne({ user_id: account._id }).select('_id').lean()
    : null;
  const dataOwnerId = accountType === 'patient' && account.user_id
    ? account.user_id
    : account._id;
  const dataOwnerType = accountType === 'patient' && account.user_id ? 'user' : accountType;
  const accountScopes = [{
    account_id: dataOwnerId,
    account_type: dataOwnerType,
  }];
  if (accountType === 'patient' && account.user_id) {
    accountScopes.push({ account_id: account._id, account_type: 'patient' });
  }
  if (linkedPatient) {
    accountScopes.push({ account_id: linkedPatient._id, account_type: 'patient' });
  }
  return {
    account,
    accountId: account._id,
    accountType,
    dataOwnerId,
    dataOwnerType,
    accountScopes,
  };
}

function accountScopeFilter(accountScopes) {
  return { $or: accountScopes };
}

async function findOrCreatePatientAppProfile({ accountScopes, dataOwnerId, dataOwnerType }) {
  const existingProfile = await findExistingPatientAppProfile(accountScopes);
  if (existingProfile) return existingProfile;
  return PatientAppProfile.findOneAndUpdate(
    { account_id: dataOwnerId, account_type: dataOwnerType },
    { $setOnInsert: { account_id: dataOwnerId, account_type: dataOwnerType } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  ).lean();
}

async function findExistingPatientAppProfile(accountScopes) {
  for (const scope of accountScopes) {
    const profile = await PatientAppProfile.findOne(scope).lean();
    if (profile) return profile;
  }
  return null;
}

function publicAccount(account, accountType) {
  return {
    id: account._id,
    name: account.name,
    email: account.email,
    phone_number: account.phone_number || '',
    role: accountType === 'patient' ? 'patient' : 'user',
  };
}

export async function registerPatientAppAccount(req, res) {
  const input = validateRegistration(req.body);
  const emailPattern = registrationEmailPattern(input.email);
  const [existingUser, existingPatient] = await Promise.all([
    User.findOne({ email: emailPattern }).select('_id'),
    Patient.findOne({ email: emailPattern }).select('_id'),
  ]);
  if (existingUser || existingPatient) {
    console.warn('[PatientApp] Registration rejected for an existing account.', {
      collection: existingUser ? 'users' : 'patients',
      accountId: String((existingUser || existingPatient)._id),
    });
    throw errorHandler(409, 'Email sudah terdaftar.');
  }

  const password = await bcryptjs.hash(input.password, 12);
  let account;
  try {
    account = await User.create({
      name: input.name,
      email: input.email,
      password,
      phone_number: input.phone_number,
      role: 'user',
    });
  } catch (error) {
    if (error?.code === 11000 && (
      error.keyPattern?.email ||
      Object.hasOwn(error.keyValue ?? {}, 'email')
    )) {
      console.warn('[PatientApp] Registration hit the unique email index after lookup.', {
        index: error.keyPattern ?? null,
      });
      throw errorHandler(409, 'Email sudah terdaftar.');
    }
    throw error;
  }

  try {
    await PatientAppProfile.create({
      account_id: account._id,
      account_type: 'user',
    });
  } catch (error) {
    try {
      await User.findByIdAndDelete(account._id);
    } catch (cleanupError) {
      console.error('[PatientApp] Failed to roll back incomplete registration:', cleanupError);
    }
    throw error;
  }

  const token = jwt.sign(
    { id: account._id.toString(), role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  res
    .cookie('access_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    })
    .status(201)
    .json({
      success: true,
      data: { account: publicAccount(account, 'user'), token },
    });
}

export async function getPatientAppProfile(req, res) {
  const accountData = await getAccount(req);
  const { account, accountType } = accountData;
  const profile = await findOrCreatePatientAppProfile(accountData);

  res.json({
    success: true,
    data: {
      account: publicAccount(account, accountType),
      profile: profileData(profile),
    },
  });
}

export async function updatePatientAppProfile(req, res) {
  const accountData = await getAccount(req);
  const {
    account,
    accountScopes,
    accountType,
    dataOwnerId,
    dataOwnerType,
  } = accountData;
  const updates = validateProfileUpdate(req.body);
  const profileUpdates = { ...updates };
  const notificationPreferences = profileUpdates.notification_preferences;
  delete profileUpdates.notification_preferences;
  if (notificationPreferences) {
    for (const [key, value] of Object.entries(notificationPreferences)) {
      profileUpdates[`notification_preferences.${key}`] = value;
    }
    if (profileUpdates.data_sharing) {
      profileUpdates['data_sharing.consent_updated_at'] = new Date();
      const dataSharing = profileUpdates.data_sharing;
      delete profileUpdates.data_sharing;
      for (const [key, value] of Object.entries(dataSharing)) {
        profileUpdates[`data_sharing.${key}`] = value;
      }
    }
  }
  const existingProfile = await findExistingPatientAppProfile(accountScopes);
  const profileQuery = existingProfile
    ? { _id: existingProfile._id }
    : { account_id: dataOwnerId, account_type: dataOwnerType };
  const profile = await PatientAppProfile.findOneAndUpdate(
    profileQuery,
    {
      $set: profileUpdates,
      $setOnInsert: { account_id: dataOwnerId, account_type: dataOwnerType },
    },
    { new: true, upsert: !existingProfile, setDefaultsOnInsert: true, runValidators: true }
  ).lean();

  res.json({
    success: true,
    data: {
      account: publicAccount(account, accountType),
      profile: profileData(profile),
    },
  });
}

export async function getPatientAppOverview(req, res) {
  const accountData = await getAccount(req);
  const { account, accountScopes, accountType } = accountData;
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [profile, latestCheckIn, latestWearableSample, checkInsThisWeek] = await Promise.all([
    findExistingPatientAppProfile(accountScopes),
    PatientAppCheckIn.findOne(accountScopeFilter(accountScopes))
      .sort({ recorded_at: -1 })
      .lean(),
    PatientAppWearableSample.findOne(accountScopeFilter(accountScopes))
      .sort({ recorded_at: -1 })
      .lean(),
    PatientAppCheckIn.countDocuments({
      ...accountScopeFilter(accountScopes),
      recorded_at: { $gte: weekStart, $lte: now },
    }),
  ]);

  const profileFields = [
    'date_of_birth',
    'sex',
    'height_cm',
    'weight_kg',
    'medication_reviewed',
    'allergies_reviewed',
  ];
  const filledProfileFields = profileFields.filter((field) => profile?.[field] != null).length;
  const latestWearableHasCore = Boolean(
    latestWearableSample
    && latestWearableSample.heart_rate_bpm != null
    && latestWearableSample.rr_intervals_ms?.length >= 10
    && latestWearableSample.acceleration_g?.length >= 10
    && latestWearableSample.activity
  );
  const latestCheckInHasContext = Boolean(
    latestCheckIn
    && Array.isArray(latestCheckIn.symptoms)
    && latestCheckIn.sleep != null
    && latestCheckIn.activity
  );
  res.json({
    success: true,
    data: {
      account: publicAccount(account, accountType),
      overview: {
        status: latestCheckIn ? 'check_in_recorded' : 'no_check_in',
        latest_check_in: latestCheckIn,
        latest_wearable_sample: latestWearableSample,
        wearable_provider: profile?.wearable_provider ?? 'none',
        check_ins_last_7_days: checkInsThisWeek,
        profile_completion: {
          completed_fields: filledProfileFields,
          total_fields: profileFields.length,
        },
        input_readiness: {
          profile: {
            age: profile?.date_of_birth != null,
            sex: profile?.sex != null,
            weight: profile?.weight_kg != null,
            height: profile?.height_cm != null,
            medication_reviewed: profile?.medication_reviewed === true,
            allergy_reviewed: profile?.allergies_reviewed === true,
          },
          wearable_minimum: latestWearableHasCore,
          patient_context_minimum: latestCheckInHasContext,
          ready_for_personal_analysis: latestWearableHasCore
            && latestCheckInHasContext
            && profile?.date_of_birth != null
            && profile?.sex != null
            && profile?.weight_kg != null
            && profile?.height_cm != null
            && profile?.medication_reviewed === true,
        },
        generated_at: now,
      },
    },
  });
}

export async function createPatientAppCheckIn(req, res) {
  const accountData = await getAccount(req);
  const { dataOwnerId, dataOwnerType } = accountData;
  const input = validateCheckIn(req.body);
  if (input.deviation_follow_up) {
    const caparDataIds = accountData.accountScopes.map((scope) => scope.account_id);
    const referencedSegment = await Segment.findOne({
      _id: input.deviation_follow_up.segment_id,
      user_id: { $in: caparDataIds },
      analyzed: true,
      is_valid: true,
    }).select('_id');
    if (!referencedSegment) {
      throw errorHandler(404, 'Segment CAPAR untuk tindak lanjut tidak ditemukan.');
    }
  }
  const checkIn = await PatientAppCheckIn.create({
    ...input,
    account_id: dataOwnerId,
    account_type: dataOwnerType,
  });
  if (checkIn.measurements?.weight_kg != null) {
    const existingProfile = await findExistingPatientAppProfile(accountData.accountScopes);
    const profileQuery = existingProfile
      ? { _id: existingProfile._id }
      : { account_id: dataOwnerId, account_type: dataOwnerType };
    await PatientAppProfile.updateOne(
      profileQuery,
      {
        $set: { weight_kg: checkIn.measurements.weight_kg },
        $setOnInsert: { account_id: dataOwnerId, account_type: dataOwnerType },
      },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
  }
  res.status(201).json({ success: true, data: checkIn });
}

export async function listPatientAppCheckIns(req, res) {
  const { accountScopes } = await getAccount(req);
  const filters = validateCheckInQuery(req.query);
  const query = accountScopeFilter(accountScopes);
  if (filters.from || filters.to || filters.before) {
    query.recorded_at = {};
    if (filters.from) query.recorded_at.$gte = filters.from;
    if (filters.to) query.recorded_at.$lte = filters.to;
    if (filters.before) query.recorded_at.$lt = filters.before;
  }

  const data = await PatientAppCheckIn.find(query)
    .sort({ recorded_at: -1 })
    .limit(filters.limit)
    .lean();
  res.json({
    success: true,
    data,
    pagination: {
      limit: filters.limit,
      next_before: data.length === filters.limit ? data[data.length - 1].recorded_at : null,
    },
  });
}

export async function getPatientAppCheckIn(req, res) {
  const { accountScopes } = await getAccount(req);
  if (!mongoose.isValidObjectId(req.params.checkInId)) {
    throw errorHandler(400, 'ID catatan tidak valid.');
  }
  const checkIn = await PatientAppCheckIn.findOne({
    _id: req.params.checkInId,
    ...accountScopeFilter(accountScopes),
  }).lean();
  if (!checkIn) throw errorHandler(404, 'Catatan tidak ditemukan.');
  res.json({ success: true, data: checkIn });
}

export async function deletePatientAppCheckIn(req, res) {
  const { accountScopes } = await getAccount(req);
  if (!mongoose.isValidObjectId(req.params.checkInId)) {
    throw errorHandler(400, 'ID catatan tidak valid.');
  }
  const result = await PatientAppCheckIn.deleteOne({
    _id: req.params.checkInId,
    ...accountScopeFilter(accountScopes),
  });
  if (!result.deletedCount) throw errorHandler(404, 'Catatan tidak ditemukan.');
  res.json({ success: true, data: { deleted: true } });
}

export async function getPatientAppDailySummary(req, res) {
  const { account, accountScopes, accountType } = await getAccount(req);
  const { date } = req.query;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw errorHandler(400, 'date wajib diisi dengan format YYYY-MM-DD (UTC).');
  }
  const start = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== date) {
    throw errorHandler(400, 'date bukan tanggal kalender yang valid.');
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const owner = accountScopeFilter(accountScopes);
  const [checkIns, events, wearableSamples] = await Promise.all([
    PatientAppCheckIn.find({
      ...owner,
      recorded_at: { $gte: start, $lt: end },
    }).sort({ recorded_at: 1 }).lean(),
    PatientAppEvent.find({
      ...owner,
      occurred_at: { $gte: start, $lt: end },
    }).sort({ occurred_at: 1 }).lean(),
    PatientAppWearableSample.find({
      ...owner,
      recorded_at: { $gte: start, $lt: end },
    }).sort({ recorded_at: 1 }).lean(),
  ]);

  res.json({
    success: true,
    data: {
      account: publicAccount(account, accountType),
      date,
      timezone: 'UTC',
      check_ins: checkIns,
      events,
      wearable_samples: wearableSamples,
      totals: {
        check_ins: checkIns.length,
        events: events.length,
        wearable_samples: wearableSamples.length,
      },
    },
  });
}

export async function linkPatientAppToCaparUser(req, res) {
  const { account, accountId, accountType } = await getAccount(req);
  const normalizedEmail = String(account.email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw errorHandler(409, 'Akun belum memiliki email yang dapat diverifikasi.');
  }

  const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sameEmail = new RegExp(`^${escapedEmail}$`, 'i');
  const user = accountType === 'user'
    ? account
    : await User.findOne({ email: sameEmail }).select('_id email role');
  if (!user || user.role !== 'user') throw errorHandler(404, 'Akun User tidak ditemukan.');

  const patient = accountType === 'patient'
    ? account
    : await Patient.findOne({ email: sameEmail }).select('_id email password user_id');
  if (!patient) throw errorHandler(404, 'Akun Patient dengan email yang sama tidak ditemukan.');
  if (accountType === 'user') {
    if (typeof req.body?.patient_password !== 'string' || !req.body.patient_password) {
      throw errorHandler(400, 'patient_password wajib diisi untuk memverifikasi akun Patient.');
    }
    const validPatientPassword = await bcryptjs.compare(req.body.patient_password, patient.password);
    if (!validPatientPassword) throw errorHandler(401, 'Kredensial akun Patient tidak valid.');
  }

  const patientId = patient._id;
  const existingLink = patient.user_id?.toString();
  if (existingLink && existingLink !== user._id.toString()) {
    throw errorHandler(409, 'Akun pasien sudah terhubung ke akun User lain.');
  }

  const duplicatePatient = await Patient.findOne({
    user_id: user._id,
    _id: { $ne: patientId },
  }).select('_id');
  if (duplicatePatient) {
    throw errorHandler(409, 'Akun User tersebut sudah terhubung ke akun pasien lain.');
  }

  if (!existingLink) {
    try {
      const update = await Patient.updateOne(
        { _id: patientId, $or: [{ user_id: null }, { user_id: { $exists: false } }] },
        { $set: { user_id: user._id } }
      );
      if (!update.modifiedCount) {
        const latest = await Patient.findById(patientId).select('user_id');
        if (latest?.user_id?.toString() !== user._id.toString()) {
          throw errorHandler(409, 'Akun pasien berubah saat proses pengaitan. Muat ulang lalu coba lagi.');
        }
      }
    } catch (error) {
      if (error?.code === 11000) {
        throw errorHandler(409, 'Akun User tersebut sudah terhubung ke akun pasien lain.');
      }
      throw error;
    }
  }

  res.json({
    success: true,
    data: {
      linked: true,
      capar_user_id: user._id,
      shared_data: ['baseline', 'segments', 'episodes', 'transitions'],
    },
  });
}

export async function getPatientAppCaparInsights(req, res) {
  const { account, accountId, accountScopes, accountType } = await getAccount(req);
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [latestCheckIn, recentEvents] = await Promise.all([
    PatientAppCheckIn.findOne(accountScopeFilter(accountScopes))
      .sort({ recorded_at: -1 })
      .lean(),
    PatientAppEvent.find({
      ...accountScopeFilter(accountScopes),
      occurred_at: { $gte: dayAgo, $lte: now },
    }).sort({ occurred_at: -1 }).limit(20).lean(),
  ]);

  const behavior = [];
  if (latestCheckIn?.activity === 'walking' || latestCheckIn?.activity === 'exercise') {
    behavior.push('physical_activity');
  }
  if (latestCheckIn?.sleep?.duration_minutes != null) behavior.push('sleep_duration');
  if (latestCheckIn?.lifestyle?.caffeine) behavior.push('caffeine');
  if (latestCheckIn?.lifestyle?.smoking) behavior.push('smoking');
  if (latestCheckIn?.stress_level != null) behavior.push('stress_job_strain');
  for (const event of recentEvents) {
    if (event.event_type === 'exercise_started') behavior.push('physical_activity');
    if (event.event_type === 'sleep_started' || event.event_type === 'woke_up') {
      behavior.push('sleep_duration');
    }
  }

  const caparUserId = accountType === 'user' ? accountId : account.user_id;
  const caparDataIds = caparUserId
    ? [...new Set(accountScopes.map((scope) => scope.account_id.toString()))]
    : [];
  let capar = {
    status: accountType === 'patient' && !caparUserId
      ? 'link_required'
      : 'insufficient_data',
    source: 'CAPAR analyzed segments',
    trajectory_24h: [],
    trajectory_30d: [],
    mahalanobis: [],
    baseline_contexts: [],
    polar_data: [],
    episode_history: [],
    cognitive_memories: [],
    data_inventory: {
      baselines: 0,
      segments_returned: 0,
      polar_records_returned: 0,
      episode_analyses_returned: 0,
      anomaly_events_returned: 0,
      cognitive_memories_returned: 0,
    },
    recovery: {
      resolved_episodes_30d: 0,
      median_recovery_minutes: null,
      observed_episode_recovery_rate_pct: null,
      recovery_rate_denominator: 0,
    },
  };

  if (caparUserId) {
    const monthStartMs = monthAgo.getTime();
    const [baselines, recentSegments, polarData, episodes, episodeMetadata,
      transitionDocs, anomalyEvents, cognitiveMemories, behaviorEvents,
      historicalCheckIns, historicalPatientEvents] = await Promise.all([
      Baseline.find({ user_id: { $in: caparDataIds } }).lean(),
      Segment.find({
        user_id: { $in: caparDataIds },
        analyzed: true,
        is_valid: true,
        window_start: { $gte: monthStartMs, $lte: now.getTime() },
      }).sort({ window_start: -1 }).limit(2000).lean(),
      PolarData.find({
        user_id: { $in: caparDataIds },
        timestamp: { $lte: Math.floor(now.getTime() / 1000) },
      }).sort({ timestamp: -1 }).limit(100).select(
        'timestamp hr rr rrms acc_x acc_y acc_z step_count activity device_id processStatus'
      ).lean(),
      EpisodeAnalysis.find({
        user_id: { $in: caparDataIds },
        start_time: { $gte: monthAgo, $lte: now },
      }).sort({ start_time: -1 }).limit(100).select(
        'start_time end_time episode_id activity context physiological_state evidence_state ttr recovery_duration total_duration peak_deviation mean_deviation deviation_auc recovery_slope relapse_detected relapse_count quality_score quality_gate_pass hr_mean rmssd sdnn dfa_alpha1'
      ).lean(),
      EpisodeMeta.find({
        user_id: { $in: caparDataIds },
        onset_timestamp: { $gte: monthStartMs, $lte: now.getTime() },
      }).sort({ onset_timestamp: -1 }).limit(100).select(
        'episode_id analysis_id onset_timestamp status current_state activity classification peak_score duration_ms'
      ).lean(),
      StateTransition.find({ user_id: { $in: caparDataIds } })
        .select('total_transitions')
        .lean(),
      AnomalyEvent.find({
        user_id: { $in: caparDataIds },
        onset_time: { $gte: monthAgo.getTime(), $lte: now.getTime() },
        classification: { $in: ['Caution', 'Alert'] },
      }).sort({ onset_time: -1 }).limit(100).lean(),
      CognitiveMemory.find({ user_id: { $in: caparDataIds } })
        .sort({ epoch_timestamp: -1 })
        .limit(20)
        .select(
          'week_id week_number epoch_timestamp scores_snapshot behavioral_factors_snapshot average_behavioral_correlation physical_factor_verdict next_week_feedback confirmed_factor_ids confirmed_factor_count block3_gate_open'
        )
        .lean(),
      BehaviorEvent.find({
        user_id: { $in: caparDataIds },
        timestamp_start: { $gte: monthAgo.getTime(), $lte: now.getTime() },
      }).sort({ timestamp_start: -1 }).limit(500).lean(),
      PatientAppCheckIn.find({
        ...accountScopeFilter(accountScopes),
        recorded_at: { $gte: monthAgo, $lte: now },
      }).sort({ recorded_at: -1 }).limit(500).lean(),
      PatientAppEvent.find({
        ...accountScopeFilter(accountScopes),
        occurred_at: { $gte: monthAgo, $lte: now },
      }).sort({ occurred_at: -1 }).limit(500).lean(),
    ]);

    const eligibleSegments = recentSegments.filter(isPatientAnalyticsSegment);
    const currentSegments = eligibleSegments.filter(
      (segment) => segment.window_start >= dayAgo.getTime()
    );
    const latestStatus = currentSegments[0]?.rr_status || currentSegments[0]?.classification || null;
    const physiology = [];
    if (eligibleSegments.some((segment) => Number.isFinite(segment.features?.mean_hr))) {
      physiology.push('heart_rate');
    }
    if (eligibleSegments.some((segment) => Number.isFinite(segment.features?.rmssd))) {
      physiology.push('rmssd');
    }
    if (eligibleSegments.some((segment) => Number.isFinite(segment.features?.dfa_alpha1))) {
      physiology.push('dfa_alpha1');
    }
    if (eligibleSegments.some((segment) => segment.rr_status === 'RECOVERING')) {
      physiology.push('recovery');
    }

    const matureBaselines = baselines.filter(isMaturePatientBaseline);
    const baselineByContext = new Map(
      matureBaselines.map((baseline) => [
        `${baseline.activity}:${baseline.time_period}`,
        baseline,
      ])
    );
    const deviationSegments = anomalyEvents.length
      ? await Segment.find({
        user_id: { $in: caparDataIds },
        analyzed: true,
        is_valid: true,
        window_start: { $gte: monthAgo.getTime(), $lte: now.getTime() },
        $or: [
          { rr_status: { $in: ['DEVIATION_CANDIDATE', 'PERSISTENT_DEVIATION'] } },
          { classification: { $in: ['Caution', 'Alert'] } },
        ],
      }).sort({ window_start: -1 }).limit(2000).lean()
      : [];
    const baselineSegments = matureBaselines.length
      ? await Segment.find({
        user_id: { $in: caparDataIds },
        analyzed: true,
        is_valid: true,
        activity_label: { $in: [...new Set(matureBaselines.map((baseline) => baseline.activity))] },
        window_start: { $lte: now.getTime() },
        $or: [{ rr_status: 'NORMAL' }, { classification: 'Normal' }],
      }).sort({ window_start: -1 }).limit(2000).lean()
      : [];
    const stableByContext = new Map();
    for (const segment of baselineSegments) {
      if (!isPatientBaselineSegment(segment)) continue;
      const contextKey = `${segment.activity_label}:${patientCaparTimePeriod(segment.window_start)}`;
      if (!baselineByContext.has(contextKey)) continue;
      const samples = stableByContext.get(contextKey) || [];
      if (samples.length < 1000) {
        samples.push(patientMahalanobisFeatureVector(segment));
        stableByContext.set(contextKey, samples);
      }
    }

    const mahalanobisModelByContext = new Map();
    for (const [contextKey, samples] of stableByContext) {
      const baseline = baselineByContext.get(contextKey);
      const featureKeys = selectPatientMahalanobisFeatures(samples, baseline);
      mahalanobisModelByContext.set(
        contextKey,
        fitPatientMahalanobisModel(samples, featureKeys)
      );
    }
    const mahalanobis = eligibleSegments
      .filter((segment) => patientFeatureVector(segment))
      .slice(0, 500)
      .map((segment) => {
        const timePeriod = patientCaparTimePeriod(segment.window_start);
        const contextKey = `${segment.activity_label}:${timePeriod}`;
        const baseline = baselineByContext.get(contextKey);
        const model = mahalanobisModelByContext.get(contextKey);
        const result = baseline && model
          ? scorePatientMahalanobis(patientMahalanobisFeatureVector(segment), model)
          : {
            available: false,
            reason: 'mature_context_baseline_unavailable',
            sample_count: 0,
          };
        return {
          recorded_at: new Date(segment.window_start),
          activity: segment.activity_label,
          time_period: timePeriod,
          state: segment.rr_status || segment.classification,
          baseline_level: baseline?.maturity_detail?.level || 'mature',
          window_start: segment.window_start,
          segment_id: segment._id,
          ...result,
        };
      });
    const mahalanobisByWindow = new Map(
      mahalanobis.map((item) => [item.window_start, item])
    );
    const recentMahalanobis = mahalanobis.filter(
      (item) => item.window_start >= dayAgo.getTime()
    );
    const latestMahalanobis = recentMahalanobis[0] || null;
    const comparableMahalanobis = latestMahalanobis?.available
      ? mahalanobis.filter((item) => (
        item.available
        && item.activity === latestMahalanobis.activity
        && item.time_period === latestMahalanobis.time_period
        && item.feature_keys.join('|') === latestMahalanobis.feature_keys.join('|')
      ))
      : [];

    const episodeHistory = buildPatientEpisodeHistory({
      episodes,
      episodeMetadata,
      anomalyEvents,
    });
    const recoveryTimes = episodeHistory
      .filter((episode) => episode.outcome === 'recovered')
      .map((episode) => Number(episode.recovery_time_ms))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);
    const middle = Math.floor(recoveryTimes.length / 2);
    const medianRecovery = recoveryTimes.length
      ? recoveryTimes.length % 2
        ? recoveryTimes[middle]
        : (recoveryTimes[middle - 1] + recoveryTimes[middle]) / 2
      : null;
    const persistenceSummary = summarizePatientPersistence(comparableMahalanobis);
    const recoverySummary = summarizePatientRecovery(
      comparableMahalanobis.map((item) => ({
        ...item,
        window_start: item.window_start,
        rr_status: item.state,
      })),
      anomalyEvents,
      now.getTime()
    );
    if (recoverySummary.status === 'recovered' && recoverySummary.recovery_progress == null) {
      recoverySummary.recovery_progress = 100;
    }
    const episodeOutcomes = summarizePatientEpisodeOutcomes(episodeHistory);
    const recentPatientCheckIn = historicalCheckIns.find((checkIn) => (
      new Date(checkIn.recorded_at).getTime() >= dayAgo.getTime()
    )) || null;
    const followUpAlreadyAnswered = latestMahalanobis?.available
      ? Boolean(await PatientAppCheckIn.exists({
        ...accountScopeFilter(accountScopes),
        'deviation_follow_up.segment_id': latestMahalanobis.segment_id,
      }))
      : false;
    const deviationFollowUp = buildPatientDeviationFollowUpPrompt({
      deviation: latestMahalanobis,
      segmentId: latestMahalanobis?.segment_id?.toString() || null,
      alreadyAnswered: followUpAlreadyAnswered,
    });
    const patientRedFlags = identifyPatientRedFlags(recentPatientCheckIn);
    const mahalanobisAvailable = Boolean(latestMahalanobis?.available);
    const currentBaselineRelation = !mahalanobisAvailable
      ? 'insufficient_data'
      : latestMahalanobis.state;
    const activeEpisode = recoverySummary.latest_episode;
    const persistentDeviation = persistenceSummary.persistent;
    const patientAction = recommendPatientAction({
      dataQualityAvailable: mahalanobisAvailable,
      redFlag: patientRedFlags.red_flag,
      symptomsPresent: (recentPatientCheckIn?.symptoms?.length || 0) > 0,
      symptomSeverity: recentPatientCheckIn?.symptom_severity ?? null,
      deviationPresent: Boolean(
        mahalanobisAvailable && latestMahalanobis.state !== 'within_personal_region'
      ),
      persistentDeviation,
      prolongedDeviation: persistenceSummary.dwell_minutes >= 15
        || activeEpisode?.elapsed_minutes >= 30
        || activeEpisode?.persistent_dwell_minutes >= 15,
      recovering: recoverySummary.recovering,
      relapse: recoverySummary.relapse_detected,
    });

    const deviationExplanations = anomalyEvents.map((event) => {
      const eventTime = event.onset_time || event.started_at;
      const peakTime = event.peak_time || eventTime;
      const linkedSegments = deviationSegments.filter((segment) => (
        event.segment_ids?.some((id) => id.toString() === segment._id.toString())
      ));
      const segment = (linkedSegments.length ? linkedSegments : deviationSegments)
        .filter((candidate) => !event.activity || candidate.activity_label === event.activity)
        .sort((a, b) => (
          Math.abs(a.window_start - peakTime) - Math.abs(b.window_start - peakTime)
        ))
        .find((candidate) => Math.abs(candidate.window_start - peakTime) <= 10 * 60 * 1000);
      const timePeriod = patientCaparTimePeriod(peakTime);
      const contextKey = `${event.activity || segment?.activity_label}:${timePeriod}`;
      const baseline = baselineByContext.get(contextKey);
      const qualityAccepted = segment ? isPatientAnalyticsSegment(segment) : false;
      const model = mahalanobisModelByContext.get(contextKey);
      const previousSegment = segment
        ? [...eligibleSegments, ...deviationSegments]
          .filter((candidate) => (
            candidate.activity_label === segment.activity_label
            && candidate.window_start < segment.window_start
            && segment.window_start - candidate.window_start <= 10 * 60 * 1000
          ))
          .sort((a, b) => b.window_start - a.window_start)[0]
        : null;
      const eventMahalanobis = segment && model && qualityAccepted
        ? scorePatientMahalanobis(patientMahalanobisFeatureVector(segment), model)
        : null;
      const deviation = qualityAccepted && baseline && isMaturePatientBaseline(baseline)
        ? explainPatientDeviation(toPatientAnalysisFeatures(segment), baseline, {
          mahalanobis: eventMahalanobis,
          previousFeatures: previousSegment
            ? toPatientAnalysisFeatures(previousSegment)
            : null,
          elapsedMinutes: previousSegment
            ? (segment.window_start - previousSegment.window_start) / 60000
            : null,
        })
        : {
          status: 'insufficient_data',
          reason: !segment
            ? 'peak_segment_not_found'
            : !qualityAccepted
              ? 'peak_segment_failed_quality_gate'
              : 'mature_context_baseline_unavailable',
          factors: [],
        };
      const contexts = collectPatientContextBeforeEvent({
        eventTime,
        checkIns: historicalCheckIns,
        patientEvents: historicalPatientEvents,
        behaviorEvents,
      });
      const contextAttribution = attributePatientContext({
        factors: deviation.factors,
        contexts,
        motionZScore: deviation.factors.find(
          (factor) => factor.feature === 'motion_index'
        )?.z_score ?? null,
      });
      const evidenceAxes = mapPatientContextToRagAxes([
        ...deviation.factors.map((factor) => ({ type: factor.physiology })),
        ...contexts.map((context) => ({ type: context.type })),
      ]);
      const hasEvidenceAxes = Object.values(evidenceAxes).some((axis) => axis.length > 0);
      const citations = (hasEvidenceAxes
        ? retrieveMultiAxisRag({ ...evidenceAxes, minScore: 0.05 })
        : []).slice(0, 3).map(({ paper, score, matchedDimensions }) => ({
        paper_id: paper.paperId,
        title: paper.title,
        year: paper.year,
        journal: paper.journal,
        doi: paper.doi,
        url: paper.pubmedUrl,
        evidence_type: paper.evidenceType,
        evidence_direction: paper.evidenceDirection,
        evidence_summary: paper.clinicalTakeaway,
        relevance_score: score,
        matched_dimensions: matchedDimensions,
      }));

      return {
        event_id: event._id,
        occurred_at: new Date(eventTime),
        peak_at: peakTime ? new Date(peakTime) : null,
        activity: event.activity || segment?.activity_label || null,
        classification: event.classification,
        state: event.current_state || segment?.rr_status || null,
        anomaly_score: event.peak_score ?? segment?.anomaly_score ?? null,
        signal_quality: segment?.signal_quality_detail?.q_signal ?? null,
        explanation_status: deviation.status,
        explanation_reason: deviation.reason || null,
        main_deviation_factors: deviation.factors,
        mahalanobis: eventMahalanobis?.available
          ? {
            distance: eventMahalanobis.distance,
            squared_distance: eventMahalanobis.squared_distance,
            state: eventMahalanobis.state,
            contributions: eventMahalanobis.features,
          }
          : null,
        temporally_associated_context: contexts,
        context_attribution: contextAttribution,
        candidate_context_contributors: contextAttribution.candidates.map((candidate) => ({
          ...candidate,
          associated_contexts: contexts.filter((context) => (
            candidate.evidence.some((evidence) => evidence.includes(context.type))
            || (candidate.type === 'physical_activity'
              && ['physical_activity', 'exercise'].includes(context.type))
          )),
        })),
        association_window_hours: 6,
        causality_established: false,
        evidence_limit: 'Literature evidence is population-level and cannot establish why this individual experienced this deviation.',
        scientific_evidence: citations,
        interpretation: contextAttribution.candidates.length
          ? 'Konteks dan pola fisiologis yang tercatat konsisten dengan hipotesis asosiasi berikut; sistem tidak dapat memastikan penyebab pada individu.'
          : 'Belum ada konteks perilaku yang tercatat pada enam jam sebelum deviasi; pemicu belum dapat dipastikan.',
      };
    });
    const latestDeviationExplanation = deviationExplanations[0] || null;

    capar = {
      status: eligibleSegments.length
        || baselines.length
        || polarData.length
        || episodes.length
        || anomalyEvents.length
        || cognitiveMemories.length
        ? 'available'
        : 'insufficient_data',
      source: 'MongoDB CAPAR collections with patient-scoped access',
      physiology_axes: physiology,
      baseline: {
        mature_contexts: matureBaselines.length,
        total_contexts: baselines.length,
        contexts: baselines.map((baseline) => ({
          activity: baseline.activity,
          time_period: baseline.time_period,
          level: isMaturePatientBaseline(baseline)
            ? baseline.maturity_detail?.level === 'mature'
              ? 'mature'
              : 'mature_legacy'
            : baseline.maturity_detail?.level || 'provisional',
          quality: baseline.maturity_detail?.bq ?? null,
          segment_count: baseline.segment_count,
          last_updated: baseline.last_updated,
          feature_stats: Object.fromEntries(
            [
              'mean_hr',
              'mean_rr',
              'delta_hr',
              'slope_hr',
              'sdnn',
              'rmssd',
              'motion_intensity',
              'dfa_alpha1',
            ]
              .filter((key) => baseline.stats?.[key]?.n > 0)
              .map((key) => [key, {
                count: baseline.stats[key].n,
                mean: baseline.stats[key].mean,
                standard_deviation: baseline.stats[key].std,
              }])
          ),
        })),
      },
      trajectory_24h: eligibleSegments
        .filter((segment) => segment.window_start >= dayAgo.getTime())
        .slice(0, 100)
        .reverse()
        .map((segment) => {
        const personalDeviation = mahalanobisByWindow.get(segment.window_start);
        return {
          recorded_at: new Date(segment.window_start),
          activity: segment.activity_label,
          state: segment.rr_status || segment.classification,
          classification: segment.classification,
          anomaly_score: segment.anomaly_score,
          personal_state: personalDeviation?.state || 'insufficient_data',
          mahalanobis_distance: personalDeviation?.distance ?? null,
          mahalanobis_distance_squared: personalDeviation?.squared_distance ?? null,
          feature_contributions: personalDeviation?.features || [],
          features: toPatientAnalysisFeatures(segment),
          z_scores: segment.z_scores,
          quality: segment.signal_quality_detail?.q_signal ?? null,
        };
      }),
      trajectory_30d: eligibleSegments.slice(0, 500).reverse().map((segment) => {
        const personalDeviation = mahalanobisByWindow.get(segment.window_start);
        return {
          recorded_at: new Date(segment.window_start),
          activity: segment.activity_label,
          state: segment.rr_status || segment.classification,
          classification: segment.classification,
          anomaly_score: segment.anomaly_score,
          personal_state: personalDeviation?.state || 'insufficient_data',
          mahalanobis_distance: personalDeviation?.distance ?? null,
          mahalanobis_distance_squared: personalDeviation?.squared_distance ?? null,
          feature_contributions: personalDeviation?.features || [],
          features: toPatientAnalysisFeatures(segment),
          quality: segment.signal_quality_detail?.q_signal ?? null,
        };
      }),
      mahalanobis: mahalanobis.slice(0, 100),
      polar_data: polarData.map((reading) => ({
        ...reading,
        recorded_at: new Date(reading.timestamp * 1000),
      })),
      episode_history: episodeHistory.slice(0, 100),
      cognitive_memories: cognitiveMemories.map((memory) => ({
        ...memory,
        behavioral_factors_snapshot: memory.behavioral_factors_snapshot
          ?.filter((factor) => factor.patient_confirmed)
          || [],
      })),
      data_inventory: {
        baselines: baselines.length,
        segments_returned: recentSegments.length,
        segments_window_days: 30,
        segments_truncated: recentSegments.length === 2000,
        polar_records_returned: polarData.length,
        polar_data_is_all_time: true,
        polar_records_truncated: polarData.length === 100,
        episode_analyses_returned: episodes.length,
        anomaly_events_returned: anomalyEvents.length,
        cognitive_memories_returned: cognitiveMemories.length,
      },
      recovery: {
        resolved_episodes_30d: episodeOutcomes.recovered,
        unresolved_episodes_30d: episodeOutcomes.unresolved,
        recovery_rate_denominator: episodeOutcomes.denominator,
        observed_episode_recovery_rate_pct: episodeOutcomes.recovery_rate_pct,
        recovery_rate_definition: 'Recovered CAPAR episodes divided by episodes with a documented recovered or unresolved outcome in the last 30 days; this is an observed historical proportion, not a prediction.',
        median_recovery_minutes: medianRecovery == null
          ? null
          : Number((medianRecovery / 60000).toFixed(1)),
        state: recoverySummary.status,
        distance_trend: recoverySummary.score_trend,
        distance_derivative_per_minute: recoverySummary.distance_derivative_per_minute,
        recovery_progress_pct: recoverySummary.recovery_progress,
        time_to_recovery_minutes: recoverySummary.time_to_recovery_minutes,
        time_since_peak_minutes: recoverySummary.time_since_peak_minutes,
        relapse_detected: recoverySummary.relapse_detected,
      },
      persistence: persistenceSummary,
      deviation_explanations: deviationExplanations,
      pedagogy: {
        where_am_i: {
          state: recoverySummary.current_state || latestStatus,
          baseline_relation: currentBaselineRelation,
          mahalanobis_distance: latestMahalanobis?.distance ?? null,
          mahalanobis_distance_squared: latestMahalanobis?.squared_distance ?? null,
          personal_reference_thresholds: latestMahalanobis?.thresholds ?? null,
          meaning: 'Perbandingan dengan baseline pribadi yang matang; bukan penilaian klinis.',
        },
        what_changed: {
          main_factors: latestDeviationExplanation?.main_deviation_factors || [],
          current_state: recoverySummary.current_state || latestStatus,
          score_trend: recoverySummary.score_trend,
          factors: latestDeviationExplanation?.main_deviation_factors || [],
        },
        why: {
          physiological_contributors: latestDeviationExplanation?.main_deviation_factors || [],
          candidate_context_contributors: latestDeviationExplanation?.candidate_context_contributors || [],
          scientific_evidence: latestDeviationExplanation?.scientific_evidence || [],
          explanation_status: latestDeviationExplanation?.explanation_status || 'insufficient_data',
          causality_established: false,
        },
        how_long: recoverySummary.latest_episode,
        persistence: persistenceSummary,
        recovery: recoverySummary,
        action: patientAction,
        red_flags: patientRedFlags,
        follow_up: deviationFollowUp,
      },
      transition_learning: {
        observed_transitions: transitionDocs.reduce(
          (total, transition) => total + (transition.total_transitions || 0),
          0
        ),
        prediction_exposed: false,
      },
      forecast: {
        status: 'not_exposed',
        reason: 'Prediksi personal tidak ditampilkan tanpa validasi kesiapan transisi dan confidence.',
      },
      latest_state: latestStatus || null,
    };
  }

  const ragAxes = {
    behavior: [...new Set([
      ...behavior,
      ...mapPatientContextToRagAxes(
        (capar.cognitive_memories || []).flatMap((memory) =>
          (memory.behavioral_factors_snapshot || []).map((factor) => ({
            type: factor.factor_name || factor.category,
          }))
        )
      ).behavior,
    ])],
    physiology: caparUserId
      ? [...new Set([
        ...capar.physiology_axes,
        ...((capar.recovery?.recovery_rate_denominator || 0) > 0 ? ['recovery'] : []),
      ])]
      : [],
    caparDimension: caparUserId
      ? [
        ...(capar.physiology_axes.includes('dfa_alpha1') || capar.physiology_axes.includes('rmssd') ? ['AR'] : []),
        ...(capar.physiology_axes.includes('recovery')
          || (capar.recovery?.recovery_rate_denominator || 0) > 0
          ? ['RC']
          : []),
      ]
      : [],
    outcome: caparUserId && (capar.recovery?.recovery_rate_denominator || 0) > 0
      ? ['recovery']
      : [],
    timeContext: latestCheckIn?.sleep
      && isPatientCaparNocturnalTime(latestCheckIn.recorded_at)
      ? ['nocturnal_sleep']
      : [],
  };
  const ragResults = Object.values(ragAxes).some((axis) => axis.length > 0)
    ? retrieveMultiAxisRag({ ...ragAxes, minScore: 0.05 }).slice(0, 5)
    : [];

  res.json({
    success: true,
    data: {
      generated_at: now,
      timezone: 'UTC',
      disclaimer: 'Informasi ini bukan diagnosis atau saran medis. Mahalanobis mengukur perbedaan statistik dari baseline pribadi, bukan risiko klinis.',
      capar,
      scientific_evidence: {
        type: 'local_multi_axis_retrieval',
        personalized_causality: false,
        axes_used: ragAxes,
        items: ragResults.map(({ paper, score, matchedDimensions }) => ({
          paper_id: paper.paperId,
          title: paper.title,
          authors: paper.authors,
          year: paper.year,
          journal: paper.journal,
          doi: paper.doi,
          url: paper.pubmedUrl,
          evidence_type: paper.evidenceType,
          evidence_direction: paper.evidenceDirection,
          relevance_score: score,
          matched_dimensions: matchedDimensions,
        })),
      },
      patient_context: {
        latest_check_in_at: latestCheckIn?.recorded_at ?? null,
        recent_event_count: recentEvents.length,
        patient_app_wearable_samples_used_by_capar: false,
        polar_records_loaded_for_patient_app: Boolean(
          caparUserId && capar.data_inventory.polar_records_returned
        ),
        polar_records_used_for_current_mahalanobis: false,
      },
    },
  });
}

export async function createPatientAppEvent(req, res) {
  const { dataOwnerId, dataOwnerType } = await getAccount(req);
  const event = await PatientAppEvent.create({
    ...validatePatientEvent(req.body),
    account_id: dataOwnerId,
    account_type: dataOwnerType,
  });
  res.status(201).json({ success: true, data: event });
}

export async function listPatientAppEvents(req, res) {
  const { accountScopes } = await getAccount(req);
  const filters = validateCheckInQuery(req.query);
  const query = accountScopeFilter(accountScopes);
  if (filters.from || filters.to || filters.before) {
    query.occurred_at = {};
    if (filters.from) query.occurred_at.$gte = filters.from;
    if (filters.to) query.occurred_at.$lte = filters.to;
    if (filters.before) query.occurred_at.$lt = filters.before;
  }
  const data = await PatientAppEvent.find(query)
    .sort({ occurred_at: -1 })
    .limit(filters.limit)
    .lean();
  res.json({
    success: true,
    data,
    pagination: {
      limit: filters.limit,
      next_before: data.length === filters.limit ? data[data.length - 1].occurred_at : null,
    },
  });
}

export async function createPatientAppWearableSample(req, res) {
  const accountData = await getAccount(req);
  const { dataOwnerId, dataOwnerType } = accountData;
  const sampleData = validateWearableSample(req.body);
  const activityConfidence = sampleData.signal_confidence;
  const rrQuality = assessRRQuality(
    sampleData.rr_intervals_ms,
    activityConfidence,
    sampleData.expected_rr_count
  );
  const accelerationX = sampleData.acceleration_g.map((sample) => sample[0]);
  const accelerationY = sampleData.acceleration_g.map((sample) => sample[1]);
  const accelerationZ = sampleData.acceleration_g.map((sample) => sample[2]);
  const derived = extractRRFeatures(
    rrQuality.rr_clean,
    accelerationX,
    accelerationY,
    accelerationZ
  );
  const derivedHr = derived.hr_mean;
  const reasons = [...rrQuality.reasons];
  if (!sampleData.sensor_contact) reasons.push('wearable_sensor_contact_not_confirmed');
  if (activityConfidence < 0.7) reasons.push('signal_confidence_below_0.7');
  if (
    Number.isFinite(sampleData.heart_rate_bpm)
    && Number.isFinite(derivedHr)
    && Math.abs(sampleData.heart_rate_bpm - derivedHr) > 25
  ) {
    reasons.push('reported_hr_disagrees_with_rr_derived_hr');
  }
  const qualityAccepted = rrQuality.accepted
    && sampleData.sensor_contact
    && activityConfidence >= 0.7
    && !reasons.includes('reported_hr_disagrees_with_rr_derived_hr');
  const signalQuality = Math.min(rrQuality.q_signal, activityConfidence);
  const dataQuality = {
    status: qualityAccepted ? 'accepted' : 'warning',
    q_signal: signalQuality,
    q_complete: rrQuality.q_complete,
    reasons,
    feature_source: rrQuality.rr_clean.length >= 2 ? 'derived_from_rr' : 'unavailable',
  };

  const sample = new PatientAppWearableSample({
    ...sampleData,
    acceleration_g: sampleData.acceleration_g.map(([x, y, z]) => ({ x, y, z })),
    rmssd_ms: derived.rmssd,
    sdnn_ms: derived.sdnn,
    dfa_alpha1: derived.dfa_alpha1,
    account_id: dataOwnerId,
    account_type: dataOwnerType,
  });
  sample.data_quality = dataQuality;
  await sample.save();

  const activityLabel = patientActivityLabel(sampleData.activity, sampleData.activity_intensity);
  const durationMs = sampleData.rr_intervals_ms.reduce((sum, rr) => sum + rr, 0);
  const windowEnd = sampleData.recorded_at.getTime() + durationMs;
  const segmentFeatures = {
    mean_hr: derived.hr_mean,
    std_hr: null,
    delta_hr: derived.hr_delta,
    slope_hr: derived.hr_slope,
    mean_rr: rrQuality.rr_clean.length
      ? rrQuality.rr_clean.reduce((sum, rr) => sum + rr, 0) / rrQuality.rr_clean.length
      : null,
    sdnn: derived.sdnn,
    rmssd: derived.rmssd,
    motion_intensity: derived.motion_index,
    step_count: sampleData.steps,
    dfa_alpha1: derived.dfa_alpha1,
    dfa_alpha2: derived.dfa_alpha2,
    pnn50: derived.pnn50,
  };
  try {
    const caparSegment = await Segment.findOneAndUpdate(
      {
        user_id: dataOwnerId,
        device_id: sampleData.device_id,
        window_type: '1min',
        window_start: sampleData.recorded_at.getTime(),
      },
      {
        $set: {
          user_id: dataOwnerId,
          device_id: sampleData.device_id,
          patient_app_sample_id: sample._id,
          window_type: '1min',
          window_start: sampleData.recorded_at.getTime(),
          window_end: windowEnd,
          activity_label: activityLabel,
          features: segmentFeatures,
          rr_raw: sampleData.rr_intervals_ms,
          raw_count: sampleData.rr_intervals_ms.length,
          is_valid: qualityAccepted,
          analyzed: !qualityAccepted,
          rr_status: qualityAccepted ? null : 'QUALITY_WARNING',
          quality_audit: {
            rr_total_received: sampleData.rr_intervals_ms.length,
            rr_artifact_count: Math.round(
              rrQuality.artifact_fraction * sampleData.rr_intervals_ms.length
            ),
            rr_missing_count: Math.round(
              rrQuality.missing_fraction * (sampleData.expected_rr_count || sampleData.rr_intervals_ms.length)
            ),
            rr_artifact_fraction: rrQuality.artifact_fraction,
            rr_missing_fraction: rrQuality.missing_fraction,
            gate_passed: qualityAccepted,
            gate_reasons: reasons,
          },
          signal_quality: {
            is_artifact: !qualityAccepted,
            is_anomaly: false,
            artifact_type: qualityAccepted ? null : 'quality_gate',
          },
          signal_quality_detail: {
            artifact_fraction: rrQuality.artifact_fraction,
            missing_fraction: rrQuality.missing_fraction,
            q_signal: signalQuality,
            q_complete: rrQuality.q_complete,
            q_context: activityConfidence,
            reasons,
          },
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
  } catch (error) {
    await PatientAppWearableSample.deleteOne({ _id: sample._id });
    throw error;
  }

  const existingProfile = await findExistingPatientAppProfile(accountData.accountScopes);
  const profileQuery = existingProfile
    ? { _id: existingProfile._id }
    : { account_id: dataOwnerId, account_type: dataOwnerType };
  await PatientAppProfile.updateOne(
    profileQuery,
    {
      $set: { wearable_provider: sample.provider },
      $setOnInsert: { account_id: dataOwnerId, account_type: dataOwnerType },
    },
    { upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  res.status(201).json({
    success: true,
    data: {
      sample,
      capar_ingestion: {
        status: qualityAccepted ? 'pending_layer3_analysis' : 'quality_warning',
        segment_id: caparSegment._id,
        analyzed: caparSegment.analyzed,
        quality: dataQuality,
        derived_features: {
          hr_mean: derived.hr_mean,
          hr_delta: derived.hr_delta,
          hr_slope: derived.hr_slope,
          mean_rr: segmentFeatures.mean_rr,
          sdnn: derived.sdnn,
          rmssd: derived.rmssd,
          pnn50: derived.pnn50,
          dfa_alpha1: derived.dfa_alpha1,
          motion_index: derived.motion_index,
        },
        minimum_rr_for_dfa: 64,
      },
    },
  });
}

export async function streamPatientAppWearableData(req, res) {
  const { dataOwnerId } = await getAccount(req);
  const stream = validateWearableStream(req.body);
  const streamActivity = {
    rest: 'Istirahat',
    sitting: 'Duduk',
    standing: 'Berdiri',
    walking: 'Berjalan',
    exercise: 'Olahraga Berat',
    sleep: 'Tidur',
    other: 'Lainnya',
  }[stream.activity] ?? 'Lainnya';
  try {
    const result = await publishLogTransport({
      user_id: dataOwnerId.toString(),
      source: 'vidyamedic_polar_ble',
      device_id: stream.device_id,
      received_at: new Date().toISOString(),
      readings: stream.readings.map((reading) => ({
        timestamp: Math.floor(reading.recorded_at.getTime() / 1000),
        heart_rate: reading.heart_rate_bpm,
        rr_interval: reading.rr_interval_ms,
        activity: streamActivity,
        signal_quality: reading.signal_confidence,
        acc_x: reading.acceleration_g[0],
        acc_y: reading.acceleration_g[1],
        acc_z: reading.acceleration_g[2],
      })),
    });
    if (!result.published) {
      console.warn(`[PatientAppWearable] RabbitMQ did not accept stream for account ${dataOwnerId}: ${result.reason}`);
      return res.status(503).json({
        success: false,
        message: 'RabbitMQ tidak menerima batch streaming. Periksa koneksi server.',
      });
    }
    return res.status(202).json({
      success: true,
      data: {
        published: true,
        reading_count: result.envelope.readings.length,
        device_id: stream.device_id,
      },
    });
  } catch (error) {
    console.error(`[PatientAppWearable] RabbitMQ stream failed for account ${dataOwnerId}: ${error.message}`);
    return res.status(503).json({
      success: false,
      message: 'Streaming wearable gagal diteruskan ke RabbitMQ.',
    });
  }
}

function buildPatientEpisodeHistory({ episodes, episodeMetadata, anomalyEvents }) {
  const metadataByEpisode = new Map(
    episodeMetadata.map((metadata) => [metadata.episode_id?.toString(), metadata])
  );
  const eventsByEpisode = new Map(
    anomalyEvents.map((event) => [event._id.toString(), event])
  );
  const historyByEpisode = new Map();
  const toDate = (value) => {
    if (value == null) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  };

  for (const analysis of episodes) {
    const episodeId = analysis.episode_id?.toString();
    const event = episodeId ? eventsByEpisode.get(episodeId) : null;
    const metadata = episodeId ? metadataByEpisode.get(episodeId) : null;
    const recoveryTime = Number(analysis.ttr)
      || Number(analysis.recovery_duration)
      || Number(event?.trajectory?.recovery_time_ms)
      || null;
    const recovered = (Number.isFinite(recoveryTime) && recoveryTime > 0)
      || analysis.physiological_state === 'RECOVERED'
      || event?.physiological_outcome === 'RECOVERED'
      || event?.recovered_at != null
      || metadata?.status === 'recovered';
    const unresolved = !recovered && (
      event?.status === 'unresolved'
      || event?.unresolved_at != null
      || metadata?.status === 'unresolved'
    );
    const startAt = toDate(analysis.start_time)
      || toDate(event?.onset_time || event?.started_at)
      || toDate(metadata?.onset_timestamp);
    const endAt = toDate(analysis.end_time)
      || toDate(event?.recovered_at || event?.resolved_time)
      || null;

    historyByEpisode.set(episodeId || `analysis:${analysis._id}`, {
      episode_id: episodeId || null,
      start_at: startAt,
      end_at: endAt,
      status: event?.current_state || metadata?.current_state
        || analysis.physiological_state || metadata?.status || event?.status || 'unknown',
      outcome: recovered ? 'recovered' : unresolved ? 'unresolved' : 'in_progress_or_unverified',
      activity: analysis.activity || event?.activity || metadata?.activity || null,
      context: analysis.context || event?.context_tag || null,
      classification: event?.classification || metadata?.classification || null,
      peak_deviation: analysis.peak_deviation ?? event?.peak_score ?? null,
      mean_deviation: analysis.mean_deviation ?? analysis.anomaly_score ?? null,
      deviation_auc: analysis.deviation_auc ?? event?.auc_score ?? null,
      recovery_time_ms: Number.isFinite(recoveryTime) && recoveryTime > 0 ? recoveryTime : null,
      duration_ms: analysis.total_duration || event?.duration_ms || metadata?.duration_ms || null,
      relapse_detected: analysis.relapse_detected === true
        || event?.relapse === true
        || (event?.relapse_count || analysis.relapse_count || 0) > 0,
      relapse_count: Math.max(analysis.relapse_count || 0, event?.relapse_count || 0),
      quality_score: analysis.quality_score ?? event?.confidence ?? null,
      quality_gate_pass: analysis.quality_gate_pass ?? null,
      features: {
        heart_rate_mean: analysis.hr_mean ?? event?.peak_hr ?? null,
        rmssd: analysis.rmssd ?? null,
        sdnn: analysis.sdnn ?? null,
        dfa_alpha1: analysis.dfa_alpha1 ?? null,
      },
    });
  }

  for (const event of anomalyEvents) {
    const key = event._id.toString();
    if (historyByEpisode.has(key)) continue;
    const metadata = metadataByEpisode.get(key);
    const recoveryTime = Number(event.trajectory?.recovery_time_ms)
      || Number(event.ttr_tau_out_ms)
      || null;
    const recovered = event.physiological_outcome === 'RECOVERED'
      || event.recovered_at != null
      || metadata?.status === 'recovered';
    const unresolved = !recovered && (
      event.status === 'unresolved'
      || event.unresolved_at != null
      || metadata?.status === 'unresolved'
    );
    historyByEpisode.set(key, {
      episode_id: key,
      start_at: toDate(event.onset_time || event.started_at || metadata?.onset_timestamp),
      end_at: toDate(event.recovered_at || event.resolved_time),
      status: event.current_state || metadata?.current_state || event.status,
      outcome: recovered ? 'recovered' : unresolved ? 'unresolved' : 'in_progress_or_unverified',
      activity: event.activity || metadata?.activity || null,
      context: event.context_tag || null,
      classification: event.classification || metadata?.classification || null,
      peak_deviation: event.peak_score ?? null,
      mean_deviation: event.onset_score ?? null,
      deviation_auc: event.auc_score ?? null,
      recovery_time_ms: Number.isFinite(recoveryTime) && recoveryTime > 0 ? recoveryTime : null,
      duration_ms: event.duration_ms ?? metadata?.duration_ms ?? null,
      relapse_detected: event.relapse === true || (event.relapse_count || 0) > 0,
      relapse_count: event.relapse_count || 0,
      quality_score: event.confidence ?? null,
      quality_gate_pass: null,
      features: {
        heart_rate_mean: event.peak_hr ?? null,
        rmssd: event.features?.rmssd ?? null,
        sdnn: event.features?.sdnn ?? null,
        dfa_alpha1: event.trajectory?.dfa_alpha1 ?? null,
      },
    });
  }

  for (const metadata of episodeMetadata) {
    const key = metadata.episode_id.toString();
    if (historyByEpisode.has(key)) continue;
    const recovered = metadata.status === 'recovered';
    const unresolved = metadata.status === 'unresolved';
    historyByEpisode.set(key, {
      episode_id: key,
      start_at: toDate(metadata.onset_timestamp),
      end_at: null,
      status: metadata.current_state || metadata.status,
      outcome: recovered ? 'recovered' : unresolved ? 'unresolved' : 'in_progress_or_unverified',
      activity: metadata.activity || null,
      context: null,
      classification: metadata.classification || null,
      peak_deviation: metadata.peak_score ?? null,
      mean_deviation: null,
      deviation_auc: null,
      recovery_time_ms: null,
      duration_ms: metadata.duration_ms ?? null,
      relapse_detected: false,
      relapse_count: 0,
      quality_score: null,
      quality_gate_pass: null,
      features: {},
    });
  }

  return [...historyByEpisode.values()]
    .sort((a, b) => (b.start_at?.getTime() || 0) - (a.start_at?.getTime() || 0));
}

function isPatientAnalyticsSegment(segment) {
  if (segment.signal_quality?.is_artifact) return false;
  if (['QUALITY_WARNING', 'INSUFFICIENT_BASELINE'].includes(segment.rr_status)) return false;
  const quality = segment.signal_quality_detail || {};
  if (quality.q_signal != null && quality.q_signal < 0.7) return false;
  if (quality.q_complete != null && quality.q_complete < 0.7) return false;
  return segment.quality_audit?.gate_passed === true
    || (quality.q_signal >= 0.7 && quality.q_complete >= 0.7);
}

function isPatientBaselineSegment(segment) {
  if (!isPatientAnalyticsSegment(segment)) return false;
  if (segment.rr_status && segment.rr_status !== 'NORMAL') return false;
  return segment.rr_status === 'NORMAL' || segment.classification === 'Normal';
}

function isMaturePatientBaseline(baseline) {
  const matureByLevel = baseline.maturity_detail?.level === 'mature';
  const matureByLegacyFlag = baseline.is_mature && baseline.segment_count >= 20;
  if (!matureByLevel && !matureByLegacyFlag) return false;
  const maturity = baseline.maturity_detail;
  const qualityWasComputed = Boolean(
    maturity?.last_computed
    || maturity?.bq > 0
    || maturity?.q_signal > 0
    || maturity?.q_complete > 0
    || maturity?.q_context > 0
    || maturity?.q_stability > 0
    || maturity?.failed_gates?.length
  );
  if (
    (matureByLevel || (matureByLegacyFlag && qualityWasComputed))
    && maturity?.bq != null
    && maturity.bq < 0.7
  ) {
    return false;
  }
  return true;
}

function patientFeatureVector(segment) {
  const vector = patientMahalanobisFeatureVector(segment);
  return Object.keys(vector).length >= 2 ? vector : null;
}

function patientMahalanobisFeatureVector(segment) {
  const features = segment?.features || {};
  return Object.fromEntries(
    [
      'mean_hr',
      'mean_rr',
      'delta_hr',
      'slope_hr',
      'sdnn',
      'rmssd',
      'dfa_alpha1',
      'motion_intensity',
    ]
      .filter((key) => Number.isFinite(features[key]))
      .map((key) => [key, features[key]])
  );
}

function selectPatientMahalanobisFeatures(samples, baseline) {
  const candidates = [
    'mean_hr',
    'mean_rr',
    'delta_hr',
    'slope_hr',
    'sdnn',
    'rmssd',
    'dfa_alpha1',
    'motion_intensity',
  ].filter((key) => baseline?.stats?.[key]?.n >= 30);
  const selected = [];
  for (const candidate of candidates) {
    const proposed = [...selected, candidate];
    const completeSampleCount = samples.filter((sample) =>
      proposed.every((key) => Number.isFinite(sample[key]))
    ).length;
    if (completeSampleCount >= 30) selected.push(candidate);
  }
  return selected.length >= 2 ? selected : [];
}

function toPatientAnalysisFeatures(segment) {
  const features = segment?.features || {};
  return {
    hr_mean: features.mean_hr,
    hr_delta: features.delta_hr,
    hr_slope: features.slope_hr,
    sdnn: features.sdnn,
    rmssd: features.rmssd,
    dfa_alpha1: features.dfa_alpha1,
    motion_index: features.motion_intensity,
  };
}

function patientActivityLabel(activity, intensity = 'unknown') {
  if (['rest', 'sitting', 'standing', 'sleep'].includes(activity)) return 'Rest';
  if (activity === 'walking') return intensity === 'vigorous' ? 'Moderate' : 'Light';
  if (activity === 'exercise') {
    if (intensity === 'vigorous') return 'Intense';
    if (intensity === 'low') return 'Light';
    return 'Moderate';
  }
  return 'Unknown';
}

function collectPatientContextBeforeEvent({
  eventTime,
  checkIns,
  patientEvents,
  behaviorEvents,
}) {
  if (!Number.isFinite(eventTime)) return [];
  const windowStart = eventTime - 6 * 60 * 60 * 1000;
  const context = [];
  const add = (type, occurredAt, source, confidence = null) => {
    const timestamp = new Date(occurredAt).getTime();
    if (!Number.isFinite(timestamp) || timestamp < windowStart || timestamp > eventTime) return;
    context.push({
      type,
      occurred_at: new Date(timestamp),
      source,
      temporal_relation: 'before_deviation_within_6h',
      ...(
        (type === 'sleep' || type === 'sleep_duration')
        && isPatientCaparNocturnalTime(timestamp)
          ? { time_context: 'nocturnal_sleep' }
          : {}
      ),
      ...(confidence == null ? {} : { confidence }),
    });
  };

  for (const record of behaviorEvents) {
    const start = Number(record.timestamp_start);
    const end = Number(record.timestamp_end);
    if (!Number.isFinite(start) || start > eventTime) continue;
    const lastActiveAt = Number.isFinite(end) ? Math.min(end, eventTime) : start;
    if (lastActiveAt < windowStart) continue;
    add(record.behavior_type, lastActiveAt, record.source || 'capar_behavior_log', record.confidence);
  }

  for (const checkIn of checkIns) {
    const recordedAt = checkIn.recorded_at;
    if (checkIn.activity === 'walking' || checkIn.activity === 'exercise') {
      add('physical_activity', recordedAt, 'patient_check_in');
    }
    if (checkIn.stress_level >= 2) add('stress', recordedAt, 'patient_check_in');
    if (checkIn.sleep?.duration_minutes != null) add('sleep_duration', recordedAt, 'patient_check_in');
    if (checkIn.lifestyle?.caffeine) add('caffeine', recordedAt, 'patient_check_in');
    if (checkIn.lifestyle?.smoking) add('smoking', recordedAt, 'patient_check_in');
    if (checkIn.lifestyle?.alcohol) add('alcohol', recordedAt, 'patient_check_in');
    if (checkIn.lifestyle?.meal) add('meal', recordedAt, 'patient_check_in');
    if (checkIn.symptoms?.length) add('reported_symptom', recordedAt, 'patient_check_in');
  }

  for (const event of patientEvents) {
    const eventType = {
      exercise_started: 'exercise',
      exercise_ended: 'physical_activity',
      sleep_started: 'sleep',
      woke_up: 'sleep_duration',
      meal: 'meal',
      medication: 'medication',
      stress: 'stress',
      symptom: 'reported_symptom',
      caffeine: 'caffeine',
      alcohol: 'alcohol',
      smoking: 'smoking',
      hydration: 'hydration',
      illness: 'illness',
      posture_change: 'posture_change',
      menstruation: 'menstruation',
    }[event.event_type] || null;
    if (eventType) add(eventType, event.occurred_at, 'patient_event');
  }

  const seen = new Set();
  return context
    .sort((a, b) => b.occurred_at - a.occurred_at)
    .filter((item) => {
      const key = `${item.type}:${item.occurred_at.getTime()}:${item.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function listPatientAppWearableSamples(req, res) {
  const { accountScopes } = await getAccount(req);
  const filters = validateCheckInQuery(req.query);
  const query = accountScopeFilter(accountScopes);
  if (filters.from || filters.to || filters.before) {
    query.recorded_at = {};
    if (filters.from) query.recorded_at.$gte = filters.from;
    if (filters.to) query.recorded_at.$lte = filters.to;
    if (filters.before) query.recorded_at.$lt = filters.before;
  }
  const data = await PatientAppWearableSample.find(query)
    .sort({ recorded_at: -1 })
    .limit(filters.limit)
    .lean();
  res.json({
    success: true,
    data,
    pagination: {
      limit: filters.limit,
      next_before: data.length === filters.limit ? data[data.length - 1].recorded_at : null,
    },
  });
}

function profileData(profile) {
  return {
    date_of_birth: profile.date_of_birth,
    timezone: profile.timezone,
    sex: profile.sex,
    height_cm: profile.height_cm,
    weight_kg: profile.weight_kg,
    blood_type: profile.blood_type,
    emergency_contact_name: profile.emergency_contact_name,
    emergency_contact_phone: profile.emergency_contact_phone,
    conditions: profile.conditions,
    allergies: profile.allergies,
    allergies_reviewed: profile.allergies_reviewed,
    special_conditions: profile.special_conditions,
    clinical_note: profile.clinical_note,
    medications: profile.medications,
    medication_reviewed: profile.medication_reviewed,
    data_sharing: profile.data_sharing,
    goal: profile.goal,
    notification_preferences: profile.notification_preferences,
    wearable_provider: profile.wearable_provider,
    updated_at: profile.updatedAt,
  };
}
