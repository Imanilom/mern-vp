import React, { useState } from 'react';
import { EvidenceBadge } from '../components/common/EvidenceBadge';
import { StateBadge } from '../components/common/StateBadge';
import {
  Sliders,
  RotateCcw,
  Lock,
  ShieldCheck,
  Info,
  TrendingUp,
  Zap,
  Activity,
  Layers,
  CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend
} from 'recharts';

// Cold Start Baseline Static Dataset
const coldStartChartData = [
  { n: 0, timeMin: 0, penalty: 0.50, uncertainty: 100, weight: 50, stage: 'Cold Start' },
  { n: 5, timeMin: 10, penalty: 0.50, uncertainty: 82, weight: 50, stage: 'Cold Start' },
  { n: 10, timeMin: 20, penalty: 0.50, uncertainty: 68, weight: 50, stage: 'Cold Start' },
  { n: 15, timeMin: 30, penalty: 0.70, uncertainty: 52, weight: 70, stage: 'Provisional' },
  { n: 20, timeMin: 40, penalty: 0.70, uncertainty: 42, weight: 70, stage: 'Provisional' },
  { n: 25, timeMin: 50, penalty: 0.70, uncertainty: 34, weight: 70, stage: 'Provisional' },
  { n: 30, timeMin: 60, penalty: 0.85, uncertainty: 25, weight: 85, stage: 'Maturing' },
  { n: 35, timeMin: 70, penalty: 0.85, uncertainty: 20, weight: 85, stage: 'Maturing' },
  { n: 40, timeMin: 80, penalty: 0.85, uncertainty: 15, weight: 85, stage: 'Maturing' },
  { n: 45, timeMin: 90, penalty: 0.85, uncertainty: 11, weight: 85, stage: 'Maturing' },
  { n: 50, timeMin: 100, penalty: 1.00, uncertainty: 5, weight: 100, stage: 'Mature' },
];

const CustomColdStartTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const stageColors = {
      'Cold Start': '#d48806',
      'Provisional': '#0958d9',
      'Maturing': '#531dab',
      'Mature': '#389e0d'
    };
    return (
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--line)',
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        fontSize: 12
      }}>
        <div style={{ fontWeight: 800, color: 'var(--navy)', marginBottom: 4 }}>
          Segment N = {data.n} ({data.timeMin} mins)
        </div>
        <div style={{ marginBottom: 6 }}>
          <span style={{
            background: stageColors[data.stage] || '#64748b',
            color: '#fff',
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 700
          }}>
            Fase: {data.stage}
          </span>
        </div>
        <div style={{ color: '#2563eb', fontWeight: 600 }}>
          Penalty Multiplier: {data.penalty.toFixed(2)}x
        </div>
        <div style={{ color: '#059669', fontWeight: 600 }}>
          Effective Weight: {data.weight}%
        </div>
        <div style={{ color: '#d97706', fontWeight: 600 }}>
          Variance Uncertainty: {data.uncertainty}%
        </div>
      </div>
    );
  }
  return null;
};

