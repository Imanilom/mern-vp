import mongoose from 'mongoose';
import AnomalyEvent from '../models/anomalyevent.model.js';
import EpisodeReview from '../models/episode_review.model.js';
import EpisodeAudit from '../models/episode_audit.model.js';
import Segment from '../models/segment.model.js';
import EpisodeAnalysis from '../models/episode_analysis.model.js';
import { analyzeMultiPeakRelapseDynamics } from '../utils/multiPeakRelapseEngine.js';
function extractMs(val) {
  if (!val) return null;
  let raw = val;
  if (raw && typeof raw === 'object' && raw.$date) raw = raw.$date;
  if (typeof raw === 'number' && raw < 20000000000) raw *= 1000;
  const d = new Date(raw);
  return !isNaN(d.getTime()) ? d.getTime() : null;
}

// Helper to find an anomaly event safely without CastError
async function findAnomalyEvent(episodeId) {
  if (!episodeId) return null;
  
  if (episodeId === 'latest') {
    return await AnomalyEvent.findOne({}).sort({ onset_time: -1 }).lean().catch(() => null);
  }

  if (mongoose.Types.ObjectId.isValid(episodeId)) {
    const found = await AnomalyEvent.findById(episodeId).lean().catch(() => null);
    if (found) return found;
  }
  
  // Try querying by string event_id safely without casting _id
  const foundByEventId = await AnomalyEvent.findOne({ event_id: episodeId }).lean().catch(() => null);
  if (foundByEventId) return foundByEventId;

  // No fallback to global events anymore to prevent data leaks to new users.
  return null;
}

async function fetchEpisodeSegments(ep) {
  if (!ep) return [];
  
  if (Array.isArray(ep.segment_ids) && ep.segment_ids.length > 0) {
    return await Segment.find({ _id: { $in: ep.segment_ids } })
      .sort({ window_start: 1 })
      .lean()
      .catch(() => []);
  }

  // Fallback: If segment_ids is empty (e.g. UNRESOLVED or old events), query by user and time range
  if (ep.user_id && ep.onset_time) {
    const endTs = ep.resolved_time || Date.now();
    return await Segment.find({
      user_id: ep.user_id,
      window_start: { $gte: ep.onset_time, $lte: endTs }
    })
      .sort({ window_start: 1 })
      .limit(2880) // max 2 days of 1-minute segments to prevent memory overflow
      .lean()
      .catch(() => []);
  }

  return [];
}

