import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw, Download, Users, HeartPulse, Waves, Gauge, Sparkles, Info, X,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, Cell, ErrorBar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ScatterChart, Scatter, ZAxis, ReferenceLine, RadarChart, PolarGrid,
  PolarAngleAxis, Radar,
} from 'recharts';

// ---------------------------------------------------------------------------
// Toast (unchanged behaviour, kept for parity with the rest of the app)
// ---------------------------------------------------------------------------
export const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', bottom: '24px', right: '24px',
        background: 'var(--surface, #fff)', border: '1px solid var(--primary, #3b82f6)',
        borderRadius: 'var(--r-md, 10px)', padding: '12px 18px',
        boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,.15))', zIndex: 1000,
        display: 'flex', alignItems: 'center', gap: '10px',
      }}
    >
      <span className="status-dot" />
      <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink, #111)' }}>{message}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Constants & small helpers
// ---------------------------------------------------------------------------
const ACTIVITY_COLORS = {
  Rest: '#8b5cf6', Light: '#3b82f6', Moderate: '#f59e0b', Vigorous: '#ef4444',
};
const activityColor = (name) => ACTIVITY_COLORS[name] || '#6366f1';

const USER_PALETTE = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const TIME_PERIOD_LABEL: Record<string, string> = {
  morning: 'Pagi', afternoon: 'Siang', evening: 'Sore', night: 'Malam',
};
const TIME_PERIOD_COLORS: Record<string, string> = {
  morning: '#f59e0b', afternoon: '#0ea5e9', evening: '#8b5cf6', night: '#4f46e5',
};

const RADAR_METRICS = [
  { key: 'mean_hr', label: 'Detak Jantung' },
  { key: 'rmssd', label: 'RMSSD' },
  { key: 'sdnn', label: 'SDNN' },
  { key: 'dfa_alpha1', label: 'DFA α1' },
  { key: 'motion_intensity', label: 'Gerak' },
];

const metricMean = (baseline, key) => baseline?.stats?.[key]?.mean ?? null;
const metricStd = (baseline, key) => baseline?.stats?.[key]?.std ?? null;
const confidenceOf = (b) => (b ? Math.min(1, b.is_mature ? 0.95 : (b.segment_count || 0) / 20) : 0);
const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(d));

function rmssdStatus(v) {
  if (v == null) return { label: '—', color: 'var(--muted, #9ca3af)' };
  if (v > 40) return { label: 'Sangat Bugar', color: 'var(--success, #10b981)' };
  if (v > 20) return { label: 'Normal', color: 'var(--primary, #3b82f6)' };
  return { label: 'Kurang Bugar', color: 'var(--warning, #f59e0b)' };
}
function dfaStatus(v) {
  if (v == null) return { label: '—', color: 'var(--muted, #9ca3af)' };
  if (v < 0.75) return { label: 'Lelah / Stres', color: 'var(--warning, #f59e0b)' };
  if (v <= 1.25) return { label: 'Optimal / Fit', color: 'var(--success, #10b981)' };
  return { label: 'Sangat Santai', color: 'var(--primary, #3b82f6)' };
}

