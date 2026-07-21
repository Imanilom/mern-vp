import React from 'react';
import { FaSync } from 'react-icons/fa';
import { Skeleton, Badge, SmoothLineChart, classColor, fmtTime } from './DashboardShared';

export default function Overview({ data, loading, errors, fetchFor, sessionUser, mqRate, w1State, w2State }) {
  const evtList = data.overview?.data || [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Patients (API)', value: data.patients?.length ?? '—', color: 'text-sys-blue', sub: 'GET /api/patient/all' },
          { label: 'Ingestion Rate', value: `${mqRate} msg/s`, color: 'text-sys-green', sub: 'RabbitMQ queue' },
          { label: 'Open Anomaly Events', value: loading.overview ? '…' : evtList.filter(e => e.status === 'open').length, color: 'text-sys-orange', sub: 'GET /api/analysis/events' },
          { label: 'Pipeline Layer', value: w1State === 'Running' && w2State === 'Running' ? 'All Active' : 'Degraded', color: w1State === 'Running' ? 'text-sys-green' : 'text-sys-red', sub: 'Worker nodes' },
        ].map((k, i) => (
          <div key={i} className="bg-brand-card border border-brand-border p-5 rounded-2xl shadow-lg">
            <span className="text-[9px] text-brand-muted uppercase font-extrabold tracking-wider block">{k.label}</span>
            <h3 className={`text-2xl font-black mt-2 ${k.color}`}>{k.value}</h3>
            <span className="text-[9px] text-brand-muted font-mono block mt-1">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Ingestion chart & Status */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-brand-card border border-brand-border p-6 rounded-2xl lg:col-span-2 shadow-lg space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm">Ingestion Rate Sparkline (simulated)</h4>
            <span className="text-[10px] text-sys-blue font-bold">{mqRate} msg/s</span>
          </div>
          <SmoothLineChart
            points={[740, 780, 810, 750, 795, mqRate - 20, mqRate, mqRate + 10, mqRate - 5, mqRate]}
            color="#3b82f6"
            fillId="ingest-grad"
            height={160}
          />
        </div>
        <div className="bg-brand-card border border-brand-border p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm">Pipeline Status</h4>
            <div className="mt-4 space-y-3 text-xs">
              {[
                { label: 'Layer 2 CronJob (3 min)', state: 'Active' },
                { label: 'Layer 3 CronJob (5 min)', state: 'Active' },
                { label: 'Worker-01', state: w1State },
                { label: 'Worker-02', state: w2State },
              ].map((n, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-brand-muted">{n.label}</span>
                  <Badge label={n.state} color={n.state === 'Running' || n.state === 'Active' ? 'green' : 'red'} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-brand-border flex justify-between items-center">
          <h4 className="font-bold text-sm">Recent Anomaly Events (Live — GET /api/analysis/events)</h4>
          <button onClick={() => fetchFor('overview')} className="text-sys-blue text-xs">
            <FaSync className={loading.overview ? 'animate-spin' : ''} />
          </button>
        </div>
        {loading.overview ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : errors.overview ? (
          <div className="p-6 text-sys-red text-xs">{errors.overview}</div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="bg-brand-cardLight border-b border-brand-border text-brand-muted text-[9px] uppercase font-bold">
              <tr>
                <th className="p-4">Onset Time</th>
                <th className="p-4">Activity</th>
                <th className="p-4">Classification</th>
                <th className="p-4">Peak Score</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-brand-muted">
              {evtList.slice(0, 8).map((evt, i) => (
                <tr key={i} className="hover:bg-brand-cardLight">
                  <td className="p-4 font-bold text-brand-text">{fmtTime(evt.onset_time)}</td>
                  <td className="p-4">{evt.activity || '—'}</td>
                  <td className="p-4"><Badge label={evt.classification} color={classColor(evt.classification)} /></td>
                  <td className="p-4 font-bold">{evt.peak_score?.toFixed(2) ?? '—'}</td>
                  <td className="p-4"><Badge label={evt.status} color={evt.status === 'open' ? 'orange' : 'gray'} /></td>
                </tr>
              ))}
              {!evtList.length && (
                <tr><td colSpan="5" className="p-6 text-center text-brand-muted">No events found for this user.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
