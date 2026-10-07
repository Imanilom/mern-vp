import React, { useState, useEffect } from 'react';
import { EvidenceBadge } from '../components/common/EvidenceBadge';
import { api } from '../services/api';
import { Radio, Wifi, ShieldCheck, AlertTriangle, RefreshCw, Flag, Database } from 'lucide-react';

export const SignalQualityView = ({ globalParticipantFilter }) => {
  const [sessionFlagged, setSessionFlagged] = useState(false);
  const [reconnectSent, setReconnectSent] = useState(false);
  const [qualityData, setQualityData] = useState(null);
  const [loading, setLoading] = useState(false);

  const participantId = globalParticipantFilter && globalParticipantFilter !== 'ALL' ? globalParticipantFilter : null;

  useEffect(() => {
    setLoading(true);
    api.getSignalQuality(participantId || 'ALL')
      .then(data => {
        setQualityData(data);
        setLoading(false);
      })
      .catch(() => {
        setQualityData(null);
        setLoading(false);
      });
  }, [participantId]);

  const goodDataPct = qualityData?.good_data_pct ?? null;
  const artifact = qualityData?.artifact_fraction_pct ?? null;
  const missingness = qualityData?.missing_fraction_pct ?? null;
  const qSignal = qualityData?.q_signal ?? null;
  const evaluableTime = qualityData?.evaluable_time_pct ?? null;
  const isConnectedRecent = typeof qualityData?.is_connected_recent === 'boolean'
    ? qualityData.is_connected_recent
    : null;
  const lastActiveStr = qualityData?.last_active_timestamp
    ? new Date(qualityData.last_active_timestamp).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    : 'Belum tersedia';
  const formatValue = (value, suffix = '') => (
    Number.isFinite(value) ? `${value}${suffix}` : 'Belum tersedia'
  );
  const perDeviceQuality = qualityData?.per_device_quality || [];
  const qualityBadgeState = qualityData?.filter_verdict === 'HIGH_NOISE_WARNING'
    ? 'QUALITY_WARNING'
    : qualityData?.filter_verdict && qualityData.filter_verdict !== 'DATA_UNAVAILABLE'
      ? 'EVALUABLE'
      : 'DATA_UNAVAILABLE';

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>W04 — Live Signal &amp; Quality Detail</div>
          <h1 className="page-title">{participantId || 'Cohort All'} · Live Signal &amp; Quality Drill-down</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Memeriksa status koneksi perangkat streaming, missingness, artifact fraction, dan instruksi koneksi ulang secara real-time.
            {loading && <span style={{ marginLeft: 8, color: 'var(--teal)' }}>Loading backend quality data...</span>}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {/* Connection Status Badge */}
          {isConnectedRecent === true ? (
            <span className="badge bg-success text-white px-2.5 py-1.5" style={{ fontSize: 11 }}>
              <Wifi size={12} className="me-1" />
              Terhubung (Streaming Aktif · {lastActiveStr})
            </span>
          ) : isConnectedRecent === false ? (
            <span className="badge bg-secondary text-white px-2.5 py-1.5" style={{ fontSize: 11 }}>
              <Radio size={12} className="me-1" />
              Tidak Ada Perangkat Terhubung (15 Mnt Terakhir)
            </span>
          ) : (
            <span className="badge bg-secondary text-white px-2.5 py-1.5" style={{ fontSize: 11 }}>
              <Radio size={12} className="me-1" />
              Status koneksi belum tersedia
            </span>
          )}

          <EvidenceBadge state={qualityBadgeState} />

          <button
            className={`btn-outline-navy ${sessionFlagged ? 'chip-amber' : ''}`}
            onClick={() => setSessionFlagged(!sessionFlagged)}
            style={{ fontSize: 11.5 }}
          >
            <Flag size={13} className="me-1" />
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
            <RefreshCw size={13} className="me-1" />
            Cara menyambungkan
          </button>
        </div>
      </div>

      {reconnectSent && (
        <div style={{ background: 'var(--teal-soft)', border: '1px solid var(--teal)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'var(--teal)', fontWeight: 600 }}>
          Data koneksi belum tersedia. Periksa pengaturan Bluetooth dan aplikasi perangkat Anda untuk menyambungkan ulang.
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="lbl">Data Bagus (Clean %)</div>
          <div className="val" style={{ color: 'var(--green)' }}>{formatValue(goodDataPct, '%')}</div>
          <div className="sub">Q_sig = {formatValue(qSignal)} / 1.00</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Artifact Ratio (Noise %)</div>
          <div className="val">{formatValue(artifact, '%')}</div>
          <div className="sub">Motion &amp; lead contact noise</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Missingness (Drop %)</div>
          <div className="val">{formatValue(missingness, '%')}</div>
          <div className="sub">Ringkasan berdasarkan data kualitas yang tersedia</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Session Evaluable Time</div>
          <div className="val" style={{ color: 'var(--teal)' }}>{formatValue(evaluableTime, '%')}</div>
          <div className="sub">Belum disediakan oleh alur telemetry</div>
        </div>
      </div>

      {/* Session Boundaries & Window Spectrum */}
      <div className="card-panel mb-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="mini-label m-0">Session Spectrum — Accepted vs Rejected Windows (Backend RR Stream)</div>
          <span className="frame-note m-0" style={{ fontSize: 10 }}>
            {isConnectedRecent === true
              ? `Active Streaming (${lastActiveStr})`
              : isConnectedRecent === false ? 'Idle / Offline Window' : 'Status sesi belum tersedia'}
          </span>
        </div>

        <div style={{ background: 'var(--gray-soft)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <svg viewBox="0 0 700 40" style={{ width: '100%', height: 40, overflow: 'visible' }}>
            <line x1="0" y1="5" x2="0" y2="35" stroke="var(--navy)" strokeWidth="2" />
            <line x1="700" y1="5" x2="700" y2="35" stroke="var(--navy)" strokeWidth="2" />
            <rect
              x="0"
              y="10"
              width="700"
              height="20"
              rx="3"
              fill="#E5E7EB"
            />
            {Number.isFinite(goodDataPct) && (
              <rect
                x="0"
                y="10"
                width={Math.min(700, Math.max(0, goodDataPct * 7))}
                height="20"
                rx="3"
                fill="#E7F4E8"
              />
            )}
          </svg>
        </div>

        <div className="d-flex gap-4 frame-note m-0 flex-wrap" style={{ fontSize: 11 }}>
          <span><i className="fa-solid fa-square me-1" style={{ color: 'var(--green)' }}></i> Data bersih: {formatValue(goodDataPct, '%')}</span>
          <span><i className="fa-solid fa-square me-1" style={{ color: 'var(--amber)' }}></i> Missingness: {formatValue(missingness, '%')}</span>
          <span><i className="fa-solid fa-square me-1" style={{ color: 'var(--red)' }}></i> Artifact: {formatValue(artifact, '%')}</span>
        </div>
      </div>

      {/* Per-device Stream Quality Table */}
      <div className="card-panel">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="mini-label m-0">PER-DEVICE STREAM QUALITY &amp; CONNECTION AUDIT</div>
          <span className="badge bg-navy text-white px-2 py-1" style={{ fontSize: 10 }}>
            <Database size={11} className="me-1" />
            Backend Integrated
          </span>
        </div>
        <div className="table-responsive">
          <table className="dtable w-100">
            <thead>
              <tr>
                <th>Stream Name</th>
                <th>Device ID</th>
                <th>Missingness (Drop)</th>
                <th>Artifact (Noise)</th>
                <th>Quality Score (Q_sig)</th>
                <th>Connection Status</th>
                <th>Last Active Instruction</th>
              </tr>
            </thead>
            <tbody>
              {perDeviceQuality.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted p-3">
                    Data kualitas per perangkat belum tersedia.
                  </td>
                </tr>
              ) : (
                perDeviceQuality.map((dq, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700 }}>{dq.stream}</td>
                    <td className="mono">{dq.device}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{dq.missingness ?? '—'}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{dq.artifact ?? '—'}</td>
                    <td className="mono" style={{ color: 'var(--teal)', fontWeight: 800 }}>{dq.qSignal ?? '—'}</td>
                    <td>
                      <span className={`evidence-chip ${dq.status === 'Normal' || dq.status === 'Connected' ? 'chip-green' : 'chip-amber'}`}>
                        {dq.status}
                      </span>
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
