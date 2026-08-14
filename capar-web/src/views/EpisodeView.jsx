import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const StateBadge = ({ state }) => {
  if (state === 'BASELINE_COMPATIBLE' || state === 'Baseline') return <span className="evidence-chip chip-green">Baseline</span>;
  if (state === 'DEVIATION_CANDIDATE' || state === 'Candidate') return <span className="evidence-chip chip-amber">Candidate</span>;
  if (state === 'PERSISTENT_DEVIATION' || state === 'Persistent') return <span className="evidence-chip chip-red">Persistent</span>;
  if (state === 'RECOVERY' || state === 'Recovery') return <span className="evidence-chip chip-purple">Recovery</span>;
  if (state === 'UNRESOLVED') return <span className="evidence-chip chip-red">Unresolved</span>;
  if (state === 'RESOLVED' || state === 'Resolved' || state === 'resolved') return <span className="evidence-chip chip-green">Resolved</span>;
  if (state === 'Under Review') return <span className="evidence-chip chip-amber">Reviewing</span>;
  if (state === 'Confirmed') return <span className="evidence-chip chip-green">Confirmed</span>;
  if (state === 'Suppressed') return <span className="evidence-chip chip-neutral">Suppressed</span>;
  if (state === 'Needs Follow-up') return <span className="evidence-chip chip-red">Needs Follow-up</span>;
  return <span className="evidence-chip chip-neutral">{state || '-'}</span>;
};

