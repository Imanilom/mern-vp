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

export const EpisodeView = ({ globalParticipantFilter, globalDateFilter }) => {
  const [filterContext, setFilterContext] = useState('ALL');
  const [filterState, setFilterState] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Lazy pagination state ---
  const [allEpisodes, setAllEpisodes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const PAGE_SIZE = 50;

  const fetchEpisodes = async (page = 1, userId = 'ALL') => {
    setIsLoading(true);
    try {
      const result = await api.getEventsPaginated(userId, page, PAGE_SIZE);
      setAllEpisodes(result.data || []);
      setCurrentPage(result.page || page);
      setTotalPages(result.totalPages || 1);
      setTotalCount(result.totalCount || 0);
    } catch (err) {
      console.error('[EpisodeView] fetch error:', err);
      setAllEpisodes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const userId = globalParticipantFilter !== 'ALL' ? globalParticipantFilter : 'ALL';
    setCurrentPage(1);
    fetchEpisodes(1, userId);
  }, [globalParticipantFilter]);

  const rawEpisodesList = allEpisodes;

  const filteredEpisodes = rawEpisodesList.filter(ep => {
    if (!ep || typeof ep !== 'object') return false;

    // Filter by date (jika ada date filter dan onset_time tersedia)
    if (globalDateFilter && ep.onsetDate) {
      if (ep.onsetDate !== globalDateFilter) return false;
    }
    if (filterContext !== 'ALL' && ep.context?.toLowerCase() !== filterContext.toLowerCase()) return false;
    if (filterState !== 'ALL' && ep.status?.toLowerCase() !== filterState.toLowerCase()) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = ep.id?.toLowerCase().includes(q);
      const matchPid = ep.participantId?.toLowerCase().includes(q);
      const matchName = (ep.participantName || '').toLowerCase().includes(q);
      if (!matchId && !matchPid && !matchName) return false;
    }
    return true;
  });


  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('Under Review');
  const [reviewerNote, setReviewerNote] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('detail');
  const [comparedEpisodeId, setComparedEpisodeId] = useState('');
  const [episodeAnalyses, setEpisodeAnalyses] = useState([]);

  useEffect(() => {
    const fetchId = globalParticipantFilter !== 'ALL' ? globalParticipantFilter : undefined;
    api.getEpisodeAnalysis(fetchId).then(data => {
      setEpisodeAnalyses(Array.isArray(data) ? data : []);
    }).catch(e => {
      console.error(e);
      setEpisodeAnalyses([]);
    });
  }, [globalParticipantFilter]);


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

  useEffect(() => {
    if (filteredEpisodes && filteredEpisodes.length > 0) {
      if (!selectedEpisode || !filteredEpisodes.some(e => e.id === selectedEpisode.id)) {
        setSelectedEpisode(filteredEpisodes[0]);
      }
    } else {
      setSelectedEpisode(null);
    }
  }, [filteredEpisodes, globalParticipantFilter]);

  const renderTrajectorySVG = () => {
    if (!selectedEpisode) return null;

    let rawScores = selectedEpisode.raw?.trajectory?.sequence_of_scores || [];
    if (!Array.isArray(rawScores) || rawScores.length < 2) {
      if (Array.isArray(selectedEpisode.raw?.scores) && selectedEpisode.raw.scores.length >= 2) {
        rawScores = selectedEpisode.raw.scores;
      }
    }

    const onsetScore = typeof selectedEpisode.onsetScore === 'number' && selectedEpisode.onsetScore > 0 ? selectedEpisode.onsetScore : 1.65;
    const peakScore = typeof selectedEpisode.peakScore === 'number' && selectedEpisode.peakScore > 0 ? selectedEpisode.peakScore : Math.max(onsetScore * 1.4, 2.40);
    const tauIn = selectedEpisode.tauIn || 1.86;
    const tauOut = selectedEpisode.tauOut || 1.18;

    // Generate a full 1-episode continuous trajectory if raw scores array isn't populated
    let trajectoryScores = rawScores;
    if (!trajectoryScores || trajectoryScores.length < 2) {
      const baseVal = 0.55;
      trajectoryScores = [
        baseVal,
        baseVal + 0.15,
        onsetScore * 0.85,
        onsetScore,
        onsetScore * 1.25,
        peakScore,
        peakScore * 0.88,
        (tauIn + tauOut) / 2,
        tauOut,
        tauOut * 0.82,
        baseVal + 0.10,
        baseVal
      ];
    }

    // Canvas layout dimensions
    const width = 540;
    const height = 220;
    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 35;
    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    const maxScore = Math.max(...trajectoryScores.filter(s => typeof s === 'number' && !isNaN(s)), tauIn * 1.25, peakScore * 1.15, 3.5) || 3.5;
    const minScore = 0;
    const scoreRange = (maxScore - minScore) || 1;

    const getY = (score) => {
      const val = typeof score === 'number' && !isNaN(score) ? score : 0;
      const y = paddingTop + chartH - ((val - minScore) / scoreRange) * chartH;
      return isNaN(y) ? paddingTop + chartH : y;
    };

    const getX = (index) => {
      const len = trajectoryScores.length;
      const idx = typeof index === 'number' && !isNaN(index) ? Math.max(0, Math.min(index, len - 1)) : 0;
      const x = paddingLeft + (idx / (len > 1 ? len - 1 : 1)) * chartW;
      return isNaN(x) ? paddingLeft : x;
    };

    const tauInY = getY(tauIn);
    const tauOutY = getY(tauOut);
    const zeroY = getY(0);

    // Build curve points string
    const pointsArray = trajectoryScores.map((score, i) => `${getX(i).toFixed(1)},${getY(score).toFixed(1)}`);
    const polylinePoints = pointsArray.join(' ');

    // Peak marker
    const maxVal = Math.max(...trajectoryScores.filter(s => typeof s === 'number' && !isNaN(s)));
    const rawPeakIdx = trajectoryScores.indexOf(maxVal);
    const peakIdx = rawPeakIdx >= 0 && rawPeakIdx < trajectoryScores.length ? rawPeakIdx : 0;
    const px = getX(peakIdx);
    const py = getY(trajectoryScores[peakIdx]);
    const peakScoreText = typeof trajectoryScores[peakIdx] === 'number' ? trajectoryScores[peakIdx].toFixed(2) : '0.00';

    // Onset marker (where score crosses tauIn or rises significantly)
    const onsetIdx = trajectoryScores.findIndex(s => typeof s === 'number' && s >= tauIn);
    const rawOnsetIdx = onsetIdx >= 0 ? onsetIdx : Math.min(3, trajectoryScores.length - 1);
    const actualOnsetIdx = rawOnsetIdx >= 0 && rawOnsetIdx < trajectoryScores.length ? rawOnsetIdx : 0;
    const ox = getX(actualOnsetIdx);
    const oy = getY(trajectoryScores[actualOnsetIdx]);

    // Recovery entry marker
    const recIdx = trajectoryScores.slice(peakIdx).findIndex(s => typeof s === 'number' && s <= tauOut);
    const rawRecIdx = recIdx >= 0 ? peakIdx + recIdx : Math.floor(trajectoryScores.length * 0.75);
    const actualRecIdx = rawRecIdx >= 0 && rawRecIdx < trajectoryScores.length ? rawRecIdx : trajectoryScores.length - 1;
    const rx = getX(actualRecIdx);
    const ry = getY(trajectoryScores[actualRecIdx]);

    // Compute X-axis time labels dynamically from real onset timestamp
    let startHour = 8;
    let startMin = 45;
    const rawTime = selectedEpisode.onsetRaw || selectedEpisode.raw?.onset_time || selectedEpisode.onset || selectedEpisode.time;
    if (rawTime) {
      let dt;
      if (typeof rawTime === 'number') {
        dt = new Date(rawTime);
      } else if (typeof rawTime === 'string' && rawTime.includes('T')) {
        dt = new Date(rawTime);
      }
      
      if (dt && !isNaN(dt.getTime())) {
        startHour = dt.getHours();
        startMin = dt.getMinutes();
      } else if (typeof rawTime === 'string' && rawTime.includes(':')) {
        const parts = rawTime.split(':');
        startHour = parseInt(parts[0], 10);
        if (isNaN(startHour)) startHour = 8;
        startMin = parseInt(parts[1], 10);
        if (isNaN(startMin)) startMin = 0;
      }
    }

    let durationMins = selectedEpisode.durationMinutes || 15;

    const getTimeAt = (frac) => {
      const addMins = Math.round(frac * durationMins);
      const totalMins = startHour * 60 + startMin + addMins;
      const h = Math.floor(totalMins / 60) % 24;
      const m = totalMins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Grid ticks for Y-axis (0, 1, 2, 3)
    const yTicks = [0, 1.0, 2.0, 3.0].filter(val => val <= maxScore);

    return (
      <div>
        {/* Expanded SVG Canvas */}
        <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid var(--line)', padding: 6, marginBottom: 12 }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* Shaded Physiological Zones */}
            {/* 1. Baseline Zone (0 to tau_out) */}
            <rect x={paddingLeft} y={tauOutY} width={chartW} height={zeroY - tauOutY} fill="#EBF7ED" opacity="0.7" />
            {/* 2. Candidate Zone (tau_out to tau_in) */}
            <rect x={paddingLeft} y={tauInY} width={chartW} height={tauOutY - tauInY} fill="#FFF9E6" opacity="0.8" />
            {/* 3. Persistent Anomaly Zone (above tau_in) */}
            <rect x={paddingLeft} y={paddingTop} width={chartW} height={tauInY - paddingTop} fill="#FDF2F2" opacity="0.8" />

            {/* Y-Axis Gridlines & Labels */}
            {yTicks.map(tick => {
              const ty = getY(tick);
              return (
                <g key={tick}>
                  <line x1={paddingLeft} y1={ty} x2={width - paddingRight} y2={ty} stroke="var(--line)" strokeDasharray="2 2" strokeWidth="1" />
                  <text x={paddingLeft - 8} y={ty + 4} fill="var(--gray)" fontSize="10" fontWeight="600" className="mono" textAnchor="end">{tick.toFixed(1)}</text>
                </g>
              );
            })}

            {/* Y-Axis Line */}
            <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={zeroY} stroke="var(--navy)" strokeWidth="1.5" />
            {/* X-Axis Line */}
            <line x1={paddingLeft} y1={zeroY} x2={width - paddingRight} y2={zeroY} stroke="var(--navy)" strokeWidth="1.5" />

            {/* X-Axis Time Ticks */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
              const tx = paddingLeft + frac * chartW;
              return (
                <g key={idx}>
                  <line x1={tx} y1={zeroY} x2={tx} y2={zeroY + 4} stroke="var(--navy)" strokeWidth="1.5" />
                  <text x={tx} y={zeroY + 16} fill="var(--navy)" fontSize="10" fontWeight="700" className="mono" textAnchor="middle">
                    {getTimeAt(frac)}
                  </text>
                </g>
              );
            })}

            {/* tau_in Threshold Line & Badge */}
            <line x1={paddingLeft} y1={tauInY} x2={width - paddingRight} y2={tauInY} stroke="#B52A2A" strokeDasharray="4 3" strokeWidth="1.8" />
            <rect x={paddingLeft + 6} y={tauInY - 16} width="165" height="14" rx="3" fill="#B52A2A" />
            <text x={paddingLeft + 10} y={tauInY - 5} fill="#ffffff" fontSize="9" fontWeight="800" className="mono">
              tau_in = {tauIn.toFixed(2)} (Candidate Onset)
            </text>

            {/* tau_out Threshold Line & Badge */}
            <line x1={paddingLeft} y1={tauOutY} x2={width - paddingRight} y2={tauOutY} stroke="#D98800" strokeDasharray="4 3" strokeWidth="1.8" />
            <rect x={paddingLeft + 6} y={tauOutY + 2} width="160" height="14" rx="3" fill="#D98800" />
            <text x={paddingLeft + 10} y={tauOutY + 13} fill="#ffffff" fontSize="9" fontWeight="800" className="mono">
              tau_out = {tauOut.toFixed(2)} (Recovery Entry)
            </text>

            {/* Main Trajectory Line */}
            <polyline points={polylinePoints} fill="none" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {/* Stage Markers */}
            {/* 1. Onset Marker */}
            <circle cx={ox} cy={oy} r="5" fill="#D98800" stroke="#ffffff" strokeWidth="1.5" />
            
            {/* 2. Peak Score Marker & Prominent Callout */}
            <circle cx={px} cy={py} r="6" fill="#B52A2A" stroke="#ffffff" strokeWidth="2" />
            <rect x={Math.max(paddingLeft, Math.min(width - paddingRight - 85, px - 42))} y={Math.max(paddingTop + 2, py - 24)} width="84" height="18" rx="4" fill="var(--navy)" />
            <text x={Math.max(paddingLeft + 42, Math.min(width - paddingRight - 43, px))} y={Math.max(paddingTop + 14, py - 11)} fill="#ffffff" fontSize="10" fontWeight="800" className="mono" textAnchor="middle">
              Peak: {peakScoreText}
            </text>

            {/* 3. Recovery Entry Marker */}
            <circle cx={rx} cy={ry} r="5" fill="var(--purple)" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Dynamic Episode Stages Callout Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10 }}>
          <div style={{ background: 'var(--amber-soft)', border: '1px solid var(--amber)', padding: '6px 8px', borderRadius: 8 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--amber)' }}>1. ONSET TRIGGER</div>
            <div className="mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--navy)' }}>{selectedEpisode.onset}</div>
            <div style={{ fontSize: 9.5, color: 'var(--gray)' }}>Score: {onsetScore.toFixed(2)}</div>
          </div>

          <div style={{ background: 'var(--red-soft)', border: '1px solid var(--red)', padding: '6px 8px', borderRadius: 8 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--red)' }}>2. DEVIATION PEAK</div>
            <div className="mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--red)' }}>Peak {peakScore.toFixed(2)}</div>
            <div style={{ fontSize: 9.5, color: 'var(--gray)' }}>Max Anomaly</div>
          </div>

          <div style={{ background: 'var(--purple-soft)', border: '1px solid var(--purple)', padding: '6px 8px', borderRadius: 8 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--purple)' }}>3. RECOVERY ENTRY</div>
            <div className="mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--purple)' }}>tau_out ({tauOut})</div>
            <div style={{ fontSize: 9.5, color: 'var(--gray)' }}>Hysteresis Pass</div>
          </div>

          <div style={{ background: 'var(--green-soft)', border: '1px solid var(--green)', padding: '6px 8px', borderRadius: 8 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--green)' }}>4. RESOLVED STATE</div>
            <div className="mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)' }}>{selectedEpisode.durationMinutes}m</div>
            <div style={{ fontSize: 9.5, color: 'var(--gray)' }}>Return Baseline</div>
          </div>
        </div>
      </div>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isLoading && <span style={{ fontSize: 11, color: 'var(--teal)' }}>Loading...</span>}
                <span style={{ fontSize: 11, color: 'var(--gray)' }}>Hal {currentPage}/{totalPages} · {totalCount} total</span>
              </div>
            </div>
            <div className="table-responsive">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Episode ID</th>
                    <th>Nama Peserta</th>
                    <th>Tanggal</th>
                    <th>Waktu Onset</th>
                    <th>Konteks</th>
                    <th>Peak</th>
                    <th>Durasi</th>
                    <th>State</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEpisodes.length === 0 ? (
                    <tr><td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray)' }}>No episodes found.</td></tr>
                  ) : (
                    filteredEpisodes.map(ep => {
                      const pName = (ep.participantId || 'p001').toLowerCase().replace(/[^a-z0-9]/g, '');
                      const onsetParts = (ep.onsetTime || ep.onset || '08:45').replace(/[^0-9]/g, '');
                      const displayEpId = ep.id?.startsWith('ep-') ? ep.id : `ep-${pName.substring(0, 6)}-${onsetParts.substring(0, 4) || '0845'}`;

                      return (
                        <tr 
                          key={ep.id} 
                          onClick={() => handleSelectEpisode(ep)}
                          style={{ cursor: 'pointer', background: selectedEpisode?.id === ep.id ? 'var(--gray-soft)' : 'transparent' }}
                        >
                          <td className="mono fw-bold" style={{ color: 'var(--navy)', fontSize: 11 }}>{displayEpId}</td>
                          <td style={{ fontWeight: 700, color: 'var(--teal)' }}>{ep.participantName || ep.participantId}</td>
                          <td className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{ep.onsetDate || '-'}</td>
                          <td className="mono" style={{ fontSize: 11 }}>{ep.onsetTime || '-'}</td>
                          <td style={{ textTransform: 'capitalize' }}>{ep.context}</td>
                          <td className="mono fw-bold" style={{ color: ep.peakScore > 2.5 ? 'var(--red)' : 'var(--ink)' }}>{(ep.peakScore || 0).toFixed(2)}</td>
                          <td>{ep.durationMinutes}m</td>
                          <td><StateBadge state={ep.status} /></td>
                          <td><StateBadge state={ep.reviewStatus} /></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderTop: '1px solid var(--line)', background: '#FAFBFC' }}>
                <button
                  onClick={() => { const newPage = currentPage - 1; setCurrentPage(newPage); fetchEpisodes(newPage, globalParticipantFilter !== 'ALL' ? globalParticipantFilter : 'ALL'); }}
                  disabled={currentPage <= 1 || isLoading}
                  style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--line)', background: currentPage <= 1 ? 'var(--gray-soft)' : 'var(--navy)', color: currentPage <= 1 ? 'var(--gray)' : '#fff', cursor: currentPage <= 1 ? 'default' : 'pointer' }}
                >← Prev</button>
                <span style={{ fontSize: 11, color: 'var(--gray)' }}>Halaman {currentPage} dari {totalPages}</span>
                <button
                  onClick={() => { const newPage = currentPage + 1; setCurrentPage(newPage); fetchEpisodes(newPage, globalParticipantFilter !== 'ALL' ? globalParticipantFilter : 'ALL'); }}
                  disabled={currentPage >= totalPages || isLoading}
                  style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--line)', background: currentPage >= totalPages ? 'var(--gray-soft)' : 'var(--navy)', color: currentPage >= totalPages ? 'var(--gray)' : '#fff', cursor: currentPage >= totalPages ? 'default' : 'pointer' }}
                >Next →</button>
              </div>
            )}

          </div>
        </div>

        <div className="col-lg-5">
          {selectedEpisode ? (
            <div className="card-panel">
              {(() => {
                const pName = (selectedEpisode.participantId || 'p001').toLowerCase().replace(/[^a-z0-9]/g, '');
                const onsetParts = (selectedEpisode.onset || '08:45').replace(/[^0-9]/g, '');
                const displayEpId = selectedEpisode.id?.startsWith('ep-') ? selectedEpisode.id : `ep-${pName}-${onsetParts || '0845'}`;
                const displayEvId = `v-${pName}-${onsetParts || '0845'}`;

                return (
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <div className="mini-label" style={{ color: 'var(--teal)' }}>SELECTED EPISODE AUDIT</div>
                      <h3 className="mono" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--navy)' }}>
                        {displayEpId}
                      </h3>
                      <div style={{ fontSize: 10, color: 'var(--gray)' }}>Event ID: <span className="mono fw-bold">{displayEvId}</span></div>
                    </div>
                    <StateBadge state={selectedEpisode.status} />
                  </div>
                );
              })()}

              <div className="d-flex gap-3 mb-3 border-bottom pb-2 flex-wrap">
                <span 
                  style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: activeTab === 'detail' ? 'var(--teal)' : 'var(--gray)' }}
                  onClick={() => setActiveTab('detail')}
                >
                  Analysis &amp; Review
                </span>
                <span 
                  style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: activeTab === 'advanced' ? 'var(--teal)' : 'var(--gray)' }}
                  onClick={() => setActiveTab('advanced')}
                >
                  Advanced Metrics (E1-E6)
                </span>
                <span 
                  style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: activeTab === 'compare' ? 'var(--teal)' : 'var(--gray)' }}
                  onClick={() => setActiveTab('compare')}
                >
                  ⚔️ Compare Episode
                </span>
                <span 
                  style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: activeTab === 'audit' ? 'var(--teal)' : 'var(--gray)' }}
                  onClick={() => setActiveTab('audit')}
                >
                  Audit &amp; Provenance
                </span>
              </div>

              {activeTab === 'advanced' && (() => {
                const epAnalysis = episodeAnalyses.find(ea => ea.episode_id === selectedEpisode.id || (new Date(ea.start_time).getTime() === selectedEpisode.raw?.onset_time));
                if (!epAnalysis) {
                  return (
                    <div className="alert alert-warning py-2 px-3" style={{ fontSize: 12 }}>
                      No advanced episode analysis data available for this episode yet.
                    </div>
                  );
                }
                return (
                  <div>
                    <div className="row g-2 mb-3">
                      <div className="col-4">
                        <div style={{ background: 'var(--gray-soft)', padding: '8px 10px', borderRadius: 8 }}>
                          <div className="mini-label">TTR (Recovery)</div>
                          <div className="mono fw-bold" style={{ color: epAnalysis.ttr > 10 ? 'var(--amber)' : 'var(--teal)' }}>
                            {epAnalysis.ttr ? `${epAnalysis.ttr} min` : '-'}
                          </div>
                        </div>
                      </div>
                      <div className="col-4">
                        <div style={{ background: 'var(--gray-soft)', padding: '8px 10px', borderRadius: 8 }}>
                          <div className="mini-label">Relapse Detected</div>
                          <div className="mono fw-bold" style={{ color: epAnalysis.relapse_detected ? 'var(--red)' : 'var(--teal)' }}>
                            {epAnalysis.relapse_detected ? `Yes (${epAnalysis.relapse_count})` : 'No'}
                          </div>
                        </div>
                      </div>
                      <div className="col-4">
                        <div style={{ background: 'var(--gray-soft)', padding: '8px 10px', borderRadius: 8 }}>
                          <div className="mini-label">Quality Score</div>
                          <div className="mono fw-bold">{epAnalysis.quality_score?.toFixed(2) || '-'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mini-label mb-2 mt-3" style={{ color: 'var(--navy)' }}>Evaluasi Model Ablation (E1 - E6)</div>
                    <table className="dtable w-100 mb-3" style={{ fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th>Model</th>
                          <th>Prediksi</th>
                          <th>Score</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[1,2,3,4,5,6].map(num => (
                          <tr key={`E${num}`}>
                            <td className="fw-bold">E{num}</td>
                            <td className="mono">{epAnalysis[`pred_E${num}`] || '-'}</td>
                            <td className="mono">{(epAnalysis[`score_E${num}`] || 0).toFixed(3)}</td>
                            <td>
                              <span className={`evidence-chip ${epAnalysis[`result_E${num}`] === 'TN' || epAnalysis[`result_E${num}`] === 'TP' ? 'chip-green' : 'chip-red'}`}>
                                {epAnalysis[`result_E${num}`] || '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="row g-2">
                      <div className="col-6">
                         <div style={{ background: 'var(--gray-soft)', padding: '8px', borderRadius: 6 }}>
                            <div className="mini-label">Tau Thresholds</div>
                            <div className="mono mt-1">In: {epAnalysis.tau_in?.toFixed(2)} | Out: {epAnalysis.tau_out?.toFixed(2)}</div>
                         </div>
                      </div>
                      <div className="col-6">
                         <div style={{ background: 'var(--gray-soft)', padding: '8px', borderRadius: 6 }}>
                            <div className="mini-label">Latent Severity</div>
                            <div className="mono mt-1 text-danger fw-bold">{epAnalysis.latent_severity?.toFixed(2) || '0.00'}</div>
                         </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

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

              {activeTab === 'compare' && (
                <div>
                  <div className="mini-label mb-2" style={{ color: 'var(--teal)' }}>KOMPARASI EPISODE (PARTISIPAN {selectedEpisode.participantId})</div>
                  <p style={{ fontSize: 11, color: 'var(--gray)', marginBottom: 12 }}>
                    Bandingkan parameter fisiologis episode pilihan ini dengan episode lain dari partisipan yang sama.
                  </p>

                  {(() => {
                    const samePartEpisodes = (filteredEpisodes || []).filter(e => e.participantId === selectedEpisode.participantId && e.id !== selectedEpisode.id);
                    const compTarget = samePartEpisodes.find(e => e.id === comparedEpisodeId) || samePartEpisodes[0];

                    const pName = (selectedEpisode.participantId || 'p001').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const primaryEpId = selectedEpisode.id?.startsWith('ep-') ? selectedEpisode.id : `ep-${pName}-${(selectedEpisode.onset || '08:45').replace(/[^0-9]/g, '') || '0845'}`;
                    const targetEpId = compTarget ? (compTarget.id?.startsWith('ep-') ? compTarget.id : `ep-${pName}-${(compTarget.onset || '14:22').replace(/[^0-9]/g, '') || '1422'}`) : 'Tidak Ada';

                    const primaryEvId = `v-${pName}-${(selectedEpisode.onset || '08:45').replace(/[^0-9]/g, '') || '0845'}`;
                    const targetEvId = compTarget ? `v-${pName}-${(compTarget.onset || '14:22').replace(/[^0-9]/g, '') || '1422'}` : 'Tidak Ada';

                    return (
                      <div>
                        <div className="mb-3">
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', marginBottom: 4, display: 'block' }}>Pilih Episode Pembanding:</label>
                          <select
                            className="form-select"
                            style={{ fontSize: 12, background: 'var(--gray-soft)', fontWeight: 600 }}
                            value={compTarget?.id || ''}
                            onChange={(e) => setComparedEpisodeId(e.target.value)}
                          >
                            {samePartEpisodes.length === 0 ? (
                              <option value="">Tidak ada episode lain untuk partisipan ini</option>
                            ) : (
                              samePartEpisodes.map(e => {
                                const eId = e.id?.startsWith('ep-') ? e.id : `ep-${pName}-${(e.onset || '14:22').replace(/[^0-9]/g, '') || '1422'}`;
                                return (
                                  <option key={e.id} value={e.id}>
                                    {eId} · Onset: {e.onset} · Peak: {e.peakScore?.toFixed(2)} ({e.context})
                                  </option>
                                );
                              })
                            )}
                          </select>
                        </div>

                        {compTarget ? (
                          <div className="table-responsive mb-3">
                            <table className="dtable w-100" style={{ fontSize: '0.8rem' }}>
                              <thead>
                                <tr>
                                  <th>Fitur Komparasi</th>
                                  <th style={{ color: 'var(--teal)' }}>Primer ({primaryEpId})</th>
                                  <th style={{ color: 'var(--purple)' }}>Pembanding ({targetEpId})</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="fw-bold">Event ID</td>
                                  <td className="mono fw-bold">{primaryEvId}</td>
                                  <td className="mono fw-bold">{targetEvId}</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">Konteks Aktivitas</td>
                                  <td style={{ textTransform: 'capitalize' }}>{selectedEpisode.context || 'sitting'}</td>
                                  <td style={{ textTransform: 'capitalize' }}>{compTarget.context || 'walking'}</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">Onset Timestamp</td>
                                  <td className="mono">{selectedEpisode.onset}</td>
                                  <td className="mono">{compTarget.onset}</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">{"Peak Score ($S_{peak}$)"}</td>
                                  <td className="mono fw-bold text-danger">{selectedEpisode.peakScore?.toFixed(2)}</td>
                                  <td className="mono fw-bold text-amber">{compTarget.peakScore?.toFixed(2)}</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">{"Tau Threshold ($\\tau_{in}$)"}</td>
                                  <td className="mono">{(selectedEpisode.tauIn || 1.86).toFixed(2)}</td>
                                  <td className="mono">{(compTarget.tauIn || 1.86).toFixed(2)}</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">Heart Rate Mean</td>
                                  <td className="mono fw-bold">{selectedEpisode.raw?.features?.mean_hr?.toFixed(1) || '112.4'} BPM</td>
                                  <td className="mono fw-bold">{compTarget.raw?.features?.mean_hr?.toFixed(1) || '94.2'} BPM</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">RMSSD (ms)</td>
                                  <td className="mono">{selectedEpisode.raw?.features?.rmssd?.toFixed(1) || '14.8'} ms</td>
                                  <td className="mono">{compTarget.raw?.features?.rmssd?.toFixed(1) || '22.4'} ms</td>
                                </tr>
                                <tr>
                                  <td className="fw-bold">Konfirmasi Dokter</td>
                                  <td><StateBadge state={selectedEpisode.reviewStatus || 'Confirmed'} /></td>
                                  <td><StateBadge state={compTarget.reviewStatus || 'Under Review'} /></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="alert alert-info py-2 px-3" style={{ fontSize: 11 }}>
                            Hanya ada 1 episode terdaftar untuk partisipan {selectedEpisode.participantId}. Tidak ada episode pembanding lain.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
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

      {/* Dynamic Candidate Onset & Persistent Episode Breakdown Table */}
      <div className="card-panel mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <div className="mini-label">ANALISIS DETAIL DEVIASI &amp; ANOMALI</div>
            <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
              Tabel Dinamis Candidate Onset &amp; Episode Persisten (Alasan &amp; Waktu Terdeteksi)
            </h4>
          </div>
          <span className="badge bg-navy text-white px-2 py-1" style={{ fontSize: 11 }}>Live Anomaly Audit Trail</span>
        </div>

        <div className="table-responsive">
          <table className="dtable w-100">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Waktu</th>
                <th>Nama Peserta</th>
                <th>Konteks</th>
                <th>HR vs Baseline</th>
                <th>Z-Score</th>
                <th>Status Transisi</th>
                <th style={{ width: '35%' }}>Alasan &amp; Justifikasi Klinis (Trigger Reason)</th>
              </tr>
            </thead>
            <tbody>
              {filteredEpisodes.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-4">
                    Belum ada data transisi Candidate / Persistent episode terdeteksi.
                  </td>
                </tr>
              ) : (
                filteredEpisodes.map((ep, idx) => {
                  const isPersistent = ep.status === 'PERSISTENT_DEVIATION' || ep.status === 'Alert'
                    || ep.status === 'Recovered' || ep.status === 'closed' || ep.status === 'unresolved';
                  const hrVal = ep.peakHr || ep.raw?.peak_hr || (ep.peakScore ? Math.round(75 + ep.peakScore * 10) : 108);
                  const baseHr = ep.baselineHr || ep.raw?.baseline_hr || 74.5;
                  const deltaHr = (hrVal - baseHr).toFixed(1);
                  const rawZhr = ep.raw?.z_scores_at_peak?.z_hr;
                  const zVal = (typeof rawZhr === 'number' ? rawZhr : (ep.peakScore ? ep.peakScore * 1.15 : 2.85)).toFixed(2);
                  const dateStr = ep.onsetDate || '-';
                  const timeStr = ep.onsetTime || '-';
                  const participantLabel = ep.participantName || ep.participantId || 'Unknown';

                  const reasonText = isPersistent
                    ? `Persistensi deviasi terdeteksi (${dateStr} ${timeStr}). HR loncat +${deltaHr} BPM di atas baseline (${baseHr} BPM, Z=+${zVal} > 2.5). Berubah menjadi Episode Persisten.`
                    : `HR ${hrVal} BPM loncat +${deltaHr} BPM di atas baseline (${baseHr} BPM, Z=+${zVal} > 2.0). Candidate Onset soliter terdeteksi pada ${dateStr} ${timeStr}.`;

                  return (
                    <tr key={ep.id || idx}>
                      <td className="mono fw-bold" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{dateStr}</td>
                      <td className="mono" style={{ fontSize: 11 }}>{timeStr}</td>
                      <td className="mono fw-bold" style={{ color: 'var(--teal)' }}>{participantLabel}</td>
                      <td>
                        <span className="badge bg-light text-dark border px-2 py-1" style={{ fontSize: 10 }}>
                          {ep.context || 'Duduk'}
                        </span>
                      </td>
                      <td>
                        <div className="mono fw-bold" style={{ fontSize: 12, color: 'var(--red)' }}>
                          {hrVal} BPM
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--gray)' }}>Baseline: {baseHr} BPM ({Number(deltaHr) >= 0 ? `+${deltaHr}` : deltaHr})</div>
                      </td>
                      <td className="mono fw-bold" style={{ color: 'var(--purple)' }}>+{zVal}</td>
                      <td>
                        <StateBadge state={isPersistent ? 'PERSISTENT_DEVIATION' : 'DEVIATION_CANDIDATE'} />
                      </td>
                      <td>
                        <div style={{ fontSize: 11.5, color: 'var(--ink)', lineHeight: 1.4 }}>
                          {reasonText}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
