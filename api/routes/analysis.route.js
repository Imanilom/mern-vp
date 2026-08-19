import express from 'express';
import {
  getAnalysisSummary,
  getAnalyzedSegments,
  getRecentEvents,
  getEventSegments,
  annotateEvent,
  updateEventStatus,
  validateEvent,
  escalateEvent,
  assignReviewer,
  getUserBaselines,
  freezeBaseline,
  approveBaseline,
  recalculateBaseline,
  getFullMetrics,
  computeROCandAUC,
  computeH1aMetrics,
  computeH2aMetrics,
  computeH3aMetrics,
  getActivityContext,
  validateSegmentByDoctor,
  getKalmanTrajectory,
  runRRAnalysisPipeline,
  getEpisodeAnalysis,
  createEpisodeAnalysis,
  saveEmaResponse,
  getStreamingSignalQualityStats,
  getCandidateAndPersistentEpisodes,
} from '../controllers/analysis.controller.js';
import { getNextStateForecast, getRecoveryEstimate, getPersonalTransitions, getRecoveryTimeToRecoveredPrediction } from '../controllers/capar.prediction.controller.js';
import { generateReportData } from '../controllers/report.controller.js';
import { computePersonalThresholds } from '../utils/capar.thresholds.js';
import { verifyToken } from '../utils/verifyUser.js';
import Segment from '../models/segment.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';
import User from '../models/user.model.js';
import Patient from '../models/patient.model.js';
import mongoose from 'mongoose';

const router = express.Router();

async function resolveUserIdParam(req, res, next) {
  try {
    const { userId } = req.params;
    if (!userId || userId.toUpperCase() === 'ALL') return next();

    let user = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId) || await Patient.findById(userId);
    }
    if (!user) {
      user = await User.findOne({ $or: [{ guid: userId }, { name: userId }, { current_device: userId }] })
        || await Patient.findOne({ $or: [{ guid: userId }, { name: userId }] });
    }

    if (user) {
      req.params.userId = user._id.toString();
    } else if (!mongoose.Types.ObjectId.isValid(userId)) {
      // If user is not found and userId is not a 24-hex ObjectId (e.g. "P-014"),
      // assign a dummy valid ObjectId so queries return [] with 200 OK instead of throwing a 500 CastError.
      req.params.userId = '000000000000000000000000';
    }
    next();
  } catch (err) {
    next(err);
  }
}


// ── Analisis Dashboard ────────────────────────────────────────────────────────

/** GET /api/analysis/reports — generate complex reports */
router.get('/reports', verifyToken, generateReportData);

/**
 * GET /api/analysis/thresholds/:userId
 * Hitung tau_in, tau_out, tau_normal personal (CAPAR Section 7.1)
 * dari StableScore memory (anomaly scores dari window BC→BC).
 */
