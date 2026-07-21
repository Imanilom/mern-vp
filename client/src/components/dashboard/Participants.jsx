import React from 'react';
import { FaSync } from 'react-icons/fa';
import { Skeleton, Badge, classColor, fmtTime } from './DashboardShared';

export default function Participants({ data, loading, errors, fetchFor, selectedPt, setSelectedPt, ptDetailTab, setPtDetailTab, ptData, ptLoading, openParticipant }) {
  if (!selectedPt) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h4 className="font-bold text-sm text-brand-muted">Source: GET /api/patient/all</h4>
          <button onClick={() => fetchFor('patients')} className="text-sys-blue text-xs flex items-center gap-1">
            <FaSync className={loading.patients ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        {loading.patients ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : errors.patients ? (
          <div className="bg-sys-red/10 border border-sys-red/20 text-sys-red text-xs p-4 rounded-xl">{errors.patients}</div>
        ) : (
          <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-brand-cardLight border-b border-brand-border text-brand-muted text-[9px] uppercase font-bold">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Device</th>
                  <th className="p-4">Active</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-brand-muted">
                {(data.patients || []).map((p, i) => (
                  <tr key={i} className="hover:bg-brand-cardLight">
                    <td className="p-4 font-bold text-brand-text">{p.name}</td>
                    <td className="p-4">{p.email}</td>
                    <td className="p-4"><Badge label={p.role} color="blue" /></td>
                    <td className="p-4 font-mono text-[9px]">{p.current_device || '—'}</td>
                    <td className="p-4"><Badge label={p.is_active ? 'Active' : 'Inactive'} color={p.is_active ? 'green' : 'gray'} /></td>
                    <td className="p-4">
                      <button onClick={() => openParticipant(p)} className="px-3 py-1.5 bg-sys-blue text-white rounded-xl font-bold hover:opacity-90">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {!(data.patients?.length) && (
                  <tr><td colSpan="6" className="p-6 text-center text-brand-muted">No patients found.</td></tr>
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
    <div className="space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-4 border-b border-brand-border pb-4">
        <div>
          <button onClick={() => setSelectedPt(null)} className="text-xs text-brand-muted hover:text-brand-text mb-1 block">← Back to list</button>
          <h2 className="text-xl font-bold">{selectedPt.name}</h2>
          <p className="text-xs text-brand-muted">{selectedPt.email} · Device: {selectedPt.current_device || 'N/A'}</p>
        </div>
        <div className="flex gap-2">
          <Badge label={selectedPt.role} color="blue" />
          <Badge label={selectedPt.is_active ? 'Active' : 'Inactive'} color={selectedPt.is_active ? 'green' : 'gray'} />
        </div>
      </div>

      <div className="flex border-b border-brand-border gap-6 text-xs font-bold overflow-x-auto scrollbar-hide">
        {['overview', 'live', 'trajectory', 'anomalies'].map(tab => (
          <button
            key={tab}
            onClick={() => setPtDetailTab(tab)}
            className={`pb-3 capitalize border-b-2 transition-colors whitespace-nowrap ${ptDetailTab === tab ? 'border-sys-blue text-sys-blue' : 'border-transparent text-brand-muted hover:text-brand-text'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {ptLoading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <div className="pt-4">
          {ptDetailTab === 'overview' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-brand-cardLight border border-brand-border p-5 rounded-2xl shadow-lg space-y-4">
                <h4 className="font-bold text-sm">Participant Profile</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div><span className="text-brand-muted block text-[9px] uppercase">ID</span><span className="font-mono text-[10px]">{selectedPt._id}</span></div>
                  <div><span className="text-brand-muted block text-[9px] uppercase">Created</span><span>{fmtTime(selectedPt.createdAt)}</span></div>
                  <div><span className="text-brand-muted block text-[9px] uppercase">Segments</span><span className="font-bold">{ptData.segments?.length || 0}</span></div>
                  <div><span className="text-brand-muted block text-[9px] uppercase">Anomalies</span><span className="font-bold text-sys-orange">{ptData.events?.length || 0}</span></div>
                </div>
              </div>
            </div>
          )}
          {ptDetailTab === 'live' && <div className="text-brand-muted text-xs">Live monitoring WebSocket goes here.</div>}
          {ptDetailTab === 'trajectory' && <div className="text-brand-muted text-xs">Trajectory graphs for {selectedPt.name}.</div>}
          {ptDetailTab === 'anomalies' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-brand-cardLight border-b border-brand-border text-brand-muted text-[9px] uppercase font-bold">
                <tr><th className="p-4">Time</th><th className="p-4">Activity</th><th className="p-4">Class</th><th className="p-4">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-brand-muted">
                {(ptData.events || []).map((evt, i) => (
                  <tr key={i} className="hover:bg-brand-cardLight">
                    <td className="p-4 font-bold text-brand-text">{fmtTime(evt.onset_time)}</td>
                    <td className="p-4">{evt.activity || '—'}</td>
                    <td className="p-4"><Badge label={evt.classification} color={classColor(evt.classification)} /></td>
                    <td className="p-4"><Badge label={evt.status} color={evt.status === 'open' ? 'orange' : 'gray'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
