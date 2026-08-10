import React, { useState, useEffect } from 'react';
import { EvidenceBadge } from '../components/common/EvidenceBadge';
import { StateBadge } from '../components/common/StateBadge';
import {
  Sliders,
  Play,
  RotateCcw,
  ShieldAlert,
  GitPullRequest,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';

export const ModelRulesView = ({ modelConfig }) => {
  useEffect(() => {
    console.log('[ModelRulesView] API Data (Model Config / Pipeline Settings):', modelConfig);
  }, [modelConfig]);
  // Simulator State
  const [synthScore, setSynthScore] = useState(2.64);
  const [synthWindows, setSynthWindows] = useState(4);
  const [synthQuality, setSynthQuality] = useState(0.94);
  const [synthContextConf, setSynthContextConf] = useState(0.91);

  // AC-15: Prompt for audit reason
  const [showReasonPrompt, setShowReasonPrompt] = useState(false);
  const [auditReason, setAuditReason] = useState("");
  const [revisionCreated, setRevisionCreated] = useState(false);

  const handleCreateDraft = () => {
    setShowReasonPrompt(true);
  };

  const submitDraft = () => {
    if (!auditReason.trim()) {
      alert("Alasan perubahan (reason) wajib diisi untuk log audit.");
      return;
    }
    // Call API here...
    setShowReasonPrompt(false);
    setRevisionCreated(true);
    setTimeout(() => setRevisionCreated(false), 3000);
  };

  // Active parameter values derived from config
  const tauIn = parseFloat(modelConfig?.alertThreshold) || 1.86;
  const tauOut = parseFloat(modelConfig?.devThreshold) || 1.18;
  const tauNormal = 0.80;

  // Live State Machine Evaluator Logic (Section 6 of blueprint.pdf)
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
      calculatedPhysiologicalState = "RECOVERY";
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
        <h1 className="page-title">Model &amp; Rules Governance</h1>
        <p className="page-sub">
          Transparansi parameter aturan, guardrail, versioning konfigurasi, dan simulator aturan state machine interaktif.
        </p>
      </div>

      {/* Readonly Alert Banner */}
      <div style={{
        background: 'var(--amber-soft)',
        border: '1px solid var(--amber)',
        borderRadius: 10,
        padding: '10px 16px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 12,
        color: '#7C4A00'
      }}>
        <Info size={18} color="var(--amber)" />
        <div>
          <b>Read-only Active Config:</b> Perubahan parameter rule membutuhkan proses approval draft, sandbox simulation, dan audit log sebelum diajukan ke active production.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Left: Active Parameters Table */}
        <div className="card-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div className="mini-label">Active Rule Configuration</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>
                Rule Version: {modelConfig?.activeVersion || 'SR-1.4'}
              </div>
            </div>
            <span className="chip-green" style={{ fontSize: 10 }}>ACTIVE IN PROD</span>
          </div>

          <div className="table-responsive">
            <table className="dtable" style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Active Value</th>
                  <th>Calibration Source</th>
                  <th>Guardrail Boundary</th>
                </tr>
              </thead>
              <tbody>
                {modelConfig?.parameters?.map((p) => (
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

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-teal" style={{ fontSize: 11.5 }} onClick={handleCreateDraft}>
              <GitPullRequest size={14} />
              <span>Create Draft Rule Revision</span>
            </button>
            <button className="btn-outline-navy" style={{ fontSize: 11.5 }}>
              <span>Compare Versions</span>
            </button>
          </div>

          {revisionCreated && (
            <div style={{ marginTop: 12, padding: 8, background: 'var(--green-soft)', color: 'var(--green)', fontSize: 11, borderRadius: 8, fontWeight: 700 }}>
              ✓ Draft created! Audit log recorded reason.
            </div>
          )}

          {/* AC-15: Reason Prompt */}
          {showReasonPrompt && (
            <div style={{ marginTop: 14, padding: 14, background: 'var(--surface)', border: '1px solid var(--amber)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldAlert size={14} />
                Audit Trail Requirement
              </div>
              <textarea
                value={auditReason}
                onChange={e => setAuditReason(e.target.value)}
                placeholder="Wajib diisi: Alasan perubahan konfigurasi..."
                rows={3}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--line)', fontSize: 11, marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-teal" style={{ fontSize: 11 }} onClick={submitDraft}>Submit Draft</button>
                <button className="btn-outline-navy" style={{ fontSize: 11 }} onClick={() => setShowReasonPrompt(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Version History */}
        <div className="card-panel">
          <div className="mini-label" style={{ marginBottom: 4 }}>Configuration Version Control</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', marginBottom: 14 }}>
            Audit &amp; Rollback History
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {modelConfig?.versionHistory?.map((v, idx) => (
              <div
                key={v.version}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: v.status === 'ACTIVE' ? 'var(--teal-soft)' : 'var(--gray-soft)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ fontWeight: 800, fontSize: 13, color: 'var(--navy)' }}>{v.version}</span>
                    <span className={`badge-soft ${v.status === 'ACTIVE' ? 'chip-green' : 'chip-neutral'}`} style={{ fontSize: 9 }}>
                      {v.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 2 }}>
                    Activated: {v.activatedAt} by <b>{v.author}</b>
                  </div>
                </div>

                {v.status !== 'ACTIVE' && (
                  <button className="btn-outline-navy" style={{ padding: '4px 8px', fontSize: 10 }}>
                    Rollback to this
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive What-If Simulator Panel */}
      <div className="card-panel" style={{ background: '#FAFBFD', border: '1.5px solid var(--teal)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--teal)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sliders size={18} />
          </div>
          <div>
            <div className="mini-label" style={{ color: 'var(--teal)' }}>Interactive Sandbox</div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
              What-If State Machine Simulator
            </h3>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
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
                <span>tau_normal (0.8)</span>
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
              <span>Reset Simulator Inputs</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
