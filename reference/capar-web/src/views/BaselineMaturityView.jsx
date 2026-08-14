import React, { useState } from 'react';

export const BaselineMaturityView = () => {
  const [isFrozen, setIsFrozen] = useState(true);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>W05 — Baseline Maturity Web</div>
          <h1 className="page-title">P-014 · Baseline Maturity &amp; Source Windows</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Menilai `baseline_n`, `n_eff`, `baseline_days`, serta day dominance per aktivitas/feature untuk akurasi threshold personal.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            className="btn-outline-navy"
            onClick={() => setIsFrozen(!isFrozen)}
            style={{ fontSize: 11.5 }}
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

      {/* Metric Cards Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="lbl">baseline_n</div>
          <div className="val" style={{ color: 'var(--teal)' }}>32</div>
          <div className="sub">Min required: 24 windows</div>
        </div>

        <div className="stat-card">
          <div className="lbl">baseline_n_eff</div>
          <div className="val" style={{ color: 'var(--teal)' }}>27.4</div>
          <div className="sub">After quality weighting</div>
        </div>

        <div className="stat-card">
          <div className="lbl">baseline_days</div>
          <div className="val">6</div>
          <div className="sub">Min required: 5 distinct days</div>
        </div>

        <div className="stat-card">
          <div className="lbl">Q99 (tau_in source)</div>
          <div className="val">1.86</div>
          <div className="sub">Rolling guarded percentile</div>
        </div>
      </div>

      {/* Row 2: Day Dominance & Status Card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card-panel">
          <div className="mini-label mb-2">baseline_day_dominance (Kontribusi Per Hari)</div>
          <div className="d-flex justify-content-between mb-1">
            <span className="frame-note m-0">07 Aug 2026</span>
            <span className="mini-value">34%</span>
          </div>
          <div className="progress-thin mb-3">
            <div style={{ width: '34%', background: 'var(--amber)' }}></div>
          </div>

          <div className="d-flex justify-content-between mb-1">
            <span className="frame-note m-0">06 Aug 2026</span>
            <span className="mini-value">21%</span>
          </div>
          <div className="progress-thin mb-3">
            <div style={{ width: '21%', background: 'var(--teal)' }}></div>
          </div>

          <div className="frame-note m-0" style={{ fontSize: 11 }}>
            Dominance tertinggi 34% (di bawah ambang 40%), tidak terindikasi bias hari tunggal.
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
              Frozen since 08 Aug 12:00 WIB · Completeness 100%. Unfreeze memerlukan persetujuan PI sebelum re-adaptasi diaktifkan kembali.
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
              <tr>
                <td className="mono">W-0032</td>
                <td className="mono">07 Aug 21:40</td>
                <td>rest</td>
                <td><span className="evidence-chip chip-green">Clean</span></td>
                <td className="mono" style={{ color: 'var(--green)', fontWeight: 800 }}>✓</td>
              </tr>
              <tr>
                <td className="mono">W-0031</td>
                <td className="mono">07 Aug 20:10</td>
                <td>sitting</td>
                <td><span className="evidence-chip chip-green">Clean</span></td>
                <td className="mono" style={{ color: 'var(--green)', fontWeight: 800 }}>✓</td>
              </tr>
              <tr>
                <td className="mono">W-0030</td>
                <td className="mono">07 Aug 18:55</td>
                <td>walking</td>
                <td><span className="evidence-chip chip-amber">Marginal</span></td>
                <td className="mono" style={{ color: 'var(--gray)' }}>Excluded</td>
              </tr>
              <tr>
                <td className="mono">W-0029</td>
                <td className="mono">07 Aug 16:20</td>
                <td>sitting</td>
                <td><span className="evidence-chip chip-green">Clean</span></td>
                <td className="mono" style={{ color: 'var(--green)', fontWeight: 800 }}>✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
