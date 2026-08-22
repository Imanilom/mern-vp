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
      // In a real system, you'd pass params to /api/events.
      // Since this is a placeholder/wrapper, we fetch recent events
      const data = await api.getRecentEvents(params.participantId || undefined);
      // Map to expected format
      const mapped = data.map(ep => ({
        episodeId: ep._id,
        onsetAt: ep.onset_time,
        peakScore: ep.peak_score,
        durationMin: ep.duration_ms ? Math.floor(ep.duration_ms/60000) : 0,
        outcome: ep.physiological_outcome || 'UNRESOLVED',
        reviewerDecision: ep.validation_label || 'None'
      }));
      setRows(mapped);
    } catch (err) {
      console.error(err);
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
              <tr><td colSpan="7" className="text-center py-4">No events found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
