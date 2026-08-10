import React, { useState, useEffect, useMemo } from 'react';
import { EvidenceBadge } from '../components/common/EvidenceBadge';
import { StateBadge } from '../components/common/StateBadge';
import { Users, Activity, AlertTriangle, ArrowRight, ShieldCheck, Search } from 'lucide-react';

export const CohortOverviewView = ({ participants, onSelectParticipant, onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    console.log('[CohortOverviewView] API Data (Participants):', participants);
  }, [participants]);

  const activeCount = participants.length;
  const evaluableCount = participants.filter(p => p.evidenceState === 'EVALUABLE').length;
  const activeEpisodesCount = participants.filter(p => ['PERSISTENT_DEVIATION', 'DEVIATION_CANDIDATE', 'RECOVERY'].includes(p.physiologicalState)).length;
  const qualityWarningsCount = participants.filter(p => p.evidenceState === 'QUALITY_WARNING' || p.evidenceState === 'UNCERTAIN_CONTEXT').length;

  const filteredPatients = useMemo(() => {
    let sorted = [...participants].sort((a, b) => {
      const aNeedsAttention = ['PERSISTENT_DEVIATION', 'DEVIATION_CANDIDATE', 'UNRESOLVED'].includes(a.physiologicalState) || ['QUALITY_WARNING', 'UNCERTAIN_CONTEXT'].includes(a.evidenceState);
      const bNeedsAttention = ['PERSISTENT_DEVIATION', 'DEVIATION_CANDIDATE', 'UNRESOLVED'].includes(b.physiologicalState) || ['QUALITY_WARNING', 'UNCERTAIN_CONTEXT'].includes(b.evidenceState);
      if (aNeedsAttention && !bNeedsAttention) return -1;
      if (!aNeedsAttention && bNeedsAttention) return 1;
      return 0;
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      sorted = sorted.filter(p => (p.name || p.email || p.id || '').toLowerCase().includes(q));
    }
    return sorted;
  }, [participants, searchQuery]);

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Cohort Overview — Executive Observability</h1>
        <p className="page-sub">
          Ringkasan operasional dataset penelitian, status readiness evidence, dan peserta yang memerlukan atensi reviewer.
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="lbl">Active Users</div>
            <Users size={16} color="var(--navy)" />
          </div>
          <div className="val">{activeCount}</div>
          <div className="sub">Cohort Population</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="lbl">Evaluable Data</div>
            <ShieldCheck size={16} color="var(--green)" />
          </div>
          <div className="val" style={{ color: 'var(--green)' }}>{evaluableCount}</div>
          <div className="sub">{((evaluableCount / (activeCount || 1)) * 100).toFixed(0)}% quality gate passed</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="lbl">Active Episodes</div>
            <Activity size={16} color="var(--red)" />
          </div>
          <div className="val" style={{ color: 'var(--red)' }}>{activeEpisodesCount}</div>
          <div className="sub">{participants.filter(p => p.physiologicalState === 'PERSISTENT_DEVIATION').length} persistent · {participants.filter(p => p.physiologicalState === 'DEVIATION_CANDIDATE').length} candidate</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="lbl">Quality Warnings</div>
            <AlertTriangle size={16} color="var(--amber)" />
          </div>
          <div className="val" style={{ color: 'var(--amber)' }}>{qualityWarningsCount}</div>
          <div className="sub">Data readiness issues</div>
        </div>
      </div>

      {/* State Distribution Stack */}
      <div className="card-panel" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="mini-label">Physiological State Distribution</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginTop: 2 }}>Distribusi Kondisi Peserta Saat Ini</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--gray)' }}>Cohort: Pilot-01</div>
        </div>

        {(() => {
          const denom = activeCount || 1;
          const pct = (val) => ((val / denom) * 100).toFixed(0);
          
          const counts = {
            base: participants.filter(p => p.physiologicalState === 'BASELINE_COMPATIBLE').length,
            cand: participants.filter(p => p.physiologicalState === 'DEVIATION_CANDIDATE').length,
            pers: participants.filter(p => p.physiologicalState === 'PERSISTENT_DEVIATION').length,
            recov: participants.filter(p => p.physiologicalState === 'RECOVERY').length,
            unres: participants.filter(p => p.physiologicalState === 'UNRESOLVED').length
          };

          return (
            <>
              <div className="state-dist" style={{ height: 12, display: 'flex', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ width: `${pct(counts.base)}%`, background: 'var(--green)' }} title={`BASELINE COMPATIBLE (${pct(counts.base)}%)`}></div>
                <div style={{ width: `${pct(counts.cand)}%`, background: 'var(--amber)' }} title={`DEVIATION CANDIDATE (${pct(counts.cand)}%)`}></div>
                <div style={{ width: `${pct(counts.pers)}%`, background: 'var(--red)' }} title={`PERSISTENT DEVIATION (${pct(counts.pers)}%)`}></div>
                <div style={{ width: `${pct(counts.recov)}%`, background: 'var(--purple)' }} title={`RECOVERY (${pct(counts.recov)}%)`}></div>
                <div style={{ width: `${pct(counts.unres)}%`, background: 'var(--gray)' }} title={`UNRESOLVED (${pct(counts.unres)}%)`}></div>
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} /><span>Baseline Compatible ({pct(counts.base)}%)</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} /><span>Candidate ({pct(counts.cand)}%)</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} /><span>Persistent ({pct(counts.pers)}%)</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--purple)' }} /><span>Recovery ({pct(counts.recov)}%)</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gray)' }} /><span>Unresolved ({pct(counts.unres)}%)</span></div>
              </div>
            </>
          );
        })()}
      </div>

      {/* Participants Requiring Attention / Searchable List */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="mini-label">Prioritas Triase Pasien</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>Participants List</div>
          </div>
          
          {/* Search Input from backoffice */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="var(--gray)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Cari nama pasien..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '6px 12px 6px 30px', borderRadius: 20, border: '1px solid var(--line)', fontSize: 12, outline: 'none', minWidth: 220 }}
              />
            </div>
            
            <button className="btn-outline-navy" onClick={() => onNavigate('live-monitor')}>
              <span>Lihat Semua Stream</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Responsive Table Wrapper */}
        <div className="table-responsive">
          <table className="dtable">
            <thead>
              <tr>
                <th>ID / Name</th>
                <th>Context</th>
                <th>Evidence Readiness</th>
                <th>Physiological State</th>
                <th>Anomaly Score</th>
                <th>Prediction Target</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.length > 0 ? (
                filteredPatients.map((p) => (
                  <tr key={p.id}>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--navy)' }}>
                      <div>{p.name || p.email || p.id}</div>
                      <div style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 400 }}>{p.id}</div>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{p.context}</td>
                    <td><EvidenceBadge state={p.evidenceState} /></td>
                    <td><StateBadge state={p.physiologicalState} /></td>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {p.anomalyScore ? p.anomalyScore.toFixed(2) : '-'}
                    </td>
                    <td style={{ fontSize: 11.5, color: 'var(--purple)', fontWeight: 600 }}>
                      {p.physiologicalState === 'PERSISTENT_DEVIATION' ? 'RECOVERY 61% (in 20m)' :
                       p.physiologicalState === 'RECOVERY' ? 'RECOVERED 78%' : 'MONITORING'}
                    </td>
                    <td>
                      <button
                        className="btn-outline-navy"
                        style={{ padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
                        onClick={() => onSelectParticipant(p.id)}
                      >
                        Inspect Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray)' }}>
                    Tidak ada pasien yang cocok dengan pencarian Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