// Real baseline data fetched directly from MongoDB via /api/analysis/baseline/:userId
export const BaselineModel = (_props) => {
  const [participants, setParticipants] = useState([]);
  const [records, setRecords] = useState([]); // [{participant, baseline}] — real MongoDB baselines
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState(null);

  const [selectedActivity, setSelectedActivity] = useState(null);
  const [timePeriod, setTimePeriod] = useState('all');
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  // Retrieve authUser to check role
  const storedUser = sessionStorage.getItem('htm_user');
  const authUser = storedUser ? JSON.parse(storedUser) : null;
  const isDoctor = authUser?.role === 'doctor';

  // ---- fetch participants ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch('/api/patient/all', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && !cancelled) {
            if (isDoctor) {
              setParticipants(data);
            } else if (authUser?.guid) {
              const selfOnly = data.filter((u: any) => u.guid === authUser.guid || u._id === authUser.id);
              setParticipants(selfOnly.length > 0 ? selfOnly : data.slice(0, 1));
            } else {
              setParticipants(data.slice(0, 1));
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch patients:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey, isDoctor, authUser?.guid, authUser?.id]);

  // ---- fetch every baseline (all activities) for every participant ----
  useEffect(() => {
    if (participants.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem('htm_token');
        const perUser = await Promise.all(participants.map(async (p) => {
          const res = await fetch(`/api/analysis/baseline/${p._id}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) return [];
          const data = await res.json();
          if (!data.success || !Array.isArray(data.data)) return [];
          return data.data.map((b) => ({ participant: p, baseline: b }));
        }));
        if (!cancelled) setRecords(perUser.flat());
      } catch (err) {
        console.error('Failed to fetch baselines:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [participants]);

  // ---- derived lists ----
  const activities = useMemo(
    () => Array.from(new Set(records.map((r) => r.baseline.activity))).sort(),
    [records],
  );

  useEffect(() => {
    if (!selectedActivity && activities.length) setSelectedActivity(activities[0]);
  }, [activities, selectedActivity]);

  const userColor = useMemo(() => {
    const map = new Map();
    participants.forEach((p, i) => map.set(p._id, USER_PALETTE[i % USER_PALETTE.length]));
    return map;
  }, [participants]);

  const filteredRecords = useMemo(() => records.filter((r) => (
    (!selectedActivity || r.baseline.activity === selectedActivity)
    && (timePeriod === 'all' || r.baseline.time_period === timePeriod)
  )), [records, selectedActivity, timePeriod]);

  // default radar selection: first 3 users present in the current activity
  useEffect(() => {
    if (filteredRecords.length === 0) return;
    const ids = filteredRecords.map((r) => r.participant._id);
    setSelectedUserIds((prev) => {
      const stillValid = prev.filter((id) => ids.includes(id));
      if (stillValid.length) return stillValid;
      return ids.slice(0, 3);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedActivity, timePeriod]);

  // ---- chart data: HR by user (with std error bar) ----
  const hrChartData = useMemo(() => filteredRecords.map((r) => ({
    id: r.participant._id + '_' + r.baseline.time_period,
    originalId: r.participant._id,
    timePeriod: r.baseline.time_period,
    name: (r.participant.name || r.participant.username || '—') + (timePeriod === 'all' ? ` (${TIME_PERIOD_LABEL[r.baseline.time_period] || r.baseline.time_period})` : ''),
    hr: +fmt(metricMean(r.baseline, 'mean_hr'), 0),
    hrStd: +fmt(metricStd(r.baseline, 'mean_hr'), 0) || 0,
  })).sort((a, b) => b.hr - a.hr), [filteredRecords, timePeriod]);

  // ---- chart data: RMSSD vs DFA quadrant scatter ----
  const scatterData = useMemo(() => filteredRecords.map((r) => ({
    id: r.participant._id + '_' + r.baseline.time_period,
    originalId: r.participant._id,
    timePeriod: r.baseline.time_period,
    name: (r.participant.name || r.participant.username || '—') + (timePeriod === 'all' ? ` (${TIME_PERIOD_LABEL[r.baseline.time_period] || r.baseline.time_period})` : ''),
    x: metricMean(r.baseline, 'rmssd'),
    y: metricMean(r.baseline, 'dfa_alpha1'),
    z: Math.round(confidenceOf(r.baseline) * 100) + 20,
  })).filter((d) => d.x != null && d.y != null), [filteredRecords, timePeriod]);

  // ---- activity comparison across all users/activities ----
  const activitySummary = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      const act = r.baseline.activity;
      if (!map[act]) map[act] = { activity: act, hr: [], rmssd: [], dfa: [], users: new Set() };
      const hr = metricMean(r.baseline, 'mean_hr');
      const rm = metricMean(r.baseline, 'rmssd');
      const dfa = metricMean(r.baseline, 'dfa_alpha1');
      if (hr != null) map[act].hr.push(hr);
      if (rm != null) map[act].rmssd.push(rm);
      if (dfa != null) map[act].dfa.push(dfa);
      map[act].users.add(r.participant._id);
    });
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    return activities.map((act) => ({
      activity: act,
      avgHr: +fmt(avg(map[act]?.hr || []), 0),
      avgRmssd: +fmt(avg(map[act]?.rmssd || []), 0),
      avgDfa: +fmt(avg(map[act]?.dfa || []), 2),
      userCount: map[act]?.users.size || 0,
    }));
  }, [records, activities]);

  // ---- radar comparison ----
  const radarUsers = useMemo(
    () => filteredRecords.filter((r) => selectedUserIds.includes(r.participant._id)),
    [filteredRecords, selectedUserIds],
  );
  const radarData = useMemo(() => RADAR_METRICS.map(({ key, label }) => {
    const vals = filteredRecords.map((r) => metricMean(r.baseline, key)).filter((v) => v != null);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const row: any = { metric: label };
    radarUsers.forEach((r) => {
      const v = metricMean(r.baseline, key);
      const name = (r.participant.name || r.participant.username || '—') + (timePeriod === 'all' ? ` (${TIME_PERIOD_LABEL[r.baseline.time_period] || r.baseline.time_period})` : '');
      row[name] = v == null ? 0 : Math.round(((v - min) / (max - min || 1)) * 100);
    });
    return row;
  }), [filteredRecords, radarUsers, timePeriod]);

  // ---- top-level stats ----
  const overallStats = useMemo(() => {
    const usersWithData = new Set(records.map((r) => r.participant._id)).size;
    const avgConfidence = records.length
      ? Math.round((records.reduce((s, r) => s + confidenceOf(r.baseline), 0) / records.length) * 100)
      : 0;
    return { usersWithData, totalBaselines: records.length, activityCount: activities.length, avgConfidence };
  }, [records, activities]);

  const toggleUser = useCallback((id) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }, []);

  const handleRefresh = () => { setRefreshKey((k) => k + 1); };

  const handleExportCsv = () => {
    const header = ['Nama', 'Aktivitas', 'Waktu', 'HR_mean', 'RMSSD_mean', 'SDNN_mean', 'DFA_alpha1', 'Motion', 'Kepercayaan%'];
    const rows = filteredRecords.map((r) => [
      r.participant.name || r.participant.username || r.participant._id,
      r.baseline.activity,
      r.baseline.time_period,
      fmt(metricMean(r.baseline, 'mean_hr'), 1),
      fmt(metricMean(r.baseline, 'rmssd'), 1),
      fmt(metricMean(r.baseline, 'sdnn'), 1),
      fmt(metricMean(r.baseline, 'dfa_alpha1'), 2),
      fmt(metricMean(r.baseline, 'motion_intensity'), 2),
      Math.round(confidenceOf(r.baseline) * 100),
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `baseline_${selectedActivity || 'semua'}.csv`; a.click();
    URL.revokeObjectURL(url);
    setToast('CSV berhasil diunduh');
  };

  return (
    <section className="baseline-analytics animate-fadein">
      <style>{`
        .ba-grid { display: grid; gap: 16px; }
        .ba-grid-4 { grid-template-columns: repeat(4, minmax(0,1fr)); }
        .ba-grid-2 { grid-template-columns: repeat(2, minmax(0,1fr)); }
        @media (max-width: 900px) { .ba-grid-4, .ba-grid-2 { grid-template-columns: 1fr; } }
        .ba-stat-card {
          background: var(--surface, #fff); border: 1px solid var(--hairline, #e5e7eb);
          border-radius: var(--r-md, 12px); padding: 16px;
        }
        .ba-tab {
          border: 1px solid var(--hairline, #e5e7eb); background: var(--surface, #fff);
          color: var(--ink, #111); font-size: 13px; font-weight: 600; padding: 7px 14px;
          border-radius: 999px; cursor: pointer; transition: all .15s ease; display: inline-flex; gap: 6px; align-items: center;
        }
        .ba-tab.active { color: #fff; border-color: transparent; }
        .ba-select {
          border: 1px solid var(--hairline, #e5e7eb); background: var(--surface, #fff);
          color: var(--ink, #111); font-size: 13px; font-weight: 550; padding: 7px 12px; border-radius: 8px;
        }
        .ba-chip {
          display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
          border: 1px solid var(--hairline, #e5e7eb); padding: 5px 10px 5px 6px; font-size: 12px;
          font-weight: 600; cursor: pointer; background: var(--surface, #fff); color: var(--muted, #6b7280);
        }
        .ba-chip.on { color: var(--ink, #111); }
        .ba-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
      `}</style>

      <div className="page-head mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">{isDoctor ? '👨‍⚕️ Baseline Model & Perbandingan Pasien' : '🔒 Profil Baseline Kesehatan Pribadi'}</h1>
          <p className="text-muted text-sm mt-1">
            {isDoctor
              ? 'Mode Dokter: Tampilkan dan bandingkan standar baseline kesehatan (HR, HRV, DFA) pasien yang dipantau.'
              : 'Profil standar baseline kesehatan pribadi Anda berdasarkan riwayat aktivitas terukur.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline flex items-center gap-1" onClick={handleRefresh}>
            <RefreshCw size={14} /> Refresh Data
          </button>
          <button className="btn btn-ghost flex items-center gap-1" onClick={handleExportCsv}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* ---- summary cards ---- */}
      <div className="ba-grid ba-grid-4 mb-4">
        <div className="ba-stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted, #6b7280)', fontSize: 12, fontWeight: 600 }}>
            <Users size={14} /> PENGGUNA TERPANTAU
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink, #111)', marginTop: 6 }}>{overallStats.usersWithData}</div>
        </div>
        <div className="ba-stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted, #6b7280)', fontSize: 12, fontWeight: 600 }}>
            <Waves size={14} /> TOTAL BASELINE
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink, #111)', marginTop: 6 }}>{overallStats.totalBaselines}</div>
        </div>
        <div className="ba-stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted, #6b7280)', fontSize: 12, fontWeight: 600 }}>
            <Gauge size={14} /> JENIS AKTIVITAS
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink, #111)', marginTop: 6 }}>{overallStats.activityCount}</div>
        </div>
        <div className="ba-stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted, #6b7280)', fontSize: 12, fontWeight: 600 }}>
            <Sparkles size={14} /> RATA-RATA KEPERCAYAAN
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink, #111)', marginTop: 6 }}>{overallStats.avgConfidence}%</div>
        </div>
      </div>

      {/* ---- activity comparison (why baselines differ per activity) ---- */}
      <div className="card mb-4" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink, #111)' }}>Profil Baseline per Jenis Aktivitas</h3>
          <span className="text-xs text-muted">Rata-rata seluruh pengguna</span>
        </div>
        <p className="text-xs text-muted mb-2">Detak jantung naik dan variabilitas (RMSSD/DFA) turun seiring intensitas aktivitas — begitu baseline yang sehat semestinya terlihat.</p>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={activitySummary} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline, #e5e7eb)" vertical={false} />
            <XAxis dataKey="activity" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="hr" tick={{ fontSize: 11 }} label={{ value: 'BPM', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <YAxis yAxisId="ms" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'ms', angle: 90, position: 'insideRight', fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="hr" dataKey="avgHr" name="Detak Jantung (bpm)" radius={[4, 4, 0, 0]}>
              {activitySummary.map((d) => <Cell key={d.activity} fill={activityColor(d.activity)} fillOpacity={0.85} />)}
            </Bar>
            <Bar yAxisId="ms" dataKey="avgRmssd" name="RMSSD (ms)" fill="var(--muted, #9ca3af)" radius={[4, 4, 0, 0]} fillOpacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ---- filters ---- */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {activities.map((act) => (
          <button
            key={act}
            className={`ba-tab ${selectedActivity === act ? 'active' : ''}`}
            style={selectedActivity === act ? { background: activityColor(act) } : {}}
            onClick={() => setSelectedActivity(act)}
          >
            <span className="ba-dot" style={{ background: activityColor(act) }} /> {act}
          </button>
        ))}
        <select className="ba-select" value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)}>
          <option value="all">Semua Waktu</option>
          {Object.entries(TIME_PERIOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {loading && <span className="text-xs text-muted">Memuat…</span>}
      </div>

      {filteredRecords.length === 0 && !loading ? (
        <div className="card text-center py-8 text-muted mb-4">Belum ada data baseline untuk kombinasi filter ini.</div>
      ) : (
        <>
          {/* ---- comparison charts: HR bar + RMSSD/DFA quadrant ---- */}
          <div className="ba-grid ba-grid-2 mb-4">
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink, #111)', marginBottom: 2 }}>
                <HeartPulse size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                Detak Jantung per Pengguna — {selectedActivity}
              </h3>
              <p className="text-xs text-muted mb-2">Batang menunjukkan rata-rata; garis vertikal adalah variasi (±SD).</p>
              <ResponsiveContainer width="100%" height={Math.max(220, hrChartData.length * 34)}>
                <BarChart data={hrChartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline, #e5e7eb)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} label={{ value: 'bpm', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v, key) => [key === 'hr' ? `${v} bpm` : v, key === 'hr' ? 'Rata-rata' : 'Variasi']} />
                  <Bar dataKey="hr" radius={[0, 4, 4, 0]} barSize={16}>
                    {hrChartData.map((d) => <Cell key={d.id} fill={timePeriod === 'all' ? (TIME_PERIOD_COLORS[d.timePeriod] || '#3b82f6') : (userColor.get(d.originalId) || '#3b82f6')} />)}
                    <ErrorBar dataKey="hrStd" width={4} strokeWidth={1.5} stroke="var(--ink, #374151)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink, #111)', marginBottom: 2 }}>
                <Waves size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                Kebugaran vs Kelelahan — {selectedActivity}
              </h3>
              <p className="text-xs text-muted mb-2">RMSSD tinggi + DFA α1 di zona optimal (garis putus-putus) menandakan pemulihan baik.</p>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline, #e5e7eb)" />
                  <XAxis type="number" dataKey="x" name="RMSSD" unit="ms" tick={{ fontSize: 11 }} label={{ value: 'RMSSD (ms)', position: 'insideBottom', offset: -4, fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" name="DFA α1" tick={{ fontSize: 11 }} label={{ value: 'DFA α1', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <ZAxis type="number" dataKey="z" range={[60, 220]} />
                  <ReferenceLine x={20} stroke="var(--warning, #f59e0b)" strokeDasharray="4 4" />
                  <ReferenceLine x={40} stroke="var(--success, #10b981)" strokeDasharray="4 4" />
                  <ReferenceLine y={0.75} stroke="var(--warning, #f59e0b)" strokeDasharray="4 4" />
                  <ReferenceLine y={1.25} stroke="var(--primary, #3b82f6)" strokeDasharray="4 4" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v, name) => [name === 'RMSSD' ? `${fmt(v)} ms` : fmt(v, 2), name]}
                    labelFormatter={() => ''}
                  />
                  <Scatter data={scatterData} name="Pengguna">
                    {scatterData.map((d) => <Cell key={d.id} fill={timePeriod === 'all' ? (TIME_PERIOD_COLORS[d.timePeriod] || '#3b82f6') : (userColor.get(d.originalId) || '#3b82f6')} fillOpacity={0.85} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {scatterData.map((d) => (
                  <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted, #6b7280)' }}>
                    <span className="ba-dot" style={{ background: timePeriod === 'all' ? (TIME_PERIOD_COLORS[d.timePeriod] || '#3b82f6') : (userColor.get(d.originalId) || '#3b82f6') }} /> {d.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ---- radar comparison ---- */}
          <div className="card mb-4" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink, #111)' }}>
                <Gauge size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                Profil Metrik — Bandingkan Pengguna ({selectedActivity})
              </h3>
              <span className="text-xs text-muted flex items-center gap-1"><Info size={12} /> Nilai dinormalisasi 0–100 relatif terhadap grup ini</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' }}>
              {filteredRecords.map((r) => {
                const on = selectedUserIds.includes(r.participant._id);
                const name = r.participant.name || r.participant.username || '—';
                return (
                  <button key={r.participant._id} className={`ba-chip ${on ? 'on' : ''}`} onClick={() => toggleUser(r.participant._id)}
                    style={on ? { borderColor: userColor.get(r.participant._id) } : {}}>
                    <span className="ba-dot" style={{ background: on ? userColor.get(r.participant._id) : 'var(--muted, #d1d5db)' }} />
                    {name}
                  </button>
                );
              })}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="var(--hairline, #e5e7eb)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                {radarUsers.map((r) => {
                  const name = r.participant.name || r.participant.username || '—';
                  return (
                    <Radar key={r.participant._id} name={name} dataKey={name}
                      stroke={userColor.get(r.participant._id)} fill={userColor.get(r.participant._id)}
                      fillOpacity={0.15} strokeWidth={2} />
                  );
                })}
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* ---- detail table ---- */}
          <div className="card !p-0 overflow-hidden mb-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--hairline, #e5e7eb)', backgroundColor: 'var(--surface-raised, #f9fafb)' }}>
                  <th className="pl-lg py-sm font-semibold text-xs text-muted uppercase tracking-wider">Profil Pengguna</th>
                  <th className="py-sm font-semibold text-xs text-muted uppercase tracking-wider">Waktu</th>
                  <th className="py-sm font-semibold text-xs text-muted uppercase tracking-wider">Detak Jantung</th>
                  <th className="py-sm font-semibold text-xs text-muted uppercase tracking-wider">Kebugaran (RMSSD)</th>
                  <th className="py-sm font-semibold text-xs text-muted uppercase tracking-wider">(DFA)</th>
                  <th className="py-sm font-semibold text-xs text-muted uppercase tracking-wider">Akurasi Data</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((item, idx) => {
                  const p = item.participant;
                  const b = item.baseline;
                  const hr = metricMean(b, 'mean_hr');
                  const hrSd = metricStd(b, 'mean_hr');
                  const rmssd = metricMean(b, 'rmssd');
                  const dfa = metricMean(b, 'dfa_alpha1');
                  const rmStat = rmssdStatus(rmssd);
                  const dfaStat = dfaStatus(dfa);
                  const conf = Math.round(confidenceOf(b) * 100);
                  const confColor = conf > 80 ? 'var(--success, #10b981)' : conf > 50 ? 'var(--primary, #3b82f6)' : 'var(--warning, #f59e0b)';
                  const initial = (p.name || p.username || '?').charAt(0).toUpperCase();

                  return (
                    <tr key={idx} className="border-t border-hairline hover-bg" style={{ transition: 'background 0.2s' }}>
                      <td className="pl-lg py-md">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-raised, #f3f4f6)', border: '1px solid var(--hairline, #e5e7eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: userColor.get(p._id) }}>
                            {initial}
                          </div>
                          <div>
                            <div className="font-semibold text-ink" style={{ fontSize: 14 }}>{p.name || p.username || p._id}</div>
                            <div className="text-xs text-muted mt-1">{p.current_device || 'Tidak ada perangkat'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-md">
                        <span className="text-xs" style={{ color: TIME_PERIOD_COLORS[b.time_period] || 'var(--muted, #6b7280)', fontWeight: 600, padding: '2px 6px', background: `${TIME_PERIOD_COLORS[b.time_period] || '#9ca3af'}20`, borderRadius: 4 }}>
                          {TIME_PERIOD_LABEL[b.time_period] || b.time_period || '—'}
                        </span>
                      </td>
                      <td className="py-md">
                        {hr != null ? (
                          <div>
                            <div className="font-semibold text-ink" style={{ fontSize: 15 }}>{fmt(hr, 0)} <span className="text-xs text-muted font-normal">bpm</span></div>
                            <div className="text-xs text-muted mt-1">±{fmt(hrSd, 1)} variasi</div>
                          </div>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="py-md">
                        {rmssd != null ? (
                          <div>
                            <div className="font-semibold text-ink" style={{ fontSize: 15 }}>{fmt(rmssd, 0)} <span className="text-xs text-muted font-normal">ms</span></div>
                            <div style={{ fontSize: 11, color: rmStat.color, marginTop: 4, fontWeight: 600 }}>{rmStat.label}</div>
                          </div>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="py-md">
                        {dfa != null ? (
                          <div>
                            <div className="font-semibold text-ink" style={{ fontSize: 15 }}>{fmt(dfa, 2)}</div>
                            <div style={{ fontSize: 11, color: dfaStat.color, marginTop: 4, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: dfaStat.color }} />
                              {dfaStat.label}
                            </div>
                          </div>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="pr-lg py-md">
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                            <span className="text-muted">Tingkat Kepercayaan</span>
                            <span className="font-semibold text-ink">{conf}%</span>
                          </div>
                          <div style={{ width: '100%', height: 6, background: 'var(--surface-raised, #f3f4f6)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, conf)}%`, height: '100%', background: confColor, transition: 'width 1s ease' }} />
                          </div>
                          <div className="text-xs text-muted mt-2">Segmen: <span className="font-mono">{b.segment_count}</span></div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};

export default BaselineModel;