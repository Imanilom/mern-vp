import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';

const getTimestamp = (d) => {
  if (d.timestamp) return new Date(d.timestamp).getTime();
  if (d.createdAt) return new Date(d.createdAt).getTime();
  if (d.date_created && d.time_created) {
    const parts = d.date_created.split('/');
    if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T${d.time_created}`).getTime();
  }
  if (d.time) return new Date(d.time).getTime();
  if (d.time_created) return new Date(`1970-01-01T${d.time_created}`).getTime();
  return NaN;
};

const EvidenceBadge = ({ state }) => {
  if (state === 'EVALUABLE' || state === 'Clean') return <span className="evidence-chip chip-green">{state}</span>;
  if (state === 'QUALITY_WARNING' || state === 'Marginal') return <span className="evidence-chip chip-neutral">{state}</span>;
  if (state === 'UNCERTAIN_CONTEXT') return <span className="evidence-chip chip-amber">{state}</span>;
  if (state === 'INSUFFICIENT_BASELINE') return <span className="evidence-chip chip-amber">Insufficient</span>;
  return <span className="evidence-chip chip-neutral">{state || '-'}</span>;
};

const StateBadge = ({ state }) => {
  if (state === 'BASELINE_COMPATIBLE' || state === 'Baseline') return <span className="evidence-chip chip-green">Baseline</span>;
  if (state === 'DEVIATION_CANDIDATE' || state === 'Candidate') return <span className="evidence-chip chip-amber">Candidate</span>;
  if (state === 'PERSISTENT_DEVIATION' || state === 'Persistent') return <span className="evidence-chip chip-red">Persistent</span>;
  if (state === 'RECOVERY' || state === 'Recovery') return <span className="evidence-chip chip-purple">Recovery</span>;
  if (state === 'UNRESOLVED') return <span className="evidence-chip chip-red">Unresolved</span>;
  if (state === 'RESOLVED' || state === 'Resolved') return <span className="evidence-chip chip-green">Resolved</span>;
  return <span className="evidence-chip chip-neutral">{state || '-'}</span>;
};

export const LiveMonitorView = ({ 
  participants = [], 
  initialSelectedId, 
  onClearSelection,
  globalParticipantFilter,
  globalDateFilter
}) => {
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [baselineData, setBaselineData] = useState(null);
  const [loadingRaw, setLoadingRaw] = useState(false);

  useEffect(() => {
    if (initialSelectedId && participants.length > 0) {
      const found = participants.find(p => p.id === initialSelectedId || p._id === initialSelectedId);
      if (found) setSelectedParticipant(found);
    }
  }, [initialSelectedId, participants]);

  useEffect(() => {
    if (selectedParticipant && globalDateFilter) {
      setLoadingRaw(true);
      const targetId = selectedParticipant.guid || selectedParticipant.id || selectedParticipant._id;
      
      Promise.all([
        api.getRawData(targetId, globalDateFilter).catch(() => null),
        api.getRRBaseline(targetId).catch(() => null)
      ]).then(([rawRes, baselineRes]) => {
        setRawData(rawRes);
        if (baselineRes && baselineRes.length > 0) {
           setBaselineData(baselineRes[0]); // Ambil baseline terbaru
        } else {
           setBaselineData(null);
        }
        setLoadingRaw(false);
      });
    } else {
      setRawData(null);
      setBaselineData(null);
    }
  }, [selectedParticipant, globalDateFilter]);

  const displayRawData = useMemo(() => {
    if (!rawData || !rawData.data || rawData.data.length === 0) return [];
    let dArr = rawData.data;
    if (globalDateFilter) {
      const [year, month, day] = globalDateFilter.split('-');
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
      const filtered = dArr.filter(d => {
        const ts = getTimestamp(d);
        if (isNaN(ts)) return false; 
        return ts >= startOfDay && ts <= endOfDay;
      });
      if (filtered.length > 0) return filtered;
    }
    return dArr;
  }, [rawData, globalDateFilter]);

  const renderLiveTrajectory = () => {
    if (loadingRaw) return <div className="frame-note m-0">Loading stream...</div>;
    if (displayRawData.length === 0) return (
      <svg viewBox="0 0 460 90" style={{ width: '100%', height: 90 }}>
        <line x1="0" y1="30" x2="460" y2="30" stroke="#B52A2A" strokeDasharray="4 3" strokeWidth="1"/>
        <text x="230" y="50" fill="var(--gray)" fontSize="11" textAnchor="middle">No raw data available</text>
      </svg>
    );

    const items = displayRawData.slice(-60); // take last 60 points for drawing
    const getY = (hr) => {
      let y = 90 - ((hr - 40) / 120) * 90;
      return Math.max(5, Math.min(85, y));
    };

    const points = items.map((d, i) => {
      const x = (i / 60) * 460;
      const hr = Number(d.hr) || 60;
      return `${x},${getY(hr)}`;
    }).join(' ');

    let baselineArea = null;
    let baselineLine = <line x1="0" y1="30" x2="460" y2="30" stroke="#B52A2A" strokeDasharray="4 3" strokeWidth="1"/>;

    if (baselineData && baselineData.stats && baselineData.stats.hr_mean) {
       const b_mean = baselineData.stats.hr_mean.mean;
       const b_std = baselineData.stats.hr_mean.std;
       if (b_mean) {
          const y_mean = getY(b_mean);
          baselineLine = <line x1="0" y1={y_mean} x2="460" y2={y_mean} stroke="#2E7D32" strokeDasharray="4 3" strokeWidth="1.5"/>;
          
          if (b_std) {
             const y_top = getY(b_mean + b_std);
             const y_bot = getY(b_mean - b_std);
             baselineArea = <rect x="0" y={y_top} width="460" height={Math.max(1, y_bot - y_top)} fill="#2E7D32" fillOpacity="0.15" />;
          }
       }
    }

    return (
      <svg viewBox="0 0 460 90" style={{ width: '100%', height: 90 }}>
        {baselineArea}
        {baselineLine}
        <polyline points={points} fill="none" stroke="#B52A2A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  };

  const filteredParticipants = participants.filter(p => {
    if (globalParticipantFilter && globalParticipantFilter !== 'ALL' && p.id !== globalParticipantFilter && p._id !== globalParticipantFilter) return false;
    return true;
  });

  const activeCount = participants.filter(p => p.evidenceState === 'EVALUABLE').length;
  const warningCount = participants.filter(p => p.evidenceState === 'QUALITY_WARNING').length;
  const episodeCount = participants.filter(p => p.physiologicalState === 'PERSISTENT_DEVIATION').length;

  return (
    <div>
      {/* Top Stats Row */}
      <div className="row g-2 mb-3">
        <div className="col-3">
          <div className="stat-card">
            <div className="lbl">Connected participants</div>
            <div className="val" style={{ color: 'var(--teal)' }}>{participants.length}</div>
            <div className="sub">{activeCount} evaluable · {participants.length - activeCount} paused</div>
          </div>
        </div>
        <div className="col-3">
          <div className="stat-card">
            <div className="lbl">Quality warnings</div>
            <div className="val" style={{ color: 'var(--gray)' }}>{warningCount}</div>
            <div className="sub">last 15 minutes</div>
          </div>
        </div>
        <div className="col-3">
          <div className="stat-card">
            <div className="lbl">Active episodes</div>
            <div className="val" style={{ color: 'var(--red)' }}>{episodeCount}</div>
            <div className="sub">{episodeCount} persistent</div>
          </div>
        </div>
        <div className="col-3">
          <div className="stat-card">
            <div className="lbl">Median latency</div>
            <div className="val" style={{ color: 'var(--blue)' }}>4.2s</div>
            <div className="sub">ingestion → state</div>
          </div>
        </div>
      </div>

      {/* Selected Participant Details */}
      {selectedParticipant && (
        <div className="row g-3 mb-3">
          <div className="col-7">
            <div className="card-panel h-100">
              <div className="d-flex justify-content-between">
                <div className="mini-label mb-1">Participant {selectedParticipant.id} — live trajectory</div>
                <button onClick={() => setSelectedParticipant(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray)' }}><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="frame-note mb-2 mt-0">Context: {selectedParticipant.context || 'unknown'} · evidence {selectedParticipant.evidenceState} · {selectedParticipant.device || 'device'}</div>
              
              {renderLiveTrajectory()}

              <div className="mt-2">
                <StateBadge state={selectedParticipant.physiologicalState} />
                <span className="frame-note m-0 d-inline ms-2">
                  Score {typeof selectedParticipant.anomalyScore === 'number' ? selectedParticipant.anomalyScore.toFixed(2) : '-'}
                </span>
              </div>
            </div>
          </div>
          <div className="col-5">
            <div className="card-panel h-100">
              <div className="mini-label mb-2">Evidence &amp; device</div>
              <div className="d-flex justify-content-between py-1 border-bottom"><span className="frame-note m-0">RR stream</span><span className="mini-value" style={{ color: 'var(--green)' }}>active</span></div>
              <div className="d-flex justify-content-between py-1 border-bottom"><span className="frame-note m-0">HR Mean</span><span className="mini-value">{selectedParticipant.hrMean || '-'}</span></div>
              <div className="d-flex justify-content-between py-1 border-bottom"><span className="frame-note m-0">Context confidence</span><span className="mini-value">{typeof selectedParticipant.contextConfidence === 'number' ? (selectedParticipant.contextConfidence * 100).toFixed(0) : '0'}%</span></div>
              <div className="d-flex justify-content-between py-1 border-bottom"><span className="frame-note m-0">Baseline</span><span className="mini-value" style={{ color: 'var(--blue)' }}>{selectedParticipant.baselineMaturity || 'ready'}</span></div>
              <div className="d-flex justify-content-between py-1"><span className="frame-note m-0">Battery</span><span className="mini-value">{selectedParticipant.battery || 100}%</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Participants Table */}
      <table className="dtable">
        <thead>
          <tr>
            <th>Participant</th>
            <th>Evidence</th>
            <th>State</th>
            <th>Score</th>
            <th>Context</th>
            <th>Last update</th>
          </tr>
        </thead>
        <tbody>
          {filteredParticipants.length === 0 ? (
             <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray)' }}>No participants match the filter.</td></tr>
          ) : (
            filteredParticipants.map(p => (
              <tr 
                key={p.id || p._id} 
                onClick={() => setSelectedParticipant(p)}
                style={{ cursor: 'pointer', background: selectedParticipant?.id === p.id ? 'var(--gray-soft)' : 'transparent' }}
              >
                <td className="mono fw-bold">{p.id}</td>
                <td><EvidenceBadge state={p.evidenceState} /></td>
                <td>
                  {p.physiologicalState === 'paused' || p.evidenceState === 'QUALITY_WARNING' || p.evidenceState === 'INSUFFICIENT_BASELINE' ? (
                    <span style={{ color: 'var(--gray)' }}>paused</span>
                  ) : (
                    <StateBadge state={p.physiologicalState} />
                  )}
                </td>
                <td className="mono">{typeof p.anomalyScore === 'number' ? p.anomalyScore.toFixed(2) : '—'}</td>
                <td>{p.context || '—'}</td>
                <td className="mono">{p.lastUpdate || '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
