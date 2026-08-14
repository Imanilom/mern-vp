import React, { useState } from 'react';
import { EvidenceBadge } from '../components/common/EvidenceBadge';
import { StateBadge } from '../components/common/StateBadge';
import {
  Sliders,
  Battery,
  X,
  Pin,
  PinOff,
  Activity,
  AlertTriangle,
  Clock,
  Radio
} from 'lucide-react';

export const LiveMonitorView = ({ participants }) => {
  const [filterEvidence, setFilterEvidence] = useState('ALL');
  const [filterState, setFilterState] = useState('ALL');
  const [selectedParticipant, setSelectedParticipant] = useState(participants[0] || null);
  const [pinnedIds, setPinnedIds] = useState(['P-014', 'P-027']);

  const togglePin = (id, e) => {
    e.stopPropagation();
    setPinnedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filtered = participants.filter(p => {
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
        <h1 className="page-title">W01. Live Monitor — Near-Real-Time Observability</h1>
        <p className="page-sub">
          Observabilitas kohort dan sinyal peserta secara near-real-time: signal &rarr; evidence &rarr; state.
        </p>
      </div>

      {/* KPI Cards Row (W01 Addendum) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 18 }}>
        <div className="card-panel" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Connected participants</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)', margin: '4px 0' }}>18</div>
          <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>16 evaluable · 2 paused</div>
        </div>

        <div className="card-panel" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Quality warnings</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--amber)', margin: '4px 0' }}>2</div>
          <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>last 15 minutes</div>
        </div>

        <div className="card-panel" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Active episodes</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--red)', margin: '4px 0' }}>3</div>
          <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>2 persistent · 1 recovery</div>
        </div>

        <div className="card-panel" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Median latency</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy)', margin: '4px 0' }}>4.2 s</div>
          <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>ingestion \(\rightarrow\) state</div>
        </div>
      </div>

      {/* Live Trajectory Hero Panel for Selected Participant (W01 Addendum) */}
      {selectedParticipant && (
        <div className="card-panel" style={{ marginBottom: 18, border: '1px solid var(--teal)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)' }}>
                Participant {selectedParticipant.id} — live trajectory
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray)' }}>
                Context: {selectedParticipant.context || 'sitting'} · evidence EVALUABLE · Polar H10 connected
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <EvidenceBadge state={selectedParticipant.evidenceState} />
              <StateBadge state={selectedParticipant.physiologicalState} />
            </div>
          </div>

          {/* SVG Trajectory Chart with Light Theme and Window Grid */}
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '16px 14px 12px 14px', border: '1px solid var(--line)', color: 'var(--ink)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray)', fontWeight: 700, marginBottom: 6 }}>
              <span>Y-AXIS: ANOMALY SCORE (SD)</span>
              <span>X-AXIS: WINDOW SEQUENCES (W1–W5 · 15m)</span>
            </div>

            <svg viewBox="0 0 500 140" style={{ width: '100%', height: 140, overflow: 'visible' }}>
              {/* Vertical Window Gridlines */}
              <line x1="45" y1="20" x2="45" y2="110" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
              <line x1="150" y1="20" x2="150" y2="110" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
              <line x1="260" y1="20" x2="260" y2="110" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
              <line x1="370" y1="20" x2="370" y2="110" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
              <line x1="480" y1="20" x2="480" y2="110" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />

              {/* Y-Axis Gridlines & Labels */}
              <line x1="45" y1="20" x2="480" y2="20" stroke="#E2E8F0" strokeDasharray="2 2" />
              <text x="38" y="23" fill="#64748B" fontSize="9" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">3.0</text>

              <line x1="45" y1="50" x2="480" y2="50" stroke="#E2E8F0" strokeDasharray="2 2" />
              <text x="38" y="53" fill="#64748B" fontSize="9" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">2.0</text>

              <line x1="45" y1="80" x2="480" y2="80" stroke="#E2E8F0" strokeDasharray="2 2" />
              <text x="38" y="83" fill="#64748B" fontSize="9" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">1.0</text>

              <line x1="45" y1="110" x2="480" y2="110" stroke="#94A3B8" strokeWidth="1.2" />
              <text x="38" y="113" fill="#64748B" fontSize="9" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">0.0</text>

              {/* Threshold Line tau_in (1.86) */}
              <line x1="45" y1="54" x2="480" y2="54" stroke="#DC2626" strokeDasharray="4 4" strokeWidth="1.5" />
              <text x="484" y="57" fill="#DC2626" fontSize="9" fontWeight="bold" fontFamily="JetBrains Mono">tau_in (1.86)</text>

              {/* Trajectory Gradient Fill */}
              <defs>
                <linearGradient id="liveGradLight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#DC2626" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#DC2626" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M 45 105 Q 120 100 180 65 T 320 35 T 420 70 T 480 85 L 480 110 L 45 110 Z" fill="url(#liveGradLight)" />

              {/* Trajectory Stroke Line */}
              <path
                d="M 45 105 Q 120 100 180 65 T 320 35 T 420 70 T 480 85"
                fill="none"
                stroke="#DC2626"
                strokeWidth="2.8"
                strokeLinecap="round"
              />

              {/* X-Axis Ticks & Window Labels */}
              <text x="45" y="126" fill="#1E293B" fontSize="9" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">W1 (13:00)</text>
              <text x="150" y="126" fill="#1E293B" fontSize="9" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">W2 (13:15)</text>
              <text x="260" y="126" fill="#1E293B" fontSize="9" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">W3 (13:30)</text>
              <text x="370" y="126" fill="#1E293B" fontSize="9" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">W4 (13:45)</text>
              <text x="480" y="126" fill="#1E293B" fontSize="9" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">W5 (14:00)</text>
            </svg>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink)' }}>
                State output: <span style={{ background: 'var(--red)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 10 }}>PERSISTENT</span>
                <span style={{ marginLeft: 8, fontWeight: 600 }}>Score 1.62 · 3/4 windows · peak 2.31</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>
                Polar H10 Battery: {selectedParticipant.battery || 76}% · Clock Drift: {selectedParticipant.clockDrift || '0.4s'}
              </div>
            </div>
          </div>
        </div>
      )}

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
              {sortedParticipants.map((p) => {
                const isPinned = pinnedIds.includes(p.id);
                const isSelected = selectedParticipant?.id === p.id;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedParticipant(p)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'var(--teal-soft)' : (isPinned ? '#F8FAFC' : 'transparent')
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
                      {p.anomalyScore !== null ? p.anomalyScore.toFixed(2) : '-'}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      <div style={{ fontWeight: 600 }}>{p.context}</div>
                      <div style={{ fontSize: 10, color: 'var(--gray)' }}>conf: {(p.contextConfidence * 100).toFixed(0)}%</div>
                    </td>
                    <td style={{ fontSize: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Battery size={13} color={p.battery < 20 ? 'var(--red)' : 'var(--green)'} />
                        <span>{p.battery}%</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--gray)' }}>drift: {p.clockDrift}</div>
                    </td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--gray)' }}>
                      {p.lastUpdate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
