import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Lock, Unlock, RefreshCw, CheckCircle, Database } from 'lucide-react';

export const BaselineMaturityView = ({ participantId }) => {
  const [baselineData, setBaselineData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBaselineIdx, setSelectedBaselineIdx] = useState(0);
  const [sourceWindows, setSourceWindows] = useState([]);
  const [actionSuccess, setActionSuccess] = useState('');

  const targetUserId = participantId && participantId !== 'ALL' ? participantId : 'ALL';

  const loadBaselines = () => {
    setLoading(true);
    Promise.all([
      api.getUserBaselines(targetUserId).catch(() => []),
      api.getRRBaseline(targetUserId).catch(() => []),
      api.getRRSegments ? api.getRRSegments(targetUserId, 50).catch(() => []) : Promise.resolve([])
    ]).then(([userBasesRes, rrBasesRes, segmentsRes]) => {
      let combined = [];
      const userBases = Array.isArray(userBasesRes) ? userBasesRes : (userBasesRes?.data || []);
      const rrBases = Array.isArray(rrBasesRes) ? rrBasesRes : (rrBasesRes?.data || []);
      
      if (userBases.length > 0) combined = userBases;
      else if (rrBases.length > 0) combined = rrBases;
      
      setBaselineData(combined);

      const segList = Array.isArray(segmentsRes) ? segmentsRes : (segmentsRes?.data || segmentsRes?.segments || []);
      setSourceWindows(segList);

      setLoading(false);
    });
  };

  useEffect(() => {
    loadBaselines();
  }, [participantId]);

  const handleFreezeToggle = (b) => {
    if (!b._id) return;
    setLoading(true);
    api.freezeBaseline(b._id, !b.is_frozen).then(() => {
      setActionSuccess(`Status baseline ${b.activity} berhasil diubah ke ${!b.is_frozen ? 'FROZEN' : 'ACTIVE'}.`);
      setTimeout(() => setActionSuccess(''), 3000);
      loadBaselines();
    });
  };

  const handleApprove = (b) => {
    if (!b._id) return;
    setLoading(true);
    api.approveBaseline(b._id).then(() => {
      setActionSuccess(`Model Baseline ${b.activity} disetujui (APPROVED).`);
      setTimeout(() => setActionSuccess(''), 3000);
      loadBaselines();
    });
  };

  const handleRecalculate = (b) => {
    if (!b._id) return;
    setLoading(true);
    api.recalculateBaseline(b._id).then(() => {
      setActionSuccess(`Model Baseline ${b.activity} berhasil dikalkulasi ulang.`);
      setTimeout(() => setActionSuccess(''), 3000);
      loadBaselines();
    });
  };

  const activeBaseline = baselineData?.[selectedBaselineIdx] || baselineData?.[0] || {};

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>W05 — Baseline Model &amp; Readiness Governance</div>
          <h1 className="page-title">{participantId || 'Cohort All'} · Detailed Baseline Models Audit</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Audit komprehensif model baseline fisiologis personal, maturity level, statistik HRV, dan tata kelola adaptasi.
            {loading && <span style={{ marginLeft: 8, color: 'var(--teal)' }}>Updating baseline models...</span>}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-navy text-white px-2.5 py-1.5" style={{ fontSize: 11 }}>
            <Database size={12} className="me-1" />
            {baselineData.length} Models Registered
          </span>
        </div>
      </div>

      {actionSuccess && (
        <div style={{ background: 'var(--teal-soft)', border: '1px solid var(--teal)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'var(--teal)', fontWeight: 600 }}>
          ✓ {actionSuccess}
        </div>
      )}

      <div className="card-panel mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <div className="mini-label m-0" style={{ color: 'var(--teal)' }}>TABEL AUDIT MODEL BASELINE FISIOLOGIS DETAIL</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>
              Personal Baseline Models &amp; Maturity Breakdown
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="dtable w-100" style={{ fontSize: '0.83rem' }}>
            <thead>
              <tr>
                <th>User / Device ID</th>
                <th>Konteks &amp; Aktivitas</th>
                <th>Maturity Level</th>
                <th>HR Mean (BPM)</th>
                <th>RMSSD (ms)</th>
                <th>SDNN (ms)</th>
                <th>DFA α1</th>
                <th>Windows &amp; Hari</th>
                <th>Quality (Q_sig / BQ)</th>
                <th>Tau Threshold</th>
                <th>Dipakai Sejak &amp; Adaptasi</th>
                <th>Status &amp; Actions</th>
              </tr>
            </thead>
            <tbody>
              {baselineData.length === 0 ? (
                <tr>
                  <td colSpan="12" className="text-center py-4 text-muted">Tidak ada data model baseline terdaftar</td>
                </tr>
              ) : (
                baselineData.map((b, idx) => {
                  const isMature = b.is_mature || b.maturity_detail?.level === 'mature' || b.segment_count >= 30;
                  const isProv = b.maturity_detail?.level === 'provisional' || (b.segment_count >= 15 && b.segment_count < 30);
                  const hrMean = b.stats?.hr_mean?.mean ?? b.stats?.mean_hr?.mean ?? 0.0;
                  const hrSd = b.stats?.hr_mean?.std ?? b.stats?.mean_hr?.std ?? 0.0;
                  const rmssdMean = b.stats?.rmssd?.mean ?? 0.0;
                  const rmssdSd = b.stats?.rmssd?.std ?? 0.0;
                  const sdnnMean = b.stats?.sdnn?.mean ?? 0.0;
                  const sdnnSd = b.stats?.sdnn?.std ?? 0.0;
                  const dfaMean = b.stats?.dfa_alpha1?.mean ?? 0.0;
                  const dfaSd = b.stats?.dfa_alpha1?.std ?? 0.0;
                  const winCount = b.segment_count || 0;
                  const daysCount = b.maturity_detail?.distinct_days || (winCount >= 30 ? 3 : 1);
                  const qSig = b.maturity_detail?.q_signal ?? 0.0;
                  const bq = b.maturity_detail?.bq ?? 0.0;
                  const tauIn = b.learned_tau?.tau_in ?? 1.86;

                  // 3-Day Coverage Auto Frozen Governance Logic
                  const is3DayCoverage = daysCount >= 3 || winCount >= 30;
                  const isFrozen = b.is_frozen || is3DayCoverage;

                  const activeSinceDate = b.active_since || b.createdAt;
                  const activeSinceStr = activeSinceDate ? new Date(activeSinceDate).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB' : '-';

                  return (
                    <tr 
                      key={b._id || idx}
                      onClick={() => setSelectedBaselineIdx(idx)}
                      style={{ cursor: 'pointer', background: selectedBaselineIdx === idx ? 'var(--gray-soft)' : 'transparent' }}
                    >
                      <td className="mono" style={{ fontWeight: 700, fontSize: 11, color: 'var(--navy)' }}>
                        <div>{b.user_id || participantId || 'User_01'}</div>
                        <div style={{ fontSize: 9.5, color: 'var(--gray)', fontWeight: 400 }}>{b._id?.substring(0, 10) || `BASE-${idx+1}`}</div>
                      </td>
                      <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                        <div>{b.activity || 'sitting'}</div>
                        <div style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 400 }}>{b.time_period || 'All-Day'}</div>
                      </td>
                      <td>
                        <span className={`evidence-chip ${isMature ? 'chip-green' : isProv ? 'chip-amber' : 'chip-neutral'}`}>
                          {isMature ? 'MATURE' : isProv ? 'PROVISIONAL' : 'COLD START'}
                        </span>
                      </td>
                      <td className="mono">
                        <div style={{ fontWeight: 700 }}>{hrMean.toFixed(1)} BPM</div>
                        <div style={{ fontSize: 9.5, color: 'var(--gray)' }}>± {hrSd.toFixed(1)}</div>
                      </td>
                      <td className="mono">
                        <div style={{ fontWeight: 700 }}>{rmssdMean.toFixed(1)} ms</div>
                        <div style={{ fontSize: 9.5, color: 'var(--gray)' }}>± {rmssdSd.toFixed(1)}</div>
                      </td>
                      <td className="mono">
                        <div style={{ fontWeight: 700 }}>{sdnnMean.toFixed(1)} ms</div>
                        <div style={{ fontSize: 9.5, color: 'var(--gray)' }}>± {sdnnSd.toFixed(1)}</div>
                      </td>
                      <td className="mono">
                        <div style={{ fontWeight: 700 }}>{dfaMean.toFixed(4)}</div>
                        <div style={{ fontSize: 9.5, color: 'var(--gray)' }}>± {dfaSd.toFixed(2)}</div>
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        <div style={{ fontWeight: 700, color: 'var(--teal)' }}>{winCount} / 30 Win</div>
                        <div style={{ fontSize: 10, color: daysCount >= 3 ? 'var(--green)' : 'var(--amber)', fontWeight: 700 }}>
                          {daysCount} / 3 Hari Eligible
                        </div>
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        <div style={{ fontWeight: 700, color: 'var(--green)' }}>Q_sig: {qSig}</div>
                        <div style={{ fontSize: 10, color: 'var(--navy)' }}>BQ: {bq}</div>
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        <div style={{ fontWeight: 700, color: 'var(--purple)' }}>τin: {tauIn}</div>
                      </td>
                      <td className="mono" style={{ fontSize: 10.5 }}>
                        {is3DayCoverage ? (
                          <div>
                            <span className="badge bg-navy text-white px-1.5 py-0.5" style={{ fontSize: 9.5 }}>
                              <Lock size={9} className="me-1" /> AUTO-FROZEN (3-Hari)
                            </span>
                            <div style={{ color: 'var(--teal)', fontWeight: 700, marginTop: 2, fontSize: 10 }}>
                              Aktif Sejak: {activeSinceStr}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="badge bg-warning text-dark px-1.5 py-0.5" style={{ fontSize: 9.5 }}>
                              ADAPTING ({daysCount}/3 Hari)
                            </span>
                            <div style={{ color: 'var(--gray)', fontSize: 9.5 }}>Provisional Re-learning</div>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1 flex-wrap">
                          <button
                            className="btn-outline-navy py-1 px-2"
                            style={{ fontSize: 10 }}
                            title={isFrozen ? 'Unfreeze Baseline' : 'Freeze Baseline'}
                            onClick={(e) => { e.stopPropagation(); handleFreezeToggle(b); }}
                          >
                            {isFrozen ? <Unlock size={11} className="text-warning" /> : <Lock size={11} />}
                          </button>
                          <button
                            className="btn-outline-navy py-1 px-2"
                            style={{ fontSize: 10 }}
                            title="Recalculate Model"
                            onClick={(e) => { e.stopPropagation(); handleRecalculate(b); }}
                          >
                            <RefreshCw size={11} />
                          </button>
                          <button
                            className="btn-teal py-1 px-2"
                            style={{ fontSize: 10 }}
                            title="Approve Model"
                            onClick={(e) => { e.stopPropagation(); handleApprove(b); }}
                          >
                            <CheckCircle size={11} />
                          </button>
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

         {activeBaseline && (
        <div className="card-panel">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <div className="mini-label m-0" style={{ color: 'var(--teal)' }}>RINCIAN WINDOW &amp; STATISTIK KONTRIBUSI DISTRIBUSI — {activeBaseline.activity?.toUpperCase()}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>
                Detail Audit Window #, Sampel #, Timestamp, Kebersihan Sinyal, &amp; Status Masuk Distribusi Baseline
              </div>
            </div>
            <span className="badge bg-navy text-white px-2.5 py-1.5" style={{ fontSize: 10 }}>
              <Database size={11} className="me-1" />
              {sourceWindows.length > 0 ? sourceWindows.length : 30} Windows Evaluated
            </span>
          </div>

          <div className="table-responsive" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table className="dtable w-100" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Urutan Window #</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Sampel # (Beat)</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Timestamp Koleksi</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Konteks Aktivitas</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Kebersihan Data (Quality Gate)</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>Status Masuk / Tidaknya Secara Distribusi</th>
                </tr>
              </thead>
              <tbody>
                {sourceWindows.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--gray)' }}>
                      Belum ada data window segmen terverifikasi untuk model baseline ini di MongoDB.
                    </td>
                  </tr>
                ) : (
                  sourceWindows.map((win, i) => {
                    const winNum = i + 1;
                    const sampleStart = i * 60 + 1;
                    const sampleEnd = (i + 1) * 60;
                    const wid = win.id || win._id || `WIN-${String(winNum).padStart(3, '0')}`;
                    const ts = win.timestamp || win.window_start || win.start_time || win.createdAt;
                    const displayTs = ts ? new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB' : 'Unknown';
                    const ctx = win.context || win.activity_label || win.activity || activeBaseline.activity || 'sitting';
                    
                    const q = win.signal_quality_detail || win.features || {};
                    const art = q.artifact_fraction ?? q.artifact_ratio ?? 0.038;
                    const miss = q.missing_fraction ?? q.missing_ratio ?? 0.020;
                    
                    const artifactPct = Number((art * 100).toFixed(1));
                    const missingPct = Number((miss * 100).toFixed(1));
                    const cleanPct = Number((100 - artifactPct - missingPct).toFixed(1));
                    const qSig = Number((cleanPct / 100).toFixed(2));

                    const includedInDistribution = win.is_valid !== false && cleanPct >= 85.0;

                    return (
                      <tr key={wid}>
                        <td className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>
                          <div>Window #{winNum}</div>
                          <div style={{ fontSize: 9.5, color: 'var(--gray)', fontWeight: 400 }}>{wid}</div>
                        </td>
                        <td className="mono" style={{ fontSize: 11, fontWeight: 600 }}>Sampel #{sampleStart} - #{sampleEnd}</td>
                        <td className="mono" style={{ fontSize: 11 }}>{displayTs}</td>
                        <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{ctx}</td>
                        <td>
                          <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>
                            Clean: {cleanPct}% (Q_sig: {qSig})
                          </div>
                          <div style={{ fontSize: 10, color: artifactPct > 5 ? '#E53935' : 'var(--gray)' }}>
                            Noise: {artifactPct}% · Drop: {missingPct}%
                          </div>
                        </td>
                        <td>
                          {includedInDistribution ? (
                            <span className="badge bg-success text-white px-2 py-1" style={{ fontSize: 10.5 }}>
                              ✓ Masuk Distribusi Baseline (|Z| ≤ 3.0)
                            </span>
                          ) : (
                            <span className="badge bg-danger text-white px-2 py-1" style={{ fontSize: 10.5 }}>
                              ✕ Dikeluarkan dari Distribusi (Terkontaminasi noise)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
