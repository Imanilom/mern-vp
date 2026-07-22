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
} from '../controllers/analysis.controller.js';
import { generateReportData } from '../controllers/report.controller.js';
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
    if (!userId) return next();

    let user = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId) || await Patient.findById(userId);
    }
    if (!user) {
      user = await User.findOne({ $or: [{ guid: userId }, { name: userId }, { email: new RegExp('^' + userId, 'i') }] })
          || await Patient.findOne({ $or: [{ guid: userId }, { name: userId }, { email: new RegExp('^' + userId, 'i') }] });
    }

    if (user) {
      req.params.userId = user._id.toString();
    }
    next();
  } catch (err) {
    next(err);
  }
}


// ── Analisis Dashboard ────────────────────────────────────────────────────────

/** GET /api/analysis/reports — generate complex reports */
router.get('/reports', verifyToken, generateReportData);

/** GET /api/analysis/segments/:userId — grafik HR + anomaly score */
router.get('/segments/:userId', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const data  = await getAnalyzedSegments(req.params.userId, limit);
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/analysis/events/:userId — event log anomali */
router.get('/events/:userId', verifyToken, resolveUserIdParam, async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit) || 20;
    const events = await getRecentEvents(req.params.userId, limit);
    res.json({ success: true, data: events, count: events.length });
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

export default router;