export const EpisodeView = ({ episodes, globalParticipantFilter, globalDateFilter }) => {
  const [filterContext, setFilterContext] = useState('ALL');
  const [filterState, setFilterState] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEpisodes = (episodes || []).filter(ep => {
    if (globalParticipantFilter && globalParticipantFilter !== 'ALL' && ep.participantId !== globalParticipantFilter) return false;
    if (globalDateFilter && ep.raw?.onset_time) {
      const ts = new Date(ep.raw.onset_time).getTime();
      if (!isNaN(ts)) {
        const epDate = new Date(ts);
        const epDateStr = `${epDate.getFullYear()}-${String(epDate.getMonth()+1).padStart(2,'0')}-${String(epDate.getDate()).padStart(2,'0')}`;
        if (epDateStr !== globalDateFilter) return false;
      }
    }
    if (filterContext !== 'ALL' && ep.context?.toLowerCase() !== filterContext.toLowerCase()) return false;
    if (filterState !== 'ALL' && ep.status?.toLowerCase() !== filterState.toLowerCase()) return false;
    if (searchQuery && !ep.id.toLowerCase().includes(searchQuery.toLowerCase()) && !ep.participantId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const [selectedEpisode, setSelectedEpisode] = useState(filteredEpisodes?.[0] || null);
  const [reviewStatus, setReviewStatus] = useState(selectedEpisode?.reviewStatus || 'Under Review');
  const [reviewerNote, setReviewerNote] = useState(selectedEpisode?.reviewerNote || '');
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('detail');

  useEffect(() => {
    if (selectedEpisode) {
      setReviewStatus(selectedEpisode.reviewStatus || selectedEpisode.validationLabel || 'Under Review');
      setReviewerNote(selectedEpisode.reviewerNotes || '');
    }
  }, [selectedEpisode]);

  const handleSelectEpisode = (ep) => {
    setSelectedEpisode(ep);
    setIsSaved(false);
  };

  const handleSaveReview = async (e) => {
    e.preventDefault();
    if (!selectedEpisode) return;
    try {
      await api.validateEvent(selectedEpisode.id, reviewStatus, reviewerNote);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Failed to save review');
    }
  };

  const renderTrajectorySVG = () => {
    if (!selectedEpisode) return null;
    const trajectoryScores = selectedEpisode.raw?.trajectory?.sequence_of_scores || [];
    
    if (!trajectoryScores || trajectoryScores.length === 0) {
      return (
        <div style={{ width: '100%', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-soft)', borderRadius: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--gray)' }}>No trajectory data available for this episode.</span>
        </div>
      );
    }

    let polylinePoints = "";
    let peakMarker = { cx: 0, cy: 0 };
    let peakScoreText = selectedEpisode.peakScore.toFixed(2);
    
    let tauInY = 35;
    let tauOutY = 65;

    const maxScore = Math.max(...trajectoryScores, 1.86 * 1.2, 3.0);
    const minScore = 0;
    const yRange = maxScore - minScore;
    const getY = (score) => 95 - ((score - minScore) / yRange) * 85;

    tauInY = getY(1.86);
    tauOutY = getY(1.18);

    const pointsArray = trajectoryScores.map((score, i) => {
      const x = (i / (trajectoryScores.length - 1 || 1)) * 300;
      const y = getY(score);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    polylinePoints = pointsArray.join(' ');

    const peakIdx = trajectoryScores.indexOf(Math.max(...trajectoryScores));
    if (peakIdx >= 0) {
      const px = (peakIdx / (trajectoryScores.length - 1 || 1)) * 300;
      const py = getY(trajectoryScores[peakIdx]);
      peakMarker = { cx: px, cy: py };
      peakScoreText = trajectoryScores[peakIdx].toFixed(2);
    }

    return (
      <svg viewBox="0 0 300 100" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 120 }}>
        {/* Baseline zone */}
        <rect x="0" y={tauOutY} width="300" height={100 - tauOutY} fill="#F3F5F7" />
        {/* tau_in */}
        <line x1="0" y1={tauInY} x2="300" y2={tauInY} stroke="#B52A2A" strokeDasharray="3 3" strokeWidth="1" />
        <text x="4" y={tauInY - 4} fill="#B52A2A" fontSize="7" className="mono">tau_in (1.86)</text>
        {/* tau_out */}
        <line x1="0" y1={tauOutY} x2="300" y2={tauOutY} stroke="#D98800" strokeDasharray="3 3" strokeWidth="1" />
        <text x="4" y={tauOutY - 4} fill="#D98800" fontSize="7" className="mono">tau_out (1.18)</text>
        
        {/* polyline */}
        <polyline points={polylinePoints} fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* peak circle */}
        <circle cx={peakMarker.cx} cy={peakMarker.cy} r="4" fill="var(--red)" />
        <text x={peakMarker.cx} y={peakMarker.cy - 7} fill="var(--ink)" fontSize="8" className="mono" textAnchor="middle">Peak {peakScoreText}</text>
      </svg>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Episode Lifecycle &amp; Reviewer Governance</h1>
        <p className="page-sub">Review episode deviasi dan pemulihan sebagai unit analisis temporal utama.</p>
      </div>

      <div className="filter-bar">
        <span className="filter-chip"><i className="fa-regular fa-calendar"></i>{globalDateFilter || 'All Time'}</span>
        
        <select className="filter-chip" value={filterContext} onChange={e => setFilterContext(e.target.value)} style={{ border: 'none', outline: 'none' }}>
          <option value="ALL">Context: all</option>
          <option value="duduk">duduk</option>
          <option value="berjalan">berjalan</option>
          <option value="berbaring">berbaring</option>
        </select>
        
        <select className="filter-chip" value={filterState} onChange={e => setFilterState(e.target.value)} style={{ border: 'none', outline: 'none' }}>
          <option value="ALL">State: all</option>
          <option value="resolved">resolved</option>
          <option value="unresolved">unresolved</option>
        </select>

        <span className="filter-chip" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}>
          <i className="fa-solid fa-magnifying-glass"></i>
          <input 
            type="text" 
            placeholder="Search episode..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', width: 120 }} 
          />
        </span>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card-panel" style={{ padding: 0 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: '#FAFBFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>All Recorded Episodes</div>
              <div style={{ fontSize: 11, color: 'var(--gray)' }}>N={filteredEpisodes.length} episodes</div>
            </div>
            <div className="table-responsive">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Episode ID</th>
                    <th>Participant</th>
                    <th>Context</th>
                    <th>Onset</th>
                    <th>Peak</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEpisodes.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray)' }}>No episodes found.</td></tr>
                  ) : (
                    filteredEpisodes.map(ep => (
                      <tr 
                        key={ep.id} 
                        onClick={() => handleSelectEpisode(ep)}
                        style={{ cursor: 'pointer', background: selectedEpisode?.id === ep.id ? 'var(--gray-soft)' : 'transparent' }}
                      >
                        <td className="mono fw-bold">{ep.id}</td>
                        <td className="mono">{ep.participantId}</td>
                        <td style={{ textTransform: 'capitalize' }}>{ep.context}</td>
                        <td className="mono">{ep.onset}</td>
                        <td className="mono fw-bold" style={{ color: ep.peakScore > 2.5 ? 'var(--red)' : 'var(--ink)' }}>{ep.peakScore.toFixed(2)}</td>
                        <td>{ep.durationMinutes}m</td>
                        <td><StateBadge state={ep.status} /></td>
                        <td><StateBadge state={ep.reviewStatus} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          {selectedEpisode ? (
            <div className="card-panel">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <div className="mini-label">Selected episode</div>
                  <h3 className="mono" style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{selectedEpisode.id}</h3>
                </div>
                <StateBadge state={selectedEpisode.status} />
              </div>

              <div className="d-flex gap-3 mb-3 border-bottom pb-2">
                <span 
                  style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: activeTab === 'detail' ? 'var(--teal)' : 'var(--gray)' }}
                  onClick={() => setActiveTab('detail')}
                >
                  Analysis &amp; Review
                </span>
                <span 
                  style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: activeTab === 'audit' ? 'var(--teal)' : 'var(--gray)' }}
                  onClick={() => setActiveTab('audit')}
                >
                  Audit &amp; Provenance
                </span>
              </div>

              {activeTab === 'detail' && (
                <>
                  <div className="row g-2 mb-3">
                    <div className="col-4">
                      <div style={{ background: 'var(--gray-soft)', padding: '6px 8px', borderRadius: 8 }}>
                        <div className="mini-label">Onset</div>
                        <div className="mono fw-bold">{selectedEpisode.onset}</div>
                      </div>
                    </div>
                    <div className="col-4">
                      <div style={{ background: 'var(--gray-soft)', padding: '6px 8px', borderRadius: 8 }}>
                        <div className="mini-label">Peak</div>
                        <div className="mono fw-bold" style={{ color: 'var(--red)' }}>{selectedEpisode.peakScore.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="col-4">
                      <div style={{ background: 'var(--gray-soft)', padding: '6px 8px', borderRadius: 8 }}>
                        <div className="mini-label">Duration</div>
                        <div className="mono fw-bold">{selectedEpisode.durationMinutes}m</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
                    <div className="mini-label mb-2">Score trajectory</div>
                    {renderTrajectorySVG()}
                  </div>

                  <form onSubmit={handleSaveReview}>
                    <div className="mini-label mb-2">Reviewer validation</div>
                    <select 
                      className="form-select mb-2" 
                      style={{ fontSize: 12, fontWeight: 600, background: 'var(--gray-soft)' }}
                      value={reviewStatus}
                      onChange={e => setReviewStatus(e.target.value)}
                    >
                      <option value="Confirmed">Confirmed (Valid Physiological Episode)</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Suppressed">Suppressed (False Alert / Artefact)</option>
                      <option value="Needs Follow-up">Needs Follow-up (Participant Check)</option>
                    </select>
                    
                    <textarea 
                      className="form-control mb-2" 
                      rows="2" 
                      placeholder="Tambahkan catatan analitis..."
                      style={{ fontSize: 12, background: 'var(--gray-soft)' }}
                      value={reviewerNote}
                      onChange={e => setReviewerNote(e.target.value)}
                    ></textarea>
                    
                    <button type="submit" className="btn-teal w-100">Simpan Keputusan Reviewer</button>
                    {isSaved && <div className="text-success text-center mt-2" style={{ fontSize: 11, fontWeight: 600 }}>✓ Tersimpan!</div>}
                  </form>
                </>
              )}

              {activeTab === 'audit' && (
                <div>
                  <div className="mini-label mb-2">Model Version &amp; Provenance</div>
                  <div style={{ background: 'var(--gray-soft)', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--ink)' }}>Model: <span className="mono">{selectedEpisode.raw?.model_version || 'v2.1.4-beta'}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--ink)' }}>Baseline Profile ID: <span className="mono">BP-{selectedEpisode.participantId}-{selectedEpisode.context || 'Unknown'}</span></div>
                  </div>

                  <div className="mini-label mb-2">Audit Trail</div>
                  <div style={{ borderLeft: '2px solid var(--line)', paddingLeft: 12, marginLeft: 6 }}>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: 'var(--gray)' }}>{selectedEpisode.onset}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>Episode detected by algorithm</div>
                    </div>
                    {selectedEpisode.status === 'RESOLVED' && (
                       <div style={{ marginBottom: 10 }}>
                         <div style={{ fontSize: 10, color: 'var(--gray)' }}>—</div>
                         <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>Episode resolved automatically</div>
                       </div>
                    )}
                    {selectedEpisode.reviewStatus !== 'New' && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: 'var(--gray)' }}>Review Action</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal)' }}>Status updated to: {selectedEpisode.reviewStatus}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card-panel h-100 d-flex align-items-center justify-content-center text-muted" style={{ fontSize: 12 }}>
              Select an episode to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
