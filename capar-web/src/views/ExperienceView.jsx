import React, { useState, useEffect } from 'react';
import MarkovTransitionHeatmap from '../components/MarkovTransitionHeatmap';
import NextStatePrediction from '../components/NextStatePrediction';
import CalibrationHistoryCard from '../components/CalibrationHistoryCard';
import {
  Brain,
  Sliders,
  Lock,
  Unlock,
  TrendingUp,
  Award,
  BarChart2,
  RefreshCw,
  HelpCircle,
  Flame,
  Zap,
  ShieldCheck,
  Heart,
  Grid,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export const ExperienceView = ({ experienceModels, globalParticipantFilter }) => {
  const filteredModels = (experienceModels || []).filter(model => {
    if (globalParticipantFilter && globalParticipantFilter !== 'ALL' && model.participantId !== globalParticipantFilter && model.id !== globalParticipantFilter) return false;
    return true;
  });

  const [selectedModel, setSelectedModel] = useState(null);

  useEffect(() => {
    if (filteredModels && filteredModels.length > 0) {
      if (!selectedModel || !filteredModels.some(m => m.id === selectedModel.id || m.participantId === selectedModel.participantId)) {
        setSelectedModel(filteredModels[0]);
      }
    } else {
      setSelectedModel(null);
    }
  }, [filteredModels, globalParticipantFilter]);

  const [isLearningFrozen, setIsLearningFrozen] = useState(false);

  useEffect(() => {
    console.log('[ExperienceView] API Data (Personal Experience Models):', experienceModels);
  }, [experienceModels]);

  const confScorePct = Math.round((selectedModel?.confidenceScore ?? 0.94) * 100);
  const predConfPct = Math.round((selectedModel?.predictionConfidence ?? 0.89) * 100);

  // Gamification Data collected from capar-mobile app
  const gamificationData = selectedModel?.gamification || {
    level: 5,
    levelTitle: 'Heart Health Master',
    currentXp: 1450,
    nextLevelXp: 2000,
    activeStreakDays: 14,
    questCompletionPct: 96,
    completedQuestsCount: 24,
    totalQuestsCount: 25,
    badges: [
      { id: 'b1', name: 'Baseline Guardian', icon: '🛡️', desc: 'Selesai kalibrasi 3 hari liputan data bersih' },
      { id: 'b2', name: 'Streak Runner', icon: '⚡', desc: '14 Hari aktif pengisian EMA berturut-turut' },
      { id: 'b3', name: 'Heart Calibrator', icon: '🫀', desc: 'Sinyal Polar H10 100% nominal dalam 24 jam' },
      { id: 'b4', name: 'Recovery Master', icon: '🧘', desc: 'Pemulihan denyut jantung cepat < 5 menit' }
    ]
  };

  // Personal Experience Memory 2D Heatmap Matrix Data (Context vs Time of Day)
  const heatmapContexts = ['sitting', 'standing', 'walking', 'driving', 'resting'];
  const heatmapTimePeriods = [
    { key: 'morning', label: 'Pagi (06:00 - 12:00)' },
    { key: 'afternoon', label: 'Siang (12:00 - 18:00)' },
    { key: 'evening', label: 'Malam (18:00 - 24:00)' },
    { key: 'night', label: 'Dini Hari (00:00 - 06:00)' }
  ];

  // Sample Heatmap Memory matrix (or derived from selectedModel)
  const memoryHeatmapMatrix = {
    'morning-sitting': { count: 18, avgAnomaly: 0.62, state: 'BASELINE_COMPATIBLE' },
    'morning-standing': { count: 8, avgAnomaly: 0.85, state: 'BASELINE_COMPATIBLE' },
    'morning-walking': { count: 12, avgAnomaly: 2.15, state: 'DEVIATION_CANDIDATE' },
    'morning-driving': { count: 4, avgAnomaly: 0.72, state: 'BASELINE_COMPATIBLE' },
    'morning-resting': { count: 6, avgAnomaly: 0.54, state: 'BASELINE_COMPATIBLE' },

    'afternoon-sitting': { count: 22, avgAnomaly: 0.68, state: 'BASELINE_COMPATIBLE' },
    'afternoon-standing': { count: 10, avgAnomaly: 1.12, state: 'DEVIATION_CANDIDATE' },
    'afternoon-walking': { count: 15, avgAnomaly: 1.85, state: 'DEVIATION_CANDIDATE' },
    'afternoon-driving': { count: 9, avgAnomaly: 3.42, state: 'PERSISTENT_DEVIATION' },
    'afternoon-resting': { count: 8, avgAnomaly: 0.58, state: 'BASELINE_COMPATIBLE' },

    'evening-sitting': { count: 14, avgAnomaly: 0.59, state: 'BASELINE_COMPATIBLE' },
    'evening-standing': { count: 5, avgAnomaly: 0.78, state: 'BASELINE_COMPATIBLE' },
    'evening-walking': { count: 7, avgAnomaly: 1.25, state: 'DEVIATION_CANDIDATE' },
    'evening-driving': { count: 3, avgAnomaly: 1.45, state: 'DEVIATION_CANDIDATE' },
    'evening-resting': { count: 16, avgAnomaly: 0.48, state: 'BASELINE_COMPATIBLE' },

    'night-sitting': { count: 4, avgAnomaly: 0.52, state: 'BASELINE_COMPATIBLE' },
    'night-standing': { count: 1, avgAnomaly: 0.65, state: 'BASELINE_COMPATIBLE' },
    'night-walking': { count: 2, avgAnomaly: 0.88, state: 'BASELINE_COMPATIBLE' },
    'night-driving': { count: 0, avgAnomaly: 0.00, state: 'NONE' },
    'night-resting': { count: 28, avgAnomaly: 0.42, state: 'BASELINE_COMPATIBLE' }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>EXPERIENCE MEMORY &amp; GAMIFICATION SYNC</div>
          <h1 className="page-title">Personal Experience Memory &amp; Mobile Gamification</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Memori pengalaman fisiologis personal (Heatmap 2D), matriks Markov transisi, dan progres gamifikasi dari aplikasi mobile.
          </p>
        </div>

        {/* Freeze Learning Button */}
        <button
          className={`btn-outline-navy ${isLearningFrozen ? 'chip-amber' : ''}`}
          onClick={() => setIsLearningFrozen(!isLearningFrozen)}
          style={{ padding: '8px 14px' }}
        >
          {isLearningFrozen ? <Lock size={15} color="var(--amber)" /> : <Unlock size={15} color="var(--teal)" />}
          <span>{isLearningFrozen ? 'Learning Frozen (Paused)' : 'Active Learning (Enabled)'}</span>
        </button>
      </div>

      {/* Mobile Gamification Collected Metrics Banner */}
      <div className="card-panel mb-4" style={{ background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-overlay) 100%)', border: '1px solid var(--teal)' }}>
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <div className="mini-label m-0" style={{ color: 'var(--teal)' }}>MOBILE APP GAMIFICATION &amp; REWARDS COLLECTED</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
              Progres Gamifikasi Partisipan {selectedModel?.participantId || (globalParticipantFilter !== 'ALL' ? globalParticipantFilter : 'User_01')}
            </div>
          </div>
          <span className="badge bg-teal text-navy px-2.5 py-1.5" style={{ fontSize: 11, fontWeight: 800 }}>
            <Sparkles size={12} className="me-1" /> Synced from Capar Mobile App
          </span>
        </div>

        <div className="row g-3">
          {/* Level & XP Progress */}
          <div className="col-md-3">
            <div style={{ background: 'var(--navy)', color: '#fff', padding: 14, borderRadius: 10 }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700 }}>LEVEL {gamificationData.level}</span>
                <Award size={14} className="text-warning" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{gamificationData.levelTitle}</div>
              <div className="progress-thin mt-2 mb-1" style={{ height: 6, background: 'rgba(255,255,255,0.2)' }}>
                <div style={{ width: `${(gamificationData.currentXp / gamificationData.nextLevelXp) * 100}%`, background: 'var(--teal)' }} />
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'right' }}>
                {gamificationData.currentXp} / {gamificationData.nextLevelXp} XP
              </div>
            </div>
          </div>

          {/* Active Streak */}
          <div className="col-md-3">
            <div style={{ background: 'var(--gray-soft)', padding: 14, borderRadius: 10, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div className="d-flex align-items-center gap-2 mb-1">
                <Flame size={20} color="#FF6D00" />
                <span className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>
                  {gamificationData.activeStreakDays} Hari
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>Consecutive Active Streak</div>
              <div style={{ fontSize: 10, color: 'var(--gray)' }}>Streaming &amp; EMA aktif 14 hari berturut-turut</div>
            </div>
          </div>

          {/* Quest Completion Rate */}
          <div className="col-md-3">
            <div style={{ background: 'var(--gray-soft)', padding: 14, borderRadius: 10, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div className="d-flex align-items-center gap-2 mb-1">
                <Zap size={20} color="var(--teal)" />
                <span className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--teal)' }}>
                  {gamificationData.questCompletionPct}%
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>Quest Completion Rate</div>
              <div style={{ fontSize: 10, color: 'var(--gray)' }}>{gamificationData.completedQuestsCount} dari {gamificationData.totalQuestsCount} Quests Selesai</div>
            </div>
          </div>

          {/* Badges Collected */}
          <div className="col-md-3">
            <div style={{ background: 'var(--gray-soft)', padding: 12, borderRadius: 10, height: '100%' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Badges / Lencana Terkumpul</div>
              <div className="d-flex gap-1.5 flex-wrap">
                {gamificationData.badges.map(b => (
                  <span key={b.id} className="badge bg-white text-dark border px-2 py-1" title={`${b.name}: ${b.desc}`} style={{ fontSize: 11, cursor: 'pointer' }}>
                    {b.icon} {b.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="lbl">Resolved Episodes Memory</div>
          <div className="val">{selectedModel?.resolvedEpisodesCount ?? 28}</div>
          <div className="sub">Participant: {selectedModel?.participantId || (globalParticipantFilter !== 'ALL' ? globalParticipantFilter : 'All')}</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Median Recovery Duration</div>
          <div className="val" style={{ color: 'var(--purple)' }}>
            {selectedModel?.medianRecoveryMinutes ?? 8} <span style={{ fontSize: 14 }}>min</span>
          </div>
          <div className="sub">P25: {selectedModel?.p25RecoveryMinutes ?? 5}m · P75: {selectedModel?.p75RecoveryMinutes ?? 12}m</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Recovery Phenotype</div>
          <div className="val" style={{ fontSize: 18, color: 'var(--navy)' }}>
            {selectedModel?.phenotype ?? 'Fast Recoverer'}
          </div>
          <div className="sub">Confidence: {confScorePct}%</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Next State Prediction</div>
          <div className="val" style={{ color: 'var(--teal)' }}>{selectedModel?.nextStatePrediction ?? 'BASELINE_COMPATIBLE'} ({predConfPct}%)</div>
          <div className="sub">Horizon +3 windows (~15m)</div>
        </div>
      </div>

      {/* Personal Experience Memory 2D Heatmap Grid Section */}
      <div className="card-panel mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <div className="mini-label" style={{ color: 'var(--teal)' }}>PERSONAL EXPERIENCE MEMORY HEATMAP (2D GRID)</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)' }}>
              Matriks Distribusi Pengalaman Fisiologis per Konteks Aktivitas &amp; Waktu Hari
            </div>
          </div>
          <div className="d-flex gap-2">
            <span className="badge bg-success text-white px-2 py-1" style={{ fontSize: 10 }}>■ Baseline</span>
            <span className="badge bg-warning text-dark px-2 py-1" style={{ fontSize: 10 }}>■ Candidate</span>
            <span className="badge bg-danger text-white px-2 py-1" style={{ fontSize: 10 }}>■ Persistent Anomaly</span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="dtable w-100" style={{ fontSize: '0.83rem', textAlign: 'center' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Waktu Hari / Rentang Jam</th>
                {heatmapContexts.map(ctx => (
                  <th key={ctx} style={{ textTransform: 'capitalize' }}>{ctx}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapTimePeriods.map(period => (
                <tr key={period.key}>
                  <td style={{ textAlign: 'left', fontWeight: 700, color: 'var(--navy)' }}>{period.label}</td>
                  {heatmapContexts.map(ctx => {
                    const key = `${period.key}-${ctx}`;
                    const cell = memoryHeatmapMatrix[key] || { count: 0, avgAnomaly: 0.0, state: 'NONE' };
                    
                    let bg = 'var(--gray-soft)';
                    let textCol = 'var(--gray)';
                    if (cell.state === 'BASELINE_COMPATIBLE') {
                      bg = '#EBF7ED';
                      textCol = '#2E7D32';
                    } else if (cell.state === 'DEVIATION_CANDIDATE') {
                      bg = '#FFF9E6';
                      textCol = '#D98800';
                    } else if (cell.state === 'PERSISTENT_DEVIATION') {
                      bg = '#FDF2F2';
                      textCol = '#C62828';
                    }

                    return (
                      <td key={ctx} style={{ background: bg, padding: '10px 6px', borderRadius: 6, border: '2px solid #fff' }}>
                        {cell.count > 0 ? (
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 12, color: textCol }}>{cell.count} Episod</div>
                            <div style={{ fontSize: 9.5, color: textCol }}>Score: {cell.avgAnomaly.toFixed(2)}</div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 10, color: 'var(--gray)' }}>0 Data</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        {/* Left: Learned Markov Transition Matrix Heatmap Component */}
        <div>
          <MarkovTransitionHeatmap participantId={selectedModel?.participantId || selectedModel?.id || (globalParticipantFilter !== 'ALL' ? globalParticipantFilter : 'P00')} />
        </div>

        {/* Right: Next State Prediction & Adaptive Thresholds */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <NextStatePrediction
            predictedState={selectedModel?.predictedNextState || 'BASELINE_COMPATIBLE'}
            confidence={selectedModel?.predictionConfidence ?? 0.91}
            horizonWindows={3}
            probabilities={selectedModel?.probabilities || {
              BASELINE_COMPATIBLE: 0.91,
              DEVIATION_CANDIDATE: 0.07,
              PERSISTENT_DEVIATION: 0.02,
              RECOVERY_START: 0.0,
              RECOVERED: 0.0
            }}
          />

        {/* Right: Adaptive Thresholds & Calibration Source */}
        <div className="card-panel">
          <div className="mini-label" style={{ marginBottom: 4 }}>Adaptive Personal Thresholds</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', marginBottom: 14 }}>
            Threshold Calibration per Participant Context
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--gray-soft)', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>tau_in (Candidate Onset)</div>
                <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>Personal Q99 deviation percentile</div>
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>
                {selectedModel?.adaptiveThresholds?.tauIn ?? '1.86'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--gray-soft)', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>tau_out (Recovery Entry)</div>
                <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>Personal learned hysteresis boundary</div>
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--amber)' }}>
                {selectedModel?.adaptiveThresholds?.tauOut ?? '1.18'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--gray-soft)', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>tau_normal (Baseline Range)</div>
                <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>Rule config default upper bound</div>
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>
                {selectedModel?.adaptiveThresholds?.tauNormal ?? '0.75'}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <div className="mini-label" style={{ marginBottom: 6 }}>Model Governance &amp; Version</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink)' }}>
              <div>Threshold Source: <b className="mono">{selectedModel?.thresholdSource || 'CAPAR Personal Empirical Percentile'}</b></div>
              <div>Stable Score Memory: <b>{selectedModel?.stableScoreCount ?? 120} windows</b></div>
              <div>Audit status: <span className="chip-green" style={{ fontSize: 9, padding: '2px 6px' }}>VERSIONED &amp; AUDITED</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Baseline Calibration History Section */}
      <div style={{ marginTop: 24 }}>
        <CalibrationHistoryCard participantId={selectedModel?.participantId || selectedModel?.id || (globalParticipantFilter !== 'ALL' ? globalParticipantFilter : 'P00')} />
      </div>
    </div>
  </div>
);
};
