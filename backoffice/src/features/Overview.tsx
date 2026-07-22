import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Users, WifiHigh, Database, Queue, Warning, WarningCircle, CheckCircle, Clock } from '@phosphor-icons/react';

interface OverviewProps {
  onViewParticipant: (id: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ onViewParticipant }) => {
  const [stats, setStats] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch('/api/pipeline/status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) {
          throw new Error('Gagal mengambil data dari server');
        }
        const data = await res.json();
        if (data.success) {
          setStats(data.overview_stats);
          setRecentEvents(data.recent_events || []);
          setError(null);
        } else {
          throw new Error(data.message || 'Terjadi kesalahan');
        }
      } catch (err: any) {
        setError(err.message || 'Gagal terhubung ke server');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <section className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Memuat data dashboard...</p>
      </section>
    );
  }

  if (error && !stats) {
    return (
      <section className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-center">
        <WarningCircle size={40} style={{ color: 'var(--alert-text)' }} />
        <p className="text-md font-semibold" style={{ color: 'var(--ink)' }}>Gagal memuat dashboard</p>
        <p className="text-sm max-w-md" style={{ color: 'var(--muted)' }}>{error}</p>
        <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', borderRadius: 'var(--r-md)' }}>
          Coba Lagi
        </button>
      </section>
    );
  }

  const {
    activeParticipants = 0,
    activeSensors = 0,
    dataToday = 0,
    preprocessingQueue = 0,
    activeAlerts = 0,
    criticalAlerts = 0,
    avgCompleteness = 94.8,
    avgSignalQuality = 91.2,
    hourlyData = [],
    donutData = []
  } = stats || {};

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Overview</h1>
        <span className="page-meta">{new Date().toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {/* KPI GRID */}
      <div className="kpi-grid">
        <div className="kpi">
          <span className="eyebrow flex items-center gap-1"><Users size={12} /> Active participants</span>
          <div className="kpi-value">{activeParticipants.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <span className="eyebrow flex items-center gap-1"><WifiHigh size={12} /> Active sensors</span>
          <div className="kpi-value">{activeSensors.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <span className="eyebrow flex items-center gap-1"><Database size={12} /> Data hari ini</span>
          <div className="kpi-value">{dataToday.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <span className="eyebrow flex items-center gap-1"><Queue size={12} /> Preprocessing queue</span>
          <div className="kpi-value">{preprocessingQueue.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <span className="eyebrow flex items-center gap-1"><Warning size={12} /> Active alerts</span>
          <div className="kpi-value">{activeAlerts.toLocaleString()}</div>
        </div>
        <div className="kpi warn">
          <span className="eyebrow flex items-center gap-1"><WarningCircle size={12} /> Critical alerts</span>
          <div className="kpi-value">{criticalAlerts.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <span className="eyebrow flex items-center gap-1"><CheckCircle size={12} /> Avg completeness</span>
          <div className="kpi-value">{avgCompleteness}%</div>
        </div>
        <div className="kpi">
          <span className="eyebrow flex items-center gap-1"><WifiHigh size={12} /> Avg signal quality</span>
          <div className="kpi-value">{avgSignalQuality}%</div>
        </div>
      </div>

      {/* TWO COLUMNS CHARTS */}
      <div className="two-col">
        <div className="chart-card">
          <div className="flex justify-between items-baseline mb-4">
            <p className="card-title !m-0">Data ingestion per jam</p>
            <span className="eyebrow">msg/s</span>
          </div>
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <XAxis dataKey="hour" stroke="var(--muted)" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: '8px', fontSize: '11px', color: 'var(--ink)' }} 
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Bar dataKey="messages" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <p className="card-title">Anomalies per activity</p>
          <div className="donut-wrap">
            <div style={{ width: 110, height: 110, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={52}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {donutData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest font-semibold text-muted">DFA</span>
              </div>
            </div>
            <div className="legend">
              {donutData.map((entry: any, index: number) => (
                <div key={index} className="legend-row">
                  <span className="legend-dot" style={{ backgroundColor: entry.color }}></span>
                  {entry.name} — {entry.value}%
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* LATEST EVENTS TABLE */}
      <div className="card">
        <p className="card-title">Event terbaru</p>
        <table className="w-full">
          <thead>
            <tr>
              <th className="pb-sm">Waktu</th>
              <th className="pb-sm">Peserta</th>
              <th className="pb-sm">Aktivitas</th>
              <th className="pb-sm">Event</th>
              <th className="pb-sm text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentEvents.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-sm text-muted">Tidak ada event terbaru</td>
              </tr>
            ) : (
              recentEvents.map((event) => {
                let badgeClass = 'badge-monitoring';
                if (event.status === 'Under Review' || event.status === 'Under review') badgeClass = 'badge-caution';
                if (event.status === 'Validated') badgeClass = 'badge-stable';
                if (event.status === 'Closed') badgeClass = 'badge-inactive';

                return (
                  <tr 
                    key={event.eventId} 
                    className="clickable" 
                    onClick={() => onViewParticipant(event.participantId)}
                  >
                    <td className="mono py-sm flex items-center gap-1 text-mutedColor"><Clock size={12} /> {event.startTime}</td>
                    <td className="mono py-sm">{event.participantId}</td>
                    <td className="py-sm">{event.activity}</td>
                    <td className="py-sm">{event.eventId.slice(-6)}: {event.magnitude} SD deviation</td>
                    <td className="py-sm text-right">
                      <span className={`badge ${badgeClass}`}>
                        <span className="badge-dot"></span>
                        {event.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
