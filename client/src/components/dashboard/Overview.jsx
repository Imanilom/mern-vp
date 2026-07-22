import React from 'react';
import { FaSync } from 'react-icons/fa';
import { Skeleton, Badge, SmoothLineChart, classColor, fmtTime, MetricCard, SectionHeader } from './DashboardShared';

export default function Overview({ data, loading, errors, fetchFor, sessionUser, mqRate, w1State, w2State }) {
  const evtList = data.overview?.data || [];

  return (
    <div className="space-y-6">
      <SectionHeader 
        title={`Welcome, ${sessionUser?.name}`} 
        subtitle="System Overview & Pipeline Status"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Participants (API)"
          value={data.patients?.length ?? '—'}
          color="var(--htm-info)"
          sub="GET /api/patient/all"
        />
        <MetricCard
          label="Ingestion Rate"
          value={`${mqRate} msg/s`}
          color="var(--htm-stable)"
          sub="RabbitMQ queue"
        />
        <MetricCard
          label="Open Anomaly Events"
          value={loading.overview ? '…' : evtList.filter(e => e.status === 'open').length}
          color="var(--htm-caution)"
          sub="GET /api/analysis/events"
        />
        <MetricCard
          label="Pipeline Layer"
          value={w1State === 'Running' && w2State === 'Running' ? 'All Active' : 'Degraded'}
          color={w1State === 'Running' ? 'var(--htm-stable)' : 'var(--htm-alert)'}
          sub="Worker nodes"
        />
      </div>

      {/* Ingestion chart & Status */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="htm-card lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="htm-title">Ingestion Rate Sparkline (simulated)</h4>
            <span className="htm-mono" style={{ color: 'var(--htm-info)', fontSize: 13 }}>{mqRate} msg/s</span>
          </div>
          <SmoothLineChart
            points={[740, 780, 810, 750, 795, mqRate - 20, mqRate, mqRate + 10, mqRate - 5, mqRate]}
            color="var(--htm-info)"
            fillId="ingest-grad"
            height={160}
          />
        </div>
        <div className="htm-card flex flex-col justify-between">
          <div>
            <h4 className="htm-title">Pipeline Status</h4>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Layer 2 CronJob (3 min)', state: 'Active' },
                { label: 'Layer 3 CronJob (5 min)', state: 'Active' },
                { label: 'Worker-01', state: w1State },
                { label: 'Worker-02', state: w2State },
              ].map((n, i) => (
                <div key={i} className="flex justify-between items-center htm-body-sm">
                  <span style={{ color: 'var(--htm-sub)' }}>{n.label}</span>
                  <Badge label={n.state} color={n.state === 'Running' || n.state === 'Active' ? 'stable' : 'alert'} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="htm-card p-0 overflow-hidden">
        <div className="p-4 border-b border-htm-hairline flex justify-between items-center" style={{ background: 'var(--htm-canvas)' }}>
          <h4 className="htm-title">Recent Anomaly Events <span className="htm-eyebrow" style={{ marginLeft: 8 }}>(Live — GET /api/analysis/events)</span></h4>
          <button onClick={() => fetchFor('overview')} className="htm-btn htm-btn-ghost htm-btn-sm" style={{ padding: '0 8px' }}>
            <FaSync className={loading.overview ? 'animate-spin' : ''} />
          </button>
        </div>
        {loading.overview ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : errors.overview ? (
          <div className="p-6 text-htm-alert htm-mono text-sm">{errors.overview}</div>
        ) : (
          <table className="htm-table">
            <thead>
              <tr>
                <th>Onset Time</th>
                <th>Activity</th>
                <th>Classification</th>
                <th>Peak Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {evtList.slice(0, 8).map((evt, i) => (
                <tr key={i}>
                  <td className="mono">{fmtTime(evt.onset_time)}</td>
                  <td>{evt.activity || '—'}</td>
                  <td><Badge label={evt.classification} color={classColor(evt.classification)} /></td>
                  <td className="mono" style={{ fontWeight: 500 }}>{evt.peak_score?.toFixed(2) ?? '—'}</td>
                  <td><Badge label={evt.status} color={evt.status === 'open' ? 'caution' : 'neutral'} /></td>
                </tr>
              ))}
              {!evtList.length && (
                <tr><td colSpan="5" className="p-6 text-center htm-eyebrow">No events found for this user.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