export const ModelRulesView = ({ modelConfig }) => {
  // Simulator State (Read-only Visualization)
  const [synthScore, setSynthScore] = useState(2.64);
  const [synthWindows, setSynthWindows] = useState(4);
  const [synthQuality, setSynthQuality] = useState(0.94);
  const [synthContextConf, setSynthContextConf] = useState(0.91);

  // Fixed System Parameters (Locked & Read-only)
  const fixedParameters = [
    { key: 'tau_in', activeValue: '1.86', source: 'Personal Empirical Q99 Percentile', guardrail: 'Fixed [1.50 - 2.50]' },
    { key: 'tau_out', activeValue: '1.18', source: 'Personal Hysteresis Boundary', guardrail: 'Fixed [1.00 - 1.40]' },
    { key: 'tau_normal', activeValue: '0.75', source: 'Rule Config Upper Bound', guardrail: 'Fixed [0.50 - 0.90]' },
    { key: 'k_persistence', activeValue: '3 windows (15 min)', source: 'CAPAR Persistence Rule', guardrail: 'Fixed k=3/4' },
    { key: 'Q_signal_min', activeValue: '0.70 (70%)', source: 'Quality Gate Rule', guardrail: 'Fixed >= 70%' },
    { key: 'Q_context_min', activeValue: '0.60 (60%)', source: 'Context Confidence Gate', guardrail: 'Fixed >= 60%' },
    { key: 'alpha_smoothing', activeValue: '0.50', source: 'Dirichlet Markov Prior', guardrail: 'Fixed alpha=0.5' },
  ];

  const parameters = modelConfig?.parameters || fixedParameters;

  // Active fixed parameter values
  const tauIn = 1.86;
  const tauOut = 1.18;
  const tauNormal = 0.75;

  // Live State Machine Evaluator Logic
  let calculatedEvidenceState = "EVALUABLE";
  if (synthQuality < 0.70) {
    calculatedEvidenceState = "QUALITY_WARNING";
  } else if (synthContextConf < 0.60) {
    calculatedEvidenceState = "UNCERTAIN_CONTEXT";
  }

  let calculatedPhysiologicalState = "BASELINE_COMPATIBLE";
  let explanationText = "";

  if (calculatedEvidenceState !== "EVALUABLE") {
    calculatedPhysiologicalState = "BASELINE_COMPATIBLE (PAUSED)";
    explanationText = "Evidence readiness gate tidak terpenuhi. Evaluasi state fisiologis di-pause untuk mencegah false positive.";
  } else {
    if (synthScore >= tauIn) {
      if (synthWindows < 3) {
        calculatedPhysiologicalState = "DEVIATION_CANDIDATE";
        explanationText = `Skor ${synthScore.toFixed(2)} >= tau_in (${tauIn}), tetapi belum mencapai k=3 window persistensi.`;
      } else {
        calculatedPhysiologicalState = "PERSISTENT_DEVIATION";
        explanationText = `Skor ${synthScore.toFixed(2)} >= tau_in (${tauIn}) bertahan ${synthWindows} window (>= k=3/4). Candidate dikonfirmasi sebagai persistent deviation.`;
      }
    } else if (synthScore < tauOut && synthScore > tauNormal) {
      calculatedPhysiologicalState = "RECOVERY_START";
      explanationText = `Skor ${synthScore.toFixed(2)} telah turun di bawah tau_out (${tauOut}). Trajectory memasuki fase recovery.`;
    } else if (synthScore <= tauNormal) {
      calculatedPhysiologicalState = "RECOVERED";
      explanationText = `Skor ${synthScore.toFixed(2)} <= tau_normal (${tauNormal}). State kembali stabil terhadap baseline personal.`;
    } else {
      calculatedPhysiologicalState = "BASELINE_COMPATIBLE";
      explanationText = `Skor ${synthScore.toFixed(2)} berada dalam batas baseline personal yang diharapkan.`;
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16 }}>
        <div className="mini-label" style={{ color: 'var(--teal)' }}>SYSTEM GOVERNANCE RULES</div>
        <h1 className="page-title">Model &amp; Rules Governance</h1>
        <p className="page-sub">
          Parameter aturan model, guardrail, dan ambang batas (thresholds) terpasang tetap (fixed system constants) dan terkunci untuk menjamin konsistensi evaluasi.
        </p>
      </div>

      {/* Locked System Banner */}
      <div style={{
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: 12,
        padding: '12px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12.5,
        color: '#166534'
      }}>
        <Lock size={20} color="#16a34a" />
        <div>
          <b>LOCKED SYSTEM GOVERNANCE (READ-ONLY):</b> Seluruh parameter aturan model, threshold {"($\\tau_{in}, \\tau_{out}, \\tau_{normal}$)"}, dan aturan FSM bersifat <b>tetap (fixed constants)</b> dan tidak dapat diubah dari konsol demi menjaga validitas dan auditibilitas klinis.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Left: Fixed Active Parameters Table */}
        <div className="card-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div className="mini-label">Active Rule Configuration (Fixed)</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>
                Rule Version: {modelConfig?.activeVersion || 'SR-1.4 (Locked)'}
              </div>
            </div>
            <span className="chip-green" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={12} /> LOCKED IN PROD
            </span>
          </div>

          <div className="table-responsive">
            <table className="dtable" style={{ marginBottom: 14 }}>
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Fixed Value</th>
                  <th>Calibration Source</th>
                  <th>Guardrail Boundary</th>
                </tr>
              </thead>
              <tbody>
                {parameters.map((p) => (
                  <tr key={p.key}>
                    <td className="mono" style={{ fontWeight: 700 }}>{p.key}</td>
                    <td className="mono" style={{ fontWeight: 800, color: 'var(--teal)' }}>{p.activeValue}</td>
                    <td style={{ fontSize: 11 }}>{p.source}</td>
                    <td className="mono" style={{ fontSize: 10.5, color: 'var(--gray)' }}>{p.guardrail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: 'var(--gray-soft)', padding: 10, borderRadius: 8, fontSize: 11, color: 'var(--gray)' }}>
            <Info size={14} className="me-1" style={{ color: 'var(--teal)' }} />
            Parameter aturan di atas terkunci secara permanen pada versi produksi `SR-1.4`.
          </div>
        </div>

        {/* Right: Version & Governance Control History */}
        <div className="card-panel">
          <div className="mini-label" style={{ marginBottom: 4 }}>System Audit &amp; Version Log</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', marginBottom: 14 }}>
            Governance Version History
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { version: 'SR-1.4', status: 'ACTIVE (LOCKED)', date: '18 Aug 2026', author: 'CAPAR Governance Board', note: 'Empirical percentiles Q99 & Dirichlet alpha=0.5' },
              { version: 'SR-1.3', status: 'ARCHIVED', date: '01 Jul 2026', author: 'CAPAR Governance Board', note: 'Baseline hysteresis calibration' },
              { version: 'SR-1.0', status: 'ARCHIVED', date: '01 Jan 2026', author: 'CAPAR Core Engine', note: 'Initial FSM Rule release' }
            ].map((v) => (
              <div
                key={v.version}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: v.status.includes('ACTIVE') ? '#f0fdf4' : 'var(--gray-soft)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ fontWeight: 800, fontSize: 13, color: 'var(--navy)' }}>{v.version}</span>
                    <span className={`badge-soft ${v.status.includes('ACTIVE') ? 'chip-green' : 'chip-neutral'}`} style={{ fontSize: 9 }}>
                      {v.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 2 }}>
                    Activated: {v.date} · <b>{v.author}</b>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink)', marginTop: 2 }}>
                    {v.note}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cold Start Baseline Static Graph Panel */}
      <div className="card-panel" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={16} />
              </div>
              <div className="mini-label" style={{ color: '#2563eb', margin: 0 }}>BASELINE MATURITY REGIME</div>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: '4px 0 2px 0' }}>
              Cold-Start Baseline Dynamics &amp; Weight Scaling Rule
            </h3>
            <p style={{ fontSize: 12, color: 'var(--gray)', margin: 0 }}>
              Aturan evolusi bobot penalti Z-score (<span className="mono" style={{ fontWeight: 700 }}>0.50x → 1.00x</span>) dan penurunan ketidakpastian varians baseline seiring bertambahnya akumulasi window (<span className="mono">N</span>).
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: '#fffbe6', border: '1px solid #ffe58f', color: '#d48806', fontWeight: 700 }}>
              Cold Start (N &lt; 15): 0.50x
            </span>
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: '#e6f7ff', border: '1px solid #91caff', color: '#0958d9', fontWeight: 700 }}>
              Provisional (N ≥ 15): 0.70x
            </span>
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: '#f9f0ff', border: '1px solid #d3adf7', color: '#531dab', fontWeight: 700 }}>
              Maturing (N ≥ 30): 0.85x
            </span>
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: '#f6ffed', border: '1px solid #b7eb8f', color: '#389e0d', fontWeight: 700 }}>
              Mature (N ≥ 50): 1.00x
            </span>
          </div>
        </div>

        {/* Recharts ComposedChart */}
        <div style={{ width: '100%', height: 280, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={coldStartChartData} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <defs>
                <linearGradient id="colorUncertainty" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.6} />
              <XAxis
                dataKey="n"
                tick={{ fontSize: 11, fill: 'var(--gray)' }}
                label={{ value: 'Jumlah Window Segmentasi (N)', position: 'insideBottom', offset: -12, fontSize: 11, fill: 'var(--navy)' }}
              />
              <YAxis
                yAxisId="left"
                domain={[0, 1.2]}
                ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2]}
                tick={{ fontSize: 11, fill: 'var(--gray)' }}
                label={{ value: 'Penalty Factor (x)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#2563eb' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: 'var(--gray)' }}
                label={{ value: 'Persentase (%)', angle: 90, position: 'insideRight', offset: 10, fontSize: 11, fill: '#d97706' }}
              />
              <Tooltip content={<CustomColdStartTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />

              <ReferenceLine yAxisId="left" x={15} stroke="#0958d9" strokeDasharray="4 4" label={{ value: 'N=15 (Provisional)', position: 'top', fill: '#0958d9', fontSize: 10, fontWeight: 700 }} />
              <ReferenceLine yAxisId="left" x={30} stroke="#531dab" strokeDasharray="4 4" label={{ value: 'N=30 (Maturing)', position: 'top', fill: '#531dab', fontSize: 10, fontWeight: 700 }} />
              <ReferenceLine yAxisId="left" x={50} stroke="#389e0d" strokeDasharray="4 4" label={{ value: 'N=50 (Mature Lock)', position: 'top', fill: '#389e0d', fontSize: 10, fontWeight: 700 }} />

              <Area
                yAxisId="right"
                type="monotone"
                dataKey="uncertainty"
                name="Variance Uncertainty (%)"
                fill="url(#colorUncertainty)"
                stroke="#f59e0b"
                strokeWidth={2}
              />
              <Line
                yAxisId="left"
                type="stepAfter"
                dataKey="penalty"
                name="Penalty Factor Multiplier (0.50x - 1.00x)"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 4, fill: '#2563eb' }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="weight"
                name="Effective Baseline Weight (%)"
                stroke="#059669"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3, fill: '#059669' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Clinical Rationale Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12, marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <div style={{ background: '#fffbe6', padding: 10, borderRadius: 8, border: '1px solid #ffe58f' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#d48806', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={12} /> Cold Start Stage (N &lt; 15)
            </div>
            <div style={{ fontSize: 10.5, color: '#595959', lineHeight: 1.35 }}>
              Penalty <b>0.50x</b> meredam false positive Z-score awal saat distribusi personal belum terkelola penuh.
            </div>
          </div>

          <div style={{ background: '#e6f7ff', padding: 10, borderRadius: 8, border: '1px solid #91caff' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0958d9', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Activity size={12} /> Provisional Gate (N ≥ 15)
            </div>
            <div style={{ fontSize: 10.5, color: '#595959', lineHeight: 1.35 }}>
              Bobot naik ke <b>0.70x</b> (30+ menit data). Live monitoring FSM aktif dengan penyaringan outlier robust.
            </div>
          </div>

          <div style={{ background: '#f9f0ff', padding: 10, borderRadius: 8, border: '1px solid #d3adf7' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#531dab', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Layers size={12} /> Maturing Phase (N ≥ 30)
            </div>
            <div style={{ fontSize: 10.5, color: '#595959', lineHeight: 1.35 }}>
              Bobot naik ke <b>0.85x</b> (60+ menit data). Evaluasi variansi antar-hari &amp; kestabilan sinyal diuji.
            </div>
          </div>

          <div style={{ background: '#f6ffed', padding: 10, borderRadius: 8, border: '1px solid #b7eb8f' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#389e0d', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={12} /> Mature Lock (N ≥ 50 / 2 Days)
            </div>
            <div style={{ fontSize: 10.5, color: '#595959', lineHeight: 1.35 }}>
              Sensitivitas penuh <b>1.00x</b> dibuka. Model dikunci (frozen) untuk evaluasi produksi klinis yang stabil.
            </div>
          </div>
        </div>
      </div>

      {/* Interactive What-If Simulator Panel (Read-only Visualization) */}
      <div className="card-panel" style={{ background: '#FAFBFD', border: '1.5px solid var(--teal)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--teal)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sliders size={18} />
          </div>
          <div>
            <div className="mini-label" style={{ color: 'var(--teal)' }}>Interactive Sandbox</div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
              What-If State Machine Visualizer (Fixed Rules)
            </h3>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 24 }}>
          {/* Sliders Input Controls */}
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                <span>Synthetic Anomaly Score</span>
                <span className="mono" style={{ color: 'var(--teal)', fontSize: 14 }}>{synthScore.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="4.0"
                step="0.05"
                value={synthScore}
                onChange={(e) => setSynthScore(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--teal)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--gray)' }}>
                <span>0.0 (Normal)</span>
                <span>tau_normal (0.75)</span>
                <span>tau_out (1.18)</span>
                <span>tau_in (1.86)</span>
                <span>4.0 (Extreme)</span>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                <span>Persistence Windows (k)</span>
                <span className="mono" style={{ color: 'var(--navy)', fontSize: 14 }}>{synthWindows} windows</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={synthWindows}
                onChange={(e) => setSynthWindows(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--navy)' }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                <span>Signal Quality Score</span>
                <span className="mono" style={{ color: synthQuality < 0.7 ? 'var(--red)' : 'var(--green)', fontSize: 14 }}>{(synthQuality * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={synthQuality}
                onChange={(e) => setSynthQuality(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--green)' }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                <span>Context Confidence</span>
                <span className="mono" style={{ color: synthContextConf < 0.6 ? 'var(--amber)' : 'var(--blue)', fontSize: 14 }}>{(synthContextConf * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={synthContextConf}
                onChange={(e) => setSynthContextConf(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--blue)' }}
              />
            </div>
          </div>

          {/* Real-time Output Display */}
          <div style={{ background: '#ffffff', borderRadius: 12, padding: 18, border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="mini-label" style={{ marginBottom: 10 }}>Calculated Live Output</div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--gray)', marginBottom: 4 }}>Evidence Readiness Gate:</div>
                <EvidenceBadge state={calculatedEvidenceState} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--gray)', marginBottom: 4 }}>Physiological State Result:</div>
                <StateBadge state={calculatedPhysiologicalState} />
              </div>

              <div style={{ background: 'var(--gray-soft)', padding: 12, borderRadius: 8, fontSize: 11.5, color: 'var(--ink)', lineHeight: 1.4 }}>
                <b>State Reason:</b> {explanationText}
              </div>
            </div>

            <button
              className="btn-outline-navy"
              style={{ width: '100%', marginTop: 14 }}
              onClick={() => {
                setSynthScore(2.64);
                setSynthWindows(4);
                setSynthQuality(0.94);
                setSynthContextConf(0.91);
              }}
            >
              <RotateCcw size={14} />
              <span>Reset Visualizer Inputs</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
