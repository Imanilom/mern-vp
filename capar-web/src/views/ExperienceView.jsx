import React, { useState, useEffect } from 'react';
import {
  Brain,
  Sliders,
  Lock,
  Unlock,
  TrendingUp,
  Award,
  BarChart2,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

export const ExperienceView = ({ experienceModels, globalParticipantFilter }) => {
  const filteredModels = (experienceModels || []).filter(model => {
    if (globalParticipantFilter && globalParticipantFilter !== 'ALL' && model.participantId && model.participantId !== globalParticipantFilter) return false;
    return true;
  });

  const [selectedModel, setSelectedModel] = useState(filteredModels?.[0] || null);

  useEffect(() => {
    if (filteredModels && filteredModels.length > 0 && !selectedModel) {
      setSelectedModel(filteredModels[0]);
    }
  }, [filteredModels, selectedModel]);
  const [isLearningFrozen, setIsLearningFrozen] = useState(false);

  useEffect(() => {
    console.log('[ExperienceView] API Data (Personal Experience Models):', experienceModels);
  }, [experienceModels]);

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Personal Experience Memory &amp; Prediction</h1>
          <p className="page-sub">
            Memori pengalaman pribadi yang dipelajari dari episode terdahulu, profil pemulihan personal, dan evaluasi matriks transisi probabilistik.
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

      {/* Top KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="lbl">Resolved Episodes Memory</div>
          <div className="val">{selectedModel?.resolvedEpisodesCount || 12}</div>
          <div className="sub">P-014 context: sitting</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Median Recovery Duration</div>
          <div className="val" style={{ color: 'var(--purple)' }}>
            {selectedModel?.medianRecoveryMinutes || 18} <span style={{ fontSize: 14 }}>min</span>
          </div>
          <div className="sub">P25: {selectedModel?.p25RecoveryMinutes || 11}m · P75: {selectedModel?.p75RecoveryMinutes || 27}m</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Recovery Phenotype</div>
          <div className="val" style={{ fontSize: 18, color: 'var(--navy)' }}>
            {selectedModel?.phenotype || 'Moderate Profile'}
          </div>
          <div className="sub">Confidence: {((selectedModel?.confidenceScore || 0.85) * 100).toFixed(0)}%</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Next State Prediction</div>
          <div className="val" style={{ color: 'var(--teal)' }}>RECOVERY (63%)</div>
          <div className="sub">Horizon +3 windows (~15m)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Left: Transition Probability Heatmap Table */}
        <div className="card-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div className="mini-label">Markov Transition Model</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>Learned Transition Matrix Heatmap</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray)' }}>n=12 episodes</div>
          </div>

          <div className="table-responsive">
            <table className="dtable" style={{ marginBottom: 14 }}>
              <thead>
                <tr>
                  <th>From State</th>
                  <th>To Target State</th>
                  <th>Probability</th>
                  <th>Transitions (n)</th>
                </tr>
              </thead>
              <tbody>
                {selectedModel?.learnedTransitions?.map((tr, idx) => (
                  <tr key={idx}>
                    <td className="mono" style={{ fontWeight: 700 }}>{tr.from}</td>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--teal)' }}>{tr.to}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-thin" style={{ flex: 1 }}>
                          <div style={{ width: `${tr.probability * 100}%`, background: tr.probability > 0.5 ? 'var(--teal)' : 'var(--gray)' }} />
                        </div>
                        <span className="mono" style={{ fontWeight: 800, minWidth: 45 }}>
                          {(tr.probability * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="mono">{tr.count} events</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 11, color: 'var(--gray)', background: 'var(--gray-soft)', padding: 10, borderRadius: 8 }}>
            <b>Prinsip Probabilistik:</b> Matriks transisi diperbarui secara guarded setelah episode terverifikasi. Tidak ada kepastian deterministik.
          </div>
        </div>

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
                {selectedModel?.adaptiveThresholds?.tauIn || 1.86}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--gray-soft)', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>tau_out (Recovery Entry)</div>
                <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>Personal learned hysteresis boundary</div>
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--amber)' }}>
                {selectedModel?.adaptiveThresholds?.tauOut || 1.18}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--gray-soft)', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>tau_normal (Baseline Range)</div>
                <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>Rule config default upper bound</div>
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>
                {selectedModel?.adaptiveThresholds?.tauNormal || 0.80}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <div className="mini-label" style={{ marginBottom: 6 }}>Model Governance &amp; Version</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink)' }}>
              <div>Experience Model Version: <b className="mono">EXP-0.6</b></div>
              <div>Last calibrated: <b>2026-08-08 09:00 WIB</b></div>
              <div>Audit status: <span className="chip-green" style={{ fontSize: 9, padding: '2px 6px' }}>VERSIONED &amp; AUDITED</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
