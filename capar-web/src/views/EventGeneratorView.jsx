import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Pagination from '../components/Pagination';

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

const PAGE_SIZE = 50;

export default function EventGeneratorView({ globalParticipantFilter, onSelectEpisode }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [filterName, setFilterName] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const loadPage = async (page = 1, userId) => {
    setLoading(true);
    try {
      const target = userId && userId !== 'ALL' ? userId : 'ALL';
      const result = await api.getEventsPaginated(target, page, PAGE_SIZE);
      const events = result.data || [];

      const persistentEvents = events.filter(ep => {
        const status = ep.status || ep.raw?.current_state || '';
        const isCurrentlyPersistent = ['PERSISTENT_DEVIATION', 'Alert'].includes(status);
        const reachedPersistent = !!ep.raw?.persistent_at
          || (ep.raw?.trajectory?.persistence >= 2)
          || ep.raw?.classification === 'Alert';
        return isCurrentlyPersistent || reachedPersistent;
      });

      const mapped = persistentEvents.map(ep => ({
        episodeId: ep.id,
        participantName: ep.participantName || 'Unknown',
        onsetAt: ep.onsetRaw,
        peakScore: ep.peakScore || 0,
        durationMin: ep.durationMinutes || 0,
        durationFormatted: ep.durationFormatted,
        outcome: ep.raw?.physiological_outcome || 'UNRESOLVED',
        reviewerDecision: ep.validationLabel || 'None',
        status: ep.status || 'open',
      }));

      mapped.sort((a, b) => new Date(b.onsetAt || 0).getTime() - new Date(a.onsetAt || 0).getTime());

      setRows(mapped);
      setCurrentPage(result.page || page);
      setTotalPages(result.totalPages || 1);
      setTotalCount(result.totalCount || 0);
    } catch (err) {
      console.error('[EventGeneratorView] Error:', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadPage(1, globalParticipantFilter);
  }, [globalParticipantFilter]);

  const handlePrev = () => {
    if (currentPage > 1) loadPage(currentPage - 1, globalParticipantFilter);
  };
  const handleNext = () => {
    if (currentPage < totalPages) loadPage(currentPage + 1, globalParticipantFilter);
  };

  return (
    <div className="card-panel" style={{ minWidth: 0, overflow: 'hidden' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>EVENT GENERATOR</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>Filter Results &amp; Episode Candidates</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {loading && <span style={{ fontSize: 12, color: 'var(--teal)' }}>Loading...</span>}
          <span style={{ fontSize: 12, color: 'var(--gray)' }}>{totalCount} total events</span>
          <button onClick={() => loadPage(currentPage, globalParticipantFilter)} className="btn-solid-teal" disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-auto">
          <input 
            type="text" 
            className="form-control form-control-sm" 
            placeholder="Cari Nama Peserta..." 
            value={filterName}
            onChange={e => setFilterName(e.target.value)}
            style={{ width: '200px' }}
          />
        </div>
        <div className="col-auto">
          <select 
            className="form-select form-select-sm" 
            value={filterOutcome}
            onChange={e => { setFilterOutcome(e.target.value); setCurrentPage(1); }}
            style={{ width: '150px' }}
          >
            <option value="ALL">Semua Outcome</option>
            <option value="UNRESOLVED">UNRESOLVED</option>
            <option value="RECOVERED">RECOVERED</option>
            <option value="PERSISTENT">PERSISTENT</option>
          </select>
        </div>
        <div className="col-auto">
          <select 
            className="form-select form-select-sm" 
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            style={{ width: '150px' }}
          >
            <option value="ALL">Semua Status</option>
            <option value="open">open</option>
            <option value="closed">closed</option>
            <option value="resolved">resolved</option>
            <option value="unresolved">unresolved</option>
            <option value="PERSISTENT_DEVIATION">PERSISTENT</option>
          </select>
        </div>
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
            {rows.filter(r => {
              if (filterName && !r.participantName.toLowerCase().includes(filterName.toLowerCase())) return false;
              if (filterOutcome !== 'ALL' && r.outcome !== filterOutcome) return false;
              if (filterStatus !== 'ALL' && (r.status || '').toLowerCase() !== filterStatus.toLowerCase()) return false;
              return true;
            }).map(r => {
              const pName = (r.participantName || 'p001').toLowerCase().replace(/[^a-z0-9]/g, '');
              const onsetDate = new Date(r.onsetAt);
              const onsetParts = onsetDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/[^0-9]/g, '');
              const displayEpId = r.episodeId?.startsWith?.('ep-') ? r.episodeId : `ep-${pName.substring(0, 6)}-${onsetParts.substring(0, 4) || '0845'}`;
              
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
                  <td>{r.durationFormatted || `${r.durationMin}m`}</td>
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
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray)' }}>Tidak ada data (atau tidak cocok dengan filter).</td></tr>
            )}
            {loading && rows.length === 0 && (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: 'var(--teal)' }}>Memuat data...</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <Pagination 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(newPage) => {
          setCurrentPage(newPage);
          loadPage(newPage, globalParticipantFilter);
        }}
        totalItems={totalCount}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}

