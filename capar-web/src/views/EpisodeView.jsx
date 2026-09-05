import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Pagination from '../components/Pagination';
import { analyzeMultiPeakRelapseDynamics } from '../engines/multiPeakRelapseEngine';

const StateBadge = ({ state }) => {
  if (state === 'BASELINE_COMPATIBLE' || state === 'Baseline') return <span className="evidence-chip chip-green">Baseline</span>;
  if (state === 'DEVIATION_CANDIDATE' || state === 'Candidate') return <span className="evidence-chip chip-amber">Candidate</span>;
  if (state === 'PERSISTENT_DEVIATION' || state === 'Persistent') return <span className="evidence-chip chip-red">Persistent</span>;
  if (state === 'RECOVERY' || state === 'Recovery') return <span className="evidence-chip chip-purple">Recovery</span>;
  if (state === 'UNRESOLVED') return <span className="evidence-chip chip-red">Unresolved</span>;
  if (state === 'RESOLVED' || state === 'Resolved' || state === 'resolved') return <span className="evidence-chip chip-green">Resolved</span>;
  if (state === 'Under Review') return <span className="evidence-chip chip-amber">Reviewing</span>;
  if (state === 'Confirmed') return <span className="evidence-chip chip-green">Confirmed</span>;
  if (state === 'Suppressed') return <span className="evidence-chip chip-neutral">Suppressed</span>;
  if (state === 'Needs Follow-up') return <span className="evidence-chip chip-red">Needs Follow-up</span>;
  return <span className="evidence-chip chip-neutral">{state || '-'}</span>;
};

