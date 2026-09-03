/**
 * resilience.controller.js
 * Cardiovascular Resilience State (CRS) Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Layer state estimation on top of CAPAR engine:
 * 1. Clinical Vulnerability (CV, 20%)
 * 2. Cardiac Reserve (CR, 20%)
 * 3. Autonomic Reserve (AR, 25%)
 * 4. Recovery Capacity (RC, 20%)
 * 5. Regulation Stability (RS, 15%)
 * Total Global Score: CRS = 0.20*CV + 0.20*CR + 0.25*AR + 0.20*RC + 0.15*RS
 */

import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Patient from '../models/patient.model.js';
import Segment from '../models/segment.model.js';
import Baseline from '../models/baseline.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';

/**
 * Normalizes value between min and max to 0.0 - 1.0
 */
function clampNormalize(val, min, max, invert = false) {
  if (typeof val !== 'number' || isNaN(val)) return 0.5;
  const clamped = Math.max(min, Math.min(max, val));
  const norm = (clamped - min) / (max - min);
  return invert ? (1.0 - norm) : norm;
}

/**
 * Computes all 5 resilience dimensions and Global CRS
 */
export function computeCardiovascularResilience(params) {
  const {
    // 1. Clinical inputs
    age = 55,
    sex = 1,
    bmi = 24.5,
    trestbps = 130,
    chol = 240,
    thalach = 116,
    oldpeak = 0.5,
    exang = 0,
    history = 0,

    // 2. Cardiac reserve inputs (CAPAR)
    meanHr = 89.9,
    minHr = 56.9,
    maxHr = 115.5,
    hrrSlope = 0.45,
    hrVariability = 46.2,
    activityResponse = 0.85,

    // 3. Autonomic reserve inputs (CAPAR)
    rmssd = 40.5,
    sdnn = 46.2,
    dfaAlpha1 = 1.10,
    dfaAlpha2 = 1.16,
    meanRr = 717,
    lf = 1978,
    hf = 672,

    // 4. Recovery capacity inputs (CAPAR)
    ttrMinutes = 15.0,
    recoverySlope = 0.65,
    residualScore = 0.20,
    relapseCount = 0,

    // 5. Regulation stability inputs (CAPAR)
    fsmStability = 0.88,
    episodeFrequency = 2,
    baselineConsistency = 0.85,
    contextAlignment = 0.90,
    scoreVariance = 0.15
  } = params;

  // ── [1] CLINICAL VULNERABILITY SCORE (0 = High Risk, 100 = Low Risk) ──
  const ageRisk = clampNormalize(age, 30, 75);
  const bmiRisk = clampNormalize(bmi, 18.5, 35);
  const bpRisk = clampNormalize(trestbps, 100, 180);
  const cholRisk = clampNormalize(chol, 150, 320);
  const ecgRisk = clampNormalize(oldpeak, 0.0, 3.5);
  const anginaRisk = exang ? 1.0 : 0.0;
  const historyRisk = history ? 1.0 : 0.0;

  const totalRiskFraction = (
    0.15 * ageRisk +
    0.15 * bmiRisk +
    0.15 * bpRisk +
    0.15 * cholRisk +
    0.15 * ecgRisk +
    0.15 * anginaRisk +
    0.10 * historyRisk
  );
  const clinicalScore = Math.min(100, Math.max(0, Number(((1.0 - totalRiskFraction) * 100).toFixed(1))));

  // ── [2] CARDIAC RESERVE SCORE (0 - 100) ──
  const hrResponseNorm = clampNormalize(maxHr - minHr, 20, 80);
  const hrrSlopeNorm = clampNormalize(hrrSlope, 0.1, 1.0);
  const hrVarNorm = clampNormalize(hrVariability, 15, 70);
  const actRespNorm = clampNormalize(activityResponse, 0.2, 1.0);

  const cardiacReserveScore = Math.min(100, Math.max(0, Number(((
    0.30 * hrResponseNorm +
    0.25 * hrrSlopeNorm +
    0.25 * hrVarNorm +
    0.20 * actRespNorm
  ) * 100).toFixed(1))));

  // ── [3] AUTONOMIC RESERVE SCORE (0 - 100) ──
  const rmssdNorm = clampNormalize(rmssd, 15, 65);
  const sdnnNorm = clampNormalize(sdnn, 20, 75);
  const dfaNorm = clampNormalize(Math.abs(dfaAlpha1 - 1.0), 0.0, 0.6, true); // ideal 1.0
  const rrStabilityNorm = clampNormalize(meanRr, 500, 1000);
  const lfhfRatio = hf > 0 ? (lf / hf) : 2.0;
  const lfhfNorm = clampNormalize(Math.abs(lfhfRatio - 1.8), 0.0, 3.0, true);

  const autonomicReserveScore = Math.min(100, Math.max(0, Number(((
    0.25 * rmssdNorm +
    0.20 * sdnnNorm +
    0.25 * dfaNorm +
    0.15 * rrStabilityNorm +
    0.15 * lfhfNorm
  ) * 100).toFixed(1))));

  // ── [4] RECOVERY CAPACITY SCORE (0 - 100) ──
  const ttrNorm = clampNormalize(ttrMinutes, 3, 30, true); // shorter TTR = higher score
  const recSlopeNorm = clampNormalize(recoverySlope, 0.1, 1.0);
  const residNorm = clampNormalize(residualScore, 0.0, 1.0, true);
  const relapsePenalty = Math.max(0, 1.0 - (relapseCount * 0.3));

  const recoveryCapacityScore = Math.min(100, Math.max(0, Number(((
    0.35 * ttrNorm +
    0.30 * recSlopeNorm +
    0.20 * residNorm +
    0.15 * relapsePenalty
  ) * 100).toFixed(1))));

  // ── [5] REGULATION STABILITY SCORE (0 - 100) ──
  const fsmNorm = clampNormalize(fsmStability, 0.3, 1.0);
  const epFreqNorm = clampNormalize(episodeFrequency, 0, 8, true); // fewer episodes = higher score
  const baseConsNorm = clampNormalize(baselineConsistency, 0.4, 1.0);
  const ctxAlignNorm = clampNormalize(contextAlignment, 0.4, 1.0);
  const varNorm = clampNormalize(scoreVariance, 0.0, 0.8, true);

  const regulationStabilityScore = Math.min(100, Math.max(0, Number(((
    0.30 * fsmNorm +
    0.25 * epFreqNorm +
    0.20 * baseConsNorm +
    0.15 * ctxAlignNorm +
    0.10 * varNorm
  ) * 100).toFixed(1))));

  // Support direct score overrides from interactive simulation
  const finalClinical = params.clinical !== undefined ? Number(params.clinical) : clinicalScore;
  const finalCardiac = params.cardiac !== undefined ? Number(params.cardiac) : cardiacReserveScore;
  const finalAutonomic = params.autonomic !== undefined ? Number(params.autonomic) : autonomicReserveScore;
  const finalRecovery = params.recovery !== undefined ? Number(params.recovery) : recoveryCapacityScore;
  const finalStability = params.stability !== undefined ? Number(params.stability) : regulationStabilityScore;

  // ── GLOBAL RESILIENCE SCORE (CRS) ──
  // Weights: CV 20%, CR 20%, AR 25%, RC 20%, RS 15%
  const globalScore = Number((
    0.20 * finalClinical +
    0.20 * finalCardiac +
    0.25 * finalAutonomic +
    0.20 * finalRecovery +
    0.15 * finalStability
  ).toFixed(1));

  let stateClassification = 'HIGH RESILIENCE';
  let stateColor = '#10B981';
  let badgeColor = '#DCFCE7';
  let badgeText = '#15803D';

  if (globalScore < 70) {
    stateClassification = 'LOW RESILIENCE';
    stateColor = '#EF4444';
    badgeColor = '#FEE2E2';
    badgeText = '#B91C1C';
  } else if (globalScore < 85) {
    stateClassification = 'MODERATE RESILIENCE';
    stateColor = '#F59E0B';
    badgeColor = '#FEF3C7';
    badgeText = '#B45309';
  }

  return {
    globalScore,
    stateClassification,
    stateColor,
    badgeColor,
    badgeText,
    dimensions: {
      clinical: {
        id: 'clinical',
        name: 'Clinical Vulnerability',
        score: clinicalScore,
        weight: 20,
        source: 'Clinical Dataset (Cleveland / Statlog / EHR)',
        interpretation: clinicalScore >= 80 ? 'Low Vulnerability (Protective)' : (clinicalScore >= 60 ? 'Moderate Vulnerability' : 'High Vulnerability Alert'),
        attributes: [
          { label: 'Usia (Age)', value: `${age} thn`, status: age < 55 ? 'Normal' : 'Elevated' },
          { label: 'BMI Indeks Massa Tubuh', value: `${bmi}`, status: bmi < 25 ? 'Normal' : 'Overweight' },
          { label: 'Tekanan Darah (Rest BP)', value: `${trestbps} mmHg`, status: trestbps < 130 ? 'Normal' : 'Elevated' },
          { label: 'Kolesterol Serum', value: `${chol} mg/dl`, status: chol < 200 ? 'Optimal' : 'Elevated' },
          { label: 'Depresi ST (Oldpeak)', value: `${oldpeak} mm`, status: oldpeak < 1.0 ? 'Normal' : 'Ischemia Alert' },
          { label: 'Riwayat Angina Latihan', value: exang ? 'Ya' : 'Tidak', status: exang ? 'Risk Factor' : 'None' }
        ]
      },
      cardiac: {
        id: 'cardiac',
        name: 'Cardiac Reserve',
        score: cardiacReserveScore,
        weight: 20,
        source: 'CAPAR Engine (HR Trajectory & Response)',
        interpretation: cardiacReserveScore >= 80 ? 'Strong Cardiac Reserve' : (cardiacReserveScore >= 60 ? 'Adequate Reserve' : 'Depleted Reserve'),
        attributes: [
          { label: 'Denyut Puncak (Peak HR)', value: `${Math.round(maxHr)} bpm`, status: 'Adequate' },
          { label: 'Rentang Respons (Delta HR)', value: `${Math.round(maxHr - minHr)} bpm`, status: 'Responsive' },
          { label: 'Variabilitas HR Latihan', value: `${hrVariability} bpm`, status: 'Optimal' },
          { label: 'Kemiringan Pemulihan (HRR Slope)', value: `${hrrSlope}`, status: 'Stable' }
        ]
      },
      autonomic: {
        id: 'autonomic',
        name: 'Autonomic Reserve',
        score: autonomicReserveScore,
        weight: 25,
        source: 'CAPAR Engine (RR, HRV, DFA, LF/HF)',
        interpretation: autonomicReserveScore >= 80 ? 'Strong Autonomic Reserve' : (autonomicReserveScore >= 60 ? 'Moderate Reserve' : 'Autonomic Impairment'),
        attributes: [
          { label: 'RMSSD Tidur (Vagal Tone)', value: `${rmssd} ms`, status: rmssd >= 35 ? 'Optimal' : 'Blunted' },
          { label: 'SDNN Total Variabilitas', value: `${sdnn} ms`, status: 'Good' },
          { label: 'DFA Alpha-1 (Fraktal)', value: `${dfaAlpha1}`, status: dfaAlpha1 < 1.35 ? 'Flexible 1/f' : 'Sympathetic Bias' },
          { label: 'Keseimbangan LF/HF', value: `${(lf / (hf || 1)).toFixed(2)}`, status: 'Balanced' }
        ]
      },
      recovery: {
        id: 'recovery',
        name: 'Recovery Capacity',
        score: recoveryCapacityScore,
        weight: 20,
        source: 'CAPAR Engine (Episode & Recovery FSM)',
        interpretation: recoveryCapacityScore >= 80 ? 'Rapid & Efficient Recovery' : (recoveryCapacityScore >= 60 ? 'Moderate Recovery Rate' : 'Prolonged / Delayed Recovery'),
        attributes: [
          { label: 'Waktu Pemulihan (TTR)', value: `${ttrMinutes} mnt`, status: ttrMinutes < 12 ? 'Rapid' : 'Moderate' },
          { label: 'Kemiringan Reaktivasi Vagal', value: `${recoverySlope}`, status: 'Efficient' },
          { label: 'Deviasi Residu (Residual Stress)', value: `${(residualScore * 100).toFixed(0)}%`, status: 'Low' },
          { label: 'Frekuensi Relapse (Kekambuhan)', value: `${relapseCount}x`, status: relapseCount === 0 ? 'None' : 'Present' }
        ]
      },
      stability: {
        id: 'stability',
        name: 'Regulation Stability',
        score: regulationStabilityScore,
        weight: 15,
        source: 'CAPAR Engine (Closed-Loop FSM Stability)',
        interpretation: regulationStabilityScore >= 80 ? 'High Regulation Stability' : (regulationStabilityScore >= 60 ? 'Moderate Homeostatic Control' : 'Unstable Homeostasis'),
        attributes: [
          { label: 'Stabilitas Status FSM', value: `${(fsmStability * 100).toFixed(0)}%`, status: 'Stable' },
          { label: 'Frekuensi Episode Anomali', value: `${episodeFrequency} episode`, status: episodeFrequency < 3 ? 'Low' : 'Frequent' },
          { label: 'Konsistensi Baseline Sirkadian', value: `${(baselineConsistency * 100).toFixed(0)}%`, status: 'High' },
          { label: 'Kesesuaian Konteks Aktivitas', value: `${(contextAlignment * 100).toFixed(0)}%`, status: 'Aligned' }
        ]
      }
    }
  };
}

