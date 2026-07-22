import React from 'react';
import { FaSync } from 'react-icons/fa';
import { Skeleton, Badge, classColor, fmtTime, SectionHeader } from './DashboardShared';

export default function Participants({ data, loading, errors, fetchFor, selectedPt, setSelectedPt, ptDetailTab, setPtDetailTab, ptData, ptLoading, openParticipant }) {
  if (!selectedPt) {
    return (
      <div className="space-y-6">
        <SectionHeader 
          title="Participants" 
          subtitle="Source: GET /api/patient/all"
          action={
            <button onClick={() => fetchFor('patients')} className="htm-btn htm-btn-outline htm-btn-sm" style={{ padding: '0 12px' }}>
              <FaSync className={loading.patients ? 'animate-spin' : ''} style={{ marginRight: 6 }} /> Refresh
            </button>
          }
        />

        {loading.patients ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : errors.patients ? (
          <div style={{ background: 'var(--htm-alert-bg)', color: 'var(--htm-alert)', border: '1px solid rgba(185,28,28,0.2)', padding: '16px', borderRadius: 'var(--htm-r-md)' }}>
            <span className="htm-mono text-sm">{errors.patients}</span>
          </div>
        ) : (
          <div className="htm-card p-0 overflow-hidden">
            <table className="htm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Device</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data.patients || []).map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td>{p.email}</td>
                    <td><Badge label={p.role} color="info" /></td>
                    <td className="mono muted">{p.current_device || '—'}</td>
                    <td><Badge label={p.is_active ? 'Active' : 'Inactive'} color={p.is_active ? 'stable' : 'neutral'} /></td>
                    <td>
                      <button onClick={() => openParticipant(p)} className="htm-btn htm-btn-primary htm-btn-sm">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {!(data.patients?.length) && (
                  <tr><td colSpan="6" className="p-6 text-center htm-eyebrow">No patients found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Participant Detail View
  return (
    <div className="space-y-6 animate-htm-page-in">
      <div className="flex justify-between items-start flex-wrap gap-4 border-b border-htm-hairline pb-4">
        <div>
          <button onClick={() => setSelectedPt(null)} className="htm-btn htm-btn-ghost htm-btn-sm" style={{ padding: 0, height: 'auto', marginBottom: 8, color: 'var(--htm-sub)' }}>
            ← Back to list
          </button>
          <h2 className="htm-display text-2xl">{selectedPt.name}</h2>
          <p className="htm-body-sm" style={{ color: 'var(--htm-muted)', marginTop: 4 }}>
            {selectedPt.email} <span style={{ margin: '0 8px' }}>·</span> Device: <span className="htm-mono-sm">{selectedPt.current_device || 'N/A'}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Badge label={selectedPt.role} color="info" />
          <Badge label={selectedPt.is_active ? 'Active' : 'Inactive'} color={selectedPt.is_active ? 'stable' : 'neutral'} />
        </div>
      </div>

      <div className="flex gap-6 htm-body-sm font-medium overflow-x-auto scrollbar-hide border-b border-htm-hairline">
        {['overview', 'live', 'trajectory', 'anomalies'].map(tab => (
          <button
            key={tab}
            onClick={() => setPtDetailTab(tab)}
            style={{
              paddingBottom: 12,
              textTransform: 'capitalize',
              borderBottom: '2px solid',
              borderColor: ptDetailTab === tab ? 'var(--htm-primary)' : 'transparent',
              color: ptDetailTab === tab ? 'var(--htm-primary)' : 'var(--htm-muted)',
              transition: 'all 0.2s ease',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {ptLoading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <div className="pt-2">
          {ptDetailTab === 'overview' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="htm-card space-y-4">
                <h4 className="htm-title">Participant Profile</h4>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  <div>
                    <span className="htm-eyebrow block mb-1">ID</span>
                    <span className="htm-mono">{selectedPt._id}</span>
                  </div>
                  <div>
                    <span className="htm-eyebrow block mb-1">Created</span>
                    <span className="htm-mono">{fmtTime(selectedPt.createdAt)}</span>
                  </div>
                  <div>
                    <span className="htm-eyebrow block mb-1">Segments</span>
                    <span className="htm-mono font-medium">{ptData.segments?.length || 0}</span>
                  </div>
                  <div>
                    <span className="htm-eyebrow block mb-1">Anomalies</span>
                    <span className="htm-mono font-medium" style={{ color: 'var(--htm-caution)' }}>{ptData.events?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {ptDetailTab === 'live' && <div className="htm-body-sm text-htm-muted">Live monitoring WebSocket goes here.</div>}
          {ptDetailTab === 'trajectory' && <div className="htm-body-sm text-htm-muted">Trajectory graphs for {selectedPt.name}.</div>}
          {ptDetailTab === 'anomalies' && (
            <div className="htm-card p-0 overflow-hidden">
              <table className="htm-table">
                <thead>
                  <tr><th>Time</th><th>Activity</th><th>Class</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {(ptData.events || []).map((evt, i) => (
                    <tr key={i}>
                      <td className="mono" style={{ fontWeight: 500 }}>{fmtTime(evt.onset_time)}</td>
                      <td>{evt.activity || '—'}</td>
                      <td><Badge label={evt.classification} color={classColor(evt.classification)} /></td>
                      <td><Badge label={evt.status} color={evt.status === 'open' ? 'caution' : 'neutral'} /></td>
                    </tr>
                  ))}
                  {!(ptData.events?.length) && (
                    <tr><td colSpan="4" className="p-6 text-center htm-eyebrow">No anomalies recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
