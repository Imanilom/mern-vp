import React, { useMemo, useState, useEffect } from 'react';
import { api } from '../services/api';

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
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>Filter Results & Episode Candidates</h2>
        </div>
        <button onClick={applyFilter} className="btn-solid-teal" disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Episode ID</th>
              <th>Peserta</th>
              <th>Onset</th>
              <th>Peak Score</th>
              <th>Duration (min)</th>
              <th>Outcome</th>
              <th>Review Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.episodeId}>
                <td>{r.episodeId.substring(0, 8)}...</td>
                <td>{r.participantName}</td>
                <td>{new Date(r.onsetAt).toLocaleString()}</td>
                <td>{r.peakScore?.toFixed(2)}</td>
                <td>{r.durationMin}</td>
                <td>
                  <span className={`badge ${r.outcome === 'RECOVERED' ? 'bg-success' : 'bg-warning'}`}>
                    {r.outcome}
                  </span>
                </td>
                <td>{r.reviewerDecision}</td>
                <td>
                  <button className="btn btn-sm btn-outline-primary" onClick={() => onSelectEpisode(r.episodeId)}>
                    View Detail
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan="8" className="text-center py-4">No events found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
