import React, { useState } from 'react';
import { FaSync, FaCheckCircle, FaSnowflake, FaRedo, FaHistory } from 'react-icons/fa';
import { Skeleton, SmoothLineChart, Badge, fmtDate, SectionHeader } from './DashboardShared';
import { analysisApi } from '../../utls/api';

export default function BaselineModels({ data, loading, sessionUser, fetchFor }) {
  const baselines = data.baseline?.data || [];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const selectedBaseline = baselines[selectedIndex] || null;

  const refreshBaselines = () => {
    if (fetchFor) fetchFor('baseline', () => analysisApi.getBaselines(sessionUser._id));
  };

  const handleAction = async (actionFn, ...args) => {
    if (!selectedBaseline) return;
    setActionLoading(true);
    try {
      await actionFn(selectedBaseline._id, ...args);
      refreshBaselines();
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Confidence heuristic based on segment count (Maturity threshold is 20)
  const conf = selectedBaseline ? Math.min(100, Math.round((selectedBaseline.segment_count / 20) * 100)) : 0;

  return (
    <div className="space-y-6 animate-htm-page-in">
      <SectionHeader 
        title="Baseline Models" 
        subtitle="Manage and analyze generated context models."
        action={
          <button 
            onClick={refreshBaselines} 
            className="htm-btn htm-btn-outline htm-btn-sm"
          >
            <FaSync className={loading.baseline || actionLoading ? 'animate-spin' : ''} style={{ marginRight: 6 }} /> Refresh Models
          </button>
        }
      />

      {loading.baseline && !baselines.length ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : baselines.length === 0 ? (
        <div className="htm-card text-center" style={{ color: 'var(--htm-muted)', padding: '48px' }}>
          No baselines generated yet. Waiting for analysis pipeline.
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Sidebar / List */}
          <div className="md:col-span-1 space-y-4">
            <div className="htm-card p-0 overflow-hidden">
              <div className="p-4 border-b border-htm-hairline bg-htm-raised">
                <h5 className="htm-eyebrow">Contextual Models</h5>
              </div>
              <div style={{ borderTop: '1px solid var(--htm-hairline)' }}>
                {baselines.map((b, i) => (
                  <div
                    key={b._id}
                    onClick={() => setSelectedIndex(i)}
                    className="p-4 cursor-pointer transition-colors"
                    style={{
                      background: selectedIndex === i ? 'var(--htm-primary-bg)' : 'transparent',
                      borderLeft: `3px solid ${selectedIndex === i ? 'var(--htm-primary)' : 'transparent'}`,
                      borderBottom: '1px solid var(--htm-hairline)'
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <span className="htm-title">{b.activity}</span>
                      <Badge label={`v${b.version || 1}`} color="neutral" />
                    </div>
                    <div className="htm-mono-sm" style={{ color: 'var(--htm-muted)', marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>{b.time_period}</span>
                      <span>•</span>
                      <span style={{ color: b.is_mature ? 'var(--htm-stable)' : 'var(--htm-caution)' }}>
                        {b.is_mature ? 'Mature' : 'Learning'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedBaseline && (
              <div className="htm-card space-y-4">
                <h5 className="htm-eyebrow">Model Actions</h5>
                <div className="space-y-2">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction(analysisApi.freezeBaseline, !selectedBaseline.is_frozen)}
                    className="htm-btn htm-btn-outline"
                    style={{
                      width: '100%',
                      color: selectedBaseline.is_frozen ? 'var(--htm-ink)' : 'var(--htm-primary)',
                      borderColor: selectedBaseline.is_frozen ? 'var(--htm-hairline)' : 'var(--htm-primary)'
                    }}
                  >
                    <FaSnowflake style={{ marginRight: 6 }} /> {selectedBaseline.is_frozen ? 'Unfreeze Model' : 'Freeze Model'}
                  </button>
                  <button
                    disabled={actionLoading || selectedBaseline.status === 'approved'}
                    onClick={() => handleAction(analysisApi.approveBaseline)}
                    className="htm-btn"
                    style={{
                      width: '100%',
                      background: 'var(--htm-stable-bg)',
                      color: 'var(--htm-stable)',
                      opacity: (actionLoading || selectedBaseline.status === 'approved') ? 0.5 : 1
                    }}
                  >
                    <FaCheckCircle style={{ marginRight: 6 }} /> {selectedBaseline.status === 'approved' ? 'Approved' : 'Approve Baseline'}
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => {
                      if(window.confirm('Reset this model back to learning phase?')) {
                        handleAction(analysisApi.recalculateBaseline);
                      }
                    }}
                    className="htm-btn htm-btn-ghost"
                    style={{
                      width: '100%',
                      color: 'var(--htm-caution)'
                    }}
                  >
                    <FaRedo style={{ marginRight: 6 }} /> Recalculate (Reset)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Details & Graph */}
          {selectedBaseline && (
            <div className="md:col-span-2 space-y-6">
              <div className="htm-card">
                <div className="flex justify-between items-start border-b border-htm-hairline pb-4 mb-6">
                  <div>
                    <h4 className="htm-display text-2xl">P0{sessionUser?.name} – {selectedBaseline.activity} <span style={{ fontWeight: 400, color: 'var(--htm-muted)', fontSize: 18 }}>({selectedBaseline.time_period})</span></h4>
                    <p className="htm-body-sm" style={{ marginTop: 8, color: 'var(--htm-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      Status: 
                      <Badge label={selectedBaseline.status || 'learning'} color={selectedBaseline.status === 'approved' ? 'stable' : 'caution'} /> 
                      <span style={{ margin: '0 4px' }}>·</span> 
                      Last Updated: {fmtDate(selectedBaseline.last_updated)}
                    </p>
                  </div>
                  {selectedBaseline.is_frozen && <Badge label="FROZEN" color="info" />}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4" style={{ background: 'var(--htm-raised)', borderRadius: 'var(--htm-r-sm)' }}>
                    <span className="htm-eyebrow block mb-2">HR Mean</span>
                    <span className="htm-display text-2xl">{selectedBaseline.stats?.mean_hr?.mean?.toFixed(1) || '0.0'} <span className="htm-mono" style={{ fontSize: 10, color: 'var(--htm-muted)' }}>BPM</span></span>
                  </div>
                  <div className="p-4" style={{ background: 'var(--htm-raised)', borderRadius: 'var(--htm-r-sm)' }}>
                    <span className="htm-eyebrow block mb-2">HR Std Dev</span>
                    <span className="htm-display text-2xl">{selectedBaseline.stats?.std_hr?.mean?.toFixed(1) || '0.0'}</span>
                  </div>
                  <div className="p-4" style={{ background: 'var(--htm-raised)', borderRadius: 'var(--htm-r-sm)' }}>
                    <span className="htm-eyebrow block mb-2">RMSSD Mean</span>
                    <span className="htm-display text-2xl">{selectedBaseline.stats?.rmssd?.mean?.toFixed(1) || '0.0'} <span className="htm-mono" style={{ fontSize: 10, color: 'var(--htm-muted)' }}>ms</span></span>
                  </div>
                  <div className="p-4" style={{ background: 'var(--htm-raised)', borderRadius: 'var(--htm-r-sm)' }}>
                    <span className="htm-eyebrow block mb-2">DFA Alpha-1</span>
                    <span className="htm-display text-2xl">{selectedBaseline.stats?.dfa_alpha1?.mean?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-3 htm-body-sm">
                  <div className="flex justify-between border-b border-htm-hairline pb-2">
                    <span style={{ color: 'var(--htm-muted)' }}>Observation</span>
                    <span className="htm-mono font-medium">{selectedBaseline.segment_count} windows</span>
                  </div>
                  <div className="flex justify-between border-b border-htm-hairline pb-2">
                    <span style={{ color: 'var(--htm-muted)' }}>Confidence</span>
                    <span className="htm-mono font-medium" style={{ color: conf >= 80 ? 'var(--htm-stable)' : conf >= 50 ? 'var(--htm-caution)' : 'var(--htm-alert)' }}>{conf}%</span>
                  </div>
                  <div className="flex justify-between border-b border-htm-hairline pb-2">
                    <span style={{ color: 'var(--htm-muted)' }}>Min HR</span>
                    <span className="htm-mono font-medium">{selectedBaseline.stats?.mean_hr?.min?.toFixed(1) || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-htm-hairline pb-2">
                    <span style={{ color: 'var(--htm-muted)' }}>Max HR</span>
                    <span className="htm-mono font-medium">{selectedBaseline.stats?.mean_hr?.max?.toFixed(1) || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="htm-card space-y-4">
                <h4 className="htm-title">Baseline HR Distribution vs Global</h4>
                <p className="htm-body-sm" style={{ color: 'var(--htm-muted)' }}>Comparing personalized (primary) vs global population (gray) baseline for {selectedBaseline.activity}.</p>
                {/* Simulated gaussian-like distribution based on real mean & std */}
                {(() => {
                  const m = selectedBaseline.stats?.mean_hr?.mean || 75;
                  const s = selectedBaseline.stats?.std_hr?.mean || 10;
                  // generate 15 points bell curve
                  const pts = [];
                  for(let i = -7; i <= 7; i++) {
                    const x = i * (s/2);
                    const y = Math.exp(-0.5 * Math.pow(x/s, 2)) * 100;
                    pts.push(y);
                  }
                  return (
                    <SmoothLineChart
                      points={pts}
                      color="var(--htm-primary)"
                      fillId="personal-dist"
                      height={200}
                      baselineBand={{ min: Math.max(0, 30), max: 80 }} // placeholder for global band
                    />
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
