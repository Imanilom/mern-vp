import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine, Brush,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
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

const getTimestamp = (d) => {
  if (d.timestamp) return new Date(d.timestamp).getTime();
  if (d.createdAt) return new Date(d.createdAt).getTime();
  if (d.date_created && d.time_created) {
    const parts = d.date_created.split('/');
    if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T${d.time_created}`).getTime();
  }
  if (d.time) return new Date(d.time).getTime();
  if (d.time_created) return new Date(`1970-01-01T${d.time_created}`).getTime(); // Fallback for time only
  return NaN;
};

export const LiveMonitorView = ({ 
  participants, 
  initialSelectedId, 
  onClearSelection,
  globalParticipantFilter,
  globalDateFilter
}) => {
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
    if (selectedParticipant && globalDateFilter) {
      setLoadingRaw(true);
      const targetId = selectedParticipant.guid || selectedParticipant.id || selectedParticipant._id;
      api.getRawData(targetId, globalDateFilter).then(data => {
        console.log(`[LiveMonitorView] API Data (Raw Data for ${targetId} on ${globalDateFilter}):`, data);
        setRawData(data);
        setLoadingRaw(false);
      }).catch(err => {
        console.error('Failed to fetch raw data for date', globalDateFilter, err);
        setRawData(null);
        setLoadingRaw(false);
      });
    } else if (selectedParticipant && !globalDateFilter) {
      // If there's a participant but no date filter yet, wait for it or fetch latest
      // For now, wait for App.jsx to set globalDateFilter
      setRawData(null);
    } else {
      setRawData(null);
    }
  }, [selectedParticipant, globalDateFilter]);

  const displayRawData = useMemo(() => {
    if (!rawData || !rawData.data || rawData.data.length === 0) return [];
    let dArr = rawData.data;
    let targetDateStr = globalDateFilter;
    
    let filtered = [];
    if (targetDateStr) {
      const [year, month, day] = targetDateStr.split('-');
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

      filtered = dArr.filter(d => {
        const ts = getTimestamp(d);
        if (isNaN(ts)) return false; 
        return ts >= startOfDay.getTime() && ts <= endOfDay.getTime();
      });
    }

    // Fallback: If filter returns empty, return the raw data so graph doesn't break
    if (targetDateStr && filtered.length === 0) {
      return dArr;
    }
    
    return targetDateStr ? filtered : dArr;
  }, [rawData, globalDateFilter]);

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
    if (globalParticipantFilter && globalParticipantFilter !== 'ALL' && p.id !== globalParticipantFilter && p._id !== globalParticipantFilter) return false;
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
                ) : (
                  <>
                    {displayRawData.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--gray)', padding: 12 }}>No raw data available for this user on the selected date range.</div>
                    ) : (
                      <>
                        {/* 1. HR Line Chart */}
                    <div className="card-panel mb-3" style={{ background: '#0B192C', color: '#fff', padding: 14, borderRadius: 10 }}>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#8FB6C4', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Activity size={14} color="var(--teal)" />
                          <span>Detak Jantung (Heart Rate)</span>
                        </div>
                        <p className="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                          Area hijau muda = rentang normal saat istirahat (60–100 bpm).
                        </p>
                      </div>
                      
                      {(() => {
                        const HR_NORMAL_MIN = 60;
                        const HR_NORMAL_MAX = 100;
                        const items = displayRawData.slice(-1000); // Use up to 1000 items

                        const chartData = items.map(d => {
                          const tTime = getTimestamp(d);
                          const tStr = isNaN(tTime) ? '' : new Date(tTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          return {
                            ...d,
                            hr: Number(d.hr) || null,
                            rr: Number(d.rr) || null,
                            timeLabel: tStr,
                          };
                        }).filter(d => d.hr !== null || d.rr !== null);

                        const SimpleTooltip = ({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          const dataPoint = payload[0].payload;
                          return (
                            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--ink)' }}>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>Jam {label}</div>
                              {payload.map((p, i) => (
                                <div key={i} style={{ color: p.color }}>
                                  {p.name}: <strong>{p.value}</strong> {p.dataKey === 'hr' ? 'bpm' : 'ms'}
                                </div>
                              ))}
                            </div>
                          );
                        };

                        return (
                          <div style={{ height: 240, width: '100%', marginTop: 10 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} syncId="liveMonitorTime" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" vertical={false} />
                                <XAxis dataKey="timeLabel" stroke="#8FB6C4" fontSize={10} tickMargin={8} minTickGap={40} />
                                <YAxis stroke="#8FB6C4" fontSize={10} domain={['dataMin - 10', 'dataMax + 10']} />
                                <ReferenceArea y1={HR_NORMAL_MIN} y2={HR_NORMAL_MAX} fill="#22c55e" fillOpacity={0.08} />
                                <ReferenceLine y={HR_NORMAL_MIN} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} />
                                <ReferenceLine y={HR_NORMAL_MAX} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} />
                                <RechartsTooltip content={<SimpleTooltip />} />
                                <Line type="monotone" dataKey="hr" name="HR" stroke="#00E5FF" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                                <Brush dataKey="timeLabel" height={30} stroke="#8FB6C4" fill="#0B192C" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 2. RR Line Chart */}
                    <div className="card-panel mb-3" style={{ background: '#0B192C', color: '#fff', padding: 14, borderRadius: 10 }}>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#8FB6C4', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Activity size={14} color="var(--teal)" />
                          <span>Jarak Antar Detak (RR Interval)</span>
                        </div>
                        <p className="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                          Semakin stabil garisnya, semakin teratur irama jantung.
                        </p>
                      </div>
                      
                      {(() => {
                        const items = displayRawData.slice(-1000); // Use up to 1000 items

                        const chartData = items.map(d => {
                          const tTime = getTimestamp(d);
                          const tStr = isNaN(tTime) ? '' : new Date(tTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          return {
                            ...d,
                            hr: Number(d.hr) || null,
                            rr: Number(d.rr) || null,
                            timeLabel: tStr,
                          };
                        }).filter(d => d.hr !== null || d.rr !== null);

                        const SimpleTooltip = ({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          const dataPoint = payload[0].payload;
                          return (
                            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--ink)' }}>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>Jam {label}</div>
                              {payload.map((p, i) => (
                                <div key={i} style={{ color: p.color }}>
                                  {p.name}: <strong>{p.value}</strong> {p.dataKey === 'hr' ? 'bpm' : 'ms'}
                                </div>
                              ))}
                            </div>
                          );
                        };

                        return (
                          <div style={{ height: 180, width: '100%', marginTop: 10 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} syncId="liveMonitorTime" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" vertical={false} />
                                <XAxis dataKey="timeLabel" stroke="#8FB6C4" fontSize={10} tickMargin={8} minTickGap={40} />
                                <YAxis stroke="#8FB6C4" fontSize={10} domain={['dataMin - 50', 'dataMax + 50']} />
                                <RechartsTooltip content={<SimpleTooltip />} />
                                <Line type="monotone" dataKey="rr" name="RR" stroke="#FFB300" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 3. Poincaré Scatter Plot */}
                    <div className="card-panel mb-3" style={{ background: '#0F2337', color: '#fff', padding: 14, borderRadius: 10 }}>
                      {(() => {
                        const rrIntervals = displayRawData.map(d => Number(d.rr)).filter(v => typeof v === 'number' && v > 0);
                        const poincareData = (() => {
                          if (rrIntervals.length < 2) return { points: [], sd1: 0, sd2: 0, ratio: 0 };
                      
                          const points = [];
                          let sumDiff = 0, sumAdd = 0;
                          const n = rrIntervals.length - 1;
                      
                          for (let i = 0; i < n; i++) {
                            const rr_n = rrIntervals[i];
                            const rr_n1 = rrIntervals[i+1];
                            points.push({ x: rr_n, y: rr_n1 });
                            sumDiff += (rr_n - rr_n1);
                            sumAdd += (rr_n + rr_n1);
                          }
                          const meanDiff = sumDiff / n;
                          const meanAdd = sumAdd / n;
                      
                          let sumSqDiff = 0, sumSqAdd = 0;
                          for (let i = 0; i < n; i++) {
                            const rr_n = rrIntervals[i];
                            const rr_n1 = rrIntervals[i+1];
                            sumSqDiff += Math.pow((rr_n - rr_n1) - meanDiff, 2);
                            sumSqAdd += Math.pow((rr_n + rr_n1) - meanAdd, 2);
                          }
                      
                          const varDiff = sumSqDiff / (n - 1 || 1);
                          const varAdd = sumSqAdd / (n - 1 || 1);
                          const sd1 = Math.sqrt(0.5 * varDiff);
                          const sd2 = Math.sqrt(0.5 * varAdd);
                      
                          return { 
                            points, 
                            sd1: Math.round(sd1 * 100) / 100, 
                            sd2: Math.round(sd2 * 100) / 100,
                            ratio: sd2 !== 0 ? Math.round((sd1 / sd2) * 100) / 100 : 0
                          };
                        })();

                        return (
                          <>
                            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#8FB6C4', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <TrendingUp size={14} color="var(--teal)" />
                                  <span>Scatter Plot HRV (Poincaré Plot)</span>
                                </div>
                                <p className="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                                  Distribusi interval detak jantung untuk analisis variabilitas.
                                </p>
                              </div>
                              <div style={{ textAlign: 'right', display: 'flex', gap: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '10px', color: '#8FB6C4' }}>SD1 (Short)</span>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#00E5FF' }}>{poincareData.sd1} ms</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '10px', color: '#8FB6C4' }}>SD2 (Long)</span>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFB300' }}>{poincareData.sd2} ms</span>
                                </div>
                              </div>
                            </div>
                            
                            <div style={{ height: 260, width: '100%', marginTop: 10 }}>
                              {poincareData.points.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                                    <XAxis type="number" dataKey="x" name="RRn" unit="ms" domain={['dataMin - 50', 'dataMax + 50']} stroke="#8FB6C4" fontSize={10} label={{ value: 'RR_n (ms)', position: 'insideBottom', offset: -10, fill: '#8FB6C4', fontSize: 10 }} />
                                    <YAxis type="number" dataKey="y" name="RRn+1" unit="ms" domain={['dataMin - 50', 'dataMax + 50']} stroke="#8FB6C4" fontSize={10} label={{ value: 'RR_{n+1} (ms)', angle: -90, position: 'insideLeft', fill: '#8FB6C4', fontSize: 10 }} />
                                    <ZAxis range={[30, 30]} />
                                    <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: 8, fontSize: 12, color: 'var(--ink)' }} />
                                    <Scatter name="RR Intervals" data={poincareData.points} fill="var(--teal)" opacity={0.6} />
                                  </ScatterChart>
                                </ResponsiveContainer>
                              ) : (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray)', fontSize: 11 }}>
                                  Not enough data
                                </div>
                              )}
                            </div>
                          </>
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
                            {displayRawData.slice(-10).reverse().map((row, idx) => (
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
                )}
              </>
            )}
          </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
