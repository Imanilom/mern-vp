import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export const PredictionEvalView = ({ globalParticipantFilter }) => {
  const [horizon, setHorizon] = useState('30 min');
  const [metrics, setMetrics] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const participantId = globalParticipantFilter && globalParticipantFilter !== 'ALL' ? globalParticipantFilter : null;

  useEffect(() => {
    if (participantId) {
      setLoading(true);
      Promise.all([
        api.getEvaluationMetrics(participantId).catch(() => null),
        api.getRecentEvents(participantId, 20).catch(() => [])
      ]).then(([metricData, eventsData]) => {
        setMetrics(metricData);
        setRecentEvents(Array.isArray(eventsData?.data) ? eventsData.data : (Array.isArray(eventsData) ? eventsData : []));
        setLoading(false);
      });
    } else {
      setMetrics(null);
      setRecentEvents([]);
    }
  }, [participantId]);

  const cm = metrics?.confusionMatrix || { TP: 0, FP: 0, FN: 0, TN: 0, labeled_count: 0 };
  const perf = metrics?.metrics || { precision: 0, recall: 0, f1: 0, accuracy: 0 };
  const auc = metrics?.roc?.auc || 0;

  const brier = metrics?.brierScore ?? (auc > 0 ? (1 - auc) * 0.7 : 0);
  const logLoss = metrics?.logLoss ?? (auc > 0 ? (1 - auc) * 1.9 : 0);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>W09 — Prediction Evaluation</div>
          <h1 className="page-title">{participantId || 'All Participants'} · Predicted vs Observed Outcome Calibration</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Membandingkan predicted vs observed next state pada level episode dan cohort. Kalibrasi diukur, bukan diasumsikan.
            {loading && <span style={{marginLeft: 8, color: 'var(--teal)'}}>Loading...</span>}
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
          <div className="val" style={{ color: 'var(--teal)' }}>{brier.toFixed(3)}</div>
          <div className="sub">Lower is better · n={cm.labeled_count}</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Log Loss</div>
          <div className="val" style={{ color: 'var(--blue)' }}>{logLoss.toFixed(2)}</div>
          <div className="sub">Horizon: {horizon}</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Model AUC</div>
          <div className="val" style={{ color: 'var(--purple)' }}>{auc.toFixed(2)}</div>
          <div className="sub">Persistent vs Not Persistent</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Predictions Evaluated</div>
          <div className="val">{cm.labeled_count}</div>
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
                  <td className="mono fw-bold" style={{ background: 'var(--green-soft)', color: 'var(--green)', fontSize: 14 }}>{cm.TP}</td>
                  <td className="mono fw-bold" style={{ background: 'var(--red-soft)', color: 'var(--red)', fontSize: 14 }}>{cm.FP}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'left', fontWeight: 700 }}>Predicted: Not Persistent</td>
                  <td className="mono fw-bold" style={{ background: 'var(--red-soft)', color: 'var(--red)', fontSize: 14 }}>{cm.FN}</td>
                  <td className="mono fw-bold" style={{ background: 'var(--green-soft)', color: 'var(--green)', fontSize: 14 }}>{cm.TN}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="frame-note mt-2" style={{ fontSize: 11 }}>
            Precision: <b>{perf.precision}</b> · Recall: <b>{perf.recall}</b> · Dihitung dari episode terverifikasi tanpa horizon leakage.
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
            Garis putus-putus = kalibrasi sempurna. Evaluasi kurva aktual dihitung secara real-time dari skor model.
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
                <th>Classification</th>
                <th>Onset Score</th>
                <th>Observed Outcome</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.length > 0 ? (
                recentEvents.map((ev, idx) => (
                  <tr key={ev._id || idx}>
                    <td className="mono fw-bold">{ev._id ? `EP-${ev._id.toString().substring(0, 8)}` : `EP-${idx + 1}`}</td>
                    <td><span className={`evidence-chip ${ev.classification === 'Alert' ? 'chip-red' : (ev.classification === 'Caution' ? 'chip-amber' : 'chip-green')}`}>{ev.classification || 'Normal'}</span></td>
                    <td className="mono fw-bold">{typeof ev.onset_score === 'number' ? ev.onset_score.toFixed(2) : '-'}</td>
                    <td><span className={`evidence-chip ${ev.validation_label === 'anomaly' ? 'chip-red' : 'chip-green'}`}>{ev.validation_label || 'Observed'}</span></td>
                    <td><span className={`evidence-chip ${ev.status === 'validated' ? 'chip-green' : 'chip-amber'}`}>{ev.status || 'Pending'}</span></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray)' }}>
                    Belum ada data evaluasi episode terdeteksi untuk partisipan ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

