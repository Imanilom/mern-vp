import React, { useState } from 'react';
import { EvidenceBadge } from '../components/common/EvidenceBadge';

export const SignalQualityView = () => {
  const [sessionFlagged, setSessionFlagged] = useState(false);
  const [reconnectSent, setReconnectSent] = useState(false);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>W04 — Live Signal &amp; Quality Detail</div>
          <h1 className="page-title">P-031 · Live Signal &amp; Quality Drill-down</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Memeriksa RR/HR stream, missingness, artifact, dan instruksi koneksi ulang perangkat secara real-time.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <EvidenceBadge state="QUALITY_WARNING" />
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
          ✓ Instruksi reconnect berhasil dikirim ke perangkat Polar H10 (P-031).
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="lbl">Missingness (1h)</div>
          <div className="val" style={{ color: 'var(--amber)' }}>14.2%</div>
          <div className="sub">Above 10% quality threshold</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Artifact Ratio</div>
          <div className="val" style={{ color: 'var(--red)' }}>8.6%</div>
          <div className="sub">Motion + lead contact noise</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Reconnects (24h)</div>
          <div className="val">3</div>
          <div className="sub">Last event: 12:41 WIB</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Session Evaluable Time</div>
          <div className="val" style={{ color: 'var(--gray)' }}>71%</div>
          <div className="sub">Since 08:00 WIB start</div>
        </div>
      </div>

      {/* Session Boundaries & Window Spectrum */}
      <div className="card-panel mb-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="mini-label m-0">Session Boundaries — Accepted vs Rejected Windows (RR Stream)</div>
          <span className="frame-note m-0" style={{ fontSize: 10 }}>Session S-0091 · 08:00–13:07 · 61 windows total</span>
        </div>

        <div style={{ background: 'var(--gray-soft)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <svg viewBox="0 0 700 40" style={{ width: '100%', height: 40, overflow: 'visible' }}>
            <line x1="0" y1="5" x2="0" y2="35" stroke="var(--navy)" strokeWidth="2" />
            <line x1="700" y1="5" x2="700" y2="35" stroke="var(--navy)" strokeWidth="2" />
            <rect x="0" y="10" width="700" height="20" rx="3" fill="#E7F4E8" />
            <rect x="40" y="10" width="30" height="20" rx="2" fill="var(--amber)" />
            <rect x="150" y="10" width="18" height="20" rx="2" fill="var(--red)" />
            <rect x="300" y="10" width="45" height="20" rx="2" fill="var(--amber)" />
            <rect x="480" y="10" width="22" height="20" rx="2" fill="var(--red)" />
            <rect x="600" y="10" width="35" height="20" rx="2" fill="var(--amber)" />
          </svg>
        </div>

        <div className="d-flex gap-4 frame-note m-0 flex-wrap" style={{ fontSize: 11 }}>
          <span><i className="fa-solid fa-square me-1" style={{ color: 'var(--green)' }}></i> 54 Accepted windows (Clean)</span>
          <span><i className="fa-solid fa-square me-1" style={{ color: 'var(--amber)' }}></i> 5 Rejected (Missingness)</span>
          <span><i className="fa-solid fa-square me-1" style={{ color: 'var(--red)' }}></i> 2 Rejected (Artifacts)</span>
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
              <tr>
                <td style={{ fontWeight: 700 }}>RR Interval</td>
                <td className="mono">Polar H10 · #A21F</td>
                <td className="mono" style={{ color: 'var(--amber)', fontWeight: 700 }}>14.2%</td>
                <td className="mono" style={{ color: 'var(--red)', fontWeight: 700 }}>8.6%</td>
                <td><span className="evidence-chip chip-amber">Degraded</span></td>
                <td style={{ fontSize: 11 }}>12:41 · "Kencangkan strap dada"</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700 }}>Accelerometer</td>
                <td className="mono">Polar H10 · #A21F</td>
                <td className="mono">2.1%</td>
                <td className="mono">1.0%</td>
                <td><span className="evidence-chip chip-green">Nominal</span></td>
                <td style={{ fontSize: 11 }}>—</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700 }}>Context / GPS</td>
                <td className="mono">Phone · Pixel-7</td>
                <td className="mono">0.4%</td>
                <td className="mono">—</td>
                <td><span className="evidence-chip chip-green">Nominal</span></td>
                <td style={{ fontSize: 11 }}>—</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700 }}>Bluetooth Link</td>
                <td className="mono">Phone ↔ H10</td>
                <td className="mono" style={{ color: 'var(--red)', fontWeight: 700 }}>3 drops/hr</td>
                <td className="mono">—</td>
                <td><span className="evidence-chip chip-red">Unstable</span></td>
                <td style={{ fontSize: 11 }}>11:58 · "Dekatkan jarak perangkat"</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