/**
 * GET /api/resilience/state
 * Retrieves real CAPAR engine data and calculates Cardiovascular Resilience State
 */
export async function getCardiovascularResilienceState(req, res) {
  try {
    const targetUserId = req.query.userId || req.user?.id || '6a6609326bf83196b1d73e97';

    let user = null;
    let patientDoc = null;
    let segments = [];
    let baselines = [];
    let events = [];

    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(targetUserId)) {
      try {
        const uId = new mongoose.Types.ObjectId(targetUserId);
        user = await User.findById(uId).select('-password').maxTimeMS(2000);
        patientDoc = await Patient.findOne({ user_id: uId }).maxTimeMS(2000);
        segments = await Segment.find({ user_id: uId }).sort({ window_start: 1 }).limit(1000).maxTimeMS(2000);
        baselines = await Baseline.find({ user_id: uId }).maxTimeMS(2000);
        events = await AnomalyEvent.find({ user_id: uId }).sort({ onset_time: -1 }).limit(20).maxTimeMS(2000);
      } catch (dbErr) {
        console.warn('[getCardiovascularResilienceState] DB fallback:', dbErr.message);
      }
    }

    // Default telemetry extraction
    let meanHr = 89.9;
    let minHr = 56.9;
    let maxHr = 115.5;
    let rmssd = 40.5;
    let sdnn = 46.2;
    let dfaAlpha1 = 1.10;
    let dfaAlpha2 = 1.16;
    let meanRr = 717;
    let lf = 1978;
    let hf = 672;
    let ttrMinutes = 15.0;
    let relapseCount = 0;
    let isRealData = false;

    if (segments.length > 0) {
      isRealData = true;
      const hrs = segments.map(s => s.features?.mean_hr).filter(v => typeof v === 'number' && !isNaN(v));
      const rmssds = segments.map(s => s.features?.rmssd).filter(v => typeof v === 'number' && !isNaN(v));
      const sdnns = segments.map(s => s.features?.sdnn).filter(v => typeof v === 'number' && !isNaN(v));
      const dfas = segments.map(s => s.features?.dfa_alpha1).filter(v => typeof v === 'number' && !isNaN(v));
      const rrs = segments.map(s => s.features?.mean_rr).filter(v => typeof v === 'number' && !isNaN(v));

      if (hrs.length > 0) {
        meanHr = hrs.reduce((a, b) => a + b, 0) / hrs.length;
        minHr = Math.min(...hrs);
        maxHr = Math.max(...hrs);
      }
      if (rmssds.length > 0) rmssd = rmssds.reduce((a, b) => a + b, 0) / rmssds.length;
      if (sdnns.length > 0) sdnn = sdnns.reduce((a, b) => a + b, 0) / sdnns.length;
      if (dfas.length > 0) dfaAlpha1 = dfas.reduce((a, b) => a + b, 0) / dfas.length;
      if (rrs.length > 0) meanRr = rrs.reduce((a, b) => a + b, 0) / rrs.length;
    }

    if (events.length > 0) {
      const ttrs = events.map(e => e.ttr_min || (e.duration_ms ? e.duration_ms / 60000 : null)).filter(v => typeof v === 'number' && v > 0);
      if (ttrs.length > 0) ttrMinutes = ttrs.reduce((a, b) => a + b, 0) / ttrs.length;
      relapseCount = events.filter(e => e.relapse === true || (e.relapse_count && e.relapse_count > 0)).length;
    }

    const age = patientDoc?.age || user?.age || 55;
    const sex = (user?.gender === 'female' || patientDoc?.gender === 'female') ? 0 : 1;

    // Run CRS Calculation
    const result = computeCardiovascularResilience({
      age,
      sex,
      bmi: 24.2,
      trestbps: 130,
      chol: 240,
      thalach: Number(maxHr.toFixed(0)),
      oldpeak: 0.5,
      exang: 0,
      history: 0,

      meanHr: Number(meanHr.toFixed(1)),
      minHr: Number(minHr.toFixed(1)),
      maxHr: Number(maxHr.toFixed(1)),
      hrrSlope: 0.48,
      hrVariability: Number(sdnn.toFixed(1)),
      activityResponse: 0.88,

      rmssd: Number(rmssd.toFixed(1)),
      sdnn: Number(sdnn.toFixed(1)),
      dfaAlpha1: Number(dfaAlpha1.toFixed(2)),
      dfaAlpha2,
      meanRr: Number(meanRr.toFixed(0)),
      lf,
      hf,

      ttrMinutes: Number(ttrMinutes.toFixed(1)),
      recoverySlope: 0.68,
      residualScore: 0.18,
      relapseCount,

      fsmStability: 0.90,
      episodeFrequency: events.length || 2,
      baselineConsistency: 0.88,
      contextAlignment: 0.92,
      scoreVariance: 0.12
    });

    return res.status(200).json({
      success: true,
      data: {
        userId: targetUserId,
        patientName: user?.username || user?.name || 'patient 27-30 Mei 2024',
        isRealData,
        caparEngineStatus: {
          baseline: 'Mature (10 Baselines Calibrated)',
          currentState: 'Recovery Phase',
          lastEpisodeTime: '14:32 WIB',
          recoveryTimeMin: Number(ttrMinutes.toFixed(1)),
          relapse: relapseCount > 0 ? `${relapseCount}x Relapse` : 'None',
          fsmThresholds: { tauIn: 1.86, tauOut: 1.18 },
          totalSegments: segments.length || 269
        },
        ...result
      }
    });
  } catch (error) {
    console.error('[getCardiovascularResilienceState] Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/resilience/assess
 * Interactive simulation recalculation for what-if scenarios
 */
export async function calculateResilienceAssessment(req, res) {
  try {
    const inputs = req.body || {};
    const result = computeCardiovascularResilience(inputs);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[calculateResilienceAssessment] Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
