import React, { useMemo, useState, useEffect } from 'react';
import { api } from '../services/api';

const StateBadge = ({ state }) => {
  if (state === 'BASELINE_COMPATIBLE' || state === 'Baseline') return <span className="evidence-chip chip-green">Baseline</span>;
  if (state === 'DEVIATION_CANDIDATE' || state === 'Candidate') return <span className="evidence-chip chip-amber">Candidate</span>;
  if (state === 'PERSISTENT_DEVIATION' || state === 'Persistent' || state === 'Alert') return <span className="evidence-chip chip-red">Persistent</span>;
  if (state === 'RECOVERY' || state === 'Recovery') return <span className="evidence-chip chip-purple">Recovery</span>;
  if (state === 'UNRESOLVED' || state === 'unresolved') return <span className="evidence-chip chip-red">Unresolved</span>;
  if (state === 'RESOLVED' || state === 'Resolved' || state === 'Recovered' || state === 'closed') return <span className="evidence-chip chip-green">Resolved</span>;
  if (state === 'Under Review' || state === 'New') return <span className="evidence-chip chip-amber">Reviewing</span>;
  if (state === 'Confirmed' || state === 'Valid anomaly') return <span className="evidence-chip chip-green">Confirmed</span>;
  if (state === 'Suppressed' || state === 'False positive') return <span className="evidence-chip chip-neutral">Suppressed</span>;
  if (state === 'Needs Follow-up') return <span className="evidence-chip chip-red">Needs Follow-up</span>;
  return <span className="evidence-chip chip-neutral">{state || '-'}</span>;
};

export default function EventGeneratorView({ globalParticipantFilter, onSelectEpisode }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({
    participantId: globalParticipantFilter !== 'ALL' ? globalParticipantFilter : '',
    adminStatus: '',
    outcome: '',
  });

  const applyFilter = async () => {
    setLoading(true);
    try {
      const res = await api.getRecentEvents(params.participantId || undefined, 500);
      const events = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      
      const persistentEvents = events.filter(ep => {
        const status = ep.current_state || ep.status || '';
        const isCurrentlyPersistent = ['PERSISTENT_DEVIATION', 'Alert'].includes(status);
        const reachedPersistent = !!ep.persistent_at || (ep.trajectory && ep.trajectory.persistence >= 2) || ep.classification === 'Alert';
        return isCurrentlyPersistent || reachedPersistent;
      });

      const mapped = persistentEvents.map(ep => ({
        episodeId: ep._id,
        participantName: typeof ep.user_id === 'object' && ep.user_id ? (ep.user_id.name || ep.user_id.email || ep.user_id.guid || 'Unknown') : 'Unknown',
        onsetAt: ep.onset_time,
        peakScore: typeof ep.peak_score === 'number' ? ep.peak_score : (typeof ep.onset_score === 'number' ? ep.onset_score : 0),
        durationMin: ep.duration_ms ? Math.floor(ep.duration_ms/60000) : 0,
        outcome: ep.physiological_outcome || 'UNRESOLVED',
        reviewerDecision: ep.validation_label || 'None',
        status: ep.current_state || ep.status || 'open'
      }));
      setRows(mapped);
    } catch (err) {
      console.error('[EventGeneratorView] Error:', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    applyFilter();
  }, [globalParticipantFilter]);

  return (
    <div className="card-panel" style={{ minWidth: 0, overflow: 'hidden' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>EVENT GENERATOR</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>Filter Results &amp; Episode Candidates</h2>
        </div>
        <button onClick={applyFilter} className="btn-solid-teal" disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="table-responsive">
        <table className="dtable w-100">
          <thead>
            <tr>
              <th>Episode ID</th>
              <th>Peserta</th>
              <th>Onset</th>
              <th>Peak Score</th>
              <th>Durasi (min)</th>
              <th>Outcome</th>
              <th>Status</th>
              <th>Review Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const pName = (r.participantName || 'p001').toLowerCase().replace(/[^a-z0-9]/g, '');
              const onsetDate = new Date(r.onsetAt);
              const onsetParts = onsetDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/[^0-9]/g, '');
              const displayEpId = r.episodeId?.startsWith('ep-') ? r.episodeId : `ep-${pName.substring(0, 6)}-${onsetParts.substring(0, 4) || '0845'}`;
              
              return (
                <tr 
                  key={r.episodeId}
                  onClick={() => onSelectEpisode && onSelectEpisode(r.episodeId)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="mono fw-bold" style={{ color: 'var(--navy)', fontSize: 11 }}>{displayEpId}</td>
                  <td style={{ fontWeight: 700, color: 'var(--teal)' }}>{r.participantName}</td>
                  <td className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                    {onsetDate.toLocaleDateString('id-ID')} {onsetDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="mono fw-bold" style={{ color: r.peakScore > 2.5 ? 'var(--red)' : 'var(--ink)' }}>{(r.peakScore || 0).toFixed(2)}</td>
                  <td>{r.durationMin}m</td>
                  <td>
                    <span className={`evidence-chip ${r.outcome === 'RECOVERED' ? 'chip-green' : 'chip-amber'}`}>
                      {r.outcome}
                    </span>
                  </td>
                  <td><StateBadge state={r.status} /></td>
                  <td><StateBadge state={r.reviewerDecision} /></td>
                </tr>
              );
            })}
            {rows.length === 0 && !loading && (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray)' }}>No persistent events found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
