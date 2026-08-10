import React, { useState } from 'react';

export const PredictionEvalView = () => {
  const [horizon, setHorizon] = useState('30 min');

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

        <div className="d-flex align-items-center gap-2">
          <div style={{ background: 'var(--gray-soft)', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600 }}>
            <i className="fa-regular fa-clock me-1" style={{ color: 'var(--teal)' }}></i>
            Horizon: <b>{horizon}</b>
          </div>
          <button className="btn-outline-navy" style={{ fontSize: 11.5 }}>
            <i className="fa-solid fa-file-export me-1"></i>
            Export Metrics
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

      {/* Row 2: Confusion Matrix & Calibration Curve */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Confusion Matrix */}
        <div className="card-panel">
          <div className="mini-label mb-2">Confusion Matrix — Predicted vs Observed ({horizon})</div>
          <div className="table-responsive">
            <table className="dtable" style={{ textAlign: 'center' }}>
              <thead>
                <tr>
                  <th></th>
                  <th>Observed: Persistent</th>
                  <th>Observed: Not Persistent</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'left', fontWeight: 700 }}>Predicted: Persistent</td>
                  <td className="mono fw-bold" style={{ background: 'var(--green-soft)', color: 'var(--green)', fontSize: 14 }}>22</td>
                  <td className="mono fw-bold" style={{ background: 'var(--red-soft)', color: 'var(--red)', fontSize: 14 }}>6</td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'left', fontWeight: 700 }}>Predicted: Not Persistent</td>
                  <td className="mono fw-bold" style={{ background: 'var(--red-soft)', color: 'var(--red)', fontSize: 14 }}>5</td>
                  <td className="mono fw-bold" style={{ background: 'var(--green-soft)', color: 'var(--green)', fontSize: 14 }}>31</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="frame-note mt-2" style={{ fontSize: 11 }}>
            Precision: <b>0.79</b> · Recall: <b>0.81</b> · Dihitung hanya dari episode resolved tanpa horizon leakage.
          </div>
        </div>

        {/* Calibration Curve */}
        <div className="card-panel">
          <div className="mini-label mb-2">Model Calibration Curve</div>
          <div style={{ background: 'var(--gray-soft)', borderRadius: 8, padding: 12 }}>
            <svg viewBox="0 0 220 110" style={{ width: '100%', height: 110 }}>
              <line x1="10" y1="100" x2="210" y2="100" stroke="var(--line)" strokeWidth="1.5" />
              <line x1="10" y1="10" x2="10" y2="100" stroke="var(--line)" strokeWidth="1.5" />
              <line x1="10" y1="100" x2="210" y2="10" stroke="#B9C2C8" strokeDasharray="3 3" strokeWidth="1.5" />
              <polyline points="10,95 60,72 110,50 160,28 210,14" fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="10" cy="95" r="3.5" fill="var(--teal)" />
              <circle cx="60" cy="72" r="3.5" fill="var(--teal)" />
              <circle cx="110" cy="50" r="3.5" fill="var(--teal)" />
              <circle cx="160" cy="28" r="3.5" fill="var(--teal)" />
              <circle cx="210" cy="14" r="3.5" fill="var(--teal)" />
            </svg>
          </div>
          <div className="frame-note mt-2" style={{ fontSize: 10.5 }}>
            Garis putus-putus = kalibrasi sempurna. Kurva teal sedikit overconfident pada bin probabilitas tinggi.
          </div>
        </div>
      </div>

      {/* Recent Predicted vs Observed Outcomes Table */}
      <div className="card-panel">
        <div className="mini-label mb-2">Recent Predicted vs Observed Outcomes</div>
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
                <td className="mono fw-bold">EP-240530-02</td>
                <td><span className="evidence-chip chip-red">Persistent</span></td>
                <td className="mono fw-bold">0.81</td>
                <td><span className="evidence-chip chip-red">Persistent</span></td>
                <td><span className="evidence-chip chip-green">Correct</span></td>
              </tr>
              <tr>
                <td className="mono fw-bold">EP-260808-07</td>
                <td><span className="evidence-chip chip-purple">Recovery</span></td>
                <td className="mono fw-bold">0.66</td>
                <td><span className="evidence-chip chip-purple">Recovery</span></td>
                <td><span className="evidence-chip chip-green">Correct</span></td>
              </tr>
              <tr>
                <td className="mono fw-bold">EP-260808-08</td>
                <td><span className="evidence-chip chip-red">Persistent</span></td>
                <td className="mono fw-bold">0.58</td>
                <td><span className="evidence-chip chip-purple">Recovery</span></td>
                <td><span className="evidence-chip chip-red">Miss</span></td>
              </tr>
              <tr>
                <td className="mono fw-bold">EP-240527-01</td>
                <td><span className="evidence-chip chip-amber">Candidate</span></td>
                <td className="mono fw-bold">0.72</td>
                <td><span className="evidence-chip chip-green">Recovered</span></td>
                <td><span className="evidence-chip chip-red">Miss</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
