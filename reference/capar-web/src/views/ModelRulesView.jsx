import React, { useState } from 'react';
import {
  Sliders,
  Play,
  FilePlus,
  Lock,
  GitBranch,
  Shield,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export const ModelRulesView = ({ modelConfig }) => {
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simOutput, setSimOutput] = useState(null);

  const handleRunSimulation = () => {
    setSimulationRunning(true);
    setTimeout(() => {
      setSimulationRunning(false);
      setSimOutput({
        stateSequence: ['BASELINE', 'CANDIDATE', 'PERSISTENT', 'RECOVERY', 'RECOVERED'],
        persistenceWindow: '3 of 4 windows',
        washoutMet: true,
        transitionCount: 4
      });
    }, 1200);
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">W05. Model &amp; Rules — Governance &amp; Parameters</h1>
        <p className="page-sub">
          Parameter aktif, versioning, threshold source, dan tata kelola simulasi aturan komputasi state.
        </p>
      </div>

      {/* Read-only Governance Banner (W05 Addendum) */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--amber-soft)',
        border: '1px solid var(--amber)',
        borderRadius: 10,
        marginBottom: 18,
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--amber)',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <Lock size={16} />
        <span>Read-only by default. Parameter changes require draft &rarr; review &rarr; approval &rarr; activation &rarr; audit.</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Active Parameter Table (W05 Addendum) */}
        <div className="card-panel" style={{ padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: '#FAFBFC', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
            Active System Parameters &amp; Guardrails
          </div>
          <div className="table-responsive">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Active Value</th>
                  <th>Source</th>
                  <th>Guardrail</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono" style={{ fontWeight: 800 }}>tau_in (τin)</td>
                  <td className="mono" style={{ fontWeight: 800, color: 'var(--navy)' }}>1.86</td>
                  <td style={{ fontSize: 11 }}>personal Q99</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--gray)' }}>1.2–3.5</td>
                </tr>
                <tr>
                  <td className="mono" style={{ fontWeight: 800 }}>tau_out (τout)</td>
                  <td className="mono" style={{ fontWeight: 800, color: 'var(--navy)' }}>1.18</td>
                  <td style={{ fontSize: 11 }}>hysteresis learned</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--gray)' }}>&lt; τin</td>
                </tr>
                <tr>
                  <td className="mono" style={{ fontWeight: 800 }}>tau_normal (τnormal)</td>
                  <td className="mono" style={{ fontWeight: 800, color: 'var(--navy)' }}>0.80</td>
                  <td style={{ fontSize: 11 }}>rule config</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--gray)' }}>&le; τout</td>
                </tr>
                <tr>
                  <td className="mono" style={{ fontWeight: 800 }}>k / m</td>
                  <td className="mono" style={{ fontWeight: 800 }}>3 / 4</td>
                  <td style={{ fontSize: 11 }}>protocol</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--gray)' }}>2 &le; k &le; m</td>
                </tr>
                <tr>
                  <td className="mono" style={{ fontWeight: 800 }}>r</td>
                  <td className="mono" style={{ fontWeight: 800 }}>2 windows</td>
                  <td style={{ fontSize: 11 }}>protocol</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--gray)' }}>1–5</td>
                </tr>
                <tr>
                  <td className="mono" style={{ fontWeight: 800 }}>q</td>
                  <td className="mono" style={{ fontWeight: 800 }}>3 windows</td>
                  <td style={{ fontSize: 11 }}>protocol</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--gray)' }}>2–6</td>
                </tr>
                <tr>
                  <td className="mono" style={{ fontWeight: 800 }}>washout</td>
                  <td className="mono" style={{ fontWeight: 800 }}>20 min</td>
                  <td style={{ fontSize: 11 }}>protocol</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--gray)' }}>&ge; 0</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Model Versions Card (W05 Addendum) */}
        <div className="card-panel">
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', marginBottom: 12 }}>
            Model Versions &amp; Governance
          </div>

          <div className="table-responsive" style={{ marginBottom: 16 }}>
            <table className="dtable" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Version</th>
                  <th>Activated</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>baseline</td>
                  <td className="mono" style={{ fontWeight: 700 }}>B-014-07</td>
                  <td style={{ fontSize: 10 }}>08 Aug 12:00</td>
                </tr>
                <tr>
                  <td>state rules</td>
                  <td className="mono" style={{ fontWeight: 700 }}>SR-1.4</td>
                  <td style={{ fontSize: 10 }}>07 Aug 09:20</td>
                </tr>
                <tr>
                  <td>experience</td>
                  <td className="mono" style={{ fontWeight: 700 }}>EXP-0.6</td>
                  <td style={{ fontSize: 10 }}>08 Aug 12:10</td>
                </tr>
                <tr>
                  <td>prediction</td>
                  <td className="mono" style={{ fontWeight: 700 }}>PRED-0.4</td>
                  <td style={{ fontSize: 10 }}>08 Aug 12:10</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => alert('Draft configuration created. Stage for peer review.')}
              style={{ padding: '8px 12px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <FilePlus size={14} />
              <span>Create Draft Version</span>
            </button>

            <button
              onClick={handleRunSimulation}
              disabled={simulationRunning}
              style={{ padding: '8px 12px', background: 'var(--surface)', color: 'var(--navy)', border: '1px solid var(--line)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Play size={14} />
              <span>{simulationRunning ? 'Simulating...' : 'Run Simulation'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Rule Simulation Trajectory Chart (W05 Addendum) */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)' }}>
            Rule Simulation — score trajectory \(\rightarrow\) state output
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className="chip-amber" style={{ fontSize: 10, fontWeight: 800 }}>Candidate</span>
            <span className="chip-red" style={{ fontSize: 10, fontWeight: 800 }}>Persistent</span>
            <span className="chip-purple" style={{ fontSize: 10, fontWeight: 800 }}>Recovery</span>
            <span className="chip-green" style={{ fontSize: 10, fontWeight: 800 }}>Recovered</span>
          </div>
        </div>

        <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '16px 14px 12px 14px', border: '1px solid var(--line)', color: 'var(--ink)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray)', fontWeight: 700, marginBottom: 6 }}>
            <span>Y-AXIS: ANOMALY SCORE (SD)</span>
            <span>X-AXIS: WINDOW SEQUENCES (W1–W12)</span>
          </div>

          <svg viewBox="0 0 500 120" style={{ width: '100%', height: 120, overflow: 'visible' }}>
            {/* Vertical Window Gridlines */}
            <line x1="35" y1="20" x2="35" y2="100" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
            <line x1="110" y1="20" x2="110" y2="100" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
            <line x1="180" y1="20" x2="180" y2="100" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
            <line x1="260" y1="20" x2="260" y2="100" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
            <line x1="360" y1="20" x2="360" y2="100" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
            <line x1="440" y1="20" x2="440" y2="100" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
            <line x1="480" y1="20" x2="480" y2="100" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />

            {/* Horizontal Gridlines */}
            <line x1="35" y1="20" x2="480" y2="20" stroke="#E2E8F0" strokeDasharray="2 2" />
            <text x="28" y="23" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">3.0</text>

            <line x1="35" y1="50" x2="480" y2="50" stroke="#E2E8F0" strokeDasharray="2 2" />
            <text x="28" y="53" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">2.0</text>

            <line x1="35" y1="80" x2="480" y2="80" stroke="#E2E8F0" strokeDasharray="2 2" />
            <text x="28" y="83" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">1.0</text>

            <line x1="35" y1="100" x2="480" y2="100" stroke="#94A3B8" strokeWidth="1.2" />
            <text x="28" y="103" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">0.0</text>

            {/* Threshold Line tau_in */}
            <line x1="35" y1="54" x2="480" y2="54" stroke="#DC2626" strokeDasharray="4 4" strokeWidth="1.5" />
            <text x="484" y="57" fill="#DC2626" fontSize="8.5" fontWeight="bold" fontFamily="JetBrains Mono">tau_in</text>

            {/* Simulation Path Line */}
            <path
              d="M 35 95 L 110 80 L 180 32 L 260 45 L 360 78 L 440 92 L 480 96"
              fill="none"
              stroke="#DC2626"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* X-Axis Window Ticks */}
            <text x="35" y="114" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">W1</text>
            <text x="110" y="114" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">W3</text>
            <text x="180" y="114" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">W5</text>
            <text x="260" y="114" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">W7</text>
            <text x="360" y="114" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">W9</text>
            <text x="440" y="114" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">W11</text>
            <text x="480" y="114" fill="#1E293B" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">W12</text>
          </svg>
        </div>
      </div>
    </div>
  );
};