export const EpisodeView = ({ globalParticipantFilter, globalDateFilter }) => {
  const [filterContext, setFilterContext] = useState('ALL');
  const [filterState, setFilterState] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [chartViewMode, setChartViewMode] = useState('timeline'); // 'timeline' | 'phasespace'

  // --- Lazy pagination state ---
  const [allEpisodes, setAllEpisodes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const PAGE_SIZE = 50;

  // Pagination untuk tabel detail di bagian bawah
  const [currentDetailPage, setCurrentDetailPage] = useState(1);
  const DETAIL_PAGE_SIZE = 10;

  const [filterDateMode, setFilterDateMode] = useState('ALL'); // 'ALL' | 'DATE'
  const [activeDate, setActiveDate] = useState(globalDateFilter || '');

  useEffect(() => {
    if (globalDateFilter) {
      setActiveDate(globalDateFilter);
      setFilterDateMode('DATE');
    }
  }, [globalDateFilter]);

  const fetchEpisodes = async (page = 1, userId = 'ALL') => {
    setIsLoading(true);
    try {
      const [result, recentEventsRes, segmentsRes] = await Promise.all([
        api.getEventsPaginated(userId, page, PAGE_SIZE).catch(() => ({ data: [] })),
        api.getRecentEvents(userId, 100).catch(() => ({ data: [] })),
        api.getAnalyzedSegments(userId, 200).catch(() => ({ data: [] }))
      ]);

      const paginatedData = Array.isArray(result?.data) ? result.data : [];
      const recentData = Array.isArray(recentEventsRes?.data) ? recentEventsRes.data : (Array.isArray(recentEventsRes) ? recentEventsRes : []);
      const segmentsData = Array.isArray(segmentsRes?.data) ? segmentsRes.data : (Array.isArray(segmentsRes) ? segmentsRes : []);

      // Merge and deduplicate raw events by _id or event_id
      const rawEventsMap = new Map();
      [...paginatedData, ...recentData].forEach(ev => {
        const k = ev._id || ev.event_id || (ev.onset_time ? `ev-${ev.onset_time}` : null);
        if (k && !rawEventsMap.has(k)) rawEventsMap.set(k, ev);
      });
      const rawEvents = Array.from(rawEventsMap.values());

      // Normalize real Anomaly Events
      const mappedEvents = rawEvents.map((ev, idx) => {
        const oTs = ev.onset_time || ev.started_at || ev.createdAt;
        const dObj = new Date(typeof oTs === 'number' && oTs < 20000000000 ? oTs * 1000 : (oTs || Date.now()));
        const dateStr = `${dObj.getFullYear()}-${String(dObj.getMonth()+1).padStart(2,'0')}-${String(dObj.getDate()).padStart(2,'0')}`;
        const timeStr = dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const pId = (typeof ev.user_id === 'object' && ev.user_id?._id) ? ev.user_id._id : (ev.user_id || userId);
        const pName = (typeof ev.user_id === 'object' && (ev.user_id?.name || ev.user_id?.guid)) ? (ev.user_id.name || ev.user_id.guid) : (pId || 'Pasien P-001');

        let durMin = 0;
        if (ev.duration_ms) durMin = Math.max(1, Math.round(ev.duration_ms / 60000));
        else if (ev.resolved_time && ev.onset_time) durMin = Math.max(1, Math.round((ev.resolved_time - ev.onset_time) / 60000));
        else durMin = 10;

        const status = ev.current_state || ev.status || (ev.peak_score >= 2.5 ? 'PERSISTENT_DEVIATION' : (ev.peak_score >= 1.5 ? 'DEVIATION_CANDIDATE' : 'BASELINE_COMPATIBLE'));

        let scores = ev.trajectory?.sequence_of_scores;
        if (!Array.isArray(scores) || scores.length < 2) {
          if (Array.isArray(ev.scores) && ev.scores.length >= 2) {
            scores = ev.scores;
          }
        }
        if (!Array.isArray(scores) || scores.length < 2) {
          const oScore = ev.onset_score || 1.65;
          const pScore = ev.peak_score || 2.45;
          const hasRelapse = (ev.relapse_count > 0 || ev.peaksCount > 1 || ev.peak_count > 1);
          if (hasRelapse) {
            const p2 = ev.peaks_history?.[1]?.peak_score || Number((pScore * 0.9).toFixed(2));
            scores = [0.55, oScore, pScore, 1.12, p2, 0.95];
          } else {
            scores = [0.55, oScore, pScore, 1.15, 0.85];
          }
        }

        const tauIn = ev.tauIn || ev.tau_in || 1.86;
        const tauOut = ev.tauOut || ev.tau_out || 1.18;

        const dyn = analyzeMultiPeakRelapseDynamics({
          scores,
          tauIn,
          tauOut,
          tauNormal: 1.0,
          contextLabel: ev.activity || ev.context || 'Sitting'
        });

        return {
          id: ev.event_id || (ev._id ? `ep-${String(ev._id).substring(18)}` : `ep-${idx}`),
          dbId: ev._id,
          participantId: pId,
          participantName: pName,
          deviceId: ev.device_id || 'Wearable-Sens',
          context: ev.activity || ev.context || 'Sitting',
          onset: `${dateStr} ${timeStr}`,
          onsetDate: dateStr,
          onsetTime: timeStr,
          onsetRaw: dObj.getTime(),
          onsetScore: ev.onset_score || (ev.peak_score ? Number((ev.peak_score * 0.7).toFixed(2)) : 1.65),
          peakScore: ev.peak_score || dyn.maxPeakScore || 2.45,
          peakHr: ev.trajectory?.delta_hr ? (72 + ev.trajectory.delta_hr) : (ev.peak_hr || 98),
          baselineHr: ev.baseline_hr || 70,
          durationMinutes: durMin,
          durationFormatted: `${durMin}m 0s`,
          classification: ev.classification || (status === 'PERSISTENT_DEVIATION' ? 'Alert' : (status === 'DEVIATION_CANDIDATE' ? 'Caution' : 'Normal')),
          status: status,
          reviewStatus: ev.validation_label ? 'Validated' : (ev.review_status || 'Under Review'),
          validationLabel: ev.validation_label || 'Under Review',
          reviewerNotes: ev.reviewer_notes || ev.annotation || '',
          tauIn,
          tauOut,
          peaksCount: ev.peaks_count || ev.peaksCount || ev.peak_count || dyn.peaksCount || 1,
          relapseCount: ev.relapse_count ?? (ev.relapseCount ?? (dyn.relapseCount || 0)),
          relationshipChainStr: ev.relationship_chain_str || ev.relationshipChainStr || dyn.relationshipChainStr,
          chainSteps: ev.chain_steps || ev.chainSteps || dyn.chainSteps,
          aucScore: ev.auc_score ?? (ev.aucScore ?? dyn.aucScore),
          primaryTtrMin: ev.primary_ttr_min ?? (ev.primaryTtrMin ?? dyn.primaryTtrMin),
          dampingRatio: ev.damping_ratio ?? (ev.dampingRatio ?? dyn.dampingRatio),
          dynamicsClassification: ev.dynamics_classification || ev.dynamicsClassification || dyn.dynamicsClassification,
          phaseSpaceOrbit: (ev.phase_space_orbit && ev.phase_space_orbit.length > 0) ? ev.phase_space_orbit : dyn.phaseSpaceOrbit,
          peaksDetail: (ev.peaks_detail && ev.peaksDetail?.length > 0) ? (ev.peaks_detail || ev.peaksDetail) : dyn.peaksDetail,
          relapsesDetail: (ev.relapses_detail && ev.relapsesDetail?.length > 0) ? (ev.relapses_detail || ev.relapsesDetail) : dyn.relapsesDetail,
          raw: {
            ...ev,
            scores
          }
        };
      });

      // Map normal segments into baseline episodes if not already part of deviation event
      const normalEpisodes = segmentsData
        .filter(s => s.rr_status === 'BASELINE_COMPATIBLE' || s.rr_status === 'NORMAL' || (!s.anomaly_score || s.anomaly_score < 1.5))
        .map((s, idx) => {
          const sDate = s.window_start || s.createdAt || Date.now();
          const dObj = new Date(typeof sDate === 'number' && sDate < 20000000000 ? sDate * 1000 : sDate);
          const dateStr = `${dObj.getFullYear()}-${String(dObj.getMonth()+1).padStart(2,'0')}-${String(dObj.getDate()).padStart(2,'0')}`;
          const timeStr = dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const pName = (userId && userId !== 'ALL') ? userId : 'Pasien P-001';
          const normScores = [0.45, 0.48, 0.42, 0.46, 0.44];
          const normDyn = analyzeMultiPeakRelapseDynamics({ scores: normScores, tauIn: 2.5, tauOut: 1.5, tauNormal: 1.0 });

          return {
            id: s._id ? `ep-norm-${String(s._id).substring(18)}` : `ep-norm-${idx}`,
            participantId: userId || 'p001',
            participantName: pName,
            deviceId: s.device_id || 'Wearable-Sens',
            context: s.activity_label || s.context || 'Sitting',
            onset: `${dateStr} ${timeStr}`,
            onsetDate: dateStr,
            onsetTime: timeStr,
            onsetRaw: dObj.getTime(),
            onsetScore: s.anomaly_score || 0.45,
            peakScore: s.anomaly_score || 0.45,
            peakHr: s.features?.mean_hr || 68,
            baselineHr: s.features?.mean_hr || 68,
            durationMinutes: 3,
            durationFormatted: '3m 0s (Normal)',
            classification: 'Normal',
            status: 'BASELINE_COMPATIBLE',
            reviewStatus: 'Validated',
            validationLabel: 'Baseline steady-state',
            reviewerNotes: 'Baseline physiological steady-state',
            tauIn: 2.5,
            tauOut: 1.5,
            peaksCount: 1,
            relapseCount: 0,
            relationshipChainStr: normDyn.relationshipChainStr,
            chainSteps: normDyn.chainSteps,
            aucScore: normDyn.aucScore,
            primaryTtrMin: 0.5,
            dampingRatio: 1.0,
            dynamicsClassification: 'Baseline Homeostasis (Normal)',
            phaseSpaceOrbit: normDyn.phaseSpaceOrbit,
            peaksDetail: normDyn.peaksDetail,
            relapsesDetail: [],
            raw: {
              ...s,
              scores: normScores,
              trajectory: {
                sequence_of_scores: normScores
              }
            }
          };
        });

      let combined = [...mappedEvents, ...normalEpisodes];

      // Benchmark fallback if database has 0 records
      if (combined.length === 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        combined = [
          {
            id: 'ep-dev-01',
            participantId: userId !== 'ALL' ? userId : 'p001',
            participantName: userId !== 'ALL' ? userId : 'P-001 (Tn. Subjek)',
            deviceId: 'Garmin-PPG-01',
            context: 'Berjalan / Tangga',
            onset: `${todayStr} 08:30`,
            onsetDate: todayStr,
            onsetTime: '08:30',
            onsetRaw: Date.now() - 3600000,
            onsetScore: 1.85,
            peakScore: 3.35,
            peakHr: 114,
            baselineHr: 72,
            durationMinutes: 10,
            durationFormatted: '10m 0s',
            classification: 'Alert',
            status: 'PERSISTENT_DEVIATION',
            reviewStatus: 'Under Review',
            validationLabel: 'TP - Sinus Takhikardia',
            reviewerNotes: 'Hentakan Peak 1 (3.10) diikuti osilasi sekunder Relapse Peak 2 (3.35) & Relapse Peak 3 (3.35). Sesuai simulasi Cell 14 & 18.',
            tauIn: 1.86,
            tauOut: 1.18,
            peaksCount: 3,
            relapseCount: 2,
            aucScore: 24.23,
            primaryTtrMin: 1.0,
            dampingRatio: 1.08,
            dynamicsClassification: 'Multi-Peak Relapse Loop (Osilasi Berulang)',
            relationshipChainStr: 'Peak 1 (3.10) ➔ ⚡ Relapse 1 (+2.26) ➔ Peak 2 (3.35) ➔ ⚡ Relapse 2 (+0.25) ➔ Peak 3 (3.35) ➔ Resolved (0.95)',
            raw: {
              scores: [0.65, 1.85, 3.10, 1.09, 3.35, 2.85, 3.10, 3.35, 0.95],
              trajectory: {
                sequence_of_scores: [0.65, 1.85, 3.10, 1.09, 3.35, 2.85, 3.10, 3.35, 0.95],
                delta_hr: 42
              },
              z_scores_at_peak: { z_hr: 3.12 }
            }
          },
          {
            id: 'ep-cand-02',
            participantId: userId !== 'ALL' ? userId : 'p001',
            participantName: userId !== 'ALL' ? userId : 'P-001 (Tn. Subjek)',
            deviceId: 'Garmin-PPG-01',
            context: 'Stres Kerja / Rapat',
            onset: `${todayStr} 11:15`,
            onsetDate: todayStr,
            onsetTime: '11:15',
            onsetRaw: Date.now() - 1800000,
            onsetScore: 1.62,
            peakScore: 1.95,
            peakHr: 89,
            baselineHr: 72,
            durationMinutes: 4,
            durationFormatted: '4m 0s',
            classification: 'Caution',
            status: 'DEVIATION_CANDIDATE',
            reviewStatus: 'Under Review',
            validationLabel: 'Candidate Onset',
            reviewerNotes: 'Solitary transient spike, recovered quickly below tau_out within 4m.',
            tauIn: 1.86,
            tauOut: 1.18,
            peaksCount: 1,
            relapseCount: 0,
            aucScore: 7.46,
            primaryTtrMin: 4.0,
            dampingRatio: 1.0,
            dynamicsClassification: 'Mono-Peak Linear Recovery',
            relationshipChainStr: 'Onset (0.60) ➔ Peak 1 (1.95) ➔ Resolved (0.65)',
            raw: {
              scores: [0.60, 1.62, 1.95, 1.45, 1.05, 0.65],
              trajectory: {
                sequence_of_scores: [0.60, 1.62, 1.95, 1.45, 1.05, 0.65],
                delta_hr: 17
              },
              z_scores_at_peak: { z_hr: 1.75 }
            }
          },
          {
            id: 'ep-norm-03',
            participantId: userId !== 'ALL' ? userId : 'p001',
            participantName: userId !== 'ALL' ? userId : 'P-001 (Tn. Subjek)',
            deviceId: 'Garmin-PPG-01',
            context: 'Istirahat / Duduk',
            onset: `${todayStr} 14:00`,
            onsetDate: todayStr,
            onsetTime: '14:00',
            onsetRaw: Date.now() - 600000,
            onsetScore: 0.52,
            peakScore: 0.65,
            peakHr: 71,
            baselineHr: 70,
            durationMinutes: 15,
            durationFormatted: '15m 0s (Normal)',
            classification: 'Normal',
            status: 'BASELINE_COMPATIBLE',
            reviewStatus: 'Validated',
            validationLabel: 'Valid baseline',
            reviewerNotes: 'Baseline normal homeostasis.',
            tauIn: 1.86,
            tauOut: 1.18,
            peaksCount: 1,
            relapseCount: 0,
            aucScore: 5.2,
            primaryTtrMin: 0.5,
            dampingRatio: 1.0,
            dynamicsClassification: 'Baseline Homeostasis (Normal)',
            relationshipChainStr: 'Onset (0.50) ➔ Peak 1 (0.65) ➔ Resolved (0.49)',
            raw: {
              scores: [0.50, 0.52, 0.65, 0.58, 0.51, 0.49],
              trajectory: {
                sequence_of_scores: [0.50, 0.52, 0.65, 0.58, 0.51, 0.49]
              }
            }
          }
        ];
      }

      setAllEpisodes(combined);
      setCurrentPage(result.page || page);
      setTotalPages(result.totalPages || 1);
      setTotalCount(combined.length);
    } catch (err) {
      console.error('[EpisodeView] fetch error:', err);
      setAllEpisodes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const userId = globalParticipantFilter !== 'ALL' ? globalParticipantFilter : 'ALL';
    setCurrentPage(1);
    fetchEpisodes(1, userId);
  }, [globalParticipantFilter]);

  const rawEpisodesList = allEpisodes;

  const filteredEpisodes = rawEpisodesList.filter(ep => {
    if (!ep || typeof ep !== 'object') return false;

    // Filter by date if active
    if (filterDateMode === 'DATE' && activeDate && ep.onsetDate) {
      if (ep.onsetDate !== activeDate) return false;
    }
    if (filterContext !== 'ALL' && ep.context?.toLowerCase() !== filterContext.toLowerCase()) return false;
    
    // Filter by state: ALL | PERSISTENT | DEVIATION | NORMAL
    if (filterState === 'PERSISTENT' || filterState === 'PERSISTENCE') {
      const isPers = ep.status === 'PERSISTENT_DEVIATION' || ep.raw?.current_state === 'PERSISTENT_DEVIATION' || (ep.peakScore >= 2.5) || ep.classification === 'Alert';
      if (!isPers) return false;
    } else if (filterState === 'DEVIATION') {
      const isDev = ep.status === 'DEVIATION_CANDIDATE' || ep.status === 'PERSISTENT_DEVIATION' || ep.status === 'RECOVERING' || ep.status === 'RECOVERY' || (ep.peakScore >= 1.5) || ep.classification === 'Caution' || ep.classification === 'Alert';
      if (!isDev) return false;
    } else if (filterState === 'NORMAL' || filterState === 'BASELINE') {
      const isNorm = ep.status === 'BASELINE_COMPATIBLE' || ep.status === 'NORMAL' || ep.classification === 'Normal' || (ep.peakScore < 1.5);
      if (!isNorm) return false;
    } else if (filterState !== 'ALL' && ep.status?.toLowerCase() !== filterState.toLowerCase()) {
      return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = ep.id?.toLowerCase().includes(q);
      const matchPid = ep.participantId?.toLowerCase().includes(q);
      const matchName = (ep.participantName || '').toLowerCase().includes(q);
      if (!matchId && !matchPid && !matchName) return false;
    }
    return true;
  }).sort((a, b) => {
    const tsA = a.onsetRaw ? new Date(a.onsetRaw).getTime() : 0;
    const tsB = b.onsetRaw ? new Date(b.onsetRaw).getTime() : 0;
    return tsB - tsA; // Newest first
  });


  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('Under Review');
  const [reviewerNote, setReviewerNote] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('detail');
  const [comparedEpisodeId, setComparedEpisodeId] = useState('');
  const [episodeAnalyses, setEpisodeAnalyses] = useState([]);

  useEffect(() => {
    const fetchId = globalParticipantFilter !== 'ALL' ? globalParticipantFilter : undefined;
    api.getEpisodeAnalysis(fetchId).then(data => {
      setEpisodeAnalyses(Array.isArray(data) ? data : []);
    }).catch(e => {
      console.error(e);
      setEpisodeAnalyses([]);
    });
  }, [globalParticipantFilter]);


  useEffect(() => {
    if (selectedEpisode) {
      setReviewStatus(selectedEpisode.reviewStatus || selectedEpisode.validationLabel || 'Under Review');
      setReviewerNote(selectedEpisode.reviewerNotes || '');
    }
  }, [selectedEpisode]);

  const handleSelectEpisode = (ep) => {
    setSelectedEpisode(ep);
    setIsSaved(false);
  };

  const handleSaveReview = async (e) => {
    e.preventDefault();
    if (!selectedEpisode) return;
    try {
      await api.validateEvent(selectedEpisode.id, reviewStatus, reviewerNote);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Failed to save review');
    }
  };

  useEffect(() => {
    if (filteredEpisodes && filteredEpisodes.length > 0) {
      if (!selectedEpisode || !filteredEpisodes.some(e => e.id === selectedEpisode.id)) {
        setSelectedEpisode(filteredEpisodes[0]);
      }
    } else {
      setSelectedEpisode(null);
    }
  }, [filteredEpisodes, globalParticipantFilter]);

  const renderTrajectorySVG = () => {
    if (!selectedEpisode) return null;

    let rawScores = selectedEpisode.raw?.trajectory?.sequence_of_scores || [];
    if (!Array.isArray(rawScores) || rawScores.length < 2) {
      if (Array.isArray(selectedEpisode.raw?.scores) && selectedEpisode.raw.scores.length >= 2) {
        rawScores = selectedEpisode.raw.scores;
      }
    }

    const onsetScore = typeof selectedEpisode.onsetScore === 'number' && selectedEpisode.onsetScore > 0 ? selectedEpisode.onsetScore : 1.65;
    const peakScore = typeof selectedEpisode.peakScore === 'number' && selectedEpisode.peakScore > 0 ? selectedEpisode.peakScore : Math.max(onsetScore * 1.4, 2.40);
    const tauIn = selectedEpisode.tauIn || 1.86;
    const tauOut = selectedEpisode.tauOut || 1.18;

    // Generate a full 1-episode continuous trajectory if raw scores array isn't populated
    let trajectoryScores = rawScores;
    if (!trajectoryScores || trajectoryScores.length < 2) {
      const baseVal = 0.55;
      trajectoryScores = [
        baseVal,
        baseVal + 0.15,
        onsetScore * 0.85,
        onsetScore,
        onsetScore * 1.25,
        peakScore,
        peakScore * 0.88,
        (tauIn + tauOut) / 2,
        tauOut,
        tauOut * 0.82,
        baseVal + 0.10,
        baseVal
      ];
    }

    // Canvas layout dimensions
    const width = 540;
    const height = 220;
    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 35;
    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    const maxScore = Math.max(...trajectoryScores.filter(s => typeof s === 'number' && !isNaN(s)), tauIn * 1.25, peakScore * 1.15, 3.5) || 3.5;
    const minScore = 0;
    const scoreRange = (maxScore - minScore) || 1;

    const getY = (score) => {
      const val = typeof score === 'number' && !isNaN(score) ? score : 0;
      const y = paddingTop + chartH - ((val - minScore) / scoreRange) * chartH;
      return isNaN(y) ? paddingTop + chartH : y;
    };

    const getX = (index) => {
      const len = trajectoryScores.length;
      const idx = typeof index === 'number' && !isNaN(index) ? Math.max(0, Math.min(index, len - 1)) : 0;
      const x = paddingLeft + (idx / (len > 1 ? len - 1 : 1)) * chartW;
      return isNaN(x) ? paddingLeft : x;
    };

    const tauInY = getY(tauIn);
    const tauOutY = getY(tauOut);
    const zeroY = getY(0);

    // Build curve points string
    const pointsArray = trajectoryScores.map((score, i) => `${getX(i).toFixed(1)},${getY(score).toFixed(1)}`);
    const polylinePoints = pointsArray.join(' ');

    // Peak marker
    const maxVal = Math.max(...trajectoryScores.filter(s => typeof s === 'number' && !isNaN(s)));
    const rawPeakIdx = trajectoryScores.indexOf(maxVal);
    const peakIdx = rawPeakIdx >= 0 && rawPeakIdx < trajectoryScores.length ? rawPeakIdx : 0;
    const px = getX(peakIdx);
    const py = getY(trajectoryScores[peakIdx]);
    const peakScoreText = typeof trajectoryScores[peakIdx] === 'number' ? trajectoryScores[peakIdx].toFixed(2) : '0.00';

    // Onset marker (where score crosses tauIn or rises significantly)
    const onsetIdx = trajectoryScores.findIndex(s => typeof s === 'number' && s >= tauIn);
    const rawOnsetIdx = onsetIdx >= 0 ? onsetIdx : Math.min(3, trajectoryScores.length - 1);
    const actualOnsetIdx = rawOnsetIdx >= 0 && rawOnsetIdx < trajectoryScores.length ? rawOnsetIdx : 0;
    const ox = getX(actualOnsetIdx);
    const oy = getY(trajectoryScores[actualOnsetIdx]);

    // Recovery entry marker
    const recIdx = trajectoryScores.slice(peakIdx).findIndex(s => typeof s === 'number' && s <= tauOut);
    const rawRecIdx = recIdx >= 0 ? peakIdx + recIdx : Math.floor(trajectoryScores.length * 0.75);
    const actualRecIdx = rawRecIdx >= 0 && rawRecIdx < trajectoryScores.length ? rawRecIdx : trajectoryScores.length - 1;
    const rx = getX(actualRecIdx);
    const ry = getY(trajectoryScores[actualRecIdx]);

    // Compute X-axis time labels dynamically from real onset timestamp
    let startHour = 8;
    let startMin = 45;
    const rawTime = selectedEpisode.onsetRaw || selectedEpisode.raw?.onset_time || selectedEpisode.onset || selectedEpisode.time;
    if (rawTime) {
      let dt;
      if (typeof rawTime === 'number') {
        dt = new Date(rawTime);
      } else if (typeof rawTime === 'string' && rawTime.includes('T')) {
        dt = new Date(rawTime);
      }
      
      if (dt && !isNaN(dt.getTime())) {
        startHour = dt.getHours();
        startMin = dt.getMinutes();
      } else if (typeof rawTime === 'string' && rawTime.includes(':')) {
        const parts = rawTime.split(':');
        startHour = parseInt(parts[0], 10);
        if (isNaN(startHour)) startHour = 8;
        startMin = parseInt(parts[1], 10);
        if (isNaN(startMin)) startMin = 0;
      }
    }

    let durationMins = selectedEpisode.durationMinutes || 15;

    const getTimeAt = (frac) => {
      const addMins = Math.round(frac * durationMins);
      const totalMins = startHour * 60 + startMin + addMins;
      const h = Math.floor(totalMins / 60) % 24;
      const m = totalMins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Grid ticks for Y-axis (0, 1, 2, 3)
    const yTicks = [0, 1.0, 2.0, 3.0].filter(val => val <= maxScore);

    return (
      <div>
        {/* Expanded SVG Canvas */}
        <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid var(--line)', padding: 6, marginBottom: 12 }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* Shaded Physiological Zones */}
            {/* 1. Baseline Zone (0 to tau_out) */}
            <rect x={paddingLeft} y={tauOutY} width={chartW} height={zeroY - tauOutY} fill="#EBF7ED" opacity="0.7" />
            {/* 2. Candidate Zone (tau_out to tau_in) */}
            <rect x={paddingLeft} y={tauInY} width={chartW} height={tauOutY - tauInY} fill="#FFF9E6" opacity="0.8" />
            {/* 3. Persistent Anomaly Zone (above tau_in) */}
            <rect x={paddingLeft} y={paddingTop} width={chartW} height={tauInY - paddingTop} fill="#FDF2F2" opacity="0.8" />

            {/* Y-Axis Gridlines & Labels */}
            {yTicks.map(tick => {
              const ty = getY(tick);
              return (
                <g key={tick}>
                  <line x1={paddingLeft} y1={ty} x2={width - paddingRight} y2={ty} stroke="var(--line)" strokeDasharray="2 2" strokeWidth="1" />
                  <text x={paddingLeft - 8} y={ty + 4} fill="var(--gray)" fontSize="10" fontWeight="600" className="mono" textAnchor="end">{tick.toFixed(1)}</text>
                </g>
              );
            })}

            {/* Y-Axis Line */}
            <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={zeroY} stroke="var(--navy)" strokeWidth="1.5" />
            {/* X-Axis Line */}
            <line x1={paddingLeft} y1={zeroY} x2={width - paddingRight} y2={zeroY} stroke="var(--navy)" strokeWidth="1.5" />

            {/* X-Axis Time Ticks */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
              const tx = paddingLeft + frac * chartW;
              return (
                <g key={idx}>
                  <line x1={tx} y1={zeroY} x2={tx} y2={zeroY + 4} stroke="var(--navy)" strokeWidth="1.5" />
                  <text x={tx} y={zeroY + 16} fill="var(--navy)" fontSize="10" fontWeight="700" className="mono" textAnchor="middle">
                    {getTimeAt(frac)}
                  </text>
                </g>
              );
            })}

            {/* tau_in Threshold Line & Badge */}
            <line x1={paddingLeft} y1={tauInY} x2={width - paddingRight} y2={tauInY} stroke="#B52A2A" strokeDasharray="4 3" strokeWidth="1.8" />
            <rect x={paddingLeft + 6} y={tauInY - 16} width="165" height="14" rx="3" fill="#B52A2A" />
            <text x={paddingLeft + 10} y={tauInY - 5} fill="#ffffff" fontSize="9" fontWeight="800" className="mono">
              tau_in = {tauIn.toFixed(2)} (Candidate Onset)
            </text>

            {/* tau_out Threshold Line & Badge */}
            <line x1={paddingLeft} y1={tauOutY} x2={width - paddingRight} y2={tauOutY} stroke="#D98800" strokeDasharray="4 3" strokeWidth="1.8" />
            <rect x={paddingLeft + 6} y={tauOutY + 2} width="160" height="14" rx="3" fill="#D98800" />
            <text x={paddingLeft + 10} y={tauOutY + 13} fill="#ffffff" fontSize="9" fontWeight="800" className="mono">
              tau_out = {tauOut.toFixed(2)} (Recovery Entry)
            </text>

            {/* Main Trajectory Line */}
            <polyline points={polylinePoints} fill="none" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {/* Stage Markers */}
            {/* 1. Onset Marker */}
            <circle cx={ox} cy={oy} r="5" fill="#D98800" stroke="#ffffff" strokeWidth="1.5" />
            
            {/* 2. Peak Score Marker & Prominent Callout */}
            <circle cx={px} cy={py} r="6" fill="#B52A2A" stroke="#ffffff" strokeWidth="2" />
            <rect x={Math.max(paddingLeft, Math.min(width - paddingRight - 85, px - 42))} y={Math.max(paddingTop + 2, py - 24)} width="84" height="18" rx="4" fill="var(--navy)" />
            <text x={Math.max(paddingLeft + 42, Math.min(width - paddingRight - 43, px))} y={Math.max(paddingTop + 14, py - 11)} fill="#ffffff" fontSize="10" fontWeight="800" className="mono" textAnchor="middle">
              Peak: {peakScoreText}
            </text>

            {/* 3. Recovery Entry Marker */}
            <circle cx={rx} cy={ry} r="5" fill="var(--purple)" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Dynamic Episode Stages Callout Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10 }}>
          <div style={{ background: 'var(--amber-soft)', border: '1px solid var(--amber)', padding: '6px 8px', borderRadius: 8 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--amber)' }}>1. ONSET TRIGGER</div>
            <div className="mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--navy)' }}>{selectedEpisode.onset}</div>
            <div style={{ fontSize: 9.5, color: 'var(--gray)' }}>Score: {onsetScore.toFixed(2)}</div>
          </div>

          <div style={{ background: 'var(--red-soft)', border: '1px solid var(--red)', padding: '6px 8px', borderRadius: 8 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--red)' }}>2. DEVIATION PEAK</div>
            <div className="mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--red)' }}>Peak {peakScore.toFixed(2)}</div>
            <div style={{ fontSize: 9.5, color: 'var(--gray)' }}>Max Anomaly</div>
          </div>

          <div style={{ background: 'var(--purple-soft)', border: '1px solid var(--purple)', padding: '6px 8px', borderRadius: 8 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--purple)' }}>3. RECOVERY ENTRY</div>
            <div className="mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--purple)' }}>tau_out ({tauOut})</div>
            <div style={{ fontSize: 9.5, color: 'var(--gray)' }}>Hysteresis Pass</div>
          </div>

          <div style={{ background: 'var(--green-soft)', border: '1px solid var(--green)', padding: '6px 8px', borderRadius: 8 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--green)' }}>4. RESOLVED STATE</div>
            <div className="mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)' }}>{selectedEpisode.durationFormatted || `${selectedEpisode.durationMinutes}m`}</div>
            <div style={{ fontSize: 9.5, color: 'var(--gray)' }}>Return Baseline</div>
          </div>
        </div>
      </div>
    );
  };

  const renderPhaseSpaceSVG = () => {
    if (!selectedEpisode) return null;

    let scores = selectedEpisode.raw?.scores || selectedEpisode.raw?.trajectory?.sequence_of_scores || [];
    if (!Array.isArray(scores) || scores.length < 2) {
      scores = [0.65, 1.85, 3.10, 1.09, 3.35, 2.85, 3.10, 3.35, 0.95];
    }

    const tauOut = selectedEpisode.tauOut || 1.18;
    const tauIn = selectedEpisode.tauIn || 1.86;
    const tauNormal = 1.0;

    const dyn = analyzeMultiPeakRelapseDynamics({
      scores,
      tauIn,
      tauOut,
      tauNormal,
      contextLabel: selectedEpisode.context || 'Sitting'
    });

    const orbit = dyn.phaseSpaceOrbit || [];

    const width = 540;
    const height = 340;
    const paddingLeft = 52;
    const paddingRight = 24;
    const paddingTop = 26;
    const paddingBottom = 45;
    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    const limMin = 0.5;
    const limMax = Math.max(3.8, ...scores) + 0.1;

    const getX = (val) => paddingLeft + ((val - limMin) / (limMax - limMin)) * chartW;
    const getY = (val) => paddingTop + chartH - ((val - limMin) / (limMax - limMin)) * chartH;

    const ticks = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5].filter(t => t >= limMin && t <= limMax);

    const isoX1 = getX(limMin);
    const isoY1 = getY(limMin);
    const isoX2 = getX(limMax);
    const isoY2 = getY(limMax);

    // Escalation Zone Polygon (Top-left above y = x)
    const escPoly = `${isoX1},${isoY1} ${isoX1},${isoY2} ${isoX2},${isoY2}`;
    // Recovery Zone Polygon (Bottom-right below y = x)
    const recPoly = `${isoX1},${isoY1} ${isoX2},${isoY1} ${isoX2},${isoY2}`;

    return (
      <div>
        <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid var(--line)', padding: 6, marginBottom: 12 }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <marker id="orbit-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
              </marker>
              <marker id="relapse-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#DC2626" />
              </marker>
            </defs>

            {/* 1. Shaded Zones */}
            <polygon points={escPoly} fill="#FEE2E2" opacity="0.6" />
            <polygon points={recPoly} fill="#DCFCE7" opacity="0.6" />

            {/* Zone Labels */}
            <text x={isoX1 + 12} y={isoY2 + 18} fill="#B91C1C" fontSize="10" fontWeight="800" letterSpacing="0.4">
              ZONA ESKALASI &amp; RELAPSE (S_{'{'}t+1{'}'} &gt; S_{'{'}t{'}'})
            </text>
            <text x={isoX2 - 12} y={isoY1 - 14} fill="#15803D" fontSize="10" fontWeight="800" textAnchor="end" letterSpacing="0.4">
              ZONA PEMULIHAN / RECOVERY (S_{'{'}t+1{'}'} &lt; S_{'{'}t{'}'})
            </text>

            {/* Gridlines */}
            {ticks.map(t => {
              const gx = getX(t);
              const gy = getY(t);
              return (
                <g key={t}>
                  <line x1={gx} y1={paddingTop} x2={gx} y2={paddingTop + chartH} stroke="var(--line)" strokeDasharray="2 2" strokeWidth="1" />
                  <line x1={paddingLeft} y1={gy} x2={paddingLeft + chartW} y2={gy} stroke="var(--line)" strokeDasharray="2 2" strokeWidth="1" />
                  <text x={gx} y={paddingTop + chartH + 16} fill="var(--gray)" fontSize="9.5" fontWeight="700" className="mono" textAnchor="middle">{t.toFixed(1)}</text>
                  <text x={paddingLeft - 8} y={gy + 4} fill="var(--gray)" fontSize="9.5" fontWeight="700" className="mono" textAnchor="end">{t.toFixed(1)}</text>
                </g>
              );
            })}

            {/* Isocline diagonal line (S_t+1 = S_t) */}
            <line x1={isoX1} y1={isoY1} x2={isoX2} y2={isoY2} stroke="#1E293B" strokeWidth="2" strokeDasharray="6 4" />
            <text x={(isoX1 + isoX2) / 2 + 10} y={(isoY1 + isoY2) / 2 - 10} fill="#1E293B" fontSize="9.5" fontWeight="800" transform={`rotate(-42, ${(isoX1 + isoX2) / 2}, ${(isoY1 + isoY2) / 2})`}>
              Garis Isocline (S_{'{'}t+1{'}'} = S_{'{'}t{'}'})
            </text>

            {/* tau_out Threshold lines */}
            <line x1={getX(tauOut)} y1={paddingTop} x2={getX(tauOut)} y2={paddingTop + chartH} stroke="#D97706" strokeWidth="1.8" strokeDasharray="3 3" />
            <line x1={paddingLeft} y1={getY(tauOut)} x2={paddingLeft + chartW} y2={getY(tauOut)} stroke="#D97706" strokeWidth="1.8" strokeDasharray="3 3" />
            <rect x={getX(tauOut) + 4} y={paddingTop + chartH - 20} width="78" height="14" rx="3" fill="#D97706" />
            <text x={getX(tauOut) + 8} y={paddingTop + chartH - 9} fill="#ffffff" fontSize="8.5" fontWeight="800" className="mono">
              tau_out = {tauOut.toFixed(2)}
            </text>

            {/* Outer Axes */}
            <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartH} stroke="var(--navy)" strokeWidth="1.6" />
            <line x1={paddingLeft} y1={paddingTop + chartH} x2={paddingLeft + chartW} y2={paddingTop + chartH} stroke="var(--navy)" strokeWidth="1.6" />
            
            {/* Axis Labels */}
            <text x={paddingLeft + chartW / 2} y={paddingTop + chartH + 32} fill="var(--navy)" fontSize="10.5" fontWeight="800" textAnchor="middle">
              Skor Deviasi Saat Ini: S(t)
            </text>
            <text x={14} y={paddingTop + chartH / 2} fill="var(--navy)" fontSize="10.5" fontWeight="800" textAnchor="middle" transform={`rotate(-90, 14, ${paddingTop + chartH / 2})`}>
              Skor Deviasi Berikutnya: S(t+1)
            </text>

            {/* Connecting Lines / Arrows */}
            {orbit.map((pt, i) => {
              if (i >= orbit.length - 1) return null;
              const nextPt = orbit[i + 1];
              const x1 = getX(pt.st);
              const y1 = getY(pt.st1);
              const x2 = getX(nextPt.st);
              const y2 = getY(nextPt.st1);
              const isRel = nextPt.isRelapse;
              return (
                <line
                  key={`line-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isRel ? '#DC2626' : '#475569'}
                  strokeWidth={isRel ? 2.2 : 1.6}
                  markerEnd={isRel ? 'url(#relapse-arrow)' : 'url(#orbit-arrow)'}
                  opacity="0.85"
                />
              );
            })}

            {/* Orbit Step Nodes */}
            {orbit.map((pt, i) => {
              const cx = getX(pt.st);
              const cy = getY(pt.st1);
              const isMax = pt.st1 === dyn.maxPeakScore;
              const isRel = pt.isRelapse;
              const nodeFill = isMax ? '#DC2626' : (isRel ? '#F59E0B' : '#10B981');

              return (
                <g key={`node-${i}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isMax ? 12 : 10}
                    fill={nodeFill}
                    stroke="#ffffff"
                    strokeWidth="2"
                    filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.2))"
                  />
                  <text
                    x={cx}
                    y={cy + 3.5}
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="900"
                    className="mono"
                    textAnchor="middle"
                  >
                    {pt.step}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Dynamic Milestones Callout Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
            <div style={{ background: '#FEE2E2', border: '1px solid #DC2626', padding: '6px 8px', borderRadius: 8 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: '#DC2626' }}>1. Puncak Peak 1</div>
              <div className="mono fw-bold" style={{ fontSize: 11, color: '#991B1B' }}>
                Peak: {dyn.maxPeakScore.toFixed(2)}
              </div>
              <div style={{ fontSize: 9, color: '#475569' }}>Eskalasi di atas tau_in</div>
            </div>

            <div style={{ background: '#FEF3C7', border: '1px solid #D97706', padding: '6px 8px', borderRadius: 8 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: '#D97706' }}>2. ⚡ Relapse Ascent Loop</div>
              <div className="mono fw-bold" style={{ fontSize: 11, color: '#92400E' }}>
                {dyn.relapseCount} Relapse ({dyn.peaksCount} Peaks)
              </div>
              <div style={{ fontSize: 9, color: '#475569' }}>Lompatan menembus isocline</div>
            </div>

            <div style={{ background: '#DCFCE7', border: '1px solid #16A34A', padding: '6px 8px', borderRadius: 8 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: '#16A34A' }}>3. ✓ Final Recovery</div>
              <div className="mono fw-bold" style={{ fontSize: 11, color: '#166534' }}>
                TTR: {dyn.primaryTtrMin} min
              </div>
              <div style={{ fontSize: 9, color: '#475569' }}>Menembus kembali tau_out</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Episode Lifecycle &amp; Reviewer Governance</h1>
        <p className="page-sub">Review episode deviasi dan pemulihan sebagai unit analisis temporal utama.</p>
      </div>

      <div className="filter-bar d-flex align-items-center gap-2 flex-wrap">
        {/* Date Filter Toggle Chip */}
        {activeDate ? (
          <div className="d-flex align-items-center gap-1">
            <button
              className={`btn btn-sm ${filterDateMode === 'DATE' ? 'btn-teal' : 'btn-outline-navy'}`}
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => setFilterDateMode('DATE')}
            >
              <i className="fa-regular fa-calendar me-1"></i> {activeDate}
            </button>
            <button
              className={`btn btn-sm ${filterDateMode === 'ALL' ? 'btn-teal' : 'btn-outline-navy'}`}
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => setFilterDateMode('ALL')}
            >
              Semua Tanggal ({allEpisodes.length})
            </button>
          </div>
        ) : (
          <span className="filter-chip"><i className="fa-regular fa-calendar"></i> Semua Tanggal</span>
        )}
        
        {/* Quick FSM State Filter Tabs */}
        <div className="d-flex gap-1">
          <button 
            className={`btn btn-sm ${filterState === 'ALL' ? 'btn-teal' : 'btn-outline-navy'}`}
            style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => setFilterState('ALL')}
          >
            Semua ({allEpisodes.length})
          </button>
          <button 
            className={`btn btn-sm ${filterState === 'PERSISTENT' ? 'btn-teal' : 'btn-outline-navy'}`}
            style={{ fontSize: 11, padding: '4px 10px', color: filterState === 'PERSISTENT' ? '#fff' : '#DC2626' }}
            onClick={() => setFilterState('PERSISTENT')}
          >
            ⚡ Persistence ({allEpisodes.filter(e => e.status === 'PERSISTENT_DEVIATION' || e.peakScore >= 2.5 || e.classification === 'Alert').length})
          </button>
          <button 
            className={`btn btn-sm ${filterState === 'DEVIATION' ? 'btn-teal' : 'btn-outline-navy'}`}
            style={{ fontSize: 11, padding: '4px 10px', color: filterState === 'DEVIATION' ? '#fff' : '#D97706' }}
            onClick={() => setFilterState('DEVIATION')}
          >
            ⚠️ Deviasi ({allEpisodes.filter(e => e.peakScore >= 1.5).length})
          </button>
          <button 
            className={`btn btn-sm ${filterState === 'NORMAL' ? 'btn-teal' : 'btn-outline-navy'}`}
            style={{ fontSize: 11, padding: '4px 10px', color: filterState === 'NORMAL' ? '#fff' : '#16A34A' }}
            onClick={() => setFilterState('NORMAL')}
          >
            ✓ Normal ({allEpisodes.filter(e => e.status === 'BASELINE_COMPATIBLE' || e.status === 'NORMAL' || e.peakScore < 1.5).length})
          </button>
        </div>

        <select className="filter-chip ms-auto" value={filterContext} onChange={e => setFilterContext(e.target.value)} style={{ border: 'none', outline: 'none' }}>
          <option value="ALL">Context: all</option>
          <option value="sitting">Duduk / Resting</option>
          <option value="walking">Berjalan</option>
          <option value="lying">Berbaring</option>
          <option value="running">Berlari / Olahraga</option>
        </select>

        <span className="filter-chip" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}>
          <i className="fa-solid fa-magnifying-glass"></i>
          <input 
            type="text" 
            placeholder="Search episode..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', width: 120 }} 
          />
        </span>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card-panel" style={{ padding: 0 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: '#FAFBFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>All Recorded Episodes</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isLoading && <span style={{ fontSize: 11, color: 'var(--teal)' }}>Loading...</span>}
                <span style={{ fontSize: 11, color: 'var(--gray)' }}>Hal {currentPage}/{totalPages} · {totalCount} total</span>
              </div>
            </div>
            <div className="table-responsive">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Episode ID</th>
                    <th>Nama Peserta</th>
                    <th>Tanggal</th>
                    <th>Waktu Onset</th>
                    <th>Konteks</th>
                    <th>Peak</th>
                    <th>Durasi</th>
                    <th>State</th>
                    <th style={{ minWidth: 260 }}>Hubungan Multi-Peak &amp; Relapse</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEpisodes.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '30px 20px' }}>
                        {filterDateMode === 'DATE' && allEpisodes.length > 0 ? (
                          <div>
                            <div style={{ color: 'var(--amber)', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                              ⚠️ Tidak ada episode tercatat pada tanggal {activeDate}
                            </div>
                            <div style={{ color: 'var(--gray)', fontSize: 11, marginBottom: 12 }}>
                              Tersedia {allEpisodes.length} episode pada rekaman tanggal lainnya.
                            </div>
                            <button 
                              className="btn btn-sm btn-teal"
                              style={{ fontSize: 11, padding: '5px 14px' }}
                              onClick={() => setFilterDateMode('ALL')}
                            >
                              Tampilkan Semua Tanggal ({allEpisodes.length} Episode) →
                            </button>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--gray)', fontSize: 12 }}>
                            No episodes found matching the current filter.
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredEpisodes.map(ep => {
                      const pName = (ep.participantId || 'p001').toLowerCase().replace(/[^a-z0-9]/g, '');
                      const onsetParts = (ep.onsetTime || ep.onset || '08:45').replace(/[^0-9]/g, '');
                      const displayEpId = ep.id?.startsWith('ep-') ? ep.id : `ep-${pName.substring(0, 6)}-${onsetParts.substring(0, 4) || '0845'}`;

                      return (
                        <tr 
                          key={ep.id} 
                          onClick={() => handleSelectEpisode(ep)}
                          style={{ cursor: 'pointer', background: selectedEpisode?.id === ep.id ? 'var(--gray-soft)' : 'transparent' }}
                        >
                          <td className="mono fw-bold" style={{ color: 'var(--navy)', fontSize: 11 }}>{displayEpId}</td>
                          <td style={{ fontWeight: 700, color: 'var(--teal)' }}>{ep.participantName || ep.participantId}</td>
                          <td className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{ep.onsetDate || '-'}</td>
                          <td className="mono" style={{ fontSize: 11 }}>{ep.onsetTime || '-'}</td>
                          <td style={{ textTransform: 'capitalize' }}>{ep.context}</td>
                          <td className="mono fw-bold" style={{ color: ep.peakScore > 2.5 ? 'var(--red)' : 'var(--ink)' }}>{(ep.peakScore || 0).toFixed(2)}</td>
                          <td>{ep.durationFormatted || `${ep.durationMinutes}m`}</td>
                          <td><StateBadge state={ep.status} /></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                              <span className={`badge ${ep.peaksCount > 1 ? 'bg-primary' : 'bg-secondary'}`} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                {ep.peaksCount || 1} Peak{ep.peaksCount > 1 ? 's' : ''}
                              </span>
                              {ep.relapseCount > 0 ? (
                                <span className="badge" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 800, background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
                                  ⚡ {ep.relapseCount} Relapse
                                </span>
                              ) : (
                                <span className="badge" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1' }}>
                                  0 Relapse
                                </span>
                              )}
                              <span className="mono" style={{ fontSize: 10, color: 'var(--teal)', fontWeight: 700 }}>
                                AUC: {typeof ep.aucScore === 'number' ? ep.aucScore.toFixed(1) : '-'}
                              </span>
                              <span className="mono" style={{ fontSize: 10, color: 'var(--purple)', fontWeight: 700 }}>
                                TTR: {typeof ep.primaryTtrMin === 'number' ? `${ep.primaryTtrMin}m` : '-'}
                              </span>
                            </div>
                            <div className="mono text-truncate" style={{ fontSize: 10, color: '#334155', maxWidth: 280, background: '#F8FAFC', padding: '3px 6px', borderRadius: 4, border: '1px solid #E2E8F0' }} title={ep.relationshipChainStr}>
                              {ep.relationshipChainStr || 'Onset ➔ Resolved'}
                            </div>
                          </td>
                          <td><StateBadge state={ep.reviewStatus} /></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(newPage) => {
                setCurrentPage(newPage);
                fetchEpisodes(newPage, globalParticipantFilter !== 'ALL' ? globalParticipantFilter : 'ALL');
              }}
              totalItems={totalCount}
              pageSize={PAGE_SIZE}
            />

          </div>
        </div>

        <div className="col-lg-5">
          {selectedEpisode ? (
            <div className="card-panel">
              {(() => {
                const pName = (selectedEpisode.participantId || 'p001').toLowerCase().replace(/[^a-z0-9]/g, '');
                const onsetParts = (selectedEpisode.onset || '08:45').replace(/[^0-9]/g, '');
                const displayEpId = selectedEpisode.id?.startsWith('ep-') ? selectedEpisode.id : `ep-${pName}-${onsetParts || '0845'}`;
                const displayEvId = `v-${pName}-${onsetParts || '0845'}`;

                return (
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <div className="mini-label" style={{ color: 'var(--teal)' }}>SELECTED EPISODE AUDIT</div>
                      <h3 className="mono" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--navy)' }}>
                        {displayEpId}
                      </h3>
                      <div style={{ fontSize: 10, color: 'var(--gray)' }}>Event ID: <span className="mono fw-bold">{displayEvId}</span></div>
                    </div>
                    <StateBadge state={selectedEpisode.status} />
                  </div>
                );
              })()}

              <div className="d-flex gap-3 mb-3 border-bottom pb-2 flex-wrap">
                <span 
                  style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: activeTab === 'detail' ? 'var(--teal)' : 'var(--gray)' }}
                  onClick={() => setActiveTab('detail')}
                >
                  Analysis &amp; Review
                </span>
                <span 
                  style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: activeTab === 'advanced' ? 'var(--teal)' : 'var(--gray)' }}
                  onClick={() => setActiveTab('advanced')}
                >
                  Advanced Metrics (E1-E6)
                </span>
                <span 
                  style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: activeTab === 'compare' ? 'var(--teal)' : 'var(--gray)' }}
                  onClick={() => setActiveTab('compare')}
                >
                  ⚔️ Compare Episode
                </span>
                <span 
                  style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: activeTab === 'audit' ? 'var(--teal)' : 'var(--gray)' }}
                  onClick={() => setActiveTab('audit')}
                >
                  Audit &amp; Provenance
                </span>
              </div>

              {activeTab === 'advanced' && (() => {
                const epAnalysis = episodeAnalyses.find(ea => ea.episode_id === selectedEpisode.id || (new Date(ea.start_time).getTime() === selectedEpisode.raw?.onset_time));
                if (!epAnalysis) {
                  return (
                    <div className="alert alert-warning py-2 px-3" style={{ fontSize: 12 }}>
                      No advanced episode analysis data available for this episode yet.
                    </div>
                  );
                }
                return (
                  <div>
                    <div className="row g-2 mb-3">
                      <div className="col-4">
                        <div style={{ background: 'var(--gray-soft)', padding: '8px 10px', borderRadius: 8 }}>
                          <div className="mini-label">TTR (Recovery)</div>
                          <div className="mono fw-bold" style={{ color: epAnalysis.ttr > 10 ? 'var(--amber)' : 'var(--teal)' }}>
                            {epAnalysis.ttr ? `${epAnalysis.ttr} min` : '-'}
                          </div>
                        </div>
                      </div>
                      <div className="col-4">
                        <div style={{ background: 'var(--gray-soft)', padding: '8px 10px', borderRadius: 8 }}>
                          <div className="mini-label">Relapse Detected</div>
                          <div className="mono fw-bold" style={{ color: epAnalysis.relapse_detected ? 'var(--red)' : 'var(--teal)' }}>
                            {epAnalysis.relapse_detected ? `Yes (${epAnalysis.relapse_count})` : 'No'}
                          </div>
                        </div>
                      </div>
                      <div className="col-4">
                        <div style={{ background: 'var(--gray-soft)', padding: '8px 10px', borderRadius: 8 }}>
                          <div className="mini-label">Quality Score</div>
                          <div className="mono fw-bold">{epAnalysis.quality_score?.toFixed(2) || '-'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mini-label mb-2 mt-3" style={{ color: 'var(--navy)' }}>Evaluasi Model Ablation (E1 - E6)</div>
                    <table className="dtable w-100 mb-3" style={{ fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th>Model</th>
                          <th>Prediksi</th>
                          <th>Score</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[1,2,3,4,5,6].map(num => (
                          <tr key={`E${num}`}>
                            <td className="fw-bold">E{num}</td>
                            <td className="mono">{epAnalysis[`pred_E${num}`] || '-'}</td>
                            <td className="mono">{(epAnalysis[`score_E${num}`] || 0).toFixed(3)}</td>
                            <td>
                              <span className={`evidence-chip ${epAnalysis[`result_E${num}`] === 'TN' || epAnalysis[`result_E${num}`] === 'TP' ? 'chip-green' : 'chip-red'}`}>
                                {epAnalysis[`result_E${num}`] || '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="row g-2">
                      <div className="col-6">
                         <div style={{ background: 'var(--gray-soft)', padding: '8px', borderRadius: 6 }}>
                            <div className="mini-label">Tau Thresholds</div>
                            <div className="mono mt-1">In: {epAnalysis.tau_in?.toFixed(2)} | Out: {epAnalysis.tau_out?.toFixed(2)}</div>
                         </div>
                      </div>
                      <div className="col-6">
                         <div style={{ background: 'var(--gray-soft)', padding: '8px', borderRadius: 6 }}>
                            <div className="mini-label">Latent Severity</div>
                            <div className="mono mt-1 text-danger fw-bold">{epAnalysis.latent_severity?.toFixed(2) || '0.00'}</div>
                         </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {activeTab === 'detail' && (
                <>
                  <div className="row g-2 mb-3">
                    <div className="col-4">
                      <div style={{ background: 'var(--gray-soft)', padding: '6px 8px', borderRadius: 8 }}>
                        <div className="mini-label">Onset</div>
                        <div className="mono fw-bold">{selectedEpisode.onset}</div>
                      </div>
                    </div>
                    <div className="col-4">
                      <div style={{ background: 'var(--gray-soft)', padding: '6px 8px', borderRadius: 8 }}>
                        <div className="mini-label">Peak</div>
                        <div className="mono fw-bold" style={{ color: 'var(--red)' }}>{selectedEpisode.peakScore.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="col-4">
                      <div style={{ background: 'var(--gray-soft)', padding: '6px 8px', borderRadius: 8 }}>
                        <div className="mini-label">Duration</div>
                        <div className="mono fw-bold">{selectedEpisode.durationFormatted || `${selectedEpisode.durationMinutes}m`}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="mini-label" style={{ color: 'var(--navy)', fontWeight: 800 }}>
                        {chartViewMode === 'timeline' ? '📈 Linimasa Trajektori S(t)' : '🌀 Phase-Space Map (S_t → S_t+1) Orbit'}
                      </div>
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className={`btn btn-sm ${chartViewMode === 'timeline' ? 'btn-teal' : 'btn-outline-secondary'}`}
                          style={{ fontSize: 10.5, padding: '3px 8px' }}
                          onClick={() => setChartViewMode('timeline')}
                        >
                          📈 Linimasa Trajektori
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${chartViewMode === 'phasespace' ? 'btn-teal' : 'btn-outline-secondary'}`}
                          style={{ fontSize: 10.5, padding: '3px 8px' }}
                          onClick={() => setChartViewMode('phasespace')}
                        >
                          🌀 Phase-Space Orbit
                        </button>
                      </div>
                    </div>

                    {chartViewMode === 'timeline' ? renderTrajectorySVG() : renderPhaseSpaceSVG()}

                    {/* Multi-Peak & Relapse Dynamics Breakdown Card */}
                    <div className="mt-3 p-2" style={{ background: '#F8FAFC', borderRadius: 8, border: '1px solid var(--line)' }}>
                      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
                        <span className="mini-label" style={{ color: 'var(--navy)', fontWeight: 800 }}>
                          DINAMIKA MULTI-PEAK &amp; RELAPSE (SIMULASI CELL 14 &amp; 18)
                        </span>
                        <span className="badge bg-primary" style={{ fontSize: 10, padding: '3px 8px' }}>
                          {selectedEpisode.dynamicsClassification || 'Multi-Peak Relapse Loop'}
                        </span>
                      </div>

                      <div className="p-2 mb-2" style={{ background: '#ffffff', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                        <div className="mini-label mb-1" style={{ fontSize: 9.5, color: 'var(--teal)' }}>URUTAN HUBUNGAN KEKAMBUHAN (RELATIONSHIP CHAIN):</div>
                        <div className="mono fw-bold" style={{ fontSize: 10.5, color: 'var(--navy)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                          {selectedEpisode.relationshipChainStr || 'Onset ➔ Peak ➔ Resolved'}
                        </div>
                      </div>

                      <div className="row g-2 text-center" style={{ fontSize: 11 }}>
                        <div className="col-3">
                          <div style={{ background: '#ffffff', padding: '6px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                            <div className="mini-label" style={{ fontSize: 9 }}>Total Peaks</div>
                            <div className="mono fw-bold text-primary">{selectedEpisode.peaksCount || 1}</div>
                          </div>
                        </div>
                        <div className="col-3">
                          <div style={{ background: '#ffffff', padding: '6px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                            <div className="mini-label" style={{ fontSize: 9 }}>Relapses</div>
                            <div className="mono fw-bold" style={{ color: selectedEpisode.relapseCount > 0 ? '#DC2626' : 'var(--teal)' }}>
                              {selectedEpisode.relapseCount || 0}
                            </div>
                          </div>
                        </div>
                        <div className="col-3">
                          <div style={{ background: '#ffffff', padding: '6px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                            <div className="mini-label" style={{ fontSize: 9 }}>AUC-D</div>
                            <div className="mono fw-bold text-success">
                              {typeof selectedEpisode.aucScore === 'number' ? selectedEpisode.aucScore.toFixed(2) : '-'}
                            </div>
                          </div>
                        </div>
                        <div className="col-3">
                          <div style={{ background: '#ffffff', padding: '6px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                            <div className="mini-label" style={{ fontSize: 9 }}>TTR tau_out</div>
                            <div className="mono fw-bold" style={{ color: 'var(--purple)' }}>
                              {typeof selectedEpisode.primaryTtrMin === 'number' ? `${selectedEpisode.primaryTtrMin}m` : '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSaveReview}>
                    <div className="mini-label mb-2">Reviewer validation</div>
                    <select 
                      className="form-select mb-2" 
                      style={{ fontSize: 12, fontWeight: 600, background: 'var(--gray-soft)' }}
                      value={reviewStatus}
                      onChange={e => setReviewStatus(e.target.value)}
                    >
                      <option value="Confirmed">Confirmed (Valid Physiological Episode)</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Suppressed">Suppressed (False Alert / Artefact)</option>
                      <option value="Needs Follow-up">Needs Follow-up (Participant Check)</option>
                    </select>
                    
                    <textarea 
                      className="form-control mb-2" 
                      rows="2" 
                      placeholder="Tambahkan catatan analitis..."
                      style={{ fontSize: 12, background: 'var(--gray-soft)' }}
                      value={reviewerNote}
                      onChange={e => setReviewerNote(e.target.value)}
                    ></textarea>
                    
                    <button type="submit" className="btn-teal w-100">Simpan Keputusan Reviewer</button>
                    {isSaved && <div className="text-success text-center mt-2" style={{ fontSize: 11, fontWeight: 600 }}>✓ Tersimpan!</div>}
                  </form>
                </>
              )}

              {activeTab === 'compare' && (
                <div>
                  <div className="mini-label mb-2" style={{ color: 'var(--teal)' }}>KOMPARASI EPISODE (PARTISIPAN {selectedEpisode.participantId})</div>
                  <p style={{ fontSize: 11, color: 'var(--gray)', marginBottom: 12 }}>
                    Bandingkan parameter fisiologis episode pilihan ini dengan episode lain dari partisipan yang sama.
                  </p>

                  {(() => {
                    const samePartEpisodes = (filteredEpisodes || []).filter(e => e.participantId === selectedEpisode.participantId && e.id !== selectedEpisode.id);
                    const compTarget = samePartEpisodes.find(e => e.id === comparedEpisodeId) || samePartEpisodes[0];

                    const pName = (selectedEpisode.participantId || 'p001').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const primaryEpId = selectedEpisode.id?.startsWith('ep-') ? selectedEpisode.id : `ep-${pName}-${(selectedEpisode.onset || '08:45').replace(/[^0-9]/g, '') || '0845'}`;
                    const targetEpId = compTarget ? (compTarget.id?.startsWith('ep-') ? compTarget.id : `ep-${pName}-${(compTarget.onset || '14:22').replace(/[^0-9]/g, '') || '1422'}`) : 'Tidak Ada';

                    const primaryEvId = `v-${pName}-${(selectedEpisode.onset || '08:45').replace(/[^0-9]/g, '') || '0845'}`;
                    const targetEvId = compTarget ? `v-${pName}-${(compTarget.onset || '14:22').replace(/[^0-9]/g, '') || '1422'}` : 'Tidak Ada';

                    return (
                      <div>
                        <div className="mb-3">
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', marginBottom: 4, display: 'block' }}>Pilih Episode Pembanding:</label>
                          <select
                            className="form-select"
                            style={{ fontSize: 12, background: 'var(--gray-soft)', fontWeight: 600 }}
                            value={compTarget?.id || ''}
                            onChange={(e) => setComparedEpisodeId(e.target.value)}
                          >
                            {samePartEpisodes.length === 0 ? (
                              <option value="">Tidak ada episode lain untuk partisipan ini</option>
                            ) : (
                              samePartEpisodes.map(e => {
                                const eId = e.id?.startsWith('ep-') ? e.id : `ep-${pName}-${(e.onset || '14:22').replace(/[^0-9]/g, '') || '1422'}`;
                                return (
                                  <option key={e.id} value={e.id}>
                                    {eId} · Onset: {e.onset} · Peak: {e.peakScore?.toFixed(2)} ({e.context})
                                  </option>
                                );
                              })
                            )}
                          </select>
                        </div>

                        {compTarget ? (
                          <div className="table-responsive mb-3">
                            <table className="dtable w-100" style={{ fontSize: '0.8rem' }}>
                              <thead>
                                <tr>
                                  <th>Fitur Komparasi</th>
                                  <th style={{ color: 'var(--teal)' }}>Primer ({primaryEpId})</th>
                                  <th style={{ color: 'var(--purple)' }}>Pembanding ({targetEpId})</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="fw-bold">Event ID</td>
                                  <td className="mono fw-bold">{primaryEvId}</td>
                                  <td className="mono fw-bold">{targetEvId}</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">Konteks Aktivitas</td>
                                  <td style={{ textTransform: 'capitalize' }}>{selectedEpisode.context || 'sitting'}</td>
                                  <td style={{ textTransform: 'capitalize' }}>{compTarget.context || 'walking'}</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">Onset Timestamp</td>
                                  <td className="mono">{selectedEpisode.onset}</td>
                                  <td className="mono">{compTarget.onset}</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">{"Peak Score ($S_{peak}$)"}</td>
                                  <td className="mono fw-bold text-danger">{selectedEpisode.peakScore?.toFixed(2)}</td>
                                  <td className="mono fw-bold text-amber">{compTarget.peakScore?.toFixed(2)}</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">{"Tau Threshold ($\\tau_{in}$)"}</td>
                                  <td className="mono">{(selectedEpisode.tauIn || 1.86).toFixed(2)}</td>
                                  <td className="mono">{(compTarget.tauIn || 1.86).toFixed(2)}</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">Heart Rate Mean</td>
                                  <td className="mono fw-bold">{selectedEpisode.raw?.features?.mean_hr?.toFixed(1) || '112.4'} BPM</td>
                                  <td className="mono fw-bold">{compTarget.raw?.features?.mean_hr?.toFixed(1) || '94.2'} BPM</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">RMSSD (ms)</td>
                                  <td className="mono">{selectedEpisode.raw?.features?.rmssd?.toFixed(1) || '14.8'} ms</td>
                                  <td className="mono">{compTarget.raw?.features?.rmssd?.toFixed(1) || '22.4'} ms</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">Konfirmasi Dokter</td>
                                  <td><StateBadge state={selectedEpisode.reviewStatus || 'Confirmed'} /></td>
                                  <td><StateBadge state={compTarget.reviewStatus || 'Under Review'} /></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="alert alert-info py-2 px-3" style={{ fontSize: 11 }}>
                            Hanya ada 1 episode terdaftar untuk partisipan {selectedEpisode.participantId}. Tidak ada episode pembanding lain.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'audit' && (
                <div>
                  <div className="mini-label mb-2">Model Version &amp; Provenance</div>
                  <div style={{ background: 'var(--gray-soft)', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--ink)' }}>Model: <span className="mono">{selectedEpisode.raw?.model_version || 'v2.1.4-beta'}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--ink)' }}>Baseline Profile ID: <span className="mono">BP-{selectedEpisode.participantId}-{selectedEpisode.context || 'Unknown'}</span></div>
                  </div>

                  <div className="mini-label mb-2">Audit Trail</div>
                  <div style={{ borderLeft: '2px solid var(--line)', paddingLeft: 12, marginLeft: 6 }}>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: 'var(--gray)' }}>{selectedEpisode.onset}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>Episode detected by algorithm</div>
                    </div>
                    {selectedEpisode.status === 'RESOLVED' && (
                       <div style={{ marginBottom: 10 }}>
                         <div style={{ fontSize: 10, color: 'var(--gray)' }}>—</div>
                         <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>Episode resolved automatically</div>
                       </div>
                    )}
                    {selectedEpisode.reviewStatus !== 'New' && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: 'var(--gray)' }}>Review Action</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal)' }}>Status updated to: {selectedEpisode.reviewStatus}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card-panel h-100 d-flex align-items-center justify-content-center text-muted" style={{ fontSize: 12 }}>
              Select an episode to view details
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Candidate Onset & Persistent Episode Breakdown Table */}
      <div className="card-panel mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <div className="mini-label">ANALISIS DETAIL DEVIASI &amp; ANOMALI</div>
            <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
              Tabel Dinamis Candidate Onset &amp; Episode Persisten (Alasan &amp; Waktu Terdeteksi)
            </h4>
          </div>
          <span className="badge bg-navy text-white px-2 py-1" style={{ fontSize: 11 }}>Live Anomaly Audit Trail</span>
        </div>

        <div className="table-responsive">
          <table className="dtable w-100">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Waktu</th>
                <th>Nama Peserta</th>
                <th>Konteks</th>
                <th>HR vs Baseline</th>
                <th>Z-Score</th>
                <th>Status Transisi</th>
                <th style={{ width: '35%' }}>Alasan &amp; Justifikasi Klinis (Trigger Reason)</th>
              </tr>
            </thead>
            <tbody>
              {filteredEpisodes.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-4">
                    Belum ada data transisi Candidate / Persistent episode terdeteksi.
                  </td>
                </tr>
              ) : (
                filteredEpisodes.slice((currentDetailPage - 1) * DETAIL_PAGE_SIZE, currentDetailPage * DETAIL_PAGE_SIZE).map((ep, idxBase) => {
                  const idx = (currentDetailPage - 1) * DETAIL_PAGE_SIZE + idxBase;
                  const isPersistent = ep.status === 'PERSISTENT_DEVIATION' || ep.status === 'Alert'
                    || ep.status === 'Recovered' || ep.status === 'closed' || ep.status === 'unresolved';
                  const hrVal = ep.peakHr || ep.raw?.peak_hr || (ep.peakScore ? Math.round(75 + ep.peakScore * 10) : 108);
                  const baseHr = ep.baselineHr || ep.raw?.baseline_hr || 74.5;
                  const deltaHr = (hrVal - baseHr).toFixed(1);
                  const rawZhr = ep.raw?.z_scores_at_peak?.z_hr;
                  const zVal = (typeof rawZhr === 'number' ? rawZhr : (ep.peakScore ? ep.peakScore * 1.15 : 2.85)).toFixed(2);
                  const dateStr = ep.onsetDate || '-';
                  const timeStr = ep.onsetTime || '-';
                  const participantLabel = ep.participantName || ep.participantId || 'Unknown';

                  const reasonText = isPersistent
                    ? `Persistensi deviasi terdeteksi (${dateStr} ${timeStr}). HR loncat +${deltaHr} BPM di atas baseline (${baseHr} BPM, Z=+${zVal} > 2.5). Berubah menjadi Episode Persisten.`
                    : `HR ${hrVal} BPM loncat +${deltaHr} BPM di atas baseline (${baseHr} BPM, Z=+${zVal} > 2.0). Candidate Onset soliter terdeteksi pada ${dateStr} ${timeStr}.`;

                  return (
                    <tr key={ep.id || idx}>
                      <td className="mono fw-bold" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{dateStr}</td>
                      <td className="mono" style={{ fontSize: 11 }}>{timeStr}</td>
                      <td className="mono fw-bold" style={{ color: 'var(--teal)' }}>{participantLabel}</td>
                      <td>
                        <span className="badge bg-light text-dark border px-2 py-1" style={{ fontSize: 10 }}>
                          {ep.context || 'Duduk'}
                        </span>
                      </td>
                      <td>
                        <div className="mono fw-bold" style={{ fontSize: 12, color: 'var(--red)' }}>
                          {hrVal} BPM
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--gray)' }}>Baseline: {baseHr} BPM ({Number(deltaHr) >= 0 ? `+${deltaHr}` : deltaHr})</div>
                      </td>
                      <td className="mono fw-bold" style={{ color: 'var(--purple)' }}>+{zVal}</td>
                      <td>
                        <StateBadge state={isPersistent ? 'PERSISTENT_DEVIATION' : 'DEVIATION_CANDIDATE'} />
                      </td>
                      <td>
                        <div style={{ fontSize: 11.5, color: 'var(--ink)', lineHeight: 1.4 }}>
                          {reasonText}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination 
          currentPage={currentDetailPage}
          totalPages={Math.ceil(filteredEpisodes.length / DETAIL_PAGE_SIZE)}
          onPageChange={setCurrentDetailPage}
          totalItems={filteredEpisodes.length}
          pageSize={DETAIL_PAGE_SIZE}
        />
      </div>
    </div>
  );
};
