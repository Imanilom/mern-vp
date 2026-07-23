import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity, Clock, Repeat, ArrowUpRight, ArrowDownRight, Radar as RadarIcon, RefreshCw, ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, Cell, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea, ReferenceLine, RadarChart, PolarGrid,
  PolarAngleAxis, Radar,
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

// ---------------------------------------------------------------------------
// Inline participant dropdown.
// The original file imported `DeviceSelector` from '../shared/components/ParticipantSelector'.
// That path can't resolve here, so this is a self-contained equivalent — swap it back
// for your real DeviceSelector in the app if you prefer that component's UX.
// ---------------------------------------------------------------------------
const ParticipantSelector = ({ participants, selectedId, onChange }) => (
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <select
      value={selectedId || ''}
      onChange={(e) => onChange(e.target.value)}
      className="traj-select"
    >
      {participants.length === 0 && <option value="">Memuat pengguna…</option>}
      {participants.map((p) => (
        <option key={p._id} value={p._id}>{p.name || p.username || p._id}</option>
      ))}
    </select>
    <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted, #6b7280)' }} />
  </div>
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmtTime = (ms) => (ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(d));
const feat = (seg, key) => seg?.features?.[key] ?? null;
const zsc = (seg, key) => seg?.z_scores?.[key] ?? null;

const classificationColor = (c) => (c === 'Normal' ? 'var(--stable-text, #10b981)' : 'var(--alert-text, #ef4444)');
const scoreColor = (s) => (s > 1.5 ? 'var(--alert-text, #ef4444)' : s > 0.8 ? 'var(--deviation-text, #f59e0b)' : 'var(--stable-text, #10b981)');

// Synthetic fallback so the panel is meaningful without a live API: a normal
// baseline that drifts into a deviation episode around the middle, then recovers.
function buildDemoSegments() {
  const now = Date.now();
  const n = 20;
  const segs = [];
  for (let i = 0; i < n; i += 1) {
    const t = now - (n - i) * 10 * 60000; // every 10 min
    // bell-shaped deviation centered around index 12, recovering by the end
    const bump = Math.max(0, 1 - Math.abs(i - 12) / 6);
    const score = +(0.4 + bump * 2.0 + (Math.random() * 0.2 - 0.1)).toFixed(2);
    const classification = score > 1.2 ? 'Deviation' : 'Normal';
    const hr = 78 + bump * 35 + (Math.random() * 4 - 2);
    const rmssd = 42 - bump * 26 + (Math.random() * 3 - 1.5);
    const sdnn = 48 - bump * 24 + (Math.random() * 3 - 1.5);
    const dfa = 1.05 - bump * 0.7 + (Math.random() * 0.05);
    const slope = bump > 0.1 ? (i < 12 ? 0.12 + bump * 0.2 : -(0.1 + bump * 0.2)) : (Math.random() * 0.04 - 0.02);
    segs.push({
      _id: `demo-${i}`,
      window_start: t,
      window_end: t + 3 * 60000,
      activity_label: bump > 0.4 ? 'Berjalan Cepat' : 'Istirahat',
      classification,
      anomaly_score: score,
      features: {
        mean_hr: hr, std_hr: 3 + bump * 2, delta_hr: 5 + bump * 10, slope_hr: +slope.toFixed(3),
        mean_rr: 700 - bump * 150, sdnn, rmssd, rolling_variance: 8 + bump * 10,
        motion_intensity: 0.2 + bump * 1.2, dfa_alpha1: dfa,
      },
      z_scores: {
        z_hr: +(bump * 2.4 - 0.2).toFixed(2), z_rr: +(-bump * 2).toFixed(2), z_sdnn: +(-bump * 1.8).toFixed(2),
        z_rmssd: +(-bump * 2.1).toFixed(2), z_motion: +(bump * 1.5).toFixed(2), z_dfa: +(-bump * 1.6).toFixed(2),
      },
    });
  }
  return segs;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const TrajectoryAnalysis = ({ selectedParticipantId = '', onParticipantChange = () => { } }) => {
  const [activeTab, setActiveTab] = useState('Magnitude');
  const tabs = ['Magnitude', 'Duration', 'Persistence', 'Recovery', 'Slope', 'Multi-feature'];

  const [participants, setParticipants] = useState([]);
  const [localId, setLocalId] = useState(selectedParticipantId || '');
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const effectiveId = selectedParticipantId || localId;
  const handleSelect = useCallback((id) => { setLocalId(id); onParticipantChange(id); }, [onParticipantChange]);
  useEffect(() => { if (selectedParticipantId) setLocalId(selectedParticipantId); }, [selectedParticipantId]);

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
          if (!effectiveId) handleSelect(data[0]._id);
        }
      } catch {
        if (!cancelled) {
          const demoParticipants = ['Dewi A.', 'Rian S.', 'Putri N.'].map((name, i) => ({ _id: `demo-user-${i}`, name }));
          setParticipants(demoParticipants);
          setIsDemo(true);
          if (!effectiveId) handleSelect(demoParticipants[0]._id);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // ---- fetch segments for the selected participant ----
  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (isDemo) {
        setSegments(buildDemoSegments());
        setLoading(false);
        return;
      }
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch(`/api/analysis/segments/${effectiveId}?limit=20`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('bad response');
        const data = await res.json();
        if (!data.success || !Array.isArray(data.data) || data.data.length === 0) throw new Error('empty');
        if (!cancelled) setSegments(data.data);
      } catch (err) {
        console.error('Failed to fetch segments:', err);
        if (!cancelled) setSegments(buildDemoSegments());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveId, isDemo, refreshKey]);

  const sorted = useMemo(() => [...segments].sort((a, b) => a.window_start - b.window_start), [segments]);
  const hasData = sorted.length > 0;

  // ---- top status card ----
  const trajStats = useMemo(() => {
    if (!hasData) return { magnitude: '0.0', started: '—', duration: '0 min', recovery: '0%', estimated: '—', status: 'Stable' };
    const latest = sorted[sorted.length - 1];
    const first = sorted[0];
    const peak = sorted.reduce((m, s) => ((s.anomaly_score || 0) > (m.anomaly_score || 0) ? s : m), sorted[0]);
    const durationMin = Math.round((latest.window_start - first.window_start) / 60000);
    const recoveryPct = peak.anomaly_score > 0
      ? Math.round(((peak.anomaly_score - (latest.anomaly_score || 0)) / peak.anomaly_score) * 100) : 100;
    return {
      magnitude: fmt(latest.anomaly_score, 1),
      started: fmtTime(first.window_start),
      duration: `${durationMin} min`,
      recovery: `${Math.max(0, recoveryPct)}%`,
      estimated: latest.classification === 'Normal' ? 'Resolved' : '~5 min',
      status: latest.classification === 'Normal' ? 'Stable' : 'Deviation',
    };
  }, [sorted, hasData]);

  // ---- shared time-series used by several tabs ----
  const magnitudeData = useMemo(() => sorted.map((s) => ({
    time: fmtTime(s.window_start), ts: s.window_start, score: +fmt(s.anomaly_score, 2),
    classification: s.classification, activity: s.activity_label,
  })), [sorted]);
  const peakPoint = useMemo(() => (magnitudeData.length
    ? magnitudeData.reduce((m, p) => (p.score > m.score ? p : m), magnitudeData[0]) : null), [magnitudeData]);

  // ---- episodes (contiguous non-Normal runs) — for Duration & Persistence ----
  const episodes = useMemo(() => {
    const out = [];
    let cur = null;
    sorted.forEach((s, idx) => {
      const isDev = s.classification !== 'Normal';
      if (isDev) {
        if (!cur) cur = { startIdx: idx, endIdx: idx, peakScore: s.anomaly_score || 0 };
        else { cur.endIdx = idx; cur.peakScore = Math.max(cur.peakScore, s.anomaly_score || 0); }
      } else if (cur) { out.push(cur); cur = null; }
    });
    if (cur) out.push(cur);
    return out.map((e, i) => {
      const startSeg = sorted[e.startIdx];
      const endSeg = sorted[e.endIdx];
      return {
        name: `Episode ${i + 1}`,
        durationMin: Math.round(((endSeg.window_end || endSeg.window_start) - startSeg.window_start) / 60000) || 1,
        segmentCount: e.endIdx - e.startIdx + 1,
        peakScore: +fmt(e.peakScore, 2),
        start: fmtTime(startSeg.window_start),
        end: fmtTime(endSeg.window_end || endSeg.window_start),
      };
    });
  }, [sorted]);
  const totalWindowMin = trajStats.duration;

  // ---- persistence: running streak of consecutive deviation segments ----
  const persistenceData = useMemo(() => {
    let streak = 0;
    return sorted.map((s) => {
      streak = s.classification !== 'Normal' ? streak + 1 : 0;
      return { time: fmtTime(s.window_start), streak, classification: s.classification };
    });
  }, [sorted]);
  const maxStreak = useMemo(() => Math.max(0, ...persistenceData.map((d) => d.streak)), [persistenceData]);

  // ---- recovery: anomaly score + key z-scores converging back to 0 ----
  const recoveryData = useMemo(() => sorted.map((s) => ({
    time: fmtTime(s.window_start),
    score: +fmt(s.anomaly_score, 2),
    z_hr: +fmt(zsc(s, 'z_hr'), 2),
    z_rmssd: +fmt(zsc(s, 'z_rmssd'), 2),
    z_sdnn: +fmt(zsc(s, 'z_sdnn'), 2),
  })), [sorted]);

  // ---- slope: rate of HR change over time ----
  const slopeData = useMemo(() => sorted.map((s) => ({
    time: fmtTime(s.window_start), slope: +fmt(feat(s, 'slope_hr'), 3), delta: +fmt(feat(s, 'delta_hr'), 1),
  })), [sorted]);

  // ---- multi-feature radar: latest segment vs the window's average ----
  const RADAR_METRICS = [
    { key: 'mean_hr', label: 'Detak Jantung' }, { key: 'rmssd', label: 'RMSSD' },
    { key: 'sdnn', label: 'SDNN' }, { key: 'dfa_alpha1', label: 'DFA α1' }, { key: 'motion_intensity', label: 'Gerak' },
  ];
  const radarData = useMemo(() => {
    if (!hasData) return [];
    const latest = sorted[sorted.length - 1];
    return RADAR_METRICS.map(({ key, label }) => {
      const vals = sorted.map((s) => feat(s, key)).filter((v) => v != null);
      const min = vals.length ? Math.min(...vals) : 0;
      const max = vals.length ? Math.max(...vals) : 0;
      const norm = (v) => (v == null ? 0 : Math.round(((v - min) / (max - min || 1)) * 100));
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { metric: label, Sekarang: norm(feat(latest, key)), 'Rata-rata jendela': norm(avg) };
    });
  }, [sorted, hasData]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <section className="traj-analytics">
      <style>{`
        .traj-select {
          appearance: none; border: 1px solid var(--hairline, #e5e7eb); background: var(--surface, #fff);
          color: var(--ink, #111); font-size: 13px; font-weight: 600; padding: 7px 30px 7px 12px; border-radius: 8px; cursor: pointer;
        }
        .traj-tab-desc { font-size: 12px; color: var(--muted, #6b7280); margin-bottom: 10px; }
        .traj-legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 11px; color: var(--muted, #6b7280); margin-top: 8px; }
        .traj-mini-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .traj-mini-table th { text-align: left; padding: 6px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: var(--muted, #6b7280); border-bottom: 1px solid var(--hairline, #e5e7eb); }
        .traj-mini-table td { padding: 7px 10px; border-bottom: 1px solid var(--hairline, #e5e7eb); }
      `}</style>

      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="page-title">Trajectory analysis</h1>
          {isDemo && <p className="text-xs" style={{ color: 'var(--warning, #f59e0b)', fontWeight: 600, marginTop: 2 }}>Menampilkan data contoh — API tidak terjangkau.</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ParticipantSelector participants={participants} selectedId={effectiveId} onChange={handleSelect} />
          <button className="btn btn-outline flex items-center gap-1" onClick={handleRefresh}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="traj-status-card mb-4">
        <div>
          <span className={`badge ${trajStats.status === 'Stable' ? 'badge-stable' : 'badge-caution'}`} style={{ fontSize: 13, padding: '6px 14px' }}>
            <span className="badge-dot" />{trajStats.status}
          </span>
          <div style={{ fontSize: 12, color: 'var(--muted, #6b7280)', marginTop: 6 }}>
            {trajStats.status === 'Stable' ? 'On baseline' : 'Moving toward baseline'}
          </div>
        </div>
        <div className="traj-figures">
          <div className="traj-figure"><span className="eyebrow">Magnitude</span><div className="traj-figure-value">{trajStats.magnitude}</div></div>
          <div className="traj-figure"><span className="eyebrow">Started</span><div className="traj-figure-value">{trajStats.started}</div></div>
          <div className="traj-figure"><span className="eyebrow">Duration</span><div className="traj-figure-value">{trajStats.duration}</div></div>
          <div className="traj-figure"><span className="eyebrow">Recovery</span><div className="traj-figure-value">{trajStats.recovery}</div></div>
          <div className="traj-figure"><span className="eyebrow">Estimated</span><div className="traj-figure-value">{trajStats.estimated}</div></div>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((tab) => (
          <div key={tab} className={`tab ${activeTab === tab ? 'on' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab}
          </div>
        ))}
      </div>

      {loading && !hasData ? (
        <div className="chart-card mb-4 text-center py-8 text-muted">Memuat data segmen…</div>
      ) : !hasData ? (
        <div className="chart-card mb-4 text-center py-8 text-muted">Belum ada data segmen untuk pengguna ini.</div>
      ) : (
        <div className="chart-card mb-4">
          {activeTab === 'Magnitude' && (
            <>
              <p className="traj-tab-desc"><Activity size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />Skor anomali tiap segmen. Area hijau adalah rentang normal (0.0–1.5); titik merah menandai puncak deviasi.</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={magnitudeData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline, #e5e7eb)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 'dataMax + 0.5']} />
                  <ReferenceArea y1={0} y2={1.5} fill="var(--stable-text, #10b981)" fillOpacity={0.08} />
                  <ReferenceLine y={1.5} stroke="var(--warning, #f59e0b)" strokeDasharray="4 4" />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v, name) => [name === 'score' ? v : v, name === 'score' ? 'Skor anomali' : name]}
                    labelFormatter={(l, p) => `${l} — ${p?.[0]?.payload?.activity || ''}`}
                  />
                  <Area type="monotone" dataKey="score" stroke="var(--deviation-text, #f59e0b)" fill="var(--deviation-text, #f59e0b)" fillOpacity={0.15} strokeWidth={2} dot={{ r: 3 }} />
                  {peakPoint && peakPoint.score > 1.5 && (
                    <ReferenceLine x={peakPoint.time} stroke="var(--alert-text, #ef4444)" strokeDasharray="2 2" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
              <div className="traj-legend">
                <span style={{ color: 'var(--alert-text, #ef4444)' }}>■ Titik puncak ({peakPoint ? fmt(peakPoint.score, 1) : '—'})</span>
                <span style={{ color: 'var(--stable-text, #10b981)' }}>■ Normal (0.0 – 1.5)</span>
              </div>
            </>
          )}

          {activeTab === 'Duration' && (
            <>
              <p className="traj-tab-desc">
                <Clock size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
                Rentang waktu yang terpantau: <strong>{totalWindowMin}</strong>. Setiap batang di bawah adalah satu episode deviasi yang terdeteksi.
              </p>
              {episodes.length === 0 ? (
                <div className="text-center py-6 text-muted text-sm">Tidak ada episode deviasi pada jendela ini — semua segmen normal.</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, episodes.length * 46)}>
                  <BarChart data={episodes} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline, #e5e7eb)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} label={{ value: 'menit', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v, name) => [name === 'durationMin' ? `${v} menit` : v, name === 'durationMin' ? 'Durasi' : name]}
                      labelFormatter={(l, p) => `${l} (${p?.[0]?.payload?.start}–${p?.[0]?.payload?.end})`}
                    />
                    <Bar dataKey="durationMin" radius={[0, 4, 4, 0]} barSize={20}>
                      {episodes.map((e) => <Cell key={e.name} fill={scoreColor(e.peakScore)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div style={{ marginTop: 10 }}>
                <div className="traj-tab-desc" style={{ marginBottom: 4 }}>Linimasa klasifikasi tiap segmen:</div>
                <div style={{ display: 'flex', gap: 2, height: 22, borderRadius: 4, overflow: 'hidden' }}>
                  {magnitudeData.map((d, i) => (
                    <div key={i} title={`${d.time} · ${d.classification}`} style={{ flex: 1, background: classificationColor(d.classification), opacity: 0.85 }} />
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'Persistence' && (
            <>
              <p className="traj-tab-desc"><Repeat size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />Panjang rentetan segmen berturut-turut yang terklasifikasi deviasi — makin panjang, makin persisten. Rentetan terpanjang: <strong>{maxStreak} segmen</strong>.</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={persistenceData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline, #e5e7eb)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} label={{ value: 'segmen berturut-turut', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v} segmen`, 'Rentetan']} />
                  <Bar dataKey="streak" radius={[4, 4, 0, 0]}>
                    {persistenceData.map((d, i) => <Cell key={i} fill={d.streak === maxStreak && maxStreak > 0 ? 'var(--alert-text, #ef4444)' : 'var(--deviation-text, #f59e0b)'} fillOpacity={d.streak ? 0.85 : 0.25} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}

          {activeTab === 'Recovery' && (
            <>
              <p className="traj-tab-desc">Skor anomali dan z-score utama seiring waktu — semuanya konvergen ke 0 saat pengguna kembali ke baseline.</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={recoveryData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline, #e5e7eb)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="var(--stable-text, #10b981)" strokeDasharray="4 4" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="score" name="Skor anomali" stroke="var(--alert-text, #ef4444)" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="z_hr" name="Z (HR)" stroke="var(--primary, #3b82f6)" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="z_rmssd" name="Z (RMSSD)" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="z_sdnn" name="Z (SDNN)" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="traj-legend">
                <span>Pemulihan saat ini: <strong style={{ color: 'var(--ink, #111)' }}>{trajStats.recovery}</strong> menuju baseline</span>
              </div>
            </>
          )}

          {activeTab === 'Slope' && (
            <>
              <p className="traj-tab-desc">
                <ArrowUpRight size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 2, color: 'var(--alert-text, #ef4444)' }} />
                <ArrowDownRight size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4, color: 'var(--stable-text, #10b981)' }} />
                Laju perubahan detak jantung antar segmen. Nilai positif = detak jantung sedang naik, negatif = sedang turun (memulihkan diri).
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={slopeData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline, #e5e7eb)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="var(--hairline, #9ca3af)" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="slope" name="Slope HR" radius={[3, 3, 0, 0]} barSize={14}>
                    {slopeData.map((d, i) => <Cell key={i} fill={d.slope >= 0 ? 'var(--alert-text, #ef4444)' : 'var(--stable-text, #10b981)'} fillOpacity={0.75} />)}
                  </Bar>
                  <Line type="monotone" dataKey="delta" name="Delta HR" stroke="var(--primary, #3b82f6)" strokeWidth={1.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}

          {activeTab === 'Multi-feature' && (
            <>
              <p className="traj-tab-desc">
                <RadarIcon size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
                Profil segmen terbaru dibanding rata-rata jendela ini — semua metrik dinormalisasi 0–100.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid stroke="var(--hairline, #e5e7eb)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                  <Radar name="Sekarang" dataKey="Sekarang" stroke="var(--alert-text, #ef4444)" fill="var(--alert-text, #ef4444)" fillOpacity={0.2} strokeWidth={2} />
                  <Radar name="Rata-rata jendela" dataKey="Rata-rata jendela" stroke="var(--primary, #3b82f6)" fill="var(--primary, #3b82f6)" fillOpacity={0.12} strokeWidth={2} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </RadarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}

      {/* ---- recent segments table ---- */}
      {hasData && (
        <div className="card !p-0 overflow-hidden mb-4">
          <table className="traj-mini-table">
            <thead>
              <tr>
                <th>Waktu</th><th>Aktivitas</th><th>Klasifikasi</th><th>Skor</th>
                <th>HR</th><th>RMSSD</th><th>DFA α1</th><th>Gerak</th>
              </tr>
            </thead>
            <tbody>
              {[...sorted].reverse().slice(0, 8).map((s) => (
                <tr key={s._id}>
                  <td className="pl-lg">{fmtTime(s.window_start)}</td>
                  <td>{s.activity_label || '—'}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, color: classificationColor(s.classification) }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: classificationColor(s.classification) }} />
                      {s.classification}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: scoreColor(s.anomaly_score || 0) }}>{fmt(s.anomaly_score, 2)}</td>
                  <td>{fmt(feat(s, 'mean_hr'), 0)} bpm</td>
                  <td>{fmt(feat(s, 'rmssd'), 0)} ms</td>
                  <td>{fmt(feat(s, 'dfa_alpha1'), 2)}</td>
                  <td>{fmt(feat(s, 'motion_intensity'), 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </section>
  );
};

export default TrajectoryAnalysis;