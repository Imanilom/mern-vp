import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, RefreshCw, Sun, Sunset, MoonStar
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, Line, LineChart, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { DeviceSelector } from '../shared/components/ParticipantSelector';
import { KalmanFilter1D } from '../shared/utils/KalmanFilter';
import { TemporalFeatures } from '../shared/utils/TemporalFeatures';

export interface AnalyticsProps {
  selectedParticipantId?: string;
  onParticipantChange?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
export const Toast = ({ message, onClose }: { message: string; onClose: () => void }) => {
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
// Helpers
// ---------------------------------------------------------------------------
const fmtTime = (ms: number) => (ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const fmt = (v: any, d = 1) => (v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(d));
const feat = (seg: any, key: string) => seg?.features?.[key] ?? null;

export const TrajectoryAnalysis: React.FC<AnalyticsProps> = ({
  selectedParticipantId = '',
  onParticipantChange = () => { }
}) => {
  const [activeTab, setActiveTab] = useState<'Kalman Trajectory' | 'Magnitude' | 'Duration' | 'Persistence' | 'Recovery' | 'Slope'>('Kalman Trajectory');
  const tabs = ['Kalman Trajectory', 'Magnitude', 'Duration', 'Persistence', 'Recovery', 'Slope'] as const;

  const [selectedTimePeriod, setSelectedTimePeriod] = useState<'Pagi' | 'Siang' | 'Sore'>('Pagi');
  const [segments, setSegments] = useState<any[]>([]);
  const [kalmanData, setKalmanData] = useState<{ Pagi: any[]; Siang: any[]; Sore: any[] }>({ Pagi: [], Siang: [], Sore: [] });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Retrieve user role from session storage
  const storedUser = sessionStorage.getItem('htm_user');
  const authUser = storedUser ? JSON.parse(storedUser) : null;
  const isDoctor = authUser?.role === 'doctor';

  // ---- fetch segments & Kalman trajectory data ----
  useEffect(() => {
    if (!selectedParticipantId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem('htm_token');

        // 1. Fetch backend Kalman trajectory endpoint
        const resK = await fetch(`/api/analysis/kalman-trajectory/${selectedParticipantId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (resK.ok) {
          const dataK = await resK.json();
          if (dataK.success && dataK.data) {
            if (!cancelled) {
              setKalmanData(dataK.data);
            }
          }
        }

        // 2. Fetch raw segment list
        const res = await fetch(`/api/analysis/segments/${selectedParticipantId}?limit=30`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            if (!cancelled) setSegments(data.data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch trajectory data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedParticipantId, refreshKey]);

  const sorted = useMemo(() => [...segments].sort((a, b) => a.window_start - b.window_start), [segments]);
  const hasData = sorted.length > 0;

  // Active Kalman dataset for selected time period (Pagi / Siang / Sore)
  const activeKalmanSeries = useMemo(() => {
    const filter = new KalmanFilter1D(0.05, 2.0, selectedTimePeriod === 'Pagi' ? 72 : selectedTimePeriod === 'Siang' ? 86 : 70);
    return sorted.map((s) => {
      const measured = feat(s, 'mean_hr') || 75;
      const kRes = filter.step(measured);
      return {
        time_str: fmtTime(s.window_start),
        measured_hr: measured,
        predicted_hr: kRes.estimate,
        activity: s.activity_label || 'Rest',
        classification: s.classification || 'Normal',
        state: s.state || 'NORMAL', // 9-State Temporal Machine
        is_episode: (s.state || '').includes('DEVIATION') || (s.classification || '') !== 'Normal',
        missing_count: s.missing_data_info?.missing_count || 5,
        confidence_score: s.missing_data_info?.confidence_score || 99.5,
      };
    });
  }, [selectedTimePeriod, sorted]);

  // ---- Top status metrics ----
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

  const magnitudeData = useMemo(() => sorted.map((s) => ({
    time: fmtTime(s.window_start), ts: s.window_start, score: +fmt(s.anomaly_score, 2),
    classification: s.classification, activity: s.activity_label,
  })), [sorted]);

  const anomalyRuns = useMemo(() => {
    const runs: Array<any> = [];
    let current: any = null;

    for (const seg of sorted) {
      const isAnomaly = seg.classification && seg.classification !== 'Normal';
      if (isAnomaly) {
        const score = Number(seg.anomaly_score ?? 0);
        if (!current) {
          current = {
            startSeg: seg,
            endSeg: seg,
            peakSeg: seg,
            count: 1,
            maxScore: score,
            activity: seg.activity_label || 'Unknown',
          };
        } else {
          current.endSeg = seg;
          current.count += 1;
          if (score > current.maxScore) {
            current.maxScore = score;
            current.peakSeg = seg;
          }
        }
      } else if (current) {
        current.recoveredAt = seg.window_start;
        current.recoveryMs = seg.window_start - current.peakSeg.window_start;
        runs.push(current);
        current = null;
      }
    }

    if (current) {
      runs.push(current);
    }

    return runs.map((run) => ({
      label: fmtTime(run.startSeg.window_start),
      startTs: run.startSeg.window_start,
      durationMin: Math.max(1, Math.round((run.endSeg.window_end - run.startSeg.window_start) / 60000)),
      count: run.count,
      activity: run.activity,
      maxScore: run.maxScore,
      recoveryMin: run.recoveryMs != null ? Math.round(run.recoveryMs / 60000) : null,
      ongoing: run.recoveryMs == null,
    }));
  }, [sorted]);

  const persistenceData = useMemo(() => {
    const map = new Map<string, { activity: string; longest: number; total: number; runs: number }>();
    anomalyRuns.forEach((run) => {
      const item = map.get(run.activity) ?? { activity: run.activity, longest: 0, total: 0, runs: 0 };
      item.longest = Math.max(item.longest, run.count);
      item.total += run.count;
      item.runs += 1;
      map.set(run.activity, item);
    });
    return Array.from(map.values());
  }, [anomalyRuns]);

  const recoveryData = useMemo(() => anomalyRuns.map((run) => ({
    label: run.label,
    recoveryMin: run.recoveryMin ?? 0,
    ongoing: run.ongoing,
    anomalyDuration: run.durationMin,
    maxScore: run.maxScore,
  })), [anomalyRuns]);

  const slopeData = useMemo(() => sorted.map((s) => ({
    time: fmtTime(s.window_start),
    slope: Number(feat(s, 'slope_hr') ?? 0),
    activity: s.activity_label || 'Unknown',
  })), [sorted]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <section className="traj-analytics">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="page-title">Trajectory analysis (Kalman Filter)</h1>
          <p className="text-xs text-muted" style={{ marginTop: 2 }}>
            Prediksi trajectory dan estimasi trend per waktu user (Pagi, Siang, Sore) • Mode: <strong>{isDoctor ? 'Doctor Monitor' : 'User Self-View'}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <DeviceSelector selectedId={selectedParticipantId} onChange={onParticipantChange} />
          <button className="btn btn-outline flex items-center gap-1" onClick={handleRefresh}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Trajectory status figures */}
      <div className="traj-status-card mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 12 }}>
        <div>
          <span className={`badge ${trajStats.status === 'Stable' ? 'badge-stable' : 'badge-caution'}`} style={{ fontSize: 13, padding: '6px 14px' }}>
            <span className="badge-dot" />{trajStats.status}
          </span>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            {trajStats.status === 'Stable' ? 'Baseline Trajectory Stable' : 'Active Deviation Detected'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div><span className="eyebrow">Magnitude</span><div style={{ fontSize: 18, fontWeight: 700 }}>{trajStats.magnitude}</div></div>
          <div><span className="eyebrow">Duration</span><div style={{ fontSize: 18, fontWeight: 700 }}>{trajStats.duration}</div></div>
          <div><span className="eyebrow">Data Count</span><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--stable-text)' }}>{sorted.length}</div></div>
          <div><span className="eyebrow">Recovery</span><div style={{ fontSize: 18, fontWeight: 700 }}>{trajStats.recovery}</div></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs mb-4" style={{ display: 'flex', gap: 8 }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab(tab)}
            style={{ fontSize: 13, padding: '6px 14px' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="chart-card mb-4 text-center py-8 text-muted">Memuat data trajectory Kalman Filter...</div>
      ) : (
        <div className="chart-card mb-4" style={{ padding: 20, background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 12 }}>
          
          {activeTab === 'Kalman Trajectory' && (
            <>
              {/* Time of Day Switcher (Pagi, Siang, Sore) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    📈 Kalman Filter Trajectory Prediction
                    <span className="badge badge-stable" style={{ fontSize: 11 }}>
                      🕒 Circadian Encoding: {TemporalFeatures.encode().timeOfDay} ({TemporalFeatures.encode().dayType})
                    </span>
                  </h3>
                  <span className="text-xs text-muted">
                    Fitur waktu sirkadian per user: Pagi (06:00-11:59), Siang (12:00-15:59), Sore (16:00-18:59), Malam (19:00-05:59)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, background: 'var(--surface-overlay)', padding: 4, borderRadius: 8, border: '1px solid var(--hairline)' }}>
                  <button
                    className={`btn ${selectedTimePeriod === 'Pagi' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: 12, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setSelectedTimePeriod('Pagi')}
                  >
                    <Sun size={14} /> Pagi (06:00-12:00)
                  </button>
                  <button
                    className={`btn ${selectedTimePeriod === 'Siang' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: 12, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setSelectedTimePeriod('Siang')}
                  >
                    <Sunset size={14} /> Siang (12:00-18:00)
                  </button>
                  <button
                    className={`btn ${selectedTimePeriod === 'Sore' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: 12, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setSelectedTimePeriod('Sore')}
                  >
                    <MoonStar size={14} /> Sore/Malam (18:00-24:00)
                  </button>
                </div>
              </div>

              {/* Kalman Filter Chart */}
              {(() => {
                const getLineColor = () => {
                  if (selectedTimePeriod === 'Pagi') return '#f59e0b';
                  if (selectedTimePeriod === 'Siang') return '#0ea5e9';
                  if (selectedTimePeriod === 'Sore') return '#8b5cf6';
                  return 'var(--primary)';
                };
                const lineColor = getLineColor();
                
                // Custom tooltip to show 9-State machine
                const TrajectoryTooltip = ({ active, payload, label }: any) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', padding: 10, borderRadius: 8, fontSize: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Waktu: {label}</div>
                      <div>Aktivitas: {data.activity}</div>
                      <div style={{ color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>
                        Status State: {data.state}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        HR Terukur: {data.measured_hr} bpm<br/>
                        HR Prediksi (Kalman): {Math.round(data.predicted_hr)} bpm
                      </div>
                    </div>
                  );
                };

                return (
                  <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={activeKalmanSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                  <XAxis dataKey="time_str" tick={{ fontSize: 11 }} />
                  <YAxis domain={['dataMin - 5', 'dataMax + 10']} tick={{ fontSize: 11 }} label={{ value: 'BPM', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <Tooltip content={<TrajectoryTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />

                  {/* Episodes Bar Band */}
                  <Bar
                    dataKey={(d) => d.is_episode ? 200 : 0}
                    name="Episode Area"
                    fill="var(--alert-text)"
                    fillOpacity={0.15}
                    isAnimationActive={false}
                    barSize={20}
                  />

                  {/* Measured Raw HR Points */}
                  <Line
                    type="monotone"
                    dataKey="measured_hr"
                    name="Measured HR (Raw)"
                    stroke="#8b5cf6"
                    strokeWidth={1.5}
                    dot={{ r: 3 }}
                  />

                  {/* Kalman Filter Predicted Trajectory */}
                  <Line
                    type="monotone"
                    dataKey="predicted_hr"
                    name="Kalman Trajectory Prediction"
                    stroke={lineColor}
                    strokeWidth={2.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              );
              })()}

              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>💡 Kalman Filter secara otomatis meredam noise sensor dan memprediksi trajectory detak jantung fisiologis.</span>
                <span className="font-mono">Data Points: {sorted.length}</span>
              </div>
            </>
          )}

          {activeTab === 'Magnitude' && (
            <>
              <p className="text-xs text-muted mb-3"><Activity size={14} style={{ display: 'inline', marginRight: 4 }} />Skor anomali tiap segmen.</p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={magnitudeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="score" stroke="var(--deviation-text)" fill="var(--deviation-text)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}

          {activeTab === 'Duration' && (
            <>
              <p className="text-xs text-muted mb-3">Durasi episode anomali berdasarkan run segment berurutan.</p>
              {anomalyRuns.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={anomalyRuns} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: 'Menit', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip formatter={(value) => [`${value} min`, 'Durasi']} />
                    <Bar dataKey="durationMin" name="Durasi" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm py-4 text-muted">Tidak ada episode anomali terdeteksi untuk periode ini.</div>
              )}
            </>
          )}

          {activeTab === 'Persistence' && (
            <>
              <p className="text-xs text-muted mb-3">Persistence menunjukkan panjang run anomali per aktivitas.</p>
              {persistenceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={persistenceData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="activity" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: 'Segment', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip formatter={(value) => [`${value} segmen`, 'Persistence']} />
                    <Bar dataKey="longest" name="Longest run" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm py-4 text-muted">Tidak ada data persistence anomali untuk periode ini.</div>
              )}
            </>
          )}

          {activeTab === 'Recovery' && (
            <>
              <p className="text-xs text-muted mb-3">Recovery menunjukkan waktu kembali normal setelah peak anomali.</p>
              {recoveryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={recoveryData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: 'Menit', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip formatter={(value, name) => [`${value} min`, name]} />
                    <Bar dataKey="recoveryMin" name="Recovery" fill="var(--stable-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm py-4 text-muted">Belum ada episode anomali yang pulih sepenuhnya.</div>
              )}
              {recoveryData.some((run) => run.ongoing) && (
                <div className="text-xs text-muted mt-3">* Beberapa episode masih dalam status ongoing dan belum pulih sepenuhnya.</div>
              )}
            </>
          )}

          {activeTab === 'Slope' && (
            <>
              <p className="text-xs text-muted mb-3">Slope HR per window untuk menunjukan trend naik / turun dalam tiap segmen.</p>
              {slopeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={slopeData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: 'Slope', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip formatter={(value) => [value, 'Slope HR']} />
                    <Line type="monotone" dataKey="slope" stroke="var(--alert-text)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm py-4 text-muted">Tidak ada nilai slope HR yang tersedia untuk periode ini.</div>
              )}
            </>
          )}

        </div>
      )}

      {/* Segments table for active time period */}
      {activeKalmanSeries.length > 0 && (
        <div className="card !p-0 overflow-hidden mb-4">
          <div style={{ padding: '10px 16px', background: 'var(--surface-overlay)', borderBottom: '1px solid var(--hairline)', fontWeight: 600, fontSize: 12 }}>
            📋 Segmen Trajectory — Periode {selectedTimePeriod}
          </div>
          <table className="w-full" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th className="pl-lg py-sm">Waktu</th>
                <th>Aktivitas</th>
                <th>Measured HR</th>
                <th>Kalman Predicted</th>
                <th>95% Confidence Bounds</th>
                <th>Status Deviasi</th>
              </tr>
            </thead>
            <tbody>
              {activeKalmanSeries.map((row: any, idx: number) => (
                <tr key={idx} className="border-t border-hairline">
                  <td className="pl-lg py-sm mono">{row.time_str}</td>
                  <td>{row.activity}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>{row.measured_hr} bpm</td>
                  <td className="mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>{row.predicted_hr} bpm</td>
                  <td className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>[{row.lower_bound} — {row.upper_bound}]</td>
                  <td>
                    <span className={`badge ${row.classification === 'Normal' ? 'badge-stable' : 'badge-caution'}`}>
                      {row.classification || 'Normal'}
                    </span>
                  </td>
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