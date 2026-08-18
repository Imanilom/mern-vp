import React, { useState } from 'react';
import { EvidenceBadge } from '../components/common/EvidenceBadge';
import { Clock, Download, Sliders, Activity, Target, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

export const PredictionEvalView = () => {
  const [horizon, setHorizon] = useState('30 min');
  const [activeChartTab, setActiveChartTab] = useState('calibration'); // 'calibration' | 'roc'

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>W09 — Prediction Evaluation</div>
          <h1 className="page-title">Predicted vs Observed Outcome Calibration</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Membandingkan predicted vs observed next state pada level episode dan cohort. Kalibrasi diukur, bukan diasumsikan.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} color="var(--teal)" />
            <span>Horizon: <b>{horizon}</b></span>
          </div>

          <button className="btn-outline-navy" style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} />
            <span>Export Metrics</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="lbl">Brier Score</div>
          <div className="val" style={{ color: 'var(--teal)' }}>0.148</div>
          <div className="sub">Lower is better · n=64</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Log Loss</div>
          <div className="val" style={{ color: 'var(--blue)' }}>0.41</div>
          <div className="sub">Horizon: 30 min</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Model AUC</div>
          <div className="val" style={{ color: 'var(--purple)' }}>0.79</div>
          <div className="sub">Persistent vs Not Persistent</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Predictions Evaluated</div>
          <div className="val">64</div>
          <div className="sub">Resolved episodes only</div>
        </div>
      </div>

      {/* Row 2: Confusion Matrix & Calibration / ROC Curve Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20, marginBottom: 20 }}>
        {/* Left: Confusion Matrix */}
        <div className="card-panel">
          <div className="mini-label" style={{ marginBottom: 8 }}>Confusion Matrix — Predicted vs Observed ({horizon})</div>
          <div className="table-responsive">
            <table className="dtable" style={{ textAlign: 'center' }}>
              <thead>
                <tr>
                  <th></th>
                  <th style={{ color: 'var(--red)', fontWeight: 800 }}>Observed: Persistent</th>
                  <th style={{ color: 'var(--green)', fontWeight: 800 }}>Observed: Not Persistent</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'left', fontWeight: 800, color: 'var(--navy)' }}>Predicted: Persistent</td>
                  <td className="mono" style={{ background: 'var(--green-soft)', color: 'var(--green)', fontSize: 16, fontWeight: 800 }}>22</td>
                  <td className="mono" style={{ background: 'var(--red-soft)', color: 'var(--red)', fontSize: 16, fontWeight: 800 }}>6</td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'left', fontWeight: 800, color: 'var(--navy)' }}>Predicted: Not Persistent</td>
                  <td className="mono" style={{ background: 'var(--red-soft)', color: 'var(--red)', fontSize: 16, fontWeight: 800 }}>5</td>
                  <td className="mono" style={{ background: 'var(--green-soft)', color: 'var(--green)', fontSize: 16, fontWeight: 800 }}>31</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            Precision: <b style={{ color: 'var(--navy)' }}>0.79</b> · Recall: <b style={{ color: 'var(--navy)' }}>0.81</b> · Dihitung hanya dari episode resolved tanpa horizon leakage.
          </div>
        </div>

        {/* Right: Model Calibration & ROC Curve Chart with Grid Window & Light Theme */}
        <div className="card-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="mini-label">Prediction Evaluation Chart</div>

            {/* Chart Sub-Tab Switcher */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setActiveChartTab('calibration')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeChartTab === 'calibration' ? 'var(--teal)' : 'var(--gray-soft)',
                  color: activeChartTab === 'calibration' ? '#ffffff' : 'var(--navy)',
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: 'pointer'
                }}
              >
                Calibration Curve
              </button>
              <button
                onClick={() => setActiveChartTab('roc')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeChartTab === 'roc' ? 'var(--purple)' : 'var(--gray-soft)',
                  color: activeChartTab === 'roc' ? '#ffffff' : 'var(--navy)',
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: 'pointer'
                }}
              >
                ROC Curve (AUC 0.79)
              </button>
            </div>
          </div>

          {activeChartTab === 'calibration' ? (
            /* TAB 1: CALIBRATION CURVE */
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '16px 14px 12px 14px', border: '1px solid var(--line)', color: 'var(--ink)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray)', fontWeight: 700, marginBottom: 6 }}>
                <span>Y-AXIS: OBSERVED FREQUENCY (0.0 to 1.0)</span>
                <span>X-AXIS: PREDICTED PROBABILITY BINS (0.0 to 1.0)</span>
              </div>

              <svg viewBox="0 0 450 160" style={{ width: '100%', height: 160, overflow: 'visible' }}>
                {/* Vertical Window Gridlines (Bins) */}
                <line x1="45" y1="20" x2="45" y2="130" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
                <line x1="125" y1="20" x2="125" y2="130" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
                <line x1="205" y1="20" x2="205" y2="130" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
                <line x1="285" y1="20" x2="285" y2="130" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
                <line x1="365" y1="20" x2="365" y2="130" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
                <line x1="420" y1="20" x2="420" y2="130" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />

                {/* Horizontal Gridlines & Y-Ticks */}
                <line x1="45" y1="20" x2="420" y2="20" stroke="#E2E8F0" strokeDasharray="2 2" />
                <text x="38" y="23" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">1.0</text>

                <line x1="45" y1="47.5" x2="420" y2="47.5" stroke="#E2E8F0" strokeDasharray="2 2" />
                <text x="38" y="50.5" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">0.75</text>

                <line x1="45" y1="75" x2="420" y2="75" stroke="#E2E8F0" strokeDasharray="2 2" />
                <text x="38" y="78" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">0.50</text>

                <line x1="45" y1="102.5" x2="420" y2="102.5" stroke="#E2E8F0" strokeDasharray="2 2" />
                <text x="38" y="105.5" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">0.25</text>

                <line x1="45" y1="130" x2="420" y2="130" stroke="#94A3B8" strokeWidth="1.2" />
                <text x="38" y="133" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">0.0</text>

                {/* Dashed Reference Line: Perfect Calibration */}
                <line x1="45" y1="130" x2="420" y2="20" stroke="#94A3B8" strokeDasharray="4 4" strokeWidth="1.5" />

                {/* Model Calibration Line */}
                <path
                  d="M 45 130 L 125 110 L 205 78 L 285 45 L 365 30 L 420 22"
                  fill="none"
                  stroke="#167C80"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />

                {/* Points & Value Badges */}
                <circle cx="125" cy="110" r="4.5" fill="#167C80" />
                <circle cx="205" cy="78" r="4.5" fill="#167C80" />
                <circle cx="285" cy="45" r="4.5" fill="#167C80" />
                <circle cx="365" cy="30" r="4.5" fill="#167C80" />

                <text x="125" y="102" fill="#167C80" fontSize="8" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">0.18</text>
                <text x="205" y="70" fill="#167C80" fontSize="8" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">0.47</text>
                <text x="285" y="37" fill="#167C80" fontSize="8" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">0.77</text>
                <text x="365" y="22" fill="#167C80" fontSize="8" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">0.91</text>

                {/* X-Axis Ticks & Labels */}
                <text x="45" y="146" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">0.0</text>
                <text x="125" y="146" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">0.2</text>
                <text x="205" y="146" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">0.4</text>
                <text x="285" y="146" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">0.6</text>
                <text x="365" y="146" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">0.8</text>
                <text x="420" y="146" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">1.0</text>
              </svg>

              <div style={{ fontSize: 10.5, color: 'var(--gray)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)', textAlign: 'center' }}>
                <span style={{ color: '#94A3B8', fontWeight: 700 }}>-- Dashed Line</span> = Perfect Calibration. <span style={{ color: 'var(--teal)', fontWeight: 800 }}>— Teal Curve</span> = Measured model outputs.
              </div>
            </div>
          ) : (
            /* TAB 2: ROC CURVE */
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '16px 14px 12px 14px', border: '1px solid var(--line)', color: 'var(--ink)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray)', fontWeight: 700, marginBottom: 6 }}>
                <span>Y-AXIS: TRUE POSITIVE RATE (SENSITIVITY)</span>
                <span>X-AXIS: FALSE POSITIVE RATE (1-SPECIFICITY)</span>
              </div>

              <svg viewBox="0 0 450 160" style={{ width: '100%', height: 160, overflow: 'visible' }}>
                {/* Vertical Gridlines */}
                <line x1="45" y1="20" x2="45" y2="130" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
                <line x1="138" y1="20" x2="138" y2="130" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
                <line x1="232" y1="20" x2="232" y2="130" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
                <line x1="326" y1="20" x2="326" y2="130" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
                <line x1="420" y1="20" x2="420" y2="130" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />

                {/* Horizontal Gridlines */}
                <line x1="45" y1="20" x2="420" y2="20" stroke="#E2E8F0" strokeDasharray="2 2" />
                <text x="38" y="23" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">1.0</text>

                <line x1="45" y1="75" x2="420" y2="75" stroke="#E2E8F0" strokeDasharray="2 2" />
                <text x="38" y="78" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">0.5</text>

                <line x1="45" y1="130" x2="420" y2="130" stroke="#94A3B8" strokeWidth="1.2" />
                <text x="38" y="133" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">0.0</text>

                {/* Random Baseline Diagonal */}
                <line x1="45" y1="130" x2="420" y2="20" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1.5" />

                {/* ROC Curve Path */}
                <path
                  d="M 45 130 Q 100 40 232 30 T 420 20"
                  fill="none"
                  stroke="#6657B8"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />

                <circle cx="100" cy="40" r="4.5" fill="#6657B8" />
                <circle cx="232" cy="30" r="4.5" fill="#6657B8" />

                {/* X-Axis Ticks */}
                <text x="45" y="146" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">0.0</text>
                <text x="138" y="146" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">0.25</text>
                <text x="232" y="146" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">0.50</text>
                <text x="326" y="146" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">0.75</text>
                <text x="420" y="146" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">1.0</text>
              </svg>

              <div style={{ fontSize: 10.5, color: 'var(--gray)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)', textAlign: 'center' }}>
                Area Under Curve (<b style={{ color: 'var(--purple)' }}>Model AUC = 0.79</b>) · Persistent vs Non-Persistent threshold.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Predicted vs Observed Outcomes Table */}
      <div className="card-panel">
        <div className="mini-label" style={{ marginBottom: 10 }}>Recent Predicted vs Observed Outcomes</div>
        <div className="table-responsive">
          <table className="dtable">
            <thead>
              <tr>
                <th>Episode ID</th>
                <th>Predicted State (30m)</th>
                <th>Predicted Prob.</th>
                <th>Observed Outcome</th>
                <th>Validation Result</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono" style={{ fontWeight: 800 }}>EP-240530-02</td>
                <td><span className="chip-red" style={{ fontSize: 10.5, fontWeight: 800 }}>Persistent</span></td>
                <td className="mono" style={{ fontWeight: 800 }}>0.81</td>
                <td><span className="chip-red" style={{ fontSize: 10.5, fontWeight: 800 }}>Persistent</span></td>
                <td>
                  <span className="chip-green" style={{ fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={12} /> Correct
                  </span>
                </td>
              </tr>
              <tr>
                <td className="mono" style={{ fontWeight: 800 }}>EP-260808-07</td>
                <td><span className="chip-purple" style={{ fontSize: 10.5, fontWeight: 800 }}>Recovery</span></td>
                <td className="mono" style={{ fontWeight: 800 }}>0.66</td>
                <td><span className="chip-purple" style={{ fontSize: 10.5, fontWeight: 800 }}>Recovery</span></td>
                <td>
                  <span className="chip-green" style={{ fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={12} /> Correct
                  </span>
                </td>
              </tr>
              <tr>
                <td className="mono" style={{ fontWeight: 800 }}>EP-260808-08</td>
                <td><span className="chip-red" style={{ fontSize: 10.5, fontWeight: 800 }}>Persistent</span></td>
                <td className="mono" style={{ fontWeight: 800 }}>0.58</td>
                <td><span className="chip-purple" style={{ fontSize: 10.5, fontWeight: 800 }}>Recovery</span></td>
                <td>
                  <span className="chip-red" style={{ fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <XCircle size={12} /> Miss
                  </span>
                </td>
              </tr>
              <tr>
                <td className="mono" style={{ fontWeight: 800 }}>EP-240527-01</td>
                <td><span className="chip-amber" style={{ fontSize: 10.5, fontWeight: 800 }}>Candidate</span></td>
                <td className="mono" style={{ fontWeight: 800 }}>0.72</td>
                <td><span className="chip-green" style={{ fontSize: 10.5, fontWeight: 800 }}>Recovered</span></td>
                <td>
                  <span className="chip-red" style={{ fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <XCircle size={12} /> Miss
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
