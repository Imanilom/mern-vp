import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend } from 'recharts';
import { api } from '../services/api';

const getTimestamp = (d) => {
  if (d.timestamp) {
     const ts = Number(d.timestamp);
     return ts < 10000000000 ? ts * 1000 : ts;
  }
  if (d.createdAt) {
     if (typeof d.createdAt === 'object' && d.createdAt.$date) return new Date(d.createdAt.$date).getTime();
     return new Date(d.createdAt).getTime();
  }
  if (d.date_created && d.time_created) {
    const sep = d.date_created.includes('-') ? '-' : '/';
    const parts = d.date_created.split(sep);
    if (parts.length === 3) {
      const yyyy = parts[0].length === 4 ? parts[0] : parts[2];
      const mm = parts[1];
      const dd = parts[0].length === 4 ? parts[2] : parts[0];
      return new Date(`${yyyy}-${mm}-${dd}T${d.time_created}`).getTime();
    }
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
  globalDateFilter,
  liveSensorData
}) => {
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [baselineData, setBaselineData] = useState(null);
  const [loadingRaw, setLoadingRaw] = useState(false);
  const [liveData, setLiveData] = useState([]);
  const [activeStreamTab, setActiveStreamTab] = useState('hr'); // 'hr' | 'acc' | 'ecg' | 'all'

  const parseAcc = (val) => {
    const num = Number(val) || 0;
    if (Math.abs(num) > 10) return Number((num / 1000).toFixed(3));
    return Number(num.toFixed(3));
  };

  useEffect(() => {
    if (initialSelectedId && participants.length > 0) {
      const found = participants.find(p => p.id === initialSelectedId || p._id === initialSelectedId);
      if (found) setSelectedParticipant(found);
    }
  }, [initialSelectedId, participants]);

  useEffect(() => {
    if (selectedParticipant) {
      setLoadingRaw(true);
      const targetId = selectedParticipant.guid || selectedParticipant.id || selectedParticipant._id;
      
      Promise.all([
        api.getRawData(targetId, globalDateFilter || undefined).catch(() => null),
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
    return rawData.data;
  }, [rawData]);

  useEffect(() => {
    if (displayRawData.length > 0) {
      setLiveData(displayRawData.slice(-1000).map(d => ({
        time: new Date(getTimestamp(d)).toLocaleTimeString('id-ID', { hour12: false }),
        hr: Number(d.hr) || 0,
        rrms: Number(d.rrms) || 0,
        acc_x: parseAcc(d.acc_x),
        acc_y: parseAcc(d.acc_y),
        acc_z: parseAcc(d.acc_z),
        ecg: Number(d.ecg) || 0,
      })));
    } else {
      setLiveData([]);
    }
  }, [displayRawData]);

  useEffect(() => {
    if (liveSensorData && selectedParticipant) {
      const pid = selectedParticipant.guid || selectedParticipant.id || selectedParticipant._id;
      if (liveSensorData.user_id === pid || (liveSensorData.user_id && liveSensorData.user_id.$oid === pid)) {
        const payloadToUse = liveSensorData.readings && liveSensorData.readings.length > 0 
          ? liveSensorData.readings[liveSensorData.readings.length - 1] 
          : liveSensorData;
          
        setLiveData(prev => {
          const newPt = {
            time: new Date(getTimestamp(payloadToUse) || Date.now()).toLocaleTimeString('id-ID', { hour12: false }),
            hr: Number(payloadToUse.hr) || 0,
            rrms: Number(payloadToUse.rrms) || 0,
            acc_x: parseAcc(payloadToUse.acc_x ?? payloadToUse.accX),
            acc_y: parseAcc(payloadToUse.acc_y ?? payloadToUse.accY),
            acc_z: parseAcc(payloadToUse.acc_z ?? payloadToUse.accZ),
            ecg: Number(payloadToUse.ecg) || 0,
          };
          const next = [...prev, newPt];
          if (next.length > 60) return next.slice(next.length - 60);
          return next;
        });
      }
    }
  }, [liveSensorData, selectedParticipant]);

  const renderLiveTrajectory = () => {
    if (loadingRaw) return <div className="frame-note m-0">Loading stream...</div>;
    if (liveData.length === 0) return (
      <div style={{ width: '100%', height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray)' }}>
        No raw data available
      </div>
    );

    let b_mean = null;
    let b_std = null;
    if (baselineData && baselineData.stats && baselineData.stats.hr_mean) {
       b_mean = baselineData.stats.hr_mean.mean;
       b_std = baselineData.stats.hr_mean.std;
    }

    const renderHRChart = () => (
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <LineChart data={liveData} margin={{ top: 5, right: 0, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="time" hide />
            <YAxis 
              yAxisId="left" 
              domain={[
                dataMin => Math.max(30, Math.floor(dataMin - 3)), 
                dataMax => Math.min(220, Math.ceil(dataMax + 3))
              ]} 
              tick={{fontSize: 10}} 
              width={35} 
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              domain={[
                dataMin => Math.max(300, Math.floor(dataMin - 15)), 
                dataMax => Math.min(2000, Math.ceil(dataMax + 15))
              ]} 
              tick={{fontSize: 10}} 
              width={40} 
            />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', fontSize: 12, backgroundColor: 'rgba(255,255,255,0.9)' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            
            {b_mean && b_std && (
              <ReferenceArea yAxisId="left" y1={b_mean - b_std} y2={b_mean + b_std} fill="#2E7D32" fillOpacity={0.1} />
            )}
            {b_mean && (
              <ReferenceLine yAxisId="left" y={b_mean} stroke="#2E7D32" strokeDasharray="3 3" />
            )}
            
            <Line yAxisId="left" type="monotone" dataKey="hr" name="Heart Rate (BPM)" stroke="var(--red)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line yAxisId="right" type="monotone" dataKey="rrms" name="RRMS (ms)" stroke="var(--teal)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );

    const renderACCChart = () => (
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <LineChart data={liveData} margin={{ top: 5, right: 0, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="time" hide />
            <YAxis 
              domain={[
                dataMin => Number((dataMin - 0.1).toFixed(2)),
                dataMax => Number((dataMax + 0.1).toFixed(2))
              ]} 
              tick={{fontSize: 10}} 
              tickFormatter={(v) => typeof v === 'number' ? v.toFixed(2) : v} 
              width={40} 
            />
            <Tooltip 
              contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', fontSize: 12, backgroundColor: 'rgba(255,255,255,0.9)' }} 
              formatter={(val, name) => [`${typeof val === 'number' ? val.toFixed(3) : val} g`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="acc_x" name="Acc X (g)" stroke="#2196F3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="acc_y" name="Acc Y (g)" stroke="#4CAF50" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="acc_z" name="Acc Z (g)" stroke="#FF9800" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );

    const renderECGChart = () => (
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <LineChart data={liveData} margin={{ top: 5, right: 0, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="time" hide />
            <YAxis 
              domain={[
                dataMin => Math.floor(dataMin - 10),
                dataMax => Math.ceil(dataMax + 10)
              ]} 
              tick={{fontSize: 10}} 
              width={45} 
            />
            <Tooltip 
              contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', fontSize: 12, backgroundColor: 'rgba(255,255,255,0.9)' }} 
              formatter={(val, name) => [`${val} µV`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="ecg" name="ECG Signal (µV)" stroke="#9C27B0" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );

    return (
      <div>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="d-flex gap-1">
            <button 
              type="button" 
              className={`btn btn-sm ${activeStreamTab === 'hr' ? 'btn-navy' : 'btn-outline-navy'}`}
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => setActiveStreamTab('hr')}
            >
              HR &amp; RR
            </button>
            <button 
              type="button" 
              className={`btn btn-sm ${activeStreamTab === 'acc' ? 'btn-navy' : 'btn-outline-navy'}`}
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => setActiveStreamTab('acc')}
            >
              ACC (Float g)
            </button>
            <button 
              type="button" 
              className={`btn btn-sm ${activeStreamTab === 'ecg' ? 'btn-navy' : 'btn-outline-navy'}`}
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => setActiveStreamTab('ecg')}
            >
              ECG (µV)
            </button>
            <button 
              type="button" 
              className={`btn btn-sm ${activeStreamTab === 'all' ? 'btn-navy' : 'btn-outline-navy'}`}
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => setActiveStreamTab('all')}
            >
              Semua Stream
            </button>
          </div>
        </div>

        {activeStreamTab === 'hr' && renderHRChart()}
        {activeStreamTab === 'acc' && renderACCChart()}
        {activeStreamTab === 'ecg' && renderECGChart()}
        {activeStreamTab === 'all' && (
          <div className="d-flex flex-column gap-3">
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>Heart Rate &amp; RR Interval</div>
              {renderHRChart()}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>3-Axis Accelerometer (g float)</div>
              {renderACCChart()}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>ECG Waveform Signal (µV)</div>
              {renderECGChart()}
            </div>
          </div>
        )}
      </div>
    );
  };

  const filteredParticipants = participants.filter(p => {
    if (globalParticipantFilter && globalParticipantFilter !== 'ALL' && p.id !== globalParticipantFilter && p._id !== globalParticipantFilter) return false;
    return true;
  });

  const activeCount = participants.filter(p => p.evidenceState === 'EVALUABLE').length;
  const warningCount = participants.filter(p => p.evidenceState === 'QUALITY_WARNING').length;
  const episodeCount = participants.filter(p => p.physiologicalState === 'PERSISTENT_DEVIATION').length;

  const latestPt = liveData.length > 0 ? liveData[liveData.length - 1] : null;

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
                <div className="mini-label mb-1">
                  Participant {selectedParticipant.id} — trajectory
                  {liveData && liveData.length > 0 && (
                    <span style={{ fontWeight: 'normal', color: 'var(--gray)', marginLeft: '6px', textTransform: 'none' }}>
                      ({liveData[0].time} - {liveData[liveData.length - 1].time})
                    </span>
                  )}
                </div>
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
              <div className="mini-label mb-2">Evidence &amp; Filter Quality Assessment</div>
              <div className="d-flex justify-content-between py-1 border-bottom"><span className="frame-note m-0">Data Bagus (Clean %)</span><span className="mini-value" style={{ color: 'var(--green)', fontWeight: 700 }}>94.2%</span></div>
              <div className="d-flex justify-content-between py-1 border-bottom"><span className="frame-note m-0">Artifact Fraction (Noise %)</span><span className="mini-value" style={{ color: '#E53935', fontWeight: 600 }}>3.8%</span></div>
              <div className="d-flex justify-content-between py-1 border-bottom"><span className="frame-note m-0">Missing Value Fraction %</span><span className="mini-value" style={{ color: '#FB8C00', fontWeight: 600 }}>2.0%</span></div>
              <div className="d-flex justify-content-between py-1 border-bottom"><span className="frame-note m-0">Signal Quality Score (Q_sig)</span><span className="mini-value" style={{ color: 'var(--teal)', fontWeight: 700 }}>0.96 / 1.00</span></div>
              <div className="d-flex justify-content-between py-1 border-bottom"><span className="frame-note m-0">ACC (X, Y, Z)</span><span className="mini-value" style={{ color: '#2196F3' }}>{latestPt ? `${latestPt.acc_x.toFixed(2)}, ${latestPt.acc_y.toFixed(2)}, ${latestPt.acc_z.toFixed(2)} g` : '-'}</span></div>
              <div className="d-flex justify-content-between py-1 border-bottom"><span className="frame-note m-0">ECG Signal</span><span className="mini-value" style={{ color: '#9C27B0' }}>{latestPt ? `${latestPt.ecg} µV` : '-'}</span></div>
              <div className="d-flex justify-content-between py-1 border-bottom"><span className="frame-note m-0">Context confidence</span><span className="mini-value">{typeof selectedParticipant.contextConfidence === 'number' ? (selectedParticipant.contextConfidence * 100).toFixed(0) : '0'}%</span></div>
              <div className="d-flex justify-content-between py-1 border-bottom"><span className="frame-note m-0">Baseline</span><span className="mini-value" style={{ color: 'var(--blue)' }}>{selectedParticipant.baselineMaturity || 'provisional'}</span></div>
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
