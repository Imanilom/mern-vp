import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ReferenceDot, ReferenceArea, CartesianGrid
} from 'recharts';
import { ArrowLeft, CheckCircle, AlertTriangle, AlertCircle, Clock } from 'lucide-react';

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
            <MetricCard label="Onset" value={new Date(detail.onsetAt).toLocaleTimeString()} />
            <MetricCard label="Peak" value={detail.peakScore.toFixed(2)} tone="danger" />
            <MetricCard label="Duration" value={`${detail.durationMin}m`} />
            <MetricCard label="Relapse Count" value={detail.relapseCount} />
          </section>

          <section className="analysis-grid mt-3">
            <div className="main-chart-area">
              <ScoreTrajectoryChart episode={detail} points={trajectory} />
              <StateTimeline points={trajectory} />
              <ContextTrack rows={context} />
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

function MetricCard({ label, value, tone }) {
  const color = tone === 'danger' ? 'var(--red)' : 'var(--navy)';
  return (
    <div className="card-panel" style={{ padding: '12px 16px' }}>
      <div className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
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

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
          
          {/* Threshold Zone Background Highlights */}
          <ReferenceArea y1={0} y2={episode.tauOut} fill="#1A8F5B" fillOpacity={0.05} />
          <ReferenceArea y1={episode.tauOut} y2={episode.tauIn} fill="#EF8D00" fillOpacity={0.06} />
          <ReferenceArea y1={episode.tauIn} y2={maxScore + 0.5} fill="#D32F2F" fillOpacity={0.06} />

          <XAxis dataKey="timeLabel" minTickGap={25} tick={{ fontSize: 11, fill: 'var(--gray)' }} axisLine={{ stroke: '#E0E0E0' }} />
          <YAxis domain={[0, Math.ceil(maxScore + 0.2)]} tick={{ fontSize: 11, fill: 'var(--gray)' }} axisLine={{ stroke: '#E0E0E0' }} />
          <Tooltip content={<CustomTooltip />} />

          {/* Reference Lines */}
          <ReferenceLine y={episode.tauIn} stroke="#C62828" strokeDasharray="4 4" strokeWidth={1.5}
            label={{ position: 'insideTopLeft', value: `tau_in = ${episode.tauIn}`, fill: '#C62828', fontSize: 10, fontWeight: 700 }} />
          <ReferenceLine y={episode.tauOut} stroke="#EF8D00" strokeDasharray="4 4" strokeWidth={1.5}
            label={{ position: 'insideTopLeft', value: `tau_out = ${episode.tauOut}`, fill: '#EF8D00', fontSize: 10, fontWeight: 700 }} />

          {/* Score Area & Line */}
          <Area type="monotone" dataKey="score" fill="url(#scoreAreaGrad)" stroke="none" isAnimationActive={false} />
          <Line type="monotone" dataKey="score" stroke="#087F7A" strokeWidth={3} dot={false} isAnimationActive={false} />

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

  return (
    <div className="card-panel mb-3">
      <h5 style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray)' }}>STATE TIMELINE</h5>
      <div className="d-flex mt-2" style={{ overflow: 'hidden', borderRadius: 8 }}>
        {collapsed.map((c, i) => (
          <div key={i} style={{ 
            flex: Math.max(c.count, 1), 
            background: stateColor(c.state), 
            color: stateTextColor(c.state),
            padding: '6px',
            fontSize: 10,
            fontWeight: 700,
            textAlign: 'center',
            borderRight: '1px solid #fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }} title={c.state}>
            {c.state}
          </div>
        ))}
        {collapsed.length === 0 && <div className="text-muted small">No state data</div>}
      </div>
    </div>
  );
}

function ContextTrack({ rows }) {
  return (
    <div className="card-panel">
      <h5 style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray)' }}>CONTEXT TRACK</h5>
      <div className="d-flex gap-2 flex-nowrap" style={{ overflowX: 'auto', paddingBottom: 8 }}>
        {rows.map((r, i) => (
          <div key={i} className="d-flex flex-column align-items-center" style={{ minWidth: 60 }}>
            <span style={{ fontSize: 10, color: '#888' }}>{new Date(r.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            <span className="badge bg-light text-dark mt-1" style={{ fontSize: 9 }}>{r.activity}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="text-muted small">No context data</div>}
      </div>
    </div>
  );
}

function EpisodeMetrics({ episode }) {
  return (
    <div className="card-panel mb-3">
      <h5 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Metrics</h5>
      <ul className="list-unstyled mb-0" style={{ fontSize: 12 }}>
        <li className="d-flex justify-content-between mb-2">
          <span className="text-muted">AUC-D (Area):</span>
          <strong>{episode.aucD ? episode.aucD.toFixed(2) : '-'}</strong>
        </li>
        <li className="d-flex justify-content-between mb-2">
          <span className="text-muted">TTR (Time to Recovery):</span>
          <strong>{episode.ttrMin ? `${episode.ttrMin} min` : 'N/A'}</strong>
        </li>
        <li className="d-flex justify-content-between mb-2">
          <span className="text-muted">Peak Count:</span>
          <strong>{episode.peakCount}</strong>
        </li>
        <li className="d-flex justify-content-between mb-0">
          <span className="text-muted">Current State:</span>
          <strong>{episode.currentState}</strong>
        </li>
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
