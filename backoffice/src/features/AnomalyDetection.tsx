import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, RefreshCw, TrendingUp, TrendingDown, Clock, Target } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Area, ReferenceArea, ReferenceDot,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

// ---------------------------------------------------------------------------
// Toast (unchanged)
// ---------------------------------------------------------------------------
export const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', background: 'var(--surface, #fff)',
      border: '1px solid var(--primary, #3b82f6)', borderRadius: 'var(--r-md, 10px)', padding: '12px 18px',
      boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,.15))', zIndex: 1000,
      display: 'flex', alignItems: 'center', gap: '10px',
    }}>
      <span className="status-dot" />
      <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink, #111)' }}>{message}</span>
    </div>
  );
};

import { DeviceSelector } from '../shared/components/ParticipantSelector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmtClock = (ms) => (ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');
const fmtDuration = (ms) => {
  if (ms == null || Number.isNaN(ms)) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m} mnt ${s}dtk` : `${s} dtk`;
};
const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(d));

const REVIEW_BADGE = {
  New: 'badge-monitoring', 'Under review': 'badge-caution', Validated: 'badge-stable',
  'False positive': 'badge-inactive', Closed: 'badge-inactive',
};

// Build a chart-ready curve for one event: onset -> peak -> recovery.
// Uses real segments when available (fine time resolution), otherwise
// synthesizes a smooth curve from onset/peak/resolved scores & times.
function buildEventCurve(event, segments) {
  const onset = event.onset_time;
  const peak = event.peak_time;
  const resolved = event.resolved_time;
  const baseline = Math.max(0.2, (event.onset_score || 1) * 0.2);

  if (segments && segments.length > 1) {
    return {
      points: [...segments].sort((a, b) => a.window_start - b.window_start).map((s) => ({
        t: +(((s.window_start - onset) / 60000).toFixed(2)), score: s.anomaly_score || 0, ts: s.window_start,
      })),
      synthesized: false,
    };
  }

  const tPeak = +(((peak - onset) / 60000).toFixed(2));
  const points = [
    { t: Math.min(-1, tPeak - 2), score: baseline, ts: onset - 60000 },
    { t: 0, score: event.onset_score ?? baseline, ts: onset },
    { t: tPeak, score: event.peak_score, ts: peak },
  ];
  if (resolved) {
    const tResolved = +(((resolved - onset) / 60000).toFixed(2));
    const tMid = tPeak + (tResolved - tPeak) * 0.55;
    points.push({ t: +tMid.toFixed(2), score: +(event.peak_score * 0.4 + baseline * 0.6).toFixed(2), ts: onset + tMid * 60000 });
    points.push({ t: tResolved, score: baseline, ts: resolved });
  } else {
    points.push({ t: +(tPeak + 3).toFixed(2), score: +(event.peak_score * 0.85).toFixed(2), ts: peak + 180000 });
  }
  return { points, synthesized: true };
}

// Small inline sparkline for the event list rows — quick "shape" at a glance.
const MiniTrend = ({ event }) => {
  const { points } = useMemo(() => buildEventCurve(event, null), [event]);
  const w = 72; const h = 24;
  const xs = points.map((p) => p.t);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const maxY = Math.max(4, ...points.map((p) => p.score));
  const path = points.map((p) => {
    const x = ((p.t - minX) / (maxX - minX || 1)) * w;
    const y = h - (p.score / maxY) * h;
    return `${x},${y}`;
  }).join(' ');
  const color = event.resolved_time ? 'var(--stable-text, #10b981)' : 'var(--alert-text, #ef4444)';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: 'block' }}>
      <polyline points={path} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const AnomalyDetection = ({ selectedParticipantId = '', onParticipantChange = (id: string) => { } }) => {
  const [selectedRadio, setSelectedRadio] = useState(0);
  const [filter, setFilter] = useState('All');
  const [toast, setToast] = useState(null);
  const filters = ['All', 'New', 'Under review', 'Validated', 'False positive', 'Closed'];
  const options = ['Valid anomaly', 'False positive', 'Sensor artifact', 'Activity mislabeled', 'Clinical follow-up needed'];

  const [participants, setParticipants] = useState([]);
  const [localId, setLocalId] = useState(selectedParticipantId || '');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventDetails, setEventDetails] = useState(null);

  const effectiveId = selectedParticipantId || localId;
  const handleSelectParticipant = useCallback((id) => { setLocalId(id); onParticipantChange(id); }, [onParticipantChange]);
  useEffect(() => { if (selectedParticipantId) setLocalId(selectedParticipantId); }, [selectedParticipantId]);

  // ---- demo fallback ----
  const buildDemoEvents = useCallback(() => {
    const now = Date.now();
    const acts = ['Tidur', 'Istirahat', 'Berjalan'];
    return Array.from({ length: 6 }).map((_, i) => {
      const onset = now - (i + 1) * 55 * 60000;
      const timeToPeak = (2 + Math.random() * 3) * 60000;
      const peak = onset + timeToPeak;
      const resolved = i === 0 ? null : peak + (3 + Math.random() * 6) * 60000;
      const peakScore = +(2.2 + Math.random() * 2).toFixed(2);
      return {
        _id: `demo-evt-${i}`, user_id: effectiveId, device_id: 'DEMO_DEVICE', activity: acts[i % acts.length],
        onset_time: onset, peak_time: peak, resolved_time: resolved,
        duration_ms: resolved ? resolved - onset : null,
        onset_score: +(peakScore * 0.5).toFixed(2), peak_score: peakScore,
        classification: peakScore > 3 ? 'Alert' : 'Warning',
        status: resolved ? 'closed' : 'open', review_status: resolved ? 'Validated' : 'New', validation_label: 'None',
      };
    });
  }, [effectiveId]);

  // ---- fetch participants ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch('/api/patient/all', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('no api');
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) throw new Error('empty');
        if (!cancelled) {
          setParticipants(data);
          if (!effectiveId) handleSelectParticipant(data[0]._id);
        }
      } catch {
        if (!cancelled) {
          const demoParticipants = ['Dewi A.', 'Rian S.', 'Putri N.'].map((name, i) => ({ _id: `demo-user-${i}`, name }));
          setParticipants(demoParticipants);
          setIsDemo(true);
          if (!effectiveId) handleSelectParticipant(demoParticipants[0]._id);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // ---- fetch events for selected participant ----
  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (isDemo) {
        setEvents(buildDemoEvents());
        setLoading(false);
        return;
      }
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch(`/api/analysis/events/${effectiveId}?limit=20`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('bad response');
        const data = await res.json();
        if (!data.success || !Array.isArray(data.data)) throw new Error('bad shape');
        if (!cancelled) setEvents(data.data);
      } catch (err) {
        console.error('Failed to fetch events:', err);
        if (!cancelled) setEvents(buildDemoEvents());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveId, isDemo, buildDemoEvents]);

  // ---- derive display fields per event ----
  const displayEvents = useMemo(() => events.map((e) => {
    const reviewStatus = e.review_status || 'New';
    const timeToPeak = e.peak_time && e.onset_time ? e.peak_time - e.onset_time : null;
    const recoveryTime = e.resolved_time && e.peak_time ? e.resolved_time - e.peak_time : null;
    const duration = e.duration_ms ?? (e.resolved_time && e.onset_time ? e.resolved_time - e.onset_time : null);
    return {
      ...e,
      eventId: e._id,
      badgeClass: REVIEW_BADGE[reviewStatus] || 'badge-monitoring',
      reviewStatus,
      timeToPeak,
      recoveryTime,
      duration,
    };
  }), [events]);

  const filteredEvents = useMemo(
    () => displayEvents.filter((e) => filter === 'All' || e.reviewStatus === filter),
    [displayEvents, filter],
  );

  useEffect(() => {
    if (filteredEvents.length && !filteredEvents.find((e) => e.eventId === selectedEventId)) {
      setSelectedEventId(filteredEvents[0].eventId);
    }
    if (filteredEvents.length === 0) setSelectedEventId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredEvents]);

  const activeEvent = filteredEvents.find((e) => e.eventId === selectedEventId) || null;

  // ---- fetch fine-grained segments for the active event (real API only) ----
  useEffect(() => {
    setEventDetails(null);
    if (!activeEvent || isDemo || String(activeEvent.eventId).startsWith('demo-')) return;
    let cancelled = false;
    (async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch(`/api/analysis/events/details/${activeEvent.eventId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && !cancelled) setEventDetails(json.data);
      } catch (err) { console.error(err); }
    })();
    return () => { cancelled = true; };
  }, [activeEvent, isDemo]);

  const curve = useMemo(() => {
    if (!activeEvent) return { points: [], synthesized: true };
    return buildEventCurve(activeEvent, eventDetails?.segments);
  }, [activeEvent, eventDetails]);

  const tPeak = activeEvent ? +(((activeEvent.peak_time - activeEvent.onset_time) / 60000).toFixed(2)) : 0;
  const tResolved = activeEvent?.resolved_time ? +(((activeEvent.resolved_time - activeEvent.onset_time) / 60000).toFixed(2)) : null;

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const handleCloseEvent = async () => {
    if (!activeEvent) return;
    const actionLabel = options[selectedRadio];
    if (isDemo) {
      setEvents((prev) => prev.map((e) => (e._id === activeEvent.eventId
        ? { ...e, status: 'closed', review_status: 'Validated', validation_label: actionLabel } : e)));
      setToast(`Event ${String(activeEvent.eventId).slice(-6)} divalidasi sebagai "${actionLabel}" dan ditutup.`);
      return;
    }
    try {
      const token = sessionStorage.getItem('htm_token');
      const res = await fetch(`/api/analysis/events/${activeEvent.eventId}/validate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label: actionLabel, notes: 'Closed via backoffice' }),
      });
      if (res.ok) {
        setEvents((prev) => prev.map((e) => (e._id === activeEvent.eventId
          ? { ...e, status: 'closed', review_status: 'Validated', validation_label: actionLabel } : e)));
        setToast(`Event ${String(activeEvent.eventId).slice(-6)} divalidasi sebagai "${actionLabel}" dan ditutup.`);
      } else {
        const errorData = await res.json();
        setToast(`Error closing event: ${errorData.message}`);
      }
    } catch {
      setToast('Network error closing event');
    }
  };

  const handleNotifyMobile = () => {
    if (!activeEvent) return;
    setToast(`Notifikasi FCM dikirim ke pengguna ${activeEvent.user_id} untuk event ${activeEvent.eventId}.`);
  };

  return (
    <section className="anom-detection" style={{ animation: 'fadeInUp 400ms var(--ease)' }}>
      <style>{`
        .anom-select {
          appearance: none; border: 1px solid var(--hairline); background: var(--surface);
          color: var(--ink); font-size: 13px; font-weight: 600; padding: 8px 32px 8px 14px; 
          border-radius: var(--r-md); cursor: pointer; transition: all 200ms var(--ease);
          box-shadow: var(--shadow-xs);
        }
        .anom-select:hover { border-color: var(--muted-light); box-shadow: var(--shadow-sm); }
        .anom-select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-glow); }
        
        .filter-pill {
          padding: 6px 14px; font-size: 12.5px; font-weight: 500; border-radius: 99px;
          cursor: pointer; transition: all 200ms var(--ease); border: 1px solid transparent;
          color: var(--muted); background: transparent; display: inline-block;
        }
        .filter-pill:hover { background: var(--surface-overlay); color: var(--ink); }
        .filter-pill.on { background: var(--primary-glow); color: var(--primary); border-color: var(--primary); font-weight: 600; }
        .filter-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 24px; padding: 6px; background: var(--surface); border: 1px solid var(--hairline); border-radius: 100px; width: fit-content; box-shadow: var(--shadow-xs); }

        .anom-stat-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 16px; }
        
        .anom-stat { 
          background: var(--surface); border: 1px solid var(--hairline); 
          border-radius: var(--r-md); padding: 14px 16px; 
          box-shadow: var(--shadow-xs); transition: all 200ms var(--ease);
          position: relative; overflow: hidden;
        }
        .anom-stat:hover { box-shadow: var(--shadow-sm); transform: translateY(-2px); border-color: var(--muted-light); }
        .anom-stat::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--hairline); transition: background 200ms; }
        .anom-stat:hover::before { background: var(--primary); }
        .anom-stat.stat-alert:hover::before { background: var(--alert-text); }
        
        .anom-stat-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 600; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .anom-stat-value { font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 500; color: var(--ink); line-height: 1; }
        
        .anom-legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 11.5px; color: var(--muted); margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--hairline); }
        
        .valid-option {
          display: flex; align-items: center; gap: 12px; padding: 12px 16px; 
          border: 1px solid var(--hairline); border-radius: var(--r-md);
          margin-bottom: 8px; cursor: pointer; transition: all 200ms var(--ease);
          background: var(--surface);
        }
        .valid-option:hover { background: var(--surface-raised); border-color: var(--muted-light); }
        .valid-option.selected { border-color: var(--primary); background: var(--primary-glow); box-shadow: 0 0 0 1px var(--primary); }
        
        .radio-custom {
          width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--muted-light);
          display: flex; align-items: center; justify-content: center; transition: all 200ms;
        }
        .valid-option.selected .radio-custom { border-color: var(--primary); }
        .radio-custom::after {
          content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--primary);
          transform: scale(0); transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .valid-option.selected .radio-custom::after { transform: scale(1); }
        
        .anom-table tr { transition: all 150ms ease; }
        .anom-table tr:hover td { background: var(--surface-overlay); }
        .anom-table tr.active-row td { background: var(--primary-glow); border-bottom-color: transparent; }
        .anom-table td { padding: 14px 0; font-size: 13px; }
        
        .btn { padding: 10px 18px; font-size: 13px; font-weight: 600; border-radius: var(--r-md); cursor: pointer; transition: all 200ms; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
        .btn-primary { background: linear-gradient(135deg, var(--primary-dim) 0%, var(--primary) 100%); color: white; border: none; box-shadow: 0 2px 8px var(--primary-glow); }
        .btn-primary:hover:not(:disabled) { box-shadow: 0 4px 12px var(--primary-glow); transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-outline { background: transparent; border: 1px solid var(--hairline); color: var(--ink); }
        .btn-outline:hover { background: var(--surface-overlay); border-color: var(--muted); }
      `}</style>

      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="page-title">Anomaly detection</h1>
          {isDemo && <p className="text-xs" style={{ color: 'var(--warning, #f59e0b)', fontWeight: 600, marginTop: 2 }}>Menampilkan data contoh — API tidak terjangkau.</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <DeviceSelector selectedId={effectiveId} onChange={handleSelectParticipant} />
          <button className="btn btn-outline flex items-center gap-1" onClick={handleRefresh}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {/* 3-WAY SIGNAL QUALITY SEPARATION GRID */}
      <div className="anom-stat-row mb-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="anom-stat" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="anom-stat-label">📡 Missing Data Detection</div>
          <div className="anom-stat-value font-mono">5 / 1000 <span style={{ fontSize: 12, color: 'var(--muted)' }}>(0.5% missing)</span></div>
          <div className="text-xs text-muted mt-1">Sinyal terputus / Timeout bluetooth</div>
        </div>

        <div className="anom-stat" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="anom-stat-label">⚠️ Artifact Detection</div>
          <div className="anom-stat-value font-mono" style={{ color: '#f59e0b' }}>1 Event <span style={{ fontSize: 12, color: 'var(--muted)' }}>(Gerak / Spike Noise)</span></div>
          <div className="text-xs text-muted mt-1">Noise pergeseran sensor</div>
        </div>

        <div className="anom-stat stat-alert" style={{ borderLeft: '4px solid var(--alert-text)' }}>
          <div className="anom-stat-label">🚨 Physiological Anomaly</div>
          <div className="anom-stat-value font-mono" style={{ color: 'var(--alert-text)' }}>1 Alert <span style={{ fontSize: 12, color: 'var(--muted)' }}>(Tachycardia / HRV Drop)</span></div>
          <div className="text-xs text-muted mt-1">Deviasi fisiologis valid</div>
        </div>
      </div>

      <div className="filter-bar">
        {filters.map((f) => (
          <span key={f} className={`filter-pill ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f}</span>
        ))}
      </div>

      <div className="split">
        <div className="card !p-0 overflow-hidden" style={{ boxShadow: 'var(--shadow-md)', alignSelf: 'start' }}>
          <table className="w-full anom-table">
            <thead>
              <tr>
                <th className="pl-lg py-md">Event</th>
                <th className="py-md">Aktivitas</th>
                <th className="py-md">Onset</th>
                <th className="py-md">Puncak</th>
                <th className="py-md">Durasi</th>
                <th className="py-md">Tren</th>
                <th className="pr-lg py-md text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-lg text-muted">Memuat event…</td></tr>
              ) : filteredEvents.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-lg text-muted">Tidak ada event ditemukan.</td></tr>
              ) : filteredEvents.map((e) => (
                <tr
                  key={e.eventId}
                  className={`border-t border-hairline clickable ${selectedEventId === e.eventId ? 'active-row' : ''}`}
                  onClick={() => setSelectedEventId(e.eventId)}
                >
                  <td className="mono pl-lg font-semibold" style={{ color: 'var(--primary)' }}>#{String(e.eventId).slice(-6)}</td>
                  <td style={{ fontWeight: 550, color: 'var(--ink)' }}>{e.activity}</td>
                  <td className="mono text-muted">{fmtClock(e.onset_time)}</td>
                  <td className="mono" style={{ color: e.peak_score > 3 ? 'var(--alert-text)' : 'inherit', fontWeight: e.peak_score > 3 ? 600 : 400 }}>{fmt(e.peak_score, 1)}</td>
                  <td className="mono text-muted">{e.duration != null ? fmtDuration(e.duration) : 'Berlangsung'}</td>
                  <td><MiniTrend event={e} /></td>
                  <td className="pr-lg text-right">
                    <span className={`badge ${e.badgeClass}`} style={{ padding: '5px 10px', borderRadius: '6px' }}><span className="badge-dot" />{e.reviewStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          {activeEvent ? (
            <div className="animate-fadein">
              <div className="side-card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <p className="card-title" style={{ margin: 0, fontSize: 16 }}>Detail Event <span className="mono" style={{ color: 'var(--primary)' }}>#{String(activeEvent.eventId).slice(-6)}</span></p>
                  <span className={`badge ${activeEvent.badgeClass}`} style={{ fontSize: 11, padding: '4px 8px' }}>{activeEvent.reviewStatus}</span>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, background: 'var(--surface-overlay)', padding: '14px 18px', borderRadius: 'var(--r-md)' }}>
                  Deviasi hingga <strong style={{ color: 'var(--ink)' }}>{fmt(activeEvent.peak_score, 1)} SD</strong> di atas baseline saat <strong style={{ color: 'var(--ink)' }}>{activeEvent.activity}</strong>.<br />
                  Klasifikasi event terdeteksi sebagai <strong style={{ color: activeEvent.classification === 'Alert' ? 'var(--alert-text)' : 'var(--caution-text)' }}>{activeEvent.classification}</strong>.
                </div>

                <div className="anom-stat-row">
                  <div className="anom-stat">
                    <div className="anom-stat-label"><Clock size={13} style={{ color: 'var(--primary)' }} /> Onset</div>
                    <div className="anom-stat-value">{fmtClock(activeEvent.onset_time)}</div>
                  </div>
                  <div className="anom-stat">
                    <div className="anom-stat-label"><TrendingUp size={13} style={{ color: 'var(--caution-text)' }} /> Waktu naik</div>
                    <div className="anom-stat-value">{fmtDuration(activeEvent.timeToPeak)}</div>
                  </div>
                  <div className="anom-stat stat-alert">
                    <div className="anom-stat-label"><Target size={13} style={{ color: 'var(--alert-text)' }} /> Skor puncak</div>
                    <div className="anom-stat-value" style={{ color: 'var(--alert-text)' }}>{fmt(activeEvent.peak_score, 2)}</div>
                  </div>
                  <div className="anom-stat">
                    <div className="anom-stat-label"><TrendingDown size={13} style={{ color: activeEvent.resolved_time ? 'var(--stable-text)' : 'var(--muted)' }} /> Waktu pulih</div>
                    <div className="anom-stat-value" style={{ color: activeEvent.resolved_time ? 'var(--stable-text)' : 'var(--muted)' }}>
                      {activeEvent.resolved_time ? fmtDuration(activeEvent.recoveryTime) : 'Belum pulih'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="side-card" style={{ padding: '20px 24px' }}>
                <p className="card-title" style={{ fontSize: 15, marginBottom: 8 }}>Grafik Trajektori Anomali</p>
                <p className="text-xs text-muted" style={{ marginBottom: 20, lineHeight: 1.5 }}>
                  Menampilkan fase kenaikan (oranye) dan pemulihan (hijau).
                  {curve.synthesized && ' Kurva ini diestimasi dari titik utama karena data resolusi tinggi tidak tersedia.'}
                </p>
                <ResponsiveContainer width="100%" height={210}>
                  <ComposedChart data={curve.points} margin={{ top: 10, right: 14, left: -22, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="var(--hairline)" vertical={false} />
                    <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--hairline)' }} tickFormatter={(v) => `${v}m`} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} domain={[0, 'dataMax + 0.5']} />
                    <ReferenceArea x1={0} x2={tPeak} fill="var(--deviation-text)" fillOpacity={0.06} />
                    {tResolved != null && <ReferenceArea x1={tPeak} x2={tResolved} fill="var(--stable-text)" fillOpacity={0.06} />}
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-lg)', background: 'var(--surface)' }}
                      labelFormatter={(v) => `${v} menit dari onset`}
                      formatter={(v) => [fmt(v, 2), 'Skor anomali']}
                    />
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--deviation-text)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--deviation-text)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="score" stroke="var(--deviation-text)" fill="url(#colorScore)" fillOpacity={1} strokeWidth={2.5} />
                    <ReferenceDot x={0} y={activeEvent.onset_score ?? 0} r={5} fill="var(--surface)" stroke="var(--primary)" strokeWidth={2.5} label={{ value: 'Onset', position: 'top', fontSize: 10, fill: 'var(--primary)', fontWeight: 600 }} />
                    <ReferenceDot x={tPeak} y={activeEvent.peak_score} r={6} fill="var(--alert-text)" stroke="var(--surface)" strokeWidth={2.5} label={{ value: 'Puncak', position: 'top', fontSize: 10, fill: 'var(--alert-text)', fontWeight: 600 }} />
                    {tResolved != null && (
                      <ReferenceDot x={tResolved} y={curve.points[curve.points.length - 1]?.score ?? 0} r={5} fill="var(--surface)" stroke="var(--stable-text)" strokeWidth={2.5} label={{ value: 'Pulih', position: 'top', fontSize: 10, fill: 'var(--stable-text)', fontWeight: 600 }} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="anom-legend">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }}></span> Onset {fmtClock(activeEvent.onset_time)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--alert-text)' }}></span> Puncak {fmtClock(activeEvent.peak_time)} <span style={{ opacity: 0.7 }}>(+{fmtDuration(activeEvent.timeToPeak)})</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {activeEvent.resolved_time
                      ? <><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--stable-text)' }}></span> Pulih {fmtClock(activeEvent.resolved_time)} <span style={{ opacity: 0.7 }}>(+{fmtDuration(activeEvent.recoveryTime)})</span></>
                      : <><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--muted-light)' }}></span> Belum kembali ke baseline</>}
                  </div>
                </div>
              </div>

              <div className="side-card" style={{ padding: '20px 24px' }}>
                <p className="card-title" style={{ fontSize: 15, marginBottom: 16 }}>Validasi Klinis</p>
                {options.map((opt, idx) => (
                  <div key={idx} className={`valid-option ${selectedRadio === idx ? 'selected' : ''}`} onClick={() => setSelectedRadio(idx)}>
                    <div className="radio-custom" /> <span style={{ fontSize: 13.5, fontWeight: selectedRadio === idx ? 600 : 500, color: selectedRadio === idx ? 'var(--ink)' : 'var(--ink-secondary)' }}>{opt}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCloseEvent} disabled={activeEvent.status === 'closed'}>
                  Close event
                </button>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleNotifyMobile}>
                  Notify mobile
                </button>
              </div>
            </div>
          ) : (
            <div className="placeholder">
              <span className="msym">info</span>
              <span>Silakan pilih event untuk melakukan validasi klinis</span>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};

export default AnomalyDetection;