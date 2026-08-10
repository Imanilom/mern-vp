import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { EvidenceBadge } from '../components/common/EvidenceBadge';
import { StateBadge } from '../components/common/StateBadge';
import {
  Radio,
  Pin,
  PinOff,
  Sliders,
  Battery,
  Wifi,
  Activity,
  AlertCircle,
  X,
  TrendingUp,
  Clock
} from 'lucide-react';

export const LiveMonitorView = ({ participants, initialSelectedId, onClearSelection }) => {
  const [filterEvidence, setFilterEvidence] = useState('ALL');
  const [filterState, setFilterState] = useState('ALL');
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [pinnedIds, setPinnedIds] = useState(['P-014', 'P-027']);
  const [rawData, setRawData] = useState(null);
  const [loadingRaw, setLoadingRaw] = useState(false);

  const safeParticipants = Array.isArray(participants) ? participants : [];

  useEffect(() => {
    console.log('[LiveMonitorView] API Data (Participants):', safeParticipants);
  }, [safeParticipants]);

  useEffect(() => {
    if (initialSelectedId && safeParticipants.length > 0) {
      const found = safeParticipants.find(p => p.id === initialSelectedId || p._id === initialSelectedId);
      if (found) setSelectedParticipant(found);
    }
  }, [initialSelectedId, safeParticipants]);

  useEffect(() => {
    if (selectedParticipant) {
      setLoadingRaw(true);
      const targetId = selectedParticipant.guid || selectedParticipant.id || selectedParticipant._id;
      api.getRawData(targetId).then(data => {
        console.log(`[LiveMonitorView] API Data (Raw Data for ${targetId}):`, data);
        setRawData(data);
        setLoadingRaw(false);
      });
    } else {
      setRawData(null);
    }
  }, [selectedParticipant]);

  const handleCloseDrawer = () => {
    setSelectedParticipant(null);
    if (onClearSelection) onClearSelection();
  };

  const togglePin = (id, e) => {
    e.stopPropagation();
    setPinnedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filtered = safeParticipants.filter(p => {
    if (filterEvidence !== 'ALL' && p.evidenceState !== filterEvidence) return false;
    if (filterState !== 'ALL' && p.physiologicalState !== filterState) return false;
    return true;
  });

  const sortedParticipants = [...filtered].sort((a, b) => {
    const aPin = pinnedIds.includes(a.id);
    const bPin = pinnedIds.includes(b.id);
    if (aPin && !bPin) return -1;
    if (!aPin && bPin) return 1;
    return 0;
  });

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Live Monitor &amp; Signal Quality</h1>
        <p className="page-sub">
          Observabilitas real-time sinyal wearable, status evidence readiness, dan tracking state fisiologis peserta.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
          <Sliders size={14} color="var(--teal)" />
          <span>Filters:</span>
        </div>

        {/* Evidence State Filter */}
        <select
          value={filterEvidence}
          onChange={(e) => setFilterEvidence(e.target.value)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '5px 10px',
            fontSize: 11.5,
            color: 'var(--ink)'
          }}
        >
          <option value="ALL">Evidence State: All</option>
          <option value="EVALUABLE">EVALUABLE</option>
          <option value="QUALITY_WARNING">QUALITY_WARNING</option>
          <option value="UNCERTAIN_CONTEXT">UNCERTAIN_CONTEXT</option>
          <option value="INSUFFICIENT_BASELINE">INSUFFICIENT_BASELINE</option>
        </select>

        {/* Physiological State Filter */}
        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '5px 10px',
            fontSize: 11.5,
            color: 'var(--ink)'
          }}
        >
          <option value="ALL">Physiological State: All</option>
          <option value="BASELINE_COMPATIBLE">BASELINE_COMPATIBLE</option>
          <option value="DEVIATION_CANDIDATE">DEVIATION_CANDIDATE</option>
          <option value="PERSISTENT_DEVIATION">PERSISTENT_DEVIATION</option>
          <option value="RECOVERY">RECOVERY</option>
          <option value="UNRESOLVED">UNRESOLVED</option>
        </select>

        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--gray)' }}>
          Showing <b>{filtered.length}</b> of <b>{participants.length}</b> participants
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="card-panel" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="dtable">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>Pin</th>
                <th>Participant ID</th>
                <th>Device &amp; Status</th>
                <th>Evidence Readiness</th>
                <th>Physiological State</th>
                <th>Score</th>
                <th>Context</th>
                <th>Battery / Drift</th>
                <th>Last Update</th>
              </tr>
            </thead>
            <tbody>
              {sortedParticipants.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--gray)' }}>
                    Tidak ada data peserta/pasien yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                sortedParticipants.map((p) => {
                  const isPinned = pinnedIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedParticipant(p)}
                      style={{
                        cursor: 'pointer',
                        background: isPinned ? '#F8FAFC' : 'transparent'
                      }}
                    >
                      <td style={{ textAlign: 'center' }} onClick={(e) => togglePin(p.id, e)}>
                        {isPinned ? (
                          <Pin size={14} color="var(--teal)" fill="var(--teal)" />
                        ) : (
                          <PinOff size={14} color="var(--gray)" />
                        )}
                      </td>
                      <td className="mono" style={{ fontWeight: 800, color: 'var(--navy)' }}>
                        {p.id}
                      </td>
                      <td style={{ fontSize: 11.5 }}>
                        <div style={{ fontWeight: 600 }}>{p.device}</div>
                        <div style={{ fontSize: 10, color: 'var(--gray)' }}>{p.baselineMaturity}</div>
                      </td>
                      <td><EvidenceBadge state={p.evidenceState} /></td>
                      <td><StateBadge state={p.physiologicalState} /></td>
                      <td className="mono" style={{ fontWeight: 700 }}>
                        {p.anomalyScore !== null && p.anomalyScore !== undefined ? p.anomalyScore.toFixed(2) : '-'}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>
                        <div style={{ fontWeight: 600 }}>{p.context}</div>
                        <div style={{ fontSize: 10, color: 'var(--gray)' }}>conf: {typeof p.contextConfidence === 'number' ? (p.contextConfidence * 100).toFixed(0) : '95'}%</div>
                      </td>
                      <td style={{ fontSize: 11 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Battery size={13} color={(p.battery || 100) < 20 ? 'var(--red)' : 'var(--green)'} />
                          <span>{p.battery || 100}%</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--gray)' }}>drift: {p.clockDrift || '0ms'}</div>
                      </td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--gray)' }}>
                        {p.lastUpdate || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Participant Detail Drawer */}
      {selectedParticipant && (
        <>
          <div className="drawer-overlay" onClick={handleCloseDrawer} />
          <div className="drawer-container">
            {/* Drawer Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--navy-2)',
              color: '#ffffff'
            }}>
              <div>
                <div className="mini-label" style={{ color: '#8FB6C4' }}>Participant Stream Detail</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{selectedParticipant.id} — Live Inspection</h3>
              </div>
              <button
                onClick={handleCloseDrawer}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {/* Badges Bar */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <EvidenceBadge state={selectedParticipant.evidenceState} />
                <StateBadge state={selectedParticipant.physiologicalState} />
              </div>

              {/* Anomaly & Metrics Box */}
              <div className="card-panel" style={{ marginBottom: 20, background: 'var(--gray-soft)' }}>
                <div className="mini-label" style={{ marginBottom: 4 }}>Live Anomaly Score vs Thresholds</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <div className="mono" style={{ fontSize: 32, fontWeight: 800, color: 'var(--navy)' }}>
                    {typeof selectedParticipant.anomalyScore === 'number' ? selectedParticipant.anomalyScore.toFixed(2) : '-'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray)' }}>
                    tau_in: <b>{selectedParticipant.tauIn || '-'}</b> · tau_out: <b>{selectedParticipant.tauOut || '-'}</b> · tau_normal: <b>{selectedParticipant.tauNormal || '-'}</b>
                  </div>
                </div>
              </div>

              {/* Signal Quality Metrics */}
              <div style={{ marginBottom: 20 }}>
                <div className="mini-label" style={{ marginBottom: 8 }}>Signal Quality &amp; Baseline Maturity</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="card-panel" style={{ padding: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--gray)' }}>HR Mean</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 800 }}>{selectedParticipant.hrMean || '-'} bpm</div>
                  </div>
                  <div className="card-panel" style={{ padding: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--gray)' }}>RMSSD (Vagal Index)</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 800 }}>{selectedParticipant.rmssd || '-'} ms</div>
                  </div>
                  <div className="card-panel" style={{ padding: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--gray)' }}>DFA α1</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 800 }}>{selectedParticipant.dfaAlpha1 || '-'}</div>
                  </div>
                  <div className="card-panel" style={{ padding: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--gray)' }}>Context Confidence</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 800 }}>
                      {typeof selectedParticipant.contextConfidence === 'number' ? (selectedParticipant.contextConfidence * 100).toFixed(0) : '0'}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Provenance Row */}
              <div className="card-panel" style={{ fontSize: 11, color: 'var(--ink)' }}>
                <div className="mini-label" style={{ marginBottom: 6 }}>Provenance &amp; Device Contract</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                  <span>Device</span><span className="mono">{selectedParticipant.device}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                  <span>Baseline Maturity</span><span>{selectedParticipant.baselineMaturity}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>Clock Drift</span><span className="mono">{selectedParticipant.clockDrift}</span>
                </div>
              </div>

              {/* Raw Data Visualizations: HR & RR Line Graph + Scatter Plot */}
              <div style={{ marginTop: 20 }}>
                <div className="mini-label" style={{ marginBottom: 8 }}>Live Physiological Signal Analysis (HR &amp; RR)</div>
                {loadingRaw ? (
                  <div style={{ fontSize: 11, color: 'var(--gray)', padding: 12 }}>Loading raw signal data...</div>
                ) : rawData && rawData.data && rawData.data.length > 0 ? (
                  <>
                    {/* 1. HR & RR Line Chart */}
                    <div className="card-panel mb-3" style={{ background: '#0B192C', color: '#fff', padding: 14, borderRadius: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#8FB6C4', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Activity size={14} color="var(--teal)" />
                          <span>Heart Rate (HR) &amp; RR Interval Trend Line</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
                          <span style={{ color: '#00E5FF', fontWeight: 600 }}>─ HR (bpm)</span>
                          <span style={{ color: '#FFB300', fontWeight: 600 }}>─ RR (ms)</span>
                        </div>
                      </div>

                      {/* SVG Line Chart */}
                      {(() => {
                        const items = rawData.data.slice(-30); // Use last 30 readings
                        const width = 360;
                        const height = 120;
                        const padding = 20;

                        const hrValues = items.map(d => Number(d.hr) || 0).filter(v => v > 0);
                        const rrValues = items.map(d => Number(d.rr) || 0).filter(v => v > 0);

                        const minHr = Math.min(...(hrValues.length ? hrValues : [50])) - 5;
                        const maxHr = Math.max(...(hrValues.length ? hrValues : [120])) + 5;

                        const minRr = Math.min(...(rrValues.length ? rrValues : [400])) - 20;
                        const maxRr = Math.max(...(rrValues.length ? rrValues : [1200])) + 20;

                        const getHrY = (val) => height - padding - ((val - minHr) / (maxHr - minHr || 1)) * (height - 2 * padding);
                        const getRrY = (val) => height - padding - ((val - minRr) / (maxRr - minRr || 1)) * (height - 2 * padding);
                        const getX = (idx) => padding + (idx / (items.length - 1 || 1)) * (width - 2 * padding);

                        const hrPoints = items.map((d, idx) => `${getX(idx)},${getHrY(d.hr || minHr)}`).join(' ');
                        const rrPoints = items.map((d, idx) => `${getX(idx)},${getRrY(d.rr || minRr)}`).join(' ');

                        return (
                          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: height, overflow: 'visible' }}>
                            {/* Grid Lines */}
                            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#1E3A5F" strokeDasharray="3 3" />
                            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#1E3A5F" strokeDasharray="3 3" />
                            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1E3A5F" />

                            {/* HR Line (Cyan) */}
                            {items.length > 1 && (
                              <polyline fill="none" stroke="#00E5FF" strokeWidth="2" points={hrPoints} />
                            )}
                            {/* RR Line (Amber) */}
                            {items.length > 1 && (
                              <polyline fill="none" stroke="#FFB300" strokeWidth="2" strokeDasharray="4 2" points={rrPoints} />
                            )}

                            {/* Data points */}
                            {items.map((d, idx) => (
                              <g key={idx}>
                                <circle cx={getX(idx)} cy={getHrY(d.hr || minHr)} r="3" fill="#00E5FF" />
                                <circle cx={getX(idx)} cy={getRrY(d.rr || minRr)} r="2.5" fill="#FFB300" />
                              </g>
                            ))}
                          </svg>
                        );
                      })()}
                    </div>

                    {/* 2. Poincaré / RR Scatter Plot */}
                    <div className="card-panel mb-3" style={{ background: '#0F2337', color: '#fff', padding: 14, borderRadius: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8FB6C4', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TrendingUp size={14} color="var(--teal)" />
                        <span>Poincaré Scatter Plot (RR<sub>n</sub> vs RR<sub>n+1</sub>)</span>
                      </div>

                      {(() => {
                        const items = rawData.data.map(d => Number(d.rr)).filter(v => v > 0);
                        const points = [];
                        for (let i = 0; i < items.length - 1; i++) {
                          points.push({ x: items[i], y: items[i + 1] });
                        }

                        const svgSize = 180;
                        const pPad = 25;
                        const allRr = items.length ? items : [600, 1000];
                        const minVal = Math.min(...allRr) - 30;
                        const maxVal = Math.max(...allRr) + 30;

                        const scale = (val) => pPad + ((val - minVal) / (maxVal - minVal || 1)) * (svgSize - 2 * pPad);
                        const scaleY = (val) => svgSize - pPad - ((val - minVal) / (maxVal - minVal || 1)) * (svgSize - 2 * pPad);

                        return (
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <svg viewBox={`0 0 ${svgSize} ${svgSize}`} style={{ width: 220, height: 220, background: '#0B1426', borderRadius: 8, padding: 4 }}>
                              {/* Identity Line (y = x) */}
                              <line x1={pPad} y1={svgSize - pPad} x2={svgSize - pPad} y2={pPad} stroke="#2B4C6F" strokeDasharray="3 3" strokeWidth="1" />
                              
                              {/* Axis Labels */}
                              <text x={svgSize / 2} y={svgSize - 4} fill="#8FB6C4" fontSize="8" textAnchor="middle">RR_n (ms)</text>
                              <text x="8" y={svgSize / 2} fill="#8FB6C4" fontSize="8" textAnchor="middle" transform={`rotate(-90 8 ${svgSize / 2})`}>RR_n+1 (ms)</text>

                              {/* Scatter Points */}
                              {points.map((pt, idx) => (
                                <circle
                                  key={idx}
                                  cx={scale(pt.x)}
                                  cy={scaleY(pt.y)}
                                  r="3"
                                  fill="var(--teal)"
                                  opacity="0.8"
                                >
                                  <title>{`RR_n: ${pt.x} ms, RR_n+1: ${pt.y} ms`}</title>
                                </circle>
                              ))}
                            </svg>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 3. Raw Data Stream Table */}
                    <div className="card-panel" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                        <table className="dtable" style={{ fontSize: 10 }}>
                          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                            <tr>
                              <th>Time</th>
                              <th>HR (bpm)</th>
                              <th>RR (ms)</th>
                              <th>Activity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rawData.data.slice(-10).reverse().map((row, idx) => (
                              <tr key={idx}>
                                <td className="mono">{row.time_created || '-'}</td>
                                <td className="mono" style={{ fontWeight: 600, color: 'var(--navy)' }}>{row.hr || '-'}</td>
                                <td className="mono" style={{ color: 'var(--teal)' }}>{row.rr || '-'}</td>
                                <td>{row.activity || row.aktivitas || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--gray)', padding: 12 }}>No raw data available for this user.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
