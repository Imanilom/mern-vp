import React, { useEffect, useState } from "react";

const STATE_LABEL = {
  BASELINE_COMPATIBLE: "Baseline",
  DEVIATION_CANDIDATE: "Candidate",
  PERSISTENT_DEVIATION: "Persistent",
  RECOVERY_START: "Recovery",
  RECOVERED: "Recovered"
};

export default function MarkovTransitionHeatmap({ participantId = "P00" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        let res = await fetch(`/api/participants/${participantId}/markov?horizon=3`);
        if (!res.ok) {
          res = await fetch(`/api/analysis/markov/${participantId}?horizon=3`);
        }

        if (!res.ok) {
          throw new Error("Gagal memuat Markov Transition Model");
        }

        const json = await res.json();
        if (isMounted) {
          setData(json);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [participantId]);

  if (loading) {
    return (
      <div className="card-panel p-4 text-center" style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--gray)', fontSize: 13 }}>
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Mempelajari matriks transisi personal (Markov Model)...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-panel p-4" style={{ color: 'var(--red)', fontSize: 13 }}>
        ⚠️ {error}
      </div>
    );
  }

  if (!data || data.status !== "READY" || !data.matrix || data.matrix.length === 0) {
    return (
      <div className="card-panel p-4">
        <p style={{ color: 'var(--gray)', fontSize: 13, marginBottom: 12 }}>
          Belum ada matriks transisi yang dapat dipelajari untuk partisipan ini.
        </p>
        <div style={{ background: 'var(--gray-soft)', padding: 12, borderRadius: 8, fontSize: 11.5, color: 'var(--ink)' }}>
          Matriks hanya dibangun dari episode yang statusnya <b>resolved</b>, <b>verified</b>, dan lolos <b>quality gating</b>.
        </div>
      </div>
    );
  }

  const states = data.matrix.map(row => row.current_state);

  // Total valid transitions in matrix
  const validTransitionsCount = data.matrix.reduce((acc, row) => {
    return acc + row.transitions.reduce((sum, cell) => sum + (cell.allowed ? cell.count : 0), 0);
  }, 0);

  const getOpacity = (probability) => {
    if (probability === null || probability === undefined) return 0;
    return Math.max(0.12, probability);
  };

  return (
    <div className="card-panel" style={{ background: '#ffffff', borderRadius: 16, border: '1px solid var(--line)', padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div className="mini-label" style={{ marginBottom: 4, letterSpacing: '0.05em' }}>
            Markov Transition Model
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
            Learned Transition Matrix Heatmap
          </h3>
        </div>
        <div style={{ background: 'rgba(13, 148, 136, 0.1)', color: '#0d9488', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
          {data.episode_count} Verified Anomaly Episodes
        </div>
      </div>

      {/* Heatmap Grid */}
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 4, fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, color: 'var(--gray)', fontWeight: 600, fontSize: 10 }}>
                Current ↓ / Next →
              </th>
              {states.map(state => (
                <th key={state} style={{ textAlign: 'center', padding: 8, color: 'var(--navy)', fontWeight: 700 }}>
                  {STATE_LABEL[state] || state}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.matrix.map(row => (
              <tr key={row.current_state}>
                <td style={{ padding: 8, fontWeight: 700, color: 'var(--navy)', whiteSpace: 'nowrap' }}>
                  {STATE_LABEL[row.current_state] || row.current_state}
                </td>

                {row.transitions.map(cell => {
                  if (!cell.allowed) {
                    return (
                      <td
                        key={cell.next_state}
                        style={{
                          height: 54,
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          background: 'var(--gray-soft)',
                          color: '#a0aec0',
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 600
                        }}
                      >
                        —
                      </td>
                    );
                  }

                  const probPct = ((cell.probability ?? 0) * 100).toFixed(1);
                  const opacity = getOpacity(cell.probability);

                  return (
                    <td
                      key={cell.next_state}
                      title={`${row.current_state} → ${cell.next_state}\nJumlah Transisi Window 1-Menit: ${cell.count}\nProbabilitas: ${probPct}%`}
                      style={{
                        height: 54,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        position: 'relative',
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: '1px solid rgba(13, 148, 136, 0.2)'
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: '#0d9488',
                          opacity: opacity,
                          transition: 'opacity 0.2s ease'
                        }}
                      />
                      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontWeight: 800, color: opacity > 0.5 ? '#ffffff' : '#0f172a', fontSize: 12 }}>
                          {probPct}%
                        </span>
                        <span style={{ fontSize: 9.5, color: opacity > 0.5 ? 'rgba(255,255,255,0.9)' : '#475569', fontWeight: 600 }}>
                          n={cell.count}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Principle Banner */}
      <div style={{ background: 'var(--gray-soft)', padding: '10px 14px', borderRadius: 10, fontSize: 11, color: 'var(--ink)', marginBottom: 16 }}>
        <b>Catatan Transisi:</b> Angka <i>n</i> di dalam sel matriks adalah <b>jumlah transisi window sinyal 1-menitan (S<sub>t</sub> &rarr; S<sub>t+1</sub>)</b> (total {validTransitionsCount} transisi), sedangkan sampel episode kejadian anomali di Journey &amp; Mobile App berjumlah <b>{data.episode_count} episode</b>.
      </div>

      {/* Model Readiness & Metadata Table */}
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <div className="mini-label" style={{ marginBottom: 8 }}>Model Governance &amp; Metadata</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, fontSize: 11 }}>
          <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: 6 }}>
            <span style={{ color: 'var(--gray)', display: 'block', fontSize: 10 }}>Anomaly Episodes</span>
            <b style={{ color: 'var(--navy)' }}>{data.episode_count}</b>
          </div>
          <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: 6 }}>
            <span style={{ color: 'var(--gray)', display: 'block', fontSize: 10 }}>Valid Transitions</span>
            <b style={{ color: 'var(--navy)' }}>{validTransitionsCount}</b>
          </div>
          <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: 6 }}>
            <span style={{ color: 'var(--gray)', display: 'block', fontSize: 10 }}>Model Order</span>
            <b style={{ color: 'var(--navy)' }}>1 (First-Order)</b>
          </div>
          <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: 6 }}>
            <span style={{ color: 'var(--gray)', display: 'block', fontSize: 10 }}>Smoothing α</span>
            <b style={{ color: 'var(--navy)' }}>{data.alpha || 0.5}</b>
          </div>
          <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: 6 }}>
            <span style={{ color: 'var(--gray)', display: 'block', fontSize: 10 }}>Min. Support</span>
            <b style={{ color: 'var(--navy)' }}>5 episodes</b>
          </div>
          <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: 6 }}>
            <span style={{ color: 'var(--gray)', display: 'block', fontSize: 10 }}>Model Version</span>
            <b className="mono" style={{ color: '#0d9488' }}>MK-{participantId}-01</b>
          </div>
        </div>
      </div>
    </div>
  );
}
