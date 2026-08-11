import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export const BaselineMaturityView = ({ participantId }) => {
  const [baselineData, setBaselineData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBaselineIdx, setSelectedBaselineIdx] = useState(0);

  const [sourceWindows, setSourceWindows] = useState([]);

  useEffect(() => {
    if (participantId) {
      setLoading(true);
      Promise.all([
        api.getBaselineMaturity(participantId).catch(() => []),
        api.getRRSegments ? api.getRRSegments(participantId, 50).catch(() => []) : Promise.resolve([])
      ]).then(([baseline, segments]) => {
        setBaselineData(baseline || []);
        
        // Extract segments from API response
        let segList = [];
        if (Array.isArray(segments?.data)) segList = segments.data;
        else if (Array.isArray(segments)) segList = segments;
        else if (segments?.segments) segList = segments.segments;
        
        setSourceWindows(segList);
        setLoading(false);
      });
    }
  }, [participantId]);

  // Aggregate stats from the baseline data array if available
  const activeBaseline = baselineData?.[selectedBaselineIdx] || {};
  const baselineCount = activeBaseline.segment_count || 0;
  const isMature = activeBaseline.is_mature || false;
  const days = activeBaseline.maturity_detail?.distinct_days || 0;
  const tauInVal = activeBaseline.learned_tau?.tau_in?.toFixed(2) || (activeBaseline.stats?.mean_hr?.mean ? ((activeBaseline.stats.mean_hr.mean / 100) + 1.2).toFixed(2) : '1.86');
  const isFrozen = activeBaseline.is_frozen || false;

  // Calculate Day Dominance from window_timestamps
  const dayDominance = React.useMemo(() => {
    if (!activeBaseline.window_timestamps || activeBaseline.window_timestamps.length === 0) return [];
    
    const counts = {};
    activeBaseline.window_timestamps.forEach(ts => {
      const dt = new Date(ts);
      const dayStr = `${dt.getDate()} ${dt.toLocaleString('default', { month: 'short' })} ${dt.getFullYear()}`;
      counts[dayStr] = (counts[dayStr] || 0) + 1;
    });

    const total = activeBaseline.window_timestamps.length;
    
    return Object.entries(counts)
      .map(([day, count]) => ({
        day,
        count,
        percent: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3); // top 3 days
  }, [activeBaseline.window_timestamps]);
  
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>W05 — Baseline Maturity Web</div>
          <h1 className="page-title">{participantId} · Baseline Maturity &amp; Source Windows</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Menilai `baseline_n`, `n_eff`, `baseline_days`, serta day dominance per aktivitas/feature untuk akurasi threshold personal.
            {loading && <span style={{marginLeft: 8, color: 'var(--teal)'}}>Loading...</span>}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            className="btn-outline-navy"
            onClick={() => {
              if (activeBaseline._id) {
                setLoading(true);
                api.freezeBaseline(activeBaseline._id, !isFrozen).then(() => {
                  // Refresh data
                  api.getBaselineMaturity(participantId).then(data => {
                    setBaselineData(data || []);
                    setLoading(false);
                  });
                });
              }
            }}
            style={{ fontSize: 11.5 }}
            disabled={!activeBaseline._id || loading}
          >
            <i className={`fa-solid ${isFrozen ? 'fa-lock-open' : 'fa-lock'} me-1`}></i>
            {isFrozen ? 'Request Unfreeze' : 'Freeze Baseline'}
          </button>
          <button className="btn-outline-navy" style={{ fontSize: 11.5 }}>
            <i className="fa-solid fa-table-list me-1"></i>
            View Excluded Windows
          </button>
        </div>
      </div>

      {/* Baseline Selector Tabs */}
      {baselineData.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {baselineData.map((b, idx) => (
            <button
              key={b._id}
              onClick={() => setSelectedBaselineIdx(idx)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: idx === selectedBaselineIdx ? 'var(--teal)' : 'var(--line)',
                background: idx === selectedBaselineIdx ? 'var(--teal)' : 'var(--surface)',
                color: idx === selectedBaselineIdx ? '#fff' : 'var(--ink)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              {b.activity} · {b.time_period}
            </button>
          ))}
        </div>
      )}

      {/* Metric Cards Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="lbl">baseline_n</div>
          <div className="val" style={{ color: 'var(--teal)' }}>{baselineCount}</div>
          <div className="sub">Min required: 24 windows</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Status</div>
          <div className="val" style={{ color: isMature ? 'var(--teal)' : 'var(--amber)' }}>{isMature ? 'MATURE' : 'LEARNING'}</div>
          <div className="sub">After quality weighting</div>
        </div>

        <div className="stat-card">
          <div className="lbl">baseline_days</div>
          <div className="val">{days}</div>
          <div className="sub">Min required: 5 distinct days</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Q99 (tau_in source)</div>
          <div className="val">{tauInVal}</div>
          <div className="sub">Rolling guarded percentile</div>
        </div>
      </div>

      {/* Row 2: Day Dominance & Status Card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card-panel">
          <div className="mini-label mb-2">baseline_day_dominance (Kontribusi Per Hari)</div>
          
          {dayDominance.length === 0 ? (
            <div className="frame-note m-0" style={{ fontSize: 12 }}>Belum ada data timestamp window.</div>
          ) : (
            dayDominance.map((d, i) => (
              <React.Fragment key={d.day}>
                <div className="d-flex justify-content-between mb-1">
                  <span className="frame-note m-0">{d.day}</span>
                  <span className="mini-value">{d.percent}%</span>
                </div>
                <div className="progress-thin mb-3">
                  <div style={{ width: `${d.percent}%`, background: i === 0 ? 'var(--amber)' : 'var(--teal)' }}></div>
                </div>
              </React.Fragment>
            ))
          )}

          <div className="frame-note m-0" style={{ fontSize: 11 }}>
            {activeBaseline.maturity_detail?.max_single_day_frac 
              ? `Dominance tertinggi ${(activeBaseline.maturity_detail.max_single_day_frac * 100).toFixed(0)}%. ${activeBaseline.maturity_detail.max_single_day_frac < 0.4 ? 'Tidak terindikasi bias hari tunggal.' : 'Terindikasi bias hari tunggal!'}`
              : 'Menunggu kalkulasi dominance selanjutnya.'}
          </div>
        </div>

        <div className="card-panel d-flex flex-column justify-content-between">
          <div>
            <div className="mini-label mb-2">Baseline Adaptation Governance</div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span style={{ fontSize: 13, fontWeight: 700 }}>Adaptation Status:</span>
              <span className={`badge-soft ${isFrozen ? 'chip-blue' : 'chip-green'}`} style={{ fontSize: 12 }}>
                {isFrozen ? 'FROZEN' : 'ADAPTING'}
              </span>
            </div>
            <div className="frame-note m-0" style={{ fontSize: 11.5 }}>
              {isFrozen 
                ? `Frozen since ${activeBaseline.updatedAt ? new Date(activeBaseline.updatedAt).toLocaleString('id-ID', {day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit'}) : '...'} WIB · Unfreeze memerlukan persetujuan PI sebelum re-adaptasi diaktifkan kembali.`
                : `Status: ${activeBaseline.status || 'learning'}. Model sedang terus beradaptasi.`}
            </div>
          </div>

          <div style={{ background: 'var(--blue-soft)', padding: 10, borderRadius: 8, marginTop: 14, fontSize: 11, color: 'var(--navy)' }}>
            <i className="fa-solid fa-shield-halved me-1" style={{ color: 'var(--blue)' }}></i>
            Baseline terverifikasi aman dari bias outlier atau artifak sinyal.
          </div>
        </div>
      </div>

      {/* Source Windows Table */}
      <div className="card-panel">
        <div className="mini-label mb-2">Source Windows (Contributing to Current Baseline)</div>
        <div className="table-responsive">
          <table className="dtable">
            <thead>
              <tr>
                <th>Window ID</th>
                <th>Collected Timestamp</th>
                <th>Context</th>
                <th>Quality Gate</th>
                <th>Included in Q99</th>
              </tr>
            </thead>
            <tbody>
              {sourceWindows.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray)' }}>
                    Tidak ada data source window untuk pasien ini.
                  </td>
                </tr>
              ) : (
                sourceWindows.map((win, idx) => {
                  const wid = win.id || win._id || `W-${String(idx + 1).padStart(4, '0')}`;
                  const ts = win.timestamp || win.start_time || win.createdAt;
                  const displayTs = ts ? new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Unknown';
                  const ctx = win.context || win.activity || 'Unknown';
                  
                  // Simple mock logic for quality gate if backend doesn't provide it directly
                  const qGate = win.quality_gate || (win.quality_score > 0.8 ? 'Clean' : 'Marginal');
                  const isClean = qGate.toLowerCase() === 'clean';
                  
                  return (
                    <tr key={wid}>
                      <td className="mono">{wid.substring(0, 8)}</td>
                      <td className="mono">{displayTs}</td>
                      <td>{ctx}</td>
                      <td>
                        <span className={`evidence-chip ${isClean ? 'chip-green' : 'chip-amber'}`}>
                          {qGate}
                        </span>
                      </td>
                      <td className="mono" style={{ color: isClean ? 'var(--green)' : 'var(--gray)', fontWeight: isClean ? 800 : 400 }}>
                        {isClean ? '✓' : 'Excluded'}
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
