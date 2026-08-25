import React, { useState, useEffect, useMemo } from 'react';
import { EvidenceBadge } from '../components/common/EvidenceBadge';
import { StateBadge } from '../components/common/StateBadge';
import { Users, Activity, AlertTriangle, ArrowRight, ShieldCheck, Search, Database, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import Pagination from '../components/Pagination';

export const CohortOverviewView = ({ 
  participants, 
  onSelectParticipant, 
  onNavigate,
  globalParticipantFilter
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [episodeAnalysisData, setEpisodeAnalysisData] = useState([]);
  const [loadingEpAnalysis, setLoadingEpAnalysis] = useState(false);
  // Pasien yang dipilih untuk tabel analisis di bawah (independen dari globalParticipantFilter)
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  const [currentPagePatients, setCurrentPagePatients] = useState(1);
  const [currentPageEvents, setCurrentPageEvents] = useState(1);
  const itemsPerPage = 10;

  // Fungsi fetch data analisis untuk pasien tertentu
  const fetchAnalysis = (pId) => {
    const target = (pId && pId !== 'ALL') ? pId : 'ALL';
    setLoadingEpAnalysis(true);
    api.getEpisodeAnalysis(target)
      .then(data => {
        setEpisodeAnalysisData(Array.isArray(data) ? data : []);
        setLoadingEpAnalysis(false);
      })
      .catch(() => {
        setEpisodeAnalysisData([]);
        setLoadingEpAnalysis(false);
      });
  };

  // Load analisis awal berdasarkan global filter
  useEffect(() => {
    const pId = (globalParticipantFilter && globalParticipantFilter !== 'ALL') ? globalParticipantFilter : null;
    setSelectedPatientId(pId);
    fetchAnalysis(pId || 'ALL');
  }, [globalParticipantFilter]);

  const filteredByGlobal = useMemo(() => {
    return participants.filter(p => {
      if (globalParticipantFilter && globalParticipantFilter !== 'ALL' && p.id !== globalParticipantFilter && p._id !== globalParticipantFilter) return false;
      return true;
    });
  }, [participants, globalParticipantFilter]);

  useEffect(() => {
    console.log('[CohortOverviewView] API Data (Participants):', participants);
  }, [participants]);

  const activeCount = filteredByGlobal.length;
  const evaluableCount = filteredByGlobal.filter(p => p.evidenceState === 'EVALUABLE').length;
  const activeEpisodesCount = filteredByGlobal.filter(p => ['PERSISTENT_DEVIATION', 'DEVIATION_CANDIDATE', 'RECOVERY'].includes(p.physiologicalState)).length;
  const qualityWarningsCount = filteredByGlobal.filter(p => p.evidenceState === 'QUALITY_WARNING' || p.evidenceState === 'UNCERTAIN_CONTEXT').length;

  const filteredPatients = useMemo(() => {
    let sorted = [...filteredByGlobal].sort((a, b) => {
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
  }, [filteredByGlobal, searchQuery]);

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 16, marginBottom: 20 }}>
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

      {/* Participants List */}
      <div className="card-panel mb-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="mini-label">Prioritas Triase Pasien</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>Participants List</div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="var(--gray)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Cari nama pasien..." 
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPagePatients(1); }}
                style={{ padding: '6px 12px 6px 30px', borderRadius: 20, border: '1px solid var(--line)', fontSize: 12, outline: 'none', minWidth: 220 }}
              />
            </div>
            
            <button className="btn-outline-navy" onClick={() => onNavigate('live-monitor')}>
              <span>Lihat Semua Stream</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

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
                filteredPatients.slice((currentPagePatients - 1) * itemsPerPage, currentPagePatients * itemsPerPage).map((p) => (
                  <tr
                    key={p.id}
                    style={{
                      background: selectedPatientId === p.id ? 'rgba(8,127,122,0.06)' : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
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
                      {p.physiologicalState === 'PERSISTENT_DEVIATION' ? 'PERSISTENT' :
                       p.physiologicalState === 'RECOVERY' ? 'RECOVERING' : 'MONITORING'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn-outline-navy"
                          style={{ padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
                          onClick={() => onSelectParticipant(p.id)}
                        >
                          Inspect
                        </button>
                        <button
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            whiteSpace: 'nowrap',
                            background: selectedPatientId === p.id ? 'var(--teal)' : 'transparent',
                            color: selectedPatientId === p.id ? '#fff' : 'var(--teal)',
                            border: '1px solid var(--teal)',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                          onClick={() => {
                            const pid = p.id || p._id;
                            setSelectedPatientId(pid);
                            setCurrentPageEvents(1);
                            fetchAnalysis(pid);
                          }}
                        >
                          {selectedPatientId === (p.id || p._id) ? '✓ Analisis' : 'Lihat Analisis'}
                        </button>
                      </div>
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
        <Pagination 
          currentPage={currentPagePatients}
          totalPages={Math.ceil(filteredPatients.length / itemsPerPage)}
          onPageChange={setCurrentPagePatients}
          totalItems={filteredPatients.length}
          pageSize={itemsPerPage}
        />
      </div>

      {/* Episode Analysis Data Overview Table */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="mini-label" style={{ color: 'var(--teal)' }}>DATA EPISODE ANALISIS &amp; AUDIT DEVIASI</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)' }}>
              Episode Analysis Overview — Candidate &amp; Persistent Detailed Breakdown
            </div>
            {selectedPatientId && (
              <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 3, fontWeight: 600 }}>
                Menampilkan data untuk: <strong>{participants.find(p => p.id === selectedPatientId || p._id === selectedPatientId)?.name || selectedPatientId}</strong>
              </div>
            )}
          </div>
          <div className="d-flex gap-2 align-items-center">
            <span className="badge bg-navy text-white px-2 py-1" style={{ fontSize: 11 }}>
              <Database size={12} className="me-1" />
              {episodeAnalysisData.length} Records
            </span>
            {selectedPatientId && (
              <button
                style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => { setSelectedPatientId(null); fetchAnalysis('ALL'); }}
              >
                <RefreshCw size={11} /> Tampilkan Semua
              </button>
            )}
          </div>
        </div>

        <div className="table-responsive" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="dtable w-100" style={{ fontSize: '0.83rem' }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Waktu Window (Start - End)</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Konteks / Aktivitas</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Evidence State</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Physiological State</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Anomaly Score</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Quality &amp; Noise</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Biometric (HR / RMSSD / SDNN / DFA)</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Prediksi (E1-E6)</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Z-Scores Breakdown (z_E4)</th>
              </tr>
            </thead>
            <tbody>
              {loadingEpAnalysis ? (
                <tr>
                  <td colSpan="9" className="text-center py-4 text-muted">Memuat data analisis...</td>
                </tr>
              ) : episodeAnalysisData.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ fontSize: 13, color: 'var(--gray)', fontWeight: 600 }}>
                      {selectedPatientId
                        ? 'Belum ada data EpisodeAnalysis untuk pasien ini.'
                        : 'Pilih pasien dengan klik "Lihat Analisis" untuk melihat data.'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 4 }}>
                      {selectedPatientId && 'Data akan otomatis ter-sync dari AnomalyEvent saat endpoint dipanggil.'}
                    </div>
                  </td>
                </tr>
              ) : (
                episodeAnalysisData.slice((currentPageEvents - 1) * itemsPerPage, currentPageEvents * itemsPerPage).map((row, idx) => (
                  <tr key={row._id || idx}>
                    <td className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
                      {(() => {
                        let st = row.createdAt || row.start_time;
                        if (st && typeof st === 'object' && st.$date) st = st.$date;
                        if (typeof st === 'number' && st < 20000000000) st *= 1000;
                        if (typeof st === 'string' && st.endsWith('Z')) st = st.replace('Z', '');
                        
                        let et = row.updatedAt || row.end_time;
                        if (et && typeof et === 'object' && et.$date) et = et.$date;
                        if (typeof et === 'number' && et < 20000000000) et *= 1000;
                        if (typeof et === 'string' && et.endsWith('Z')) et = et.replace('Z', '');
                        
                        const sStr = st ? new Date(st).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':') : '-';
                        const eStr = et ? new Date(et).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':') : '-';
                        return `${sStr} - ${eStr}`;
                      })()}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{row.context || row.activity || 'sitting'}</td>
                    <td><EvidenceBadge state={row.evidence_state} /></td>
                    <td><StateBadge state={row.physiological_state} /></td>
                    <td className="mono" style={{ fontWeight: 800, color: row.anomaly_score >= 2.0 ? 'var(--red)' : 'var(--navy)' }}>
                      {typeof row.anomaly_score === 'number' ? row.anomaly_score.toFixed(3) : '-'}
                      <div style={{ fontSize: 9.5, color: 'var(--gray)', fontWeight: 400 }}>τin: {row.tau_in || 1.5}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>
                        Clean: {typeof row.quality_score === 'number' ? (row.quality_score * 100).toFixed(1) : 91.4}%
                      </div>
                      <div style={{ fontSize: 10, color: '#E53935' }}>
                        Noise: {typeof row.artifact_fraction === 'number' ? (row.artifact_fraction * 100).toFixed(1) : 14.0}%
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: 11 }}>
                      <div>HR: {typeof row.hr_mean === 'number' ? row.hr_mean.toFixed(1) : '-'} BPM</div>
                      <div style={{ color: 'var(--gray)' }}>RMSSD: {typeof row.rmssd === 'number' ? row.rmssd.toFixed(1) : '-'} ms · SDNN: {typeof row.sdnn === 'number' ? row.sdnn.toFixed(1) : '-'} ms</div>
                    </td>
                    <td>
                      <span className="mono fw-bold me-1" style={{ color: row.result_E6 === 'TP' ? 'var(--red)' : 'var(--green)' }}>
                        {row.result_E6 || 'TN'}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--purple)', fontWeight: 600 }}>
                        {row.predicted_state_E6 || row.physiological_state}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 10.5 }}>
                      {row.z_E4 ? (
                        <div>
                          <span>HR:{row.z_E4.hr_mean}</span> · <span style={{ color: row.z_E4.rmssd <= -1.5 ? 'var(--red)' : 'inherit' }}>RMSSD:{row.z_E4.rmssd}</span>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination 
          currentPage={currentPageEvents}
          totalPages={Math.ceil(episodeAnalysisData.length / itemsPerPage)}
          onPageChange={setCurrentPageEvents}
          totalItems={episodeAnalysisData.length}
          pageSize={itemsPerPage}
        />
      </div>
    </div>
  );
};
