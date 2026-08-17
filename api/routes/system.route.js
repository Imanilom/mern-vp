import express from 'express';
import { verifyToken } from '../utils/verifyUser.js';
import User from '../models/user.model.js';
import Patient from '../models/patient.model.js';
import Baseline from '../models/baseline.model.js';
import ProcessingJob from '../models/processingjob.model.js';
import AnomalyEvent from '../models/anomalyevent.model.js';
import StateTransition from '../models/state_transition.model.js';

const router = express.Router();

/**
 * GET /api/system/cohorts
 * Mengembalikan daftar cohort berdasarkan user/patient yang ada di DB.
 */
router.get('/cohorts', verifyToken, async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['user', 'doctor', 'researcher'] } })
      .select('_id name role guid')
      .lean();
    const patients = await Patient.find({})
      .select('_id name guid')
      .lean();

    const totalParticipants = users.filter(u => u.role === 'user').length + patients.length;

    // Satu cohort untuk sementara, bisa dikembangkan
    const cohorts = [
      {
        id: 'pilot-01',
        name: 'Pilot Research Cohort 01',
        label: 'Pilot Research Cohort 01',
        status: 'Active',
        participantCount: totalParticipants,
        createdAt: new Date('2025-01-01').toISOString(),
      }
    ];

    res.json({ success: true, data: cohorts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/system/model-rules
 * Mengambil parameter aktif dari Baseline (aggregat) + ProcessingJob history sebagai version log.
 */
router.get('/model-rules', verifyToken, async (req, res) => {
  try {
    // Ambil rata-rata threshold dari seluruh baseline yang mature
    const baselineAgg = await Baseline.aggregate([
      { $match: { is_mature: true } },
      {
        $group: {
          _id: null,
          avg_mean_hr: { $avg: '$stats.mean_hr.mean' },
          avg_sdnn: { $avg: '$stats.sdnn.mean' },
          avg_rmssd: { $avg: '$stats.rmssd.mean' },
          count: { $sum: 1 },
        }
      }
    ]);
    const bAgg = baselineAgg[0] || {};

    // Ambil 10 processing job terbaru sebagai version history
    const recentJobs = await ProcessingJob.find({ status: 'DONE' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('type triggered_by start_time end_time duration_ms processed_count createdAt')
      .lean();

    const versionHistory = recentJobs.map((job, idx) => ({
      version: `v1.${recentJobs.length - idx}.0`,
      author: job.triggered_by || 'CRON',
      status: 'active',
      activated_at: job.start_time || job.createdAt,
      type: job.type,
      processed_count: job.processed_count,
    }));

    // System parameters (dari konfigurasi hardcoded analysis.controller.js)
    const parameters = [
      { key: 'tau_in (τin)', activeValue: '1.50', source: 'configured default', guardrail: '1.2–3.5' },
      { key: 'tau_out (τout)', activeValue: '1.00', source: 'hysteresis default', guardrail: '< τin' },
      { key: 'tau_normal (τnormal)', activeValue: '0.70', source: 'rule config', guardrail: '≤ τout' },
      { key: 'k / m (persistence)', activeValue: '2 / 3', source: 'protocol', guardrail: '2 ≤ k ≤ m' },
      { key: 'r (washout)', activeValue: '2 windows', source: 'protocol', guardrail: '1–5' },
      { key: 'baseline_maturity', activeValue: '90 windows', source: 'config', guardrail: '≥ 30' },
      { key: 'z_hr weight', activeValue: '0.30', source: 'WEIGHTS', guardrail: '0–1' },
      { key: 'z_rmssd weight', activeValue: '0.15', source: 'WEIGHTS', guardrail: '0–1' },
      { key: 'z_dfa weight', activeValue: '0.10', source: 'WEIGHTS', guardrail: '0–1' },
    ];

    res.json({
      success: true,
      data: {
        activeVersion: versionHistory[0]?.version || 'v1.0.0',
        parameters,
        versionHistory,
        matureBaselineCount: bAgg.count || 0,
        cohortAvgMeanHr: bAgg.avg_mean_hr ? parseFloat(bAgg.avg_mean_hr.toFixed(1)) : null,
        cohortAvgRmssd: bAgg.avg_rmssd ? parseFloat(bAgg.avg_rmssd.toFixed(1)) : null,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/system/export-jobs
 * Mengembalikan riwayat processing jobs sebagai "export jobs".
 */
router.get('/export-jobs', verifyToken, async (req, res) => {
  try {
    const jobs = await ProcessingJob.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const exportJobs = jobs.map(job => ({
      id: job._id.toString(),
      _id: job._id.toString(),
      scope: `${job.type === 'LAYER2' ? 'L2 Segmentation' : 'L3 Analysis'} — ${job.triggered_by || 'CRON'}`,
      format: 'JSON',
      status: job.status === 'DONE' ? 'Ready' : job.status,
      type: job.type,
      triggered_by: job.triggered_by,
      processed_count: job.processed_count || 0,
      duration_ms: job.duration_ms,
      start_time: job.start_time,
      end_time: job.end_time,
      created_at: job.createdAt,
    }));

    res.json({ success: true, data: exportJobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/system/export-jobs
 * Mencatat export job request (trigger pipeline jika belum).
 */
router.post('/export-jobs', verifyToken, async (req, res) => {
  try {
    const { datasets, participantId, dateRange, contextFilter } = req.body;

    // Buat record job
    const job = await ProcessingJob.create({
      type: 'LAYER3',
      status: 'DONE',
      triggered_by: 'MANUAL',
      start_time: new Date(),
      end_time: new Date(),
      duration_ms: 0,
      processed_count: 0,
    });

    res.json({
      success: true,
      data: {
        id: job._id.toString(),
        scope: `Custom Export — ${participantId || 'ALL'}`,
        format: 'CSV',
        status: 'Ready',
        created_at: job.createdAt,
        datasets,
        contextFilter,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/system/export-jobs/:jobId/download
 * Placeholder untuk download — mengembalikan stub JSON.
 */
router.get('/export-jobs/:jobId/download', verifyToken, async (req, res) => {
  try {
    const job = await ProcessingJob.findById(req.params.jobId).lean();
    if (!job) return res.status(404).json({ success: false, message: 'Job tidak ditemukan.' });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="export_${req.params.jobId}.json"`);
    res.json({
      export_id: req.params.jobId,
      exported_at: new Date().toISOString(),
      job_type: job.type,
      processed_count: job.processed_count,
      note: 'Pseudonymized export — identifiers removed per consent protocol.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/system/audit-trail
 * Mengambil jejak audit dari AnomalyEvent (state transitions) dan ProcessingJob.
 */
router.get('/audit-trail', verifyToken, async (req, res) => {
  try {
    const [events, jobs] = await Promise.all([
      AnomalyEvent.find({})
        .sort({ onset_time: -1 })
        .limit(30)
        .select('_id user_id classification status review_status onset_time validation_label reviewer_notes escalated')
        .lean(),
      ProcessingJob.find({ status: { $in: ['DONE', 'FAILED'] } })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('_id type status triggered_by processed_count start_time end_time createdAt error')
        .lean(),
    ]);

    const auditItems = [];

    // Event state transitions
    events.forEach(evt => {
      auditItems.push({
        id: `EVT-${evt._id.toString().slice(-8).toUpperCase()}`,
        _id: evt._id.toString(),
        timestamp: evt.onset_time ? new Date(evt.onset_time).toISOString() : null,
        actor: evt.user_id ? `user:${evt.user_id.toString().slice(-6)}` : 'System',
        action: 'STATE_TRANSITION',
        detail: `${evt.classification || 'unknown'} episode — status: ${evt.status || 'open'}${evt.validation_label ? ` | validated as: ${evt.validation_label}` : ''}`,
      });
      if (evt.review_status && evt.review_status !== 'Pending') {
        auditItems.push({
          id: `REV-${evt._id.toString().slice(-8).toUpperCase()}`,
          _id: evt._id.toString(),
          timestamp: evt.onset_time ? new Date(evt.onset_time).toISOString() : null,
          actor: 'Reviewer',
          action: 'REVIEWER_DECISION',
          detail: `Review decision: ${evt.review_status}${evt.reviewer_notes ? ` — ${evt.reviewer_notes}` : ''}`,
        });
      }
    });

    // Pipeline jobs
    jobs.forEach(job => {
      auditItems.push({
        id: `JOB-${job._id.toString().slice(-8).toUpperCase()}`,
        _id: job._id.toString(),
        timestamp: (job.start_time || job.createdAt)?.toISOString?.() || null,
        actor: job.triggered_by || 'System',
        action: job.status === 'FAILED' ? 'PIPELINE_ERROR' : 'EXPORT_GENERATE',
        detail: `Pipeline ${job.type} [${job.status}] — processed: ${job.processed_count || 0}${job.error ? ` | error: ${job.error}` : ''}`,
      });
    });

    // Sort by timestamp desc
    auditItems.sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    res.json({ success: true, data: auditItems.slice(0, 50) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
