import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Line } from 'recharts';
import { DownloadSimple, Heart, Footprints, WifiHigh, BatteryMedium, Cpu } from '@phosphor-icons/react';

interface ParticipantDetailProps {
  id: string;
  onBack: () => void;
}


export const ParticipantDetail: React.FC<ParticipantDetailProps> = ({ id, onBack }) => {
  const [activeTab, setActiveTab] = useState<'Overview' | 'Live' | 'Timeline' | 'Baseline' | 'Trajectory' | 'Anomalies' | 'Reports' | 'Quality'>('Overview');
  const [liveHr, setLiveHr] = useState(78);
  const [liveHistory, setLiveHistory] = useState<number[]>(Array.from({ length: 20 }, () => 75 + Math.floor(Math.random() * 10)));

  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRawData = async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch(`/api/data/raw/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            // Take the last 24 hours of data roughly, or just the most recent
            const recent = json.data.slice(-500); // adjust as needed
            
            // Build chart data
            const mapped = recent.map((item: any, i: number) => ({
              time: new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
              hr: item.HR,
              baselineLow: 60,
              baselineHigh: 100,
              baselineAvg: 80,
            }));
            setChartData(mapped);

            if (recent.length > 0) {
              const latestHr = recent[recent.length - 1].HR;
              setLiveHr(latestHr);
              setLiveHistory(recent.slice(-20).map((r: any) => r.HR));
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch participant data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRawData();
    
    let interval: any;
    if (activeTab === 'Live') {
      interval = setInterval(fetchRawData, 5000);
    }
    return () => clearInterval(interval);
  }, [id, activeTab]);

  return (
    <section>
      <div className="breadcrumb flex items-center gap-1">
        <span className="link" onClick={onBack}>Participants</span> / <b>{id}</b>
      </div>

      <div className="page-head">
        <h1 className="page-title">Participant {id}</h1>
        <button className="btn btn-ghost flex items-center gap-1">
          <DownloadSimple size={14} /> Export
        </button>
      </div>

      {/* DETAIL TABS */}
      <div className="tabs">
        {(['Overview', 'Live', 'Timeline', 'Baseline', 'Trajectory', 'Anomalies', 'Reports', 'Quality'] as const).map(tab => (
          <div 
            key={tab}
            className={`tab ${activeTab === (tab === 'Live' ? 'Live' : tab === 'Timeline' ? 'Timeline' : tab === 'Quality' ? 'Quality' : tab) ? 'on' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'Live' ? 'Live monitoring' : tab === 'Timeline' ? 'Activity timeline' : tab === 'Quality' ? 'Device & data quality' : tab}
          </div>
        ))}
      </div>

      {/* METRIC ROW */}
      <div className="metric-row">
        <div className="metric">
          <span className="eyebrow flex items-center gap-1"><Heart size={12} className="text-alert-text" /> Heart rate</span>
          <div className="metric-value">{activeTab === 'Live' ? liveHr : 78} bpm</div>
        </div>
        <div className="metric">
          <span className="eyebrow">RMSSD mean</span>
          <div className="metric-value">36 ms</div>
        </div>
        <div className="metric">
          <span className="eyebrow">DFA α1</span>
          <div className="metric-value">1.08</div>
        </div>
        <div className="metric">
          <span className="eyebrow flex items-center gap-1"><Footprints size={12} /> Activity</span>
          <div className="metric-value font-sans text-xs">Sit working</div>
        </div>
        <div className="metric">
          <span className="eyebrow">Data quality</span>
          <div className="metric-value">96%</div>
        </div>
        <div className="metric" style={{ backgroundColor: 'var(--caution-fill)', borderColor: 'var(--caution-text)' }}>
          <span className="eyebrow" style={{ color: 'var(--caution-text)' }}>Trajectory</span>
          <div className="metric-value font-sans text-xs font-semibold" style={{ color: 'var(--caution-text)' }}>Recovering</div>
        </div>
      </div>

      {/* TAB CONTENTS */}
      {activeTab === 'Overview' && (
        <div className="split">
          <div className="chart-card">
            <p className="card-title">Heart rate & baseline (24h)</p>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="time" stroke="var(--muted)" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted)" fontSize={9} tickLine={false} axisLine={false} domain={[50, 130]} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: '8px', fontSize: '11px', color: 'var(--ink)' }} />
                  {/* Normal Range Band Area */}
                  <Area dataKey="baselineHigh" stroke="none" fill="var(--hairline)" opacity={0.3} />
                  <Area dataKey="baselineLow" stroke="none" fill="var(--surface)" opacity={1} />
                  {/* Baseline Avg Line */}
                  <Line dataKey="baselineAvg" stroke="var(--muted)" strokeDasharray="3 3" dot={false} strokeWidth={1} />
                  {/* Actual Heart Rate */}
                  <Area dataKey="hr" stroke="var(--primary)" fill="none" strokeWidth={2} dot={(props: any) => {
                    if (props.payload.hr > 100) {
                      return <circle cx={props.cx} cy={props.cy} r={4} fill="var(--deviation-text)" stroke="none" key={props.index} />;
                    }
                    return null as any;
                  }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Color Strip Bar for Activity Context */}
            <div className="activity-strip">
              <div style={{ width: '20%', backgroundColor: 'var(--cat2)' }} title="Walking"></div>
              <div style={{ width: '35%', backgroundColor: 'var(--cat1)' }} title="Sit working"></div>
              <div style={{ width: '15%', backgroundColor: 'var(--cat3)' }} title="Driving"></div>
              <div style={{ width: '10%', backgroundColor: 'var(--cat4)' }} title="Eating"></div>
              <div style={{ width: '20%', backgroundColor: 'var(--cat5)' }} title="Exercise"></div>
            </div>
            <div className="flex gap-4 mt-2 text-[10px] text-muted font-mono">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cat1"></span> Sit Working</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cat2"></span> Walking</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cat3"></span> Driving</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cat4"></span> Eating</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cat5"></span> Exercise</div>
            </div>
          </div>

          <div>
            <div className="side-card">
              <p className="card-title">Last anomaly</p>
              <div className="text-xs text-muted mb-2">10:21 AM</div>
              <div className="flex justify-between text-xs py-1 border-t border-hairline">
                <span className="text-muted">Magnitude</span>
                <span className="mono">2.4 SD</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-t border-hairline">
                <span className="text-muted">Duration</span>
                <span className="mono">13 min</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-t border-hairline">
                <span className="text-muted">Recovery</span>
                <span className="mono">72%</span>
              </div>
            </div>
            <div className="side-card">
              <p className="card-title">Device & Signal</p>
              <div className="text-xs font-semibold flex items-center gap-1"><Cpu size={14} /> Polar H10</div>
              <div className="text-xs text-muted mt-1 flex items-center gap-1">
                <BatteryMedium size={14} /> Battery 82% · <WifiHigh size={14} /> Signal good
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Live' && (
        <div className="card">
          <div className="flex justify-between items-baseline mb-4">
            <p className="card-title !m-0">Real-time Heart Rate Stream (Mock)</p>
            <span className="badge badge-stable flex items-center gap-1"><span className="badge-dot"></span> Live</span>
          </div>
          <div className="flex items-center gap-8 mb-4">
            <div className="text-5xl font-mono font-bold tracking-tight text-primaryColor flex items-baseline gap-1">
              {liveHr} <span className="text-xs font-sans font-normal text-muted">BPM</span>
            </div>
            <div className="flex-1 text-xs text-muted">
              Menerima data paket BLE (characteristic 2a37) secara real-time dari sensor Polar H10. Data diunggah ke MongoDB via offline buffer service.
            </div>
          </div>
          <div className="h-[120px] bg-canvas border border-hairline rounded-lg p-2 flex items-end gap-1 overflow-hidden">
            {liveHistory.map((val, idx) => {
              const heightPct = ((val - 50) / 70) * 100;
              return (
                <div 
                  key={idx} 
                  className="flex-1 bg-primaryColor rounded-t-sm transition-all duration-300"
                  style={{ height: `${Math.max(10, Math.min(100, heightPct))}%`, opacity: 0.3 + (idx / 20) * 0.7 }}
                ></div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'Timeline' && (
        <div className="card">
          <p className="card-title">Activity timeline (Hari ini)</p>
          <div className="flex flex-col gap-4 font-sans text-xs">
            <div className="flex gap-4 border-l border-hairline pl-4 relative">
              <span className="w-2 h-2 rounded-full bg-cat2 absolute -left-[5px] top-1"></span>
              <div className="mono text-muted w-20">10:30 - Sekarang</div>
              <div className="font-semibold text-ink">Walking</div>
              <div className="text-muted">Melangkah kaki intensitas sedang. Sinyal kuat.</div>
            </div>
            <div className="flex gap-4 border-l border-hairline pl-4 relative">
              <span className="w-2 h-2 rounded-full bg-cat1 absolute -left-[5px] top-1"></span>
              <div className="mono text-muted w-20">07:30 - 10:30</div>
              <div className="font-semibold text-ink">Sit working</div>
              <div className="text-muted">Aktivitas duduk bekerja di depan komputer meja.</div>
            </div>
            <div className="flex gap-4 pl-4 relative">
              <span className="w-2 h-2 rounded-full bg-cat4 absolute -left-[5px] top-1"></span>
              <div className="mono text-muted w-20">07:00 - 07:30</div>
              <div className="font-semibold text-ink">Eating</div>
              <div className="text-muted">Makan pagi/sarapan.</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Baseline' && (
        <div className="card">
          <p className="card-title">Personalized baseline parameters (Sit working)</p>
          <div className="grid grid-cols-4 gap-4 text-xs font-sans">
            <div className="border border-hairline p-3 rounded-lg bg-canvas">
              <div className="text-muted">Baseline HR Mean</div>
              <div className="text-lg font-mono font-semibold">77 BPM</div>
            </div>
            <div className="border border-hairline p-3 rounded-lg bg-canvas">
              <div className="text-muted">Baseline HR SD</div>
              <div className="text-lg font-mono font-semibold">6.1</div>
            </div>
            <div className="border border-hairline p-3 rounded-lg bg-canvas">
              <div className="text-muted">RMSSD Target</div>
              <div className="text-lg font-mono font-semibold">31 ms</div>
            </div>
            <div className="border border-hairline p-3 rounded-lg bg-canvas">
              <div className="text-muted">Observation window</div>
              <div className="text-lg font-mono font-semibold">518 windows</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Trajectory' && (
        <div className="card">
          <p className="card-title">Trajectory recovery analysis</p>
          <div className="text-xs text-muted mb-4">
            Estimated state: **Moving toward baseline**. Kecepatan recovery saat ini 1.2 BPM/menit.
          </div>
          <div className="w-full bg-canvas border border-hairline rounded-lg p-4 font-mono text-xs flex flex-col gap-2">
            <div className="flex justify-between border-b border-hairline pb-1">
              <span>Deviation Start</span>
              <span>10:21 AM (Sit working)</span>
            </div>
            <div className="flex justify-between border-b border-hairline pb-1">
              <span>Max Magnitude Deviation</span>
              <span className="text-alert-text font-bold">2.4 SD (108 BPM vs 77 BPM baseline)</span>
            </div>
            <div className="flex justify-between border-b border-hairline pb-1">
              <span>Current Recovery Percentage</span>
              <span className="text-stable-text font-semibold">72%</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated Time to Baseline</span>
              <span>~8 menit</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Anomalies' && (
        <div className="card !p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-hairline">
                <th className="pl-lg py-sm">Event ID</th>
                <th className="py-sm">Start</th>
                <th className="py-sm">Max Deviation</th>
                <th className="py-sm">Duration</th>
                <th className="py-sm">Recovery</th>
                <th className="pr-lg py-sm text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-hairline">
                <td className="mono pl-lg py-sm">EVT-2031</td>
                <td className="mono py-sm">10:21</td>
                <td className="mono py-sm">2.4 SD</td>
                <td className="mono py-sm">13 min</td>
                <td className="mono py-sm">72%</td>
                <td className="pr-lg py-sm text-right"><span className="badge badge-monitoring"><span className="badge-dot"></span>New</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Reports' && (
        <div className="card !p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-hairline">
                <th className="pl-lg py-sm">Report Name</th>
                <th className="py-sm">Generated At</th>
                <th className="pr-lg py-sm text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-hairline">
                <td className="pl-lg py-sm">Daily summary — 20 Jul 2026</td>
                <td className="mono py-sm">20 Jul 2026 10:30</td>
                <td className="pr-lg py-sm text-right"><button className="btn btn-ghost py-1 px-3">Download</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Quality' && (
        <div className="card">
          <p className="card-title">Data Completeness & Quality metrics</p>
          <div className="text-xs text-muted mb-4">Polar H10 sensor is connected and healthy. Packet loss is extremely low.</div>
          <div className="grid grid-cols-3 gap-4 text-xs font-sans">
            <div className="border border-hairline p-3 rounded-lg bg-canvas text-center">
              <div className="text-muted">Avg Data Completeness</div>
              <div className="text-2xl font-mono font-bold mt-1 text-stable-text">96.4%</div>
            </div>
            <div className="border border-hairline p-3 rounded-lg bg-canvas text-center">
              <div className="text-muted">Signal strength</div>
              <div className="text-2xl font-mono font-bold mt-1 text-stable-text">98%</div>
            </div>
            <div className="border border-hairline p-3 rounded-lg bg-canvas text-center">
              <div className="text-muted">ECG artifacts frequency</div>
              <div className="text-2xl font-mono font-bold mt-1 text-mutedColor">0.02%</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