router.get('/thresholds/:userId', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const config = {};
    // Override min_stable_scores jika disuplai via query param
    if (req.query.min_stable_scores) config.min_stable_scores = parseInt(req.query.min_stable_scores);
    const data = await computePersonalThresholds(req.params.userId, config);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/analysis/segments/:userId — grafik HR + anomaly score */
router.get('/segments/:userId', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const data = await getAnalyzedSegments(req.params.userId, limit);
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/analysis/events/:userId — event log anomali */
router.get('/events/:userId', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const events = await getRecentEvents(req.params.userId, limit);
    res.json({ success: true, data: events, count: events.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/analysis/episode-analysis/:userId — detailed episode evaluations */
router.get('/episode-analysis/:userId', verifyToken, resolveUserIdParam, getEpisodeAnalysis);

/** POST /api/analysis/episode-analysis — create a detailed episode evaluation */
router.post('/episode-analysis', verifyToken, createEpisodeAnalysis);

/** POST /api/analysis/ema — Simpan respon EMA 1-4 ke MongoDB */
router.post('/ema', verifyToken, async (req, res) => {
  try {
    const userId = req.body.user_id || req.user?.id || req.user?._id;
    const result = await saveEmaResponse(userId, req.body);
    res.json({ success: true, message: 'Respon EMA berhasil tersimpan di database.', data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/analysis/events/details/:eventId — full event details + segments */
router.get('/events/details/:eventId', verifyToken, async (req, res) => {
  try {
    const data = await getEventSegments(req.params.eventId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/analysis/events/:eventId/annotate — add annotation */
router.post('/events/:eventId/annotate', verifyToken, async (req, res) => {
  try {
    const { text, timestamp } = req.body;
    const data = await annotateEvent(req.params.eventId, text, timestamp);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Clinical Review Workflow ──────────────────────────────────────────────────

router.patch('/events/:eventId/status', verifyToken, async (req, res) => {
  try {
    const data = await updateEventStatus(req.params.eventId, req.body.status);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/events/:eventId/validate', verifyToken, async (req, res) => {
  try {
    const { label, notes } = req.body;
    const data = await validateEvent(req.params.eventId, label, notes);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/events/:eventId/escalate', verifyToken, async (req, res) => {
  try {
    const data = await escalateEvent(req.params.eventId, req.body.escalated);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/events/:eventId/assign', verifyToken, async (req, res) => {
  try {
    const data = await assignReviewer(req.params.eventId, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/analysis/baseline/:userId — baseline personal */
router.get('/baseline/:userId', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const data = await getUserBaselines(req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /api/analysis/baseline/:baselineId/freeze — freeze/unfreeze baseline */
router.patch('/baseline/:baselineId/freeze', verifyToken, async (req, res) => {
  try {
    const { is_frozen } = req.body;
    const data = await freezeBaseline(req.params.baselineId, is_frozen);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /api/analysis/baseline/:baselineId/approve — approve baseline */
router.patch('/baseline/:baselineId/approve', verifyToken, async (req, res) => {
  try {
    const data = await approveBaseline(req.params.baselineId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/analysis/baseline/:baselineId/recalculate — reset and recalculate baseline */
router.post('/baseline/:baselineId/recalculate', verifyToken, async (req, res) => {
  try {
    const data = await recalculateBaseline(req.params.baselineId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Evaluasi Metrik ───────────────────────────────────────────────────────────

/**
 * GET /api/analysis/metrics/:userId
 * Ringkasan lengkap: Precision, Recall, F1, FPR, Accuracy, AUC,
 * Detection Delay, TCR, MER, TCI, CFPR, TRS
 */
router.get('/metrics/:userId', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const data = await getFullMetrics(req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/analysis/metrics/:userId/roc — ROC curve untuk visualisasi AUC */
router.get('/metrics/:userId/roc', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const data = await computeROCandAUC(req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/analysis/metrics/:userId/h1a — TCR, MER, TCI (Uji H1a) */
router.get('/metrics/:userId/h1a', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const intervalMin = parseInt(req.query.interval) || 15;
    const data = await computeH1aMetrics(req.params.userId, intervalMin);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/analysis/metrics/:userId/h2a — CFPR (Uji H2a) */
router.get('/metrics/:userId/h2a', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const data = await computeH2aMetrics(req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/analysis/metrics/:userId/h3a — TRS (Uji H3a) */
router.get('/metrics/:userId/h3a', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const data = await computeH3aMetrics(req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/activity-context/:userId', verifyToken, resolveUserIdParam, getActivityContext);

// ── Annotasi Ground Truth ─────────────────────────────────────────────────────

/**
 * PATCH /api/analysis/segments/:segmentId/label
 * Set ground truth label untuk evaluasi Precision/Recall/AUC.
 * Body: { "label": "anomaly" | "normal" }
 */
router.patch('/segments/:segmentId/label', verifyToken, async (req, res) => {
  try {
    const { label } = req.body;
    if (!['anomaly', 'normal'].includes(label)) {
      return res.status(400).json({ success: false, message: 'Label harus "anomaly" atau "normal"' });
    }
    const seg = await Segment.findByIdAndUpdate(
      req.params.segmentId,
      { $set: { ground_truth_label: label } },
      { new: true }
    ).select('_id window_start classification ground_truth_label');
    if (!seg) return res.status(404).json({ success: false, message: 'Segment tidak ditemukan' });
    res.json({ success: true, data: seg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/analysis/events/:eventId/label
 * Set actual_onset_time untuk menghitung detection delay.
 * Body: { "actual_onset_time": 1718345401000 }
 */
router.patch('/events/:eventId/label', verifyToken, async (req, res) => {
  try {
    const { actual_onset_time } = req.body;
    if (!actual_onset_time || typeof actual_onset_time !== 'number') {
      return res.status(400).json({ success: false, message: 'actual_onset_time harus berupa epoch ms (number)' });
    }
    const event = await AnomalyEvent.findByIdAndUpdate(
      req.params.eventId,
      { $set: { actual_onset_time } },
      { new: true }
    ).select('_id onset_time actual_onset_time classification');
    if (!event) return res.status(404).json({ success: false, message: 'Event tidak ditemukan' });
    res.json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Doctor validation route for segment
router.patch('/segments/:segmentId/doctor-validate', verifyToken, validateSegmentByDoctor);

// Kalman trajectory prediction route per user (Pagi, Siang, Sore)
router.get('/kalman-trajectory/:userId', verifyToken, resolveUserIdParam, getKalmanTrajectory);

// ── RR 1-menit Pipeline (context-aware) ──────────────────────────────────────

/**
 * POST /api/analysis/rr/trigger
 * Trigger Layer 3 RR pipeline secara manual (untuk testing / backfill).
 */
router.post('/rr/trigger', verifyToken, async (req, res) => {
  try {
    runRRAnalysisPipeline('MANUAL').catch(err =>
      console.error('[Manual Trigger L3-RR] Error:', err.message)
    );
    res.json({ success: true, message: 'RR Analysis pipeline triggered. Cek job history untuk progress.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/analysis/rr/segments/:userId
 * Ambil segmen 1-menit dengan rr_status untuk user tertentu.
 */
router.get('/rr/segments/:userId', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const status = req.query.status;
    const filter = { user_id: req.params.userId, window_type: '1min' };
    if (status) filter.rr_status = status;
    const data = await Segment.find(filter)
      .sort({ window_start: -1 })
      .limit(limit)
      .select('window_start window_end activity_label rr_status anomaly_score classification z_scores signal_quality_detail features analyzed')
      .lean();
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/analysis/rr/baseline/:userId
 * Ambil baseline user lengkap dengan maturity_detail.
 */
router.get('/rr/baseline/:userId', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const Baseline = (await import('../models/baseline.model.js')).default;
    const data = await Baseline.find({ user_id: req.params.userId })
      .select('activity time_period segment_count is_mature maturity_detail stats.mean_hr stats.sdnn stats.rmssd last_updated')
      .lean();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── CAPAR Future-State Prediction (Section 10) ────────────────────────────────

/** GET /api/analysis/forecast/:userId — next-state & multi-step prediction */
router.get('/forecast/:userId', verifyToken, resolveUserIdParam, getNextStateForecast);

/** GET /api/analysis/recovery-estimate/:userId — personal recovery distribution */
router.get('/recovery-estimate/:userId', verifyToken, resolveUserIdParam, getRecoveryEstimate);

/** GET /api/analysis/transitions/:userId — personal transition matrix */
router.get('/transitions/:userId', verifyToken, resolveUserIdParam, getPersonalTransitions);

import { getSignalQuality } from '../controllers/quality.controller.js';
/** GET /api/analysis/signal-quality/:userId */
router.get('/signal-quality/:userId', verifyToken, resolveUserIdParam, getSignalQuality);

import { computeConfusionMatrix, computeClassificationMetrics } from '../controllers/evaluation.controller.js';
/** GET /api/analysis/evaluation/:userId */
router.get('/evaluation/:userId', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const cm = await computeConfusionMatrix(req.params.userId);
    const metrics = computeClassificationMetrics(cm);
    const roc = await computeROCandAUC(req.params.userId);

    res.json({
      success: true,
      data: {
        confusionMatrix: cm,
        metrics: metrics,
        roc: roc
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

import { runWindowOptimizationSimulation } from '../scripts/test_baseline_window_optimization.js';

/** GET /api/analysis/test-window-optimization — Pengetesan terpisah simulasi 30 window vs 15 window */
router.get('/test-window-optimization', verifyToken, async (req, res) => {
  try {
    const { userId } = req.query;
    const report = await runWindowOptimizationSimulation(userId);
    res.json(report);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/analysis/signal-quality/:userId — Statistik filter kualitas sinyal, artifact fraction, & missing values */
router.get('/signal-quality/:userId', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const stats = await getStreamingSignalQualityStats(req.params.userId);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/analysis/candidate-episodes/:userId — Tabel dinamis Candidate Onset & Persistent Episodes dengan alasan detail */
router.get('/candidate-episodes/:userId', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const data = await getCandidateAndPersistentEpisodes(req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/analysis/recovery-time-prediction/:userId — Model Prediksi Waktu Tersisa Menuju Recovered & Probabilitas Pemulihan */
router.get('/recovery-time-prediction/:userId', verifyToken, resolveUserIdParam, getRecoveryTimeToRecoveredPrediction);

export default router;
