import mongoose from 'mongoose';
import AnomalyEvent from '../models/anomalyevent.model.js';
import EpisodeReview from '../models/episode_review.model.js';
import EpisodeAudit from '../models/episode_audit.model.js';
import Segment from '../models/segment.model.js';

export async function getEpisodeDetail(req, res) {
  try {
    const { episodeId } = req.params;
    
    // We treat AnomalyEvent as the "episode" root
    const ep = await AnomalyEvent.findById(episodeId).lean();
    if (!ep) return res.status(404).json({ success: false, message: 'Episode not found' });

    // Try to get latest review
    const latestReview = await EpisodeReview.findOne({ episode_id: episodeId }).sort({ createdAt: -1 }).lean();

    const tauIn = 1.86; // Can be derived from adaptive model
    const tauOut = 1.18; 
    const durationMin = ep.duration_ms ? Math.floor(ep.duration_ms / 60000) : (ep.resolved_time ? Math.floor((ep.resolved_time - ep.onset_time)/60000) : 0);

    const detail = {
      episodeId: ep._id.toString(),
      eventId: `evt-${ep._id.toString().substring(0,8)}`,
      participantId: ep.user_id.toString(),
      adminStatus: ep.admin_status || 'OPEN',
      outcome: ep.physiological_outcome || 'UNRESOLVED',
      onsetAt: new Date(ep.onset_time).toISOString(),
      peakScore: ep.peak_score || 0,
      peakAt: ep.peak_time ? new Date(ep.peak_time).toISOString() : null,
      durationMin: durationMin,
      tauIn: tauIn,
      tauOut: tauOut,
      ttrMin: ep.ttr_min || null,
      aucD: ep.auc_score || null,
      peakCount: ep.peak_count || 1,
      relapseCount: ep.relapse_count || 0,
      currentState: ep.current_state || 'BASELINE_COMPATIBLE',
      reviewerDecision: latestReview ? latestReview.decision : null,
    };

    res.json({ success: true, data: detail });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getEpisodeTrajectory(req, res) {
  try {
    const { episodeId } = req.params;
    const ep = await AnomalyEvent.findById(episodeId).lean();
    if (!ep) return res.status(404).json({ success: false, message: 'Not found' });

    // Fetch segments belonging to this episode
    const segments = await Segment.find({ _id: { $in: ep.segment_ids || [] } }).sort({ window_start: 1 }).lean();

    // Map segments to points array for chart
    const points = segments.map((s, i) => {
      let marker = null;
      if (i === 0) marker = 'ONSET';
      else if (s.window_start === ep.peak_time) marker = 'PEAK';
      
      return {
        ts: s.window_start,
        timeLabel: new Date(s.window_start).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        score: s.anomaly_score || 0,
        state: s.rr_status || s.classification || 'BASELINE_COMPATIBLE',
        eventMarker: marker,
        qualityFlag: s.quality_flag || 'OK',
        activityContext: s.activity_label || 'sitting',
        contextConfidence: s.context_confidence || 0.9
      };
    });

    res.json({ success: true, items: points });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getEpisodeContext(req, res) {
  try {
    const { episodeId } = req.params;
    const ep = await AnomalyEvent.findById(episodeId).lean();
    if (!ep) return res.status(404).json({ success: false, message: 'Not found' });

    const segments = await Segment.find({ _id: { $in: ep.segment_ids || [] } }).sort({ window_start: 1 }).lean();
    const context = segments.map(s => ({
      ts: s.window_start,
      activity: s.activity_label || 'sitting',
      quality: s.quality_flag || 'OK',
      ema: null
    }));

    res.json({ success: true, items: context });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getEpisodeAudit(req, res) {
  try {
    const { episodeId } = req.params;
    const audits = await EpisodeAudit.find({ episode_id: episodeId }).sort({ createdAt: -1 }).populate('actor_id', 'name role').lean();
    
    const items = audits.map(a => ({
      id: a._id.toString(),
      action: a.action,
      actor: a.actor_id ? a.actor_id.name : 'System',
      payload: a.payload,
      algorithm_version: a.algorithm_version,
      rule_version: a.rule_version,
      created_at: a.createdAt,
    }));

    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function reviewEpisode(req, res) {
  try {
    const { episodeId } = req.params;
    const { decision, note } = req.body;
    
    const ep = await AnomalyEvent.findById(episodeId);
    if (!ep) return res.status(404).json({ success: false, message: 'Not found' });

    // We assume req.user is set via auth middleware
    const reviewerId = req.user?._id || new mongoose.Types.ObjectId('000000000000000000000000'); 

    const review = await EpisodeReview.create({
      episode_id: episodeId,
      reviewer_id: reviewerId,
      decision,
      note,
    });

    // Update AnomalyEvent
    ep.review_status = 'Under Review';
    if (decision === 'VALID') ep.validation_label = 'Valid anomaly';
    if (decision === 'INVALID') ep.validation_label = 'False positive';
    await ep.save();

    // Log to Audit
    await EpisodeAudit.create({
      episode_id: episodeId,
      action: 'REVIEW_SUBMITTED',
      actor_id: reviewerId,
      payload: { decision, note },
    });

    res.json({ success: true, review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