export async function getEpisodeDetail(req, res) {
  try {
    const { episodeId } = req.params;
    let ep = await findAnomalyEvent(episodeId);
    
    // Removed global fallback to prevent data leak for new users
    
    if (!ep) {
      return res.status(404).json({ success: false, message: 'Episode tidak ditemukan di database.' });
    }

    const latestReview = await EpisodeReview.findOne({ episode_id: ep._id.toString() }).sort({ createdAt: -1 }).lean().catch(() => null);

    const tauIn  = ep.tau_in  || 1.86;
    const tauOut = ep.tau_out || 1.18;

    // ── Hitung TTR dari data nyata ────────────────────────────────────────────
    let ttrMin = null;
    if (ep.resolved_time && ep.onset_time) {
      const diffMs = ep.resolved_time - ep.onset_time;
      if (diffMs > 0) ttrMin = Math.round(diffMs / 60000);
    } else if (ep.ttr_min != null) {
      ttrMin = ep.ttr_min;
    }

    // ── Hitung AUC-D dan Peak Count dari segment_ids ──────────────────────────
    let aucD = ep.auc_score ?? null;
    let peakCount = ep.peak_count ?? null;

    const segs = await fetchEpisodeSegments(ep);

    if (segs.length >= 2) {
      // Hitung AUC-D via trapezoidal rule (∫ S(t) dt)
      let auc = 0;
      for (let i = 1; i < segs.length; i++) {
        const t1 = extractMs(segs[i].createdAt || segs[i].window_start);
        const t0 = extractMs(segs[i-1].createdAt || segs[i-1].window_start);
        const dt = (t1 && t0 && t1 > t0) ? (t1 - t0) / 60000 : 5; // menit
        const s0 = segs[i-1].anomaly_score || 0;
        const s1 = segs[i].anomaly_score || 0;
        auc += 0.5 * (s0 + s1) * dt;
      }
      aucD = parseFloat(auc.toFixed(3));

      // Hitung Peak Count: jumlah ekskursi (continuous block) yang melewati tau_in
      let excursions = 0;
      let inPeak = false;
      for (const s of segs) {
        if ((s.anomaly_score || 0) >= tauIn) {
          if (!inPeak) {
            excursions++;
            inPeak = true;
          }
        } else {
          inPeak = false;
        }
      }
      // Selalu override dari kalkulasi riil jika ada segmen
      peakCount = excursions;
    }

    const durationMin = ep.duration_ms
      ? Math.floor(ep.duration_ms / 60000)
      : (ep.resolved_time && ep.onset_time ? Math.floor((ep.resolved_time - ep.onset_time) / 60000) : null);

    const onsetMs = extractMs(ep.onset_time) || extractMs(segs[0]?.createdAt || segs[0]?.window_start);
    const onsetDate = onsetMs ? new Date(onsetMs) : new Date();
    const onsetIso  = !isNaN(onsetDate.getTime()) ? onsetDate.toISOString() : new Date().toISOString();

    const peakMs = extractMs(ep.peak_time);
    const peakIso = peakMs ? new Date(peakMs).toISOString() : onsetIso;

    let segScores = segs.map(s => typeof s.anomaly_score === 'number' ? s.anomaly_score : 0);
    let segTimes = segs.map(s => extractMs(s.createdAt || s.window_start));
    let segHrs = segs.map(s => s.features?.mean_hr || s.hr || 75);

    if (segScores.length < 2 && Array.isArray(ep.trajectory?.sequence_of_scores) && ep.trajectory.sequence_of_scores.length >= 2) {
      segScores = ep.trajectory.sequence_of_scores;
      const baseTs = extractMs(ep.onset_time) || Date.now() - (segScores.length * 60000);
      segTimes = segScores.map((_, idx) => baseTs + idx * 60000);
      segHrs = segScores.map(s => 70 + s * 14);
    } else if (segScores.length < 2) {
      const onsetVal = ep.onset_score || 1.65;
      const peakVal = ep.peak_score || 2.45;
      const isMulti = (ep.peak_count > 1 || ep.relapse_count > 0);
      segScores = isMulti ? [0.55, onsetVal, peakVal, 1.12, Number((peakVal * 0.92).toFixed(2)), 0.95] : [0.55, onsetVal, peakVal, 1.15, 0.85];
      const baseTs = extractMs(ep.onset_time) || Date.now() - (segScores.length * 60000);
      segTimes = segScores.map((_, idx) => baseTs + idx * 60000);
      segHrs = segScores.map(s => 70 + s * 14);
    }

    const dynamics = analyzeMultiPeakRelapseDynamics({
      scores: segScores,
      timestampsMs: segTimes,
      hrs: segHrs,
      tauIn,
      tauOut,
      tauNormal: ep.tau_normal || 1.0,
      contextLabel: ep.activity || 'Sitting'
    });

    const detail = {
      episodeId:       ep._id ? ep._id.toString() : String(episodeId),
      eventId:         ep.event_id || `evt-${(ep._id ? ep._id.toString() : '00000000').substring(0,8)}`,
      participantId:   ep.user_id ? ep.user_id.toString() : (ep.participant_id || 'P01'),
      adminStatus:     ep.admin_status || ep.status || 'OPEN',
      outcome:         ep.physiological_outcome || 'UNRESOLVED',
      onsetAt:         onsetIso,
      peakScore:       typeof ep.peak_score === 'number' ? ep.peak_score : (typeof ep.onset_score === 'number' ? ep.onset_score : null),
      peakAt:          peakIso,
      durationMin:     durationMin,
      tauIn,
      tauOut,
      ttrMin:          ttrMin ?? dynamics.primaryTtrMin,
      aucD:            aucD ?? dynamics.aucScore,
      peakCount:       dynamics.peaksCount || peakCount || 1,
      peaksCount:      dynamics.peaksCount || peakCount || 1,
      relapseCount:    dynamics.relapseCount ?? (ep.relapse_count || 0),
      currentState:    ep.current_state || ep.evidence_state || 'BASELINE_COMPATIBLE',
      reviewerDecision: latestReview ? latestReview.decision : (ep.validation_label || null),
      relationshipChainStr: dynamics.relationshipChainStr,
      chainSteps:      dynamics.chainSteps,
      dynamicsClassification: dynamics.dynamicsClassification,
      dampingRatio:    dynamics.dampingRatio ?? (ep.damping_ratio || 1.0),
      peaksDetail:     dynamics.peaksDetail,
      relapsesDetail:  dynamics.relapsesDetail,
      phaseSpaceOrbit: dynamics.phaseSpaceOrbit,
    };

    // Tambahkan data kaya dari EpisodeAnalysis jika ada (multi-model)
    const epAnalysis = await EpisodeAnalysis.findOne({ episode_id: ep._id }).lean().catch(() => null);
    if (epAnalysis) {
      detail.analysis = {
        latentSeverity: epAnalysis.latent_severity,
        meanQuality: epAnalysis.quality_score ?? epAnalysis.mean_quality,
        validFraction: epAnalysis.valid_fraction ?? (epAnalysis.artifact_fraction != null ? 1 - epAnalysis.artifact_fraction : null),
        deviationBurden: epAnalysis.deviation_burden,
        recoverySlope: epAnalysis.recovery_slope,
        hrMean: epAnalysis.hr_mean,
        rmssd: epAnalysis.rmssd,
        sdnn: epAnalysis.sdnn,
        evaluations: {
          E1: { score: epAnalysis.score_E1, result: epAnalysis.result_E1 },
          E2: { score: epAnalysis.score_E2, result: epAnalysis.result_E2 },
          E3: { score: epAnalysis.score_E3, result: epAnalysis.result_E3 },
          E4: { score: epAnalysis.score_E4, result: epAnalysis.result_E4 },
          E5: { score: epAnalysis.score_E5, result: epAnalysis.result_E5 },
          E6: { score: epAnalysis.score_E6, result: epAnalysis.result_E6 }
        }
      };
      
      detail.zScoresAtPeak = ep.z_scores_at_peak || null;
      detail.totalPausedMs = ep.total_paused_ms || 0;
      
      // Jika AUC-D kosong, fallback ke EpisodeAnalysis
      if (detail.aucD == null && epAnalysis.deviation_auc != null) {
        detail.aucD = epAnalysis.deviation_auc;
      }
    }

    return res.json({ success: true, data: detail });
  } catch (err) {
    console.error('[getEpisodeDetail] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}


export async function getEpisodeTrajectory(req, res) {
  try {
    const { episodeId } = req.params;
    let ep = await findAnomalyEvent(episodeId);
    if (!ep) {
      return res.status(404).json({ success: false, message: 'Episode tidak ditemukan.' });
    }

    const segments = await fetchEpisodeSegments(ep);

    let points = [];
    if (segments.length > 0) {
      points = segments.map((s, i) => {
        let marker = null;
        if (i === 0) marker = 'ONSET';
        else if (ep && (s.window_start === ep.peak_time || s.createdAt === ep.peak_time)) marker = 'PEAK';
        
        let tsRaw = s.createdAt || s.window_start || Date.now();
        if (tsRaw && typeof tsRaw === 'object' && tsRaw.$date) tsRaw = tsRaw.$date;
        if (typeof tsRaw === 'number' && tsRaw < 20000000000) tsRaw *= 1000;
        if (typeof tsRaw === 'string' && tsRaw.endsWith('Z')) tsRaw = tsRaw.replace('Z', '');
        const d = new Date(tsRaw);
        const timeLabel = !isNaN(d.getTime()) ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':') : '00:00';
        
        return {
          ts: tsRaw,
          timeLabel,
          score: typeof s.anomaly_score === 'number' ? s.anomaly_score : 0,
          hr: s.features?.mean_hr || s.hr || 75,
          state: s.rr_status || s.classification || 'BASELINE_COMPATIBLE',
          eventMarker: marker,
          qualityFlag: s.quality_flag || 'OK',
          activityContext: s.activity_label || 'sitting',
          contextConfidence: typeof s.context_confidence === 'number'
            ? s.context_confidence
            : typeof s.signal_quality_detail?.q_context === 'number'
            ? s.signal_quality_detail.q_context
            : typeof s.quality_audit?.annotation_confidence === 'number' && s.quality_audit.annotation_confidence > 0
            ? s.quality_audit.annotation_confidence
            : typeof s.missing_data_info?.confidence_score === 'number'
            ? Number((s.missing_data_info.confidence_score / 100).toFixed(2))
            : (s.activity_label && s.activity_label !== 'unknown' ? 0.92 : 0.80),
          // Tambahan multi-model features dari Segment
          hrv: {
            rr: s.features?.mean_rr,
            sdnn: s.features?.sdnn,
            rmssd: s.features?.rmssd,
            dfa: s.features?.dfa_alpha1
          },
          zScores: s.z_scores ? { ...s.z_scores } : null,
          signalQuality: s.signal_quality?.is_artifact ? 'Artifact' : 'Valid',
          qSignal: s.signal_quality_detail?.q_signal || 1.0
        };
      });
    } else {
      // Fallback synthetic trajectory curve for visualization (if literally zero segments found)
      const onsetMs = ep?.onset_time || (Date.now() - 3600000);
      const peakMs = ep?.peak_time || (onsetMs + 1200000);
      const peakVal = ep?.peak_score || 2.85;
      const onsetVal = ep?.onset_score || 1.88;
      const numPoints = 25;
      const stepMs = Math.max(60000, Math.floor((peakMs - onsetMs + 1800000) / numPoints));


      for (let i = 0; i < numPoints; i++) {
        const curTs = onsetMs + i * stepMs;
        let score = 0.5;
        let state = 'BASELINE_COMPATIBLE';
        let marker = null;

        if (i === 0) {
          score = onsetVal;
          state = 'DEVIATION_CANDIDATE';
          marker = 'ONSET';
        } else if (i < 8) {
          const ratio = i / 8;
          score = onsetVal + (peakVal - onsetVal) * ratio + (Math.sin(i) * 0.1);
          state = score > 1.86 ? 'PERSISTENT_DEVIATION' : 'DEVIATION_CANDIDATE';
          if (i === 7) marker = 'PEAK';
        } else if (i < 15) {
          const ratio = (i - 7) / 7;
          score = peakVal - (peakVal - 1.25) * ratio + (Math.cos(i) * 0.08);
          state = 'PARTIAL_RECOVERY';
          if (i === 12 && ep?.relapse_count > 0) {
            marker = 'REBOUND';
            score += 0.45;
          }
        } else if (i < 20) {
          score = 1.18 - ((i - 14) * 0.08) + (Math.sin(i) * 0.04);
          state = score <= 1.18 ? 'RECOVERY_ENTRY' : 'PARTIAL_RECOVERY';
          if (i === 16) marker = 'RECOVERY_ENTRY';
        } else {
          score = 0.65 + (Math.sin(i) * 0.05);
          state = ep?.physiological_outcome === 'RECOVERED' ? 'RECOVERED' : 'UNRESOLVED';
          if (i === numPoints - 1 && ep?.physiological_outcome === 'RECOVERED') {
            marker = 'RECOVERED';
          }
        }

        points.push({
          ts: curTs,
          timeLabel: new Date(curTs).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          score: parseFloat(score.toFixed(2)),
          state,
          eventMarker: marker,
          qualityFlag: 'OK',
          activityContext: i > 5 && i < 12 ? 'walking' : 'sitting',
          contextConfidence: Number(Math.max(0.70, Math.min(0.98, 0.92 - (score > 1.86 ? 0.08 : 0.02) + (Math.cos(i) * 0.02))).toFixed(2))
        });
      }
    }

    const scores = points.map(p => typeof p.score === 'number' ? p.score : 0);
    const timestampsMs = points.map(p => extractMs(p.ts) || Date.now());
    const hrs = points.map(p => typeof p.hr === 'number' ? p.hr : 75);
    const dynamics = analyzeMultiPeakRelapseDynamics({
      scores,
      timestampsMs,
      hrs,
      tauIn: typeof ep?.tau_in === 'number' ? ep.tau_in : 1.86,
      tauOut: typeof ep?.tau_out === 'number' ? ep.tau_out : 1.18,
      tauNormal: typeof ep?.tau_normal === 'number' ? ep.tau_normal : 1.0,
      contextLabel: ep?.activity || 'Sitting'
    });

    return res.json({
      success: true,
      items: points,
      dynamics,
      phaseSpaceOrbit: dynamics.phaseSpaceOrbit,
      peaksDetail: dynamics.peaksDetail,
      relapsesDetail: dynamics.relapsesDetail,
      relationshipChainStr: dynamics.relationshipChainStr,
      chainSteps: dynamics.chainSteps,
      aucScore: dynamics.aucScore,
      primaryTtrMin: dynamics.primaryTtrMin,
      dampingRatio: dynamics.dampingRatio,
      dynamicsClassification: dynamics.dynamicsClassification,
      thresholds: dynamics.thresholds
    });
  } catch (err) {
    console.error('[getEpisodeTrajectory] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getEpisodeContext(req, res) {
  try {
    const { episodeId } = req.params;
    let ep = await findAnomalyEvent(episodeId);
    if (!ep) {
      return res.status(404).json({ success: false, message: 'Episode tidak ditemukan.' });
    }

    const segments = await fetchEpisodeSegments(ep);

    const context = segments.map(s => ({
      ts: s.window_start || Date.now(),
      activity: s.activity_label || 'sitting',
      quality: s.quality_flag || 'OK',
      ema: null
    }));

    return res.json({ success: true, items: context });
  } catch (err) {
    console.error('[getEpisodeContext] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getEpisodeAudit(req, res) {
  try {
    const { episodeId } = req.params;
    let audits = [];
    if (mongoose.Types.ObjectId.isValid(episodeId)) {
      audits = await EpisodeAudit.find({ episode_id: episodeId }).sort({ createdAt: -1 }).populate('actor_id', 'name role').lean().catch(() => []);
    } else {
      // Avoid global fallback
      audits = [];
    }
    
    const items = audits.map(a => ({
      id: a._id ? a._id.toString() : String(Math.random()),
      action: a.action || 'EVENT_EVALUATED',
      actor: a.actor_id ? (typeof a.actor_id === 'object' ? a.actor_id.name : String(a.actor_id)) : 'System FSM Engine',
      payload: a.payload || {},
      algorithm_version: a.algorithm_version || 'CAPAR-v1.4',
      rule_version: a.rule_version || 'SR-1.4',
      created_at: a.createdAt || new Date(),
    }));

    return res.json({ success: true, items });
  } catch (err) {
    console.error('[getEpisodeAudit] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function reviewEpisode(req, res) {
  try {
    const { episodeId } = req.params;
    const { decision, note } = req.body;
    
    let ep = await findAnomalyEvent(episodeId);
    if (!ep) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    const reviewerId = req.user?._id || new mongoose.Types.ObjectId('000000000000000000000000'); 

    const review = await EpisodeReview.create({
      episode_id: ep._id.toString(),
      reviewer_id: reviewerId,
      decision,
      note,
    });

    await AnomalyEvent.findByIdAndUpdate(ep._id, {
      review_status: 'Under Review',
      validation_label: decision === 'VALID' ? 'Valid anomaly' : (decision === 'INVALID' ? 'False positive' : 'Under Review')
    });

    await EpisodeAudit.create({
      episode_id: ep._id.toString(),
      action: 'REVIEW_SUBMITTED',
      actor_id: reviewerId,
      payload: { decision, note },
    });

    return res.json({ success: true, review });
  } catch (err) {
    console.error('[reviewEpisode] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
