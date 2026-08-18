import React from 'react';
import { EvidenceBadge } from '../components/common/EvidenceBadge';
import { StateBadge } from '../components/common/StateBadge';
import { Users, Activity, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';

export const CohortOverviewView = ({ participants, onSelectParticipant, onNavigate }) => {
  const activeCount = participants.length;
  const evaluableCount = participants.filter(p => p.evidenceState === 'EVALUABLE').length;
  const activeEpisodesCount = participants.filter(p => ['PERSISTENT_DEVIATION', 'DEVIATION_CANDIDATE', 'RECOVERY'].includes(p.physiologicalState)).length;
  const qualityWarningsCount = participants.filter(p => p.evidenceState === 'QUALITY_WARNING' || p.evidenceState === 'UNCERTAIN_CONTEXT').length;

  const requiringAttention = participants.filter(p =>
    ['PERSISTENT_DEVIATION', 'DEVIATION_CANDIDATE', 'UNRESOLVED'].includes(p.physiologicalState) ||
    ['QUALITY_WARNING', 'UNCERTAIN_CONTEXT'].includes(p.evidenceState)
  );

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
          <div className="sub">25 connected · 3 offline</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="lbl">Evaluable Data</div>
            <ShieldCheck size={16} color="var(--green)" />
          </div>
          <div className="val" style={{ color: 'var(--green)' }}>{evaluableCount}</div>
          <div className="sub">{(evaluableCount / activeCount * 100).toFixed(0)}% quality gate passed</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="lbl">Active Episodes</div>
            <Activity size={16} color="var(--red)" />
          </div>
          <div className="val" style={{ color: 'var(--red)' }}>{activeEpisodesCount}</div>
          <div className="sub">2 persistent · 1 candidate</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="lbl">Quality Warnings</div>
            <AlertTriangle size={16} color="var(--amber)" />
          </div>
          <div className="val" style={{ color: 'var(--amber)' }}>{qualityWarningsCount}</div>
          <div className="sub">3 low signal · 2 context conflict</div>
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

        <div className="state-dist" style={{ height: 12, display: 'flex', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ width: '45%', background: 'var(--green)' }} title="BASELINE COMPATIBLE (45%)"></div>
          <div style={{ width: '15%', background: 'var(--amber)' }} title="DEVIATION CANDIDATE (15%)"></div>
          <div style={{ width: '15%', background: 'var(--red)' }} title="PERSISTENT DEVIATION (15%)"></div>
          <div style={{ width: '15%', background: 'var(--purple)' }} title="RECOVERY (15%)"></div>
          <div style={{ width: '10%', background: 'var(--gray)' }} title="UNRESOLVED (10%)"></div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} /><span>Baseline Compatible (45%)</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} /><span>Candidate (15%)</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} /><span>Persistent (15%)</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--purple)' }} /><span>Recovery (15%)</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gray)' }} /><span>Unresolved (10%)</span></div>
        </div>
      </div>

      {/* Participants Requiring Attention */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="mini-label">Action Required</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>Participants Requiring Reviewer Attention</div>
          </div>
          <button className="btn-outline-navy" onClick={() => onNavigate('live-monitor')}>
            <span>Lihat Semua Stream</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Responsive Table Wrapper */}
        <div className="table-responsive">
          <table className="dtable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Context</th>
                <th>Evidence Readiness</th>
                <th>Physiological State</th>
                <th>Anomaly Score</th>
                <th>Prediction Target</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requiringAttention.map((p) => (
                <tr key={p.id}>
                  <td className="mono" style={{ fontWeight: 700, color: 'var(--navy)' }}>{p.id}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
