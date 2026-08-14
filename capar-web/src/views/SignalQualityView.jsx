import React, { useState, useEffect } from 'react';
import { EvidenceBadge } from '../components/common/EvidenceBadge';
import { api } from '../services/api';

export const SignalQualityView = ({ globalParticipantFilter }) => {
  const [sessionFlagged, setSessionFlagged] = useState(false);
  const [reconnectSent, setReconnectSent] = useState(false);
  const [qualityData, setQualityData] = useState(null);
  const [loading, setLoading] = useState(false);

  const participantId = globalParticipantFilter && globalParticipantFilter !== 'ALL' ? globalParticipantFilter : 'P-031'; // Default or selected

  useEffect(() => {
    if (participantId) {
      setLoading(true);
      api.getSignalQuality(participantId).then(data => {
        setQualityData(data);
        setLoading(false);
      });
    }
  }, [participantId]);

  const missingness = qualityData?.missingness || '0.0';
  const artifact = qualityData?.artifact || '0.0';
  const evaluableTime = qualityData?.evaluableTime || '0';
  const reconnects = qualityData?.reconnects || 0;
  const perDeviceQuality = qualityData?.perDeviceQuality || [];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>W04 — Live Signal &amp; Quality Detail</div>
          <h1 className="page-title">{participantId} · Live Signal &amp; Quality Drill-down</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Memeriksa RR/HR stream, missingness, artifact, dan instruksi koneksi ulang perangkat secara real-time.
            {loading && <span style={{marginLeft: 8, color: 'var(--teal)'}}>Loading...</span>}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <EvidenceBadge state={parseFloat(missingness) > 10 ? 'QUALITY_WARNING' : 'EVALUABLE'} />
          <button
            className={`btn-outline-navy ${sessionFlagged ? 'chip-amber' : ''}`}
            onClick={() => setSessionFlagged(!sessionFlagged)}
            style={{ fontSize: 11.5 }}
          >
            <i className="fa-solid fa-flag me-1"></i>
            {sessionFlagged ? 'Session Flagged' : 'Flag Session'}
          </button>
          <button
            className="btn-teal"
            onClick={() => {
              setReconnectSent(true);
              setTimeout(() => setReconnectSent(false), 2500);
            }}
            style={{ fontSize: 11.5 }}
          >
            <i className="fa-solid fa-arrows-rotate me-1"></i>
            Send Reconnect
          </button>
        </div>
      </div>

      {reconnectSent && (
        <div style={{ background: 'var(--teal-soft)', border: '1px solid var(--teal)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'var(--teal)', fontWeight: 600 }}>
          ✓ Instruksi reconnect berhasil dikirim ke perangkat {qualityData?.device || 'Polar H10'} ({participantId}).
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="lbl">Missingness (All Time)</div>
          <div className="val" style={{ color: parseFloat(missingness) > 10 ? 'var(--amber)' : 'var(--green)' }}>{missingness}%</div>
          <div className="sub">{parseFloat(missingness) > 10 ? 'Above 10% quality threshold' : 'Within normal limits'}</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Artifact Ratio</div>
          <div className="val" style={{ color: parseFloat(artifact) > 5 ? 'var(--red)' : 'var(--green)' }}>{artifact}%</div>
          <div className="sub">Motion + lead contact noise</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Reconnects (24h)</div>
          <div className="val">{reconnects}</div>
          <div className="sub">Automated / Manual</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Session Evaluable Time</div>
          <div className="val" style={{ color: 'var(--gray)' }}>{evaluableTime}%</div>
          <div className="sub">Of total recorded windows</div>
        </div>
      </div>

      {/* Session Boundaries & Window Spectrum */}
      <div className="card-panel mb-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="mini-label m-0">Session Boundaries — Accepted vs Rejected Windows (RR Stream)</div>
          <span className="frame-note m-0" style={{ fontSize: 10 }}>Session active</span>
        </div>

        <div style={{ background: 'var(--gray-soft)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <svg viewBox="0 0 700 40" style={{ width: '100%', height: 40, overflow: 'visible' }}>
            <line x1="0" y1="5" x2="0" y2="35" stroke="var(--navy)" strokeWidth="2" />
            <line x1="700" y1="5" x2="700" y2="35" stroke="var(--navy)" strokeWidth="2" />
            {parseFloat(missingness) > 10 ? (
               <>
                 <rect x="0" y="10" width="700" height="20" rx="3" fill="#E7F4E8" />
                 <rect x="40" y="10" width="30" height="20" rx="2" fill="var(--amber)" />
                 <rect x="150" y="10" width="18" height="20" rx="2" fill="var(--red)" />
                 <rect x="300" y="10" width="45" height="20" rx="2" fill="var(--amber)" />
                 <rect x="480" y="10" width="22" height="20" rx="2" fill="var(--red)" />
                 <rect x="600" y="10" width="35" height="20" rx="2" fill="var(--amber)" />
               </>
            ) : (
               <rect x="0" y="10" width="700" height="20" rx="3" fill="#E7F4E8" />
            )}
          </svg>
        </div>

        <div className="d-flex gap-4 frame-note m-0 flex-wrap" style={{ fontSize: 11 }}>
          <span><i className="fa-solid fa-square me-1" style={{ color: 'var(--green)' }}></i> Accepted windows (Clean)</span>
          <span><i className="fa-solid fa-square me-1" style={{ color: 'var(--amber)' }}></i> Rejected (Missingness)</span>
          <span><i className="fa-solid fa-square me-1" style={{ color: 'var(--red)' }}></i> Rejected (Artifacts)</span>
        </div>
      </div>

      {/* Per-device Stream Quality Table */}
      <div className="card-panel">
        <div className="mini-label mb-2">Per-Device Stream Quality Table</div>
        <div className="table-responsive">
          <table className="dtable">
            <thead>
              <tr>
                <th>Stream Name</th>
                <th>Device ID</th>
                <th>Missingness</th>
                <th>Artifact</th>
                <th>Status</th>
                <th>Last Reconnect Instruction</th>
              </tr>
            </thead>
            <tbody>
              {perDeviceQuality.length === 0 ? (
                 <tr>
                    <td colSpan="6" className="text-center text-muted p-3">No device data available</td>
                 </tr>
              ) : (
                 perDeviceQuality.map((dq, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700 }}>{dq.stream}</td>
                      <td className="mono">{dq.device}</td>
                      <td className="mono" style={{ color: parseFloat(dq.missingness) > 10 ? 'var(--amber)' : 'inherit', fontWeight: 700 }}>{dq.missingness}</td>
                      <td className="mono" style={{ color: parseFloat(dq.artifact) > 5 ? 'var(--red)' : 'inherit', fontWeight: 700 }}>{dq.artifact}</td>
                      <td>
                         <span className={`evidence-chip ${dq.status === 'Nominal' ? 'chip-green' : 'chip-amber'}`}>{dq.status}</span>
                      </td>
                      <td style={{ fontSize: 11 }}>{dq.lastInstruction}</td>
                    </tr>
                 ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

