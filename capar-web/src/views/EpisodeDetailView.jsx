import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ReferenceDot, ReferenceArea, CartesianGrid
} from 'recharts';
import { ArrowLeft, CheckCircle, AlertTriangle, AlertCircle, Clock } from 'lucide-react';

const formatTime = (ts) => {
  if (!ts) return '-';
  let raw = ts;
  if (raw && typeof raw === 'object' && raw.$date) raw = raw.$date;
  if (typeof raw === 'number' && raw < 20000000000) raw *= 1000;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
};

export default function EpisodeDetailView({ episodeId, onBack }) {
  const [detail, setDetail] = useState(null);
  const [trajectory, setTrajectory] = useState([]);
  const [context, setContext] = useState([]);
  const [audit, setAudit] = useState([]);
  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis' or 'audit'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    // If episodeId is empty, try passing 'latest' or fetch fallback
    const targetId = episodeId || 'latest';

    Promise.all([
      api.getEpisodeDetail(targetId).catch(err => ({ error: err.message })),
      api.getEpisodeTrajectory(targetId).catch(() => ({ items: [] })),
      api.getEpisodeContext(targetId).catch(() => ({ items: [] })),
      api.getEpisodeAudit(targetId).catch(() => ({ items: [] }))
    ]).then(([d, t, c, a]) => {
      if (!isMounted) return;

      if (d?.error || !d?.data) {
        setError(d?.error || d?.message || 'Detail episode tidak ditemukan.');
      } else {
        setDetail(d.data);
        setTrajectory(Array.isArray(t?.items) ? t.items : []);
        setContext(Array.isArray(c?.items) ? c.items : []);
        setAudit(Array.isArray(a?.items) ? a.items : []);
      }
    }).catch(err => {
      if (isMounted) {
        console.error('[EpisodeDetailView] Error:', err);
        setError(err.message || 'Gagal memuat detail episode.');
      }
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [episodeId]);

  if (loading) {
    return (
      <div className="card-panel p-4 text-center my-4" style={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner-border text-teal mb-3" role="status"></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>Memuat Detail Episode...</div>
        <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 4 }}>Mengambil trajectory, context telemetry, dan audit log...</div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="card-panel p-4 my-3">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <button className="btn btn-sm btn-outline-navy" onClick={onBack}>
            <ArrowLeft size={16} className="me-2" /> Kembali ke Event Generator
          </button>
        </div>
        <div className="alert alert-warning d-flex align-items-center gap-2 mb-0" role="alert">
          <AlertTriangle size={20} className="text-warning flex-shrink-0" />
          <div>
            <strong>Episode Tidak Ditemukan:</strong> {error || 'Silakan pilih episode valid dari Event Generator atau Episode List.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="episode-detail">
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-sm btn-link text-decoration-none px-0" onClick={onBack}>
          <ArrowLeft size={16} className="me-2" /> Back to Event Generator
        </button>
      </div>

      {/* Header */}
      <div className="card-panel mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <div className="mini-label">EPISODE DETAIL</div>
            <h3>Episode {detail.eventId}</h3>
            <div className="text-muted small">Participant: {detail.participantId}</div>
          </div>
          <div className="text-end">
            <OutcomeCard status={detail.adminStatus} outcome={detail.outcome} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'analysis' ? 'active font-weight-bold text-navy' : 'text-muted'}`} onClick={() => setActiveTab('analysis')}>Analysis & Review</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'audit' ? 'active font-weight-bold text-navy' : 'text-muted'}`} onClick={() => setActiveTab('audit')}>Audit & Provenance</button>
        </li>
      </ul>

      {activeTab === 'analysis' && (
        <>
          <section className="summary-grid">
            <MetricCard 
              label="Waktu Onset" 
              value={trajectory.length > 0 && trajectory[0].timeLabel ? trajectory[0].timeLabel : formatTime(detail.onsetAt)} 
            />
            <MetricCard 
              label="Waktu & Skor Peak" 
              value={detail.peakScore != null ? detail.peakScore.toFixed(2) : '-'} 
              subValue={(() => {
                const peakPoint = trajectory.find(p => p.eventMarker === 'PEAK');
                const tStr = peakPoint?.timeLabel || formatTime(detail.peakAt);
                return tStr ? `di ${tStr}` : '';
              })()}
              tone="danger" 
            />
            <MetricCard label="Durasi" value={api.formatDurationMs(detail.duration_ms, detail.current_state || detail.status)} />
            <MetricCard label="Relapse Count" value={detail.relapseCount} />
          </section>

          <section className="analysis-grid mt-3">
            <div className="main-chart-area">
              <ScoreTrajectoryChart episode={detail} points={trajectory} />
              <StateTimeline points={trajectory} />
              {/* Gunakan trajectory (sama dengan chart) agar waktu selaras */}
              <ContextTrack rows={trajectory} />
              <SignalQualityTrack rows={trajectory} />
            </div>
            <aside className="side-area">
              <EpisodeMetrics episode={detail} />
              <ReviewerValidation episodeId={episodeId} initialDecision={detail.reviewerDecision} onSaved={() => {
                api.getEpisodeDetail(episodeId).then(d => setDetail(d.data));
                api.getEpisodeAudit(episodeId).then(a => setAudit(a.items));
              }} />
            </aside>
          </section>
        </>
      )}

      {activeTab === 'audit' && (
        <div className="card-panel">
          <h4>Audit & Provenance</h4>
          <table className="table table-sm mt-3">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Rule Version</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {audit.map(a => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                  <td><strong>{a.action}</strong></td>
                  <td>{a.actor}</td>
                  <td>{a.rule_version}</td>
                  <td><pre style={{ fontSize: 10, margin: 0 }}>{JSON.stringify(a.payload, null, 2)}</pre></td>
                </tr>
              ))}
              {audit.length === 0 && <tr><td colSpan="5">No audit trail yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Subcomponents

function MetricCard({ label, value, subValue, tone }) {
  const color = tone === 'danger' ? 'var(--red)' : 'var(--navy)';
  return (
    <div className="card-panel" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
        {subValue && <div style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600 }}>{subValue}</div>}
      </div>
    </div>
  );
}

function OutcomeCard({ status, outcome }) {
  return (
    <div>
      <div className="d-flex align-items-center gap-2 justify-content-end mb-1">
        <span style={{ fontSize: 11, fontWeight: 700 }} className="text-muted">Admin Status:</span>
        <span className={`badge ${status === 'CLOSED' ? 'bg-secondary' : 'bg-success'}`}>{status}</span>
      </div>
      <div className="d-flex align-items-center gap-2 justify-content-end">
        <span style={{ fontSize: 11, fontWeight: 700 }} className="text-muted">Physiological Outcome:</span>
        <span className={`badge ${outcome === 'RECOVERED' ? 'bg-success' : 'bg-danger'}`}>{outcome}</span>
      </div>
      {status === 'CLOSED' && outcome === 'UNRESOLVED' && (
        <div className="text-danger mt-2" style={{ fontSize: 11, maxWidth: 250, textAlign: 'right' }}>
          <AlertCircle size={12} className="me-1" />
          Administratively closed, but physiological recovery is not met.
        </div>
      )}
    </div>
  );
}

function ScoreTrajectoryChart({ episode, points }) {
  const markers = points.filter(p => p.eventMarker);
  const maxScore = Math.max(3.5, ...points.map(p => p.score || 0));

  const markerColor = (marker) => {
    return {
      'ONSET': '#EF8D00',
      'PEAK': '#D32F2F',
      'PARTIAL_RECOVERY': '#2E6FBD',
      'REBOUND': '#D32F2F',
      'RECOVERY_ENTRY': '#2E6FBD',
      'RECOVERED': '#1A8F5B'
    }[marker] || '#64748B';
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const color = data.score >= episode.tauIn ? '#D32F2F' : (data.score >= episode.tauOut ? '#EF8D00' : '#1A8F5B');

    return (
      <div style={{
        background: 'var(--navy)',
        color: '#fff',
        padding: '10px 14px',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.1)',
        fontSize: 12,
        minWidth: 180
      }}>
        <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, marginBottom: 4 }}>
          {data.timeLabel} {data.eventMarker && `• ${data.eventMarker}`}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color }}>
          Score: {data.score?.toFixed(2)}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, opacity: 0.9 }}>
          State: <strong>{data.state}</strong>
        </div>
        <div style={{ fontSize: 11, opacity: 0.8 }}>
          Context: <strong>{data.activityContext}</strong> | Quality: <span style={{ color: '#81C784' }}>{data.qualityFlag}</span>
        </div>
        {/* Tambahan multi-model */}
        {data.hrv && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: 10 }}>
            <div>HR: {data.hr} | SDNN: {data.hrv.sdnn?.toFixed(1) || '-'} | RMSSD: {data.hrv.rmssd?.toFixed(1) || '-'} {data.hrv.dfa != null ? `| DFAα1: ${data.hrv.dfa.toFixed(2)}` : ''}</div>
            {data.zScores && (
              <div style={{ color: '#90CAF9', marginTop: 2 }}>
                Z-Score HR: {data.zScores.z_hr?.toFixed(2) || '-'} | RR: {data.zScores.z_rr?.toFixed(2) || '-'}
              </div>
            )}
            <div style={{ color: data.signalQuality === 'Valid' ? '#81C784' : '#E57373', marginTop: 2 }}>
               Signal Quality: {data.signalQuality} (Q: {data.qSignal?.toFixed(2) || '-'})
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card-panel mb-3" style={{ background: 'linear-gradient(180deg, var(--surface) 0%, #FAFCFD 100%)' }}>
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <div>
          <div className="mini-label m-0" style={{ color: 'var(--teal)' }}>PHYSIOLOGICAL TRAJECTORY</div>
          <h5 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
            Score vs Time Trajectory & Threshold Markers
          </h5>
        </div>
        <div className="d-flex gap-3 align-items-center" style={{ fontSize: 11, fontWeight: 700 }}>
          <span className="d-flex align-items-center gap-1">
            <span style={{ width: 12, height: 3, background: '#C62828', display: 'inline-block', borderRadius: 2 }} />
            tau_in ({episode.tauIn})
          </span>
          <span className="d-flex align-items-center gap-1">
            <span style={{ width: 12, height: 3, background: '#EF8D00', display: 'inline-block', borderRadius: 2 }} />
            tau_out ({episode.tauOut})
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={points} margin={{ top: 25, right: 25, bottom: 5, left: -15 }}>
          <defs>
            <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#087F7A" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#087F7A" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="rgba(0,0,0,0.07)"
          />
          {/* Grid tegas di batas state — garis solid merah & oranye */}
          {/* Threshold Zone Background Highlights */}
          <ReferenceArea y1={0} y2={episode.tauOut} fill="#1A8F5B" fillOpacity={0.05} />
          <ReferenceArea y1={episode.tauOut} y2={episode.tauIn} fill="#EF8D00" fillOpacity={0.06} />
          <ReferenceArea y1={episode.tauIn} y2={maxScore + 0.5} fill="#D32F2F" fillOpacity={0.06} />

          <XAxis dataKey="timeLabel" minTickGap={25} tick={{ fontSize: 11, fill: 'var(--gray)' }} axisLine={{ stroke: '#E0E0E0' }} />
          <YAxis
            domain={[0, Math.ceil(maxScore + 0.2)]}
            tick={{ fontSize: 11, fill: 'var(--gray)' }}
            axisLine={{ stroke: '#E0E0E0' }}
            ticks={[
              0,
              ...Array.from({ length: Math.ceil(maxScore / 0.5) + 1 }, (_, i) => parseFloat((i * 0.5).toFixed(1)))
            ]}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />

          {/* Reference Lines */}
          <ReferenceLine y={episode.tauIn} stroke="#C62828" strokeDasharray="4 4" strokeWidth={1.5}
            label={{ position: 'insideTopLeft', value: `tau_in = ${episode.tauIn}`, fill: '#C62828', fontSize: 10, fontWeight: 700 }} />
          <ReferenceLine y={episode.tauOut} stroke="#EF8D00" strokeDasharray="4 4" strokeWidth={1.5}
            label={{ position: 'insideTopLeft', value: `tau_out = ${episode.tauOut}`, fill: '#EF8D00', fontSize: 10, fontWeight: 700 }} />

          {/* Vertical Marker Lines for Onset and Recovery */}
          {markers.filter(m => m.eventMarker === 'ONSET').map((m, i) => (
            <ReferenceLine key={`onset-line-${i}`} x={m.timeLabel} stroke="#C62828" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.7} />
          ))}
          {markers.filter(m => m.eventMarker === 'RECOVERED' || m.eventMarker === 'RECOVERY_ENTRY').map((m, i) => (
            <ReferenceLine key={`rec-line-${i}`} x={m.timeLabel} stroke="#EF8D00" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.7} />
          ))}
          {/* Score Area & Line */}
          <Area type="monotone" dataKey="score" fill="url(#scoreAreaGrad)" stroke="none" isAnimationActive={false} />
          <Line type="monotone" dataKey="score" stroke="#087F7A" strokeWidth={3} dot={points.length <= 1 ? { r: 4, fill: '#087F7A', stroke: '#fff', strokeWidth: 2 } : false} isAnimationActive={false} />

          {/* Event Markers */}
          {markers.map((m, i) => (
            <ReferenceDot
              key={i}
              x={m.timeLabel}
              y={m.score}
              r={6}
              fill={markerColor(m.eventMarker)}
              stroke="#ffffff"
              strokeWidth={2.5}
              label={{
                value: m.eventMarker,
                position: 'top',
                fontSize: 10,
                fontWeight: 800,
                fill: markerColor(m.eventMarker),
                dy: -4
              }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function StateTimeline({ points }) {
  // Collapse adjacent identical states
  const collapsed = useMemo(() => {
    const res = [];
    let cur = null;
    points.forEach(p => {
      if (!cur || cur.state !== p.state) {
        if (cur) res.push(cur);
        cur = { state: p.state, start: p.timeLabel, count: 1 };
      } else {
        cur.count++;
      }
    });
    if (cur) res.push(cur);
    return res;
  }, [points]);

  const stateColor = (st) => {
    if (st.includes('BASELINE') || st.includes('Normal') || st.includes('Resolved')) return '#e8f6ed';
    if (st.includes('PERSISTENT') || st.includes('Alert')) return '#fde7e7';
    return '#fdf3e1'; // Deviation/Candidate
  };
  const stateTextColor = (st) => {
    if (st.includes('BASELINE') || st.includes('Normal') || st.includes('Resolved')) return '#16764b';
    if (st.includes('PERSISTENT') || st.includes('Alert')) return '#b42318';
    return '#b54708';
  };

  // Padding kiri/kanan harus sesuai margin chart (YAxis ≈ 30px di kiri, right margin 25px)
  const CHART_LEFT_PAD = 30;
  const CHART_RIGHT_PAD = 25;

  return (
    <div className="card-panel mb-3" style={{ padding: '8px 14px' }}>
      <h5 style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>State Timeline</h5>
      <div style={{ display: 'flex', overflow: 'hidden', borderRadius: 6, border: '1px solid var(--line)', marginLeft: CHART_LEFT_PAD, marginRight: CHART_RIGHT_PAD }}>
        {collapsed.map((c, i) => (
          <div key={i} style={{ 
            flex: Math.max(c.count, 1), 
            background: stateColor(c.state), 
            color: stateTextColor(c.state),
            padding: '4px 6px',
            fontSize: 10,
            fontWeight: 700,
            textAlign: 'center',
            borderRight: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }} title={c.state}>
            {c.state}
          </div>
        ))}
        {collapsed.length === 0 && <div className="text-muted small">No state data</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 2, marginLeft: CHART_LEFT_PAD, marginRight: CHART_RIGHT_PAD }}>
        <span style={{ fontSize: 10, color: 'var(--gray)' }}>{points[0]?.timeLabel || ''}</span>
        <span style={{ fontSize: 10, color: 'var(--gray)' }}>{points[points.length - 1]?.timeLabel || ''}</span>
      </div>
    </div>
  );
}

function ContextTrack({ rows }) {
  // Kelompokkan segmen yang berurutan dengan activity yang sama (sama seperti StateTimeline)
  const collapsed = useMemo(() => {
    const res = [];
    let cur = null;
    rows.forEach(p => {
      const act = p.activityContext || p.activity || 'sitting';
      if (!cur || cur.activity !== act) {
        if (cur) res.push(cur);
        cur = { activity: act, start: p.timeLabel, count: 1 };
      } else {
        cur.count++;
        cur.end = p.timeLabel;
      }
    });
    if (cur) res.push(cur);
    return res;
  }, [rows]);

  const actColor = (act) => {
    if (!act) return { bg: '#f1f5f9', text: '#64748b' };
    const a = act.toLowerCase();
    if (a.includes('walk')) return { bg: '#dbeafe', text: '#1d4ed8' };
    if (a.includes('run') || a.includes('exercise')) return { bg: '#fce7f3', text: '#be185d' };
    if (a.includes('sleep') || a.includes('lie')) return { bg: '#ede9fe', text: '#6d28d9' };
    if (a.includes('stand')) return { bg: '#d1fae5', text: '#065f46' };
    return { bg: '#f1f5f9', text: '#475569' }; // sitting / default
  };

  if (collapsed.length === 0) return null;

  // Padding harus selaras dengan StateTimeline dan chart
  const CHART_LEFT_PAD = 30;
  const CHART_RIGHT_PAD = 25;

  return (
    <div className="card-panel mb-3" style={{ padding: '8px 14px' }}>
      <h5 style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Context Track</h5>
      <div style={{ display: 'flex', overflow: 'hidden', borderRadius: 6, border: '1px solid var(--line)', marginLeft: CHART_LEFT_PAD, marginRight: CHART_RIGHT_PAD, marginBottom: 4 }}>
        {collapsed.map((c, i) => {
          const { bg, text } = actColor(c.activity);
          return (
            <div
              key={i}
              style={{
                flex: Math.max(c.count, 1),
                background: bg,
                color: text,
                padding: '4px 6px',
                fontSize: 10,
                fontWeight: 700,
                textAlign: 'center',
                borderRight: 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textTransform: 'capitalize',
              }}
              title={`${c.activity} (${c.count} segmen, mulai ${c.start})`}
            >
              {c.activity}
            </div>
          );
        })}
      </div>
      {/* Label waktu awal dan akhir — pakai timeLabel yang identik dengan chart X-axis */}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 2, marginLeft: CHART_LEFT_PAD, marginRight: CHART_RIGHT_PAD }}>
        <span style={{ fontSize: 10, color: 'var(--gray)' }}>
          {rows[0]?.timeLabel || ''}
        </span>
        <span style={{ fontSize: 10, color: 'var(--gray)' }}>
          {rows[rows.length - 1]?.timeLabel || ''}
        </span>
      </div>
    </div>
  );
}


function SignalQualityTrack({ rows }) {
  const collapsed = useMemo(() => {
    const res = [];
    let cur = null;
    rows.forEach(p => {
      const sq = p.signalQuality || 'Valid';
      if (!cur || cur.sq !== sq) {
        if (cur) res.push(cur);
        cur = { sq, start: p.timeLabel, count: 1 };
      } else {
        cur.count++;
      }
    });
    if (cur) res.push(cur);
    return res;
  }, [rows]);

  const sqColor = (sq) => {
    if (sq === 'Valid') return { bg: '#e8f6ed', text: '#16764b' };
    if (sq === 'Artifact') return { bg: '#fde7e7', text: '#b42318' };
    return { bg: '#f1f5f9', text: '#64748b' };
  };
  
  if (collapsed.length === 0) return null;
  const CHART_LEFT_PAD = 30;
  const CHART_RIGHT_PAD = 25;

  return (
    <div className="card-panel mb-3" style={{ padding: '8px 14px' }}>
      <h5 style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signal Quality</h5>
      <div style={{ display: 'flex', overflow: 'hidden', borderRadius: 6, border: '1px solid var(--line)', marginLeft: CHART_LEFT_PAD, marginRight: CHART_RIGHT_PAD, marginBottom: 4 }}>
        {collapsed.map((c, i) => {
          const { bg, text } = sqColor(c.sq);
          return (
            <div key={i} style={{ flex: Math.max(c.count, 1), background: bg, color: text, padding: '4px 6px', fontSize: 10, fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.sq}>{c.sq}</div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 2, marginLeft: CHART_LEFT_PAD, marginRight: CHART_RIGHT_PAD }}>
        <span style={{ fontSize: 10, color: 'var(--gray)' }}>{rows[0]?.timeLabel || ''}</span>
        <span style={{ fontSize: 10, color: 'var(--gray)' }}>{rows[rows.length - 1]?.timeLabel || ''}</span>
      </div>
    </div>
  );
}


function EpisodeMetrics({ episode }) {
  // ── Null-safe formatters ───────────────────────────────────────────────────
  const fmtNum  = (val, dec = 2) => (val != null && !isNaN(val)) ? Number(val).toFixed(dec) : null;
  const fmtMin  = (val)          => (val != null && !isNaN(val)) ? `${val} min` : null;

  // Badge untuk nilai yang tidak tersedia — menjelaskan alasannya
  const NaTag = ({ reason }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 700,
      color: '#94a3b8', background: '#f1f5f9',
      border: '1px dashed #cbd5e1',
      borderRadius: 4, padding: '2px 6px',
      cursor: 'default'
    }} title={reason}>
      — {reason}
    </span>
  );

  const stateColor = (st) => {
    if (!st) return 'var(--gray)';
    if (st.includes('PERSISTENT')) return 'var(--red)';
    if (st.includes('CANDIDATE'))  return 'var(--amber)';
    if (st.includes('RECOVERY') || st.includes('RECOVERED')) return 'var(--teal)';
    if (st.includes('BASELINE'))   return 'var(--green)';
    return 'var(--navy)';
  };

  const aucVal     = fmtNum(episode.aucD);
  const ttrVal     = fmtMin(episode.ttrMin);
  const peakVal    = episode.peakCount ?? null;

  return (
    <div className="card-panel mb-3">
      <h5 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Metrics</h5>
      <ul className="list-unstyled mb-0" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* AUC-D */}
        <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-muted" title="Area Under Curve (Deviation) — integral anomaly score selama episode berlangsung">AUC-D:</span>
          {aucVal != null
            ? <strong style={{ color: 'var(--navy)', fontFamily: 'monospace' }}>{aucVal}</strong>
            : <NaTag reason="Tidak ada segmen terhubung" />
          }
        </li>

        {/* TTR */}
        <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-muted" title="Time to Recovery — durasi dari onset sampai kondisi kembali ke baseline">TTR:</span>
          {ttrVal != null
            ? <strong style={{ color: 'var(--teal)', fontFamily: 'monospace' }}>{ttrVal}</strong>
            : <NaTag reason="Episode belum recovery" />
          }
        </li>

        {/* Peak Count */}
        <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-muted" title="Jumlah window dengan anomaly score ≥ tau_in">Peak Count:</span>
          {peakVal != null
            ? <strong style={{ color: peakVal > 0 ? 'var(--red)' : 'var(--gray)', fontFamily: 'monospace' }}>
                {peakVal}
              </strong>
            : <NaTag reason="Tidak ada segmen terhubung" />
          }
        </li>

        {/* Current State */}
        <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 4, borderTop: '1px solid var(--line)', marginTop: 2 }}>
          <span className="text-muted">State Saat Ini:</span>
          {episode.currentState
            ? <strong style={{
                fontSize: 11, textAlign: 'right', maxWidth: 150,
                color: stateColor(episode.currentState),
                fontFamily: 'monospace', wordBreak: 'break-word'
              }}>
                {episode.currentState}
              </strong>
            : <NaTag reason="Tidak ada data state" />
          }
        </li>

        {/* Multi-model Analysis Data */}
        {episode.analysis && (
          <>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--line)', marginTop: 2 }}>
              <span className="text-muted" title="Latent Severity Index">Latent Severity:</span>
              <strong style={{ color: 'var(--amber)', fontFamily: 'monospace' }}>
                {fmtNum(episode.analysis.latentSeverity) || <NaTag reason="N/A" />}
              </strong>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted" title="Mean Quality Score">Quality Score:</span>
              <strong style={{ color: 'var(--teal)', fontFamily: 'monospace' }}>
                {episode.analysis.meanQuality ? (episode.analysis.meanQuality * 100).toFixed(0) + '%' : <NaTag reason="N/A" />}
              </strong>
            </li>
            
            {episode.totalPausedMs > 0 && (
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted" title="Total waktu di-pause (ms)">Total Paused:</span>
              <strong style={{ color: 'var(--red)', fontFamily: 'monospace' }}>
                {(episode.totalPausedMs / 60000).toFixed(1)} min
              </strong>
            </li>
            )}

            {episode.zScoresAtPeak && (
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px dashed var(--line)', marginTop: 2 }}>
              <span className="text-muted" title="Z-Scores at Peak (HR / RR)">Peak Z-Score:</span>
              <strong style={{ color: 'var(--navy)', fontSize: 10, fontFamily: 'monospace' }}>
                HR: {episode.zScoresAtPeak.z_hr?.toFixed(1) || '-'} | RR: {episode.zScoresAtPeak.z_rr?.toFixed(1) || '-'}
              </strong>
            </li>
            )}

            {episode.analysis.evaluations && (
              <li style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                <span className="text-muted" style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 700 }}>Clinical Evaluations (E1-E6):</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                   {Object.entries(episode.analysis.evaluations).map(([k, v]) => (
                     <span key={k} style={{ 
                        fontSize: 9, fontWeight: 700, padding: '2px 4px', borderRadius: 4,
                        background: v.result === 'PASS' ? '#e8f6ed' : (v.result === 'FAIL' ? '#fde7e7' : '#f1f5f9'),
                        color: v.result === 'PASS' ? '#16764b' : (v.result === 'FAIL' ? '#b42318' : '#64748b')
                     }} title={`Score: ${v.score || '-'}`}>{k}: {v.result || 'N/A'}</span>
                   ))}
                </div>
              </li>
            )}
          </>
        )}

      </ul>
    </div>
  );
}



function ReviewerValidation({ episodeId, initialDecision, onSaved }) {
  const [decision, setDecision] = useState(initialDecision || 'UNCERTAIN');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.reviewEpisode(episodeId, { decision, note });
      setNote('');
      onSaved();
    } catch (e) {
      alert('Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-panel" style={{ border: '1px solid var(--teal)' }}>
      <h5 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: 'var(--navy)' }}>Reviewer Validation</h5>
      <div className="d-flex flex-column gap-2 mb-3">
        {['VALID', 'INVALID', 'UNCERTAIN'].map(d => (
          <label key={d} className="d-flex align-items-center gap-2" style={{ cursor: 'pointer', fontSize: 13 }}>
            <input type="radio" name="decision" value={d} checked={decision === d} onChange={() => setDecision(d)} />
            {d}
          </label>
        ))}
      </div>
      <textarea 
        className="form-control mb-3" 
        rows={3} 
        placeholder="Add analytical notes..."
        value={note}
        onChange={e => setNote(e.target.value)}
        style={{ fontSize: 12 }}
      />
      <button className="btn-solid-teal w-100" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Decision'}
      </button>
    </div>
  );
}
