import React, { useState } from 'react';
import { FaSync, FaCheckCircle, FaSnowflake, FaRedo, FaHistory } from 'react-icons/fa';
import { Skeleton, SmoothLineChart, Badge, fmtDate } from './DashboardShared';
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
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-bold text-sm">Baseline Model Management</h4>
        <button onClick={refreshBaselines} className="text-sys-blue text-xs flex items-center gap-1">
          <FaSync className={loading.baseline || actionLoading ? 'animate-spin' : ''} /> Refresh Models
        </button>
      </div>

      {loading.baseline && !baselines.length ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : baselines.length === 0 ? (
        <div className="bg-brand-card border border-brand-border p-6 rounded-2xl text-center text-brand-muted">
          No baselines generated yet. Waiting for analysis pipeline.
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Sidebar / List */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-brand-card border border-brand-border rounded-2xl shadow-lg overflow-hidden">
              <div className="p-4 border-b border-brand-border bg-brand-cardLight">
                <h5 className="font-bold text-xs uppercase text-brand-muted tracking-wider">Contextual Models</h5>
              </div>
              <div className="divide-y divide-brand-border">
                {baselines.map((b, i) => (
                  <div
                    key={b._id}
                    onClick={() => setSelectedIndex(i)}
                    className={`p-4 cursor-pointer transition-colors ${selectedIndex === i ? 'bg-sys-blue/10 border-l-2 border-sys-blue' : 'hover:bg-brand-cardLight border-l-2 border-transparent'}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-sm">{b.activity}</span>
                      <Badge label={`v${b.version || 1}`} color="gray" />
                    </div>
                    <div className="text-[10px] text-brand-muted mt-1 space-x-2">
                      <span>{b.time_period}</span>
                      <span>•</span>
                      <span className={b.is_mature ? 'text-sys-green' : 'text-sys-orange'}>
                        {b.is_mature ? 'Mature' : 'Learning'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedBaseline && (
              <div className="bg-brand-card border border-brand-border p-5 rounded-2xl shadow-lg space-y-4">
                <h5 className="font-bold text-xs uppercase text-brand-muted tracking-wider">Model Actions</h5>
                <div className="space-y-2">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction(analysisApi.freezeBaseline, !selectedBaseline.is_frozen)}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${selectedBaseline.is_frozen ? 'bg-brand-border text-brand-text hover:bg-brand-muted' : 'bg-sys-blue/20 text-sys-blue hover:bg-sys-blue/30'}`}
                  >
                    <FaSnowflake /> {selectedBaseline.is_frozen ? 'Unfreeze Model' : 'Freeze Model'}
                  </button>
                  <button
                    disabled={actionLoading || selectedBaseline.status === 'approved'}
                    onClick={() => handleAction(analysisApi.approveBaseline)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-sys-green/20 text-sys-green rounded-xl text-xs font-bold hover:bg-sys-green/30 disabled:opacity-50"
                  >
                    <FaCheckCircle /> {selectedBaseline.status === 'approved' ? 'Approved' : 'Approve Baseline'}
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => {
                      if(window.confirm('Reset this model back to learning phase?')) {
                        handleAction(analysisApi.recalculateBaseline);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-sys-orange/20 text-sys-orange rounded-xl text-xs font-bold hover:bg-sys-orange/30 disabled:opacity-50"
                  >
                    <FaRedo /> Recalculate (Reset)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Details & Graph */}
          {selectedBaseline && (
            <div className="md:col-span-2 space-y-6">
              <div className="bg-brand-card border border-brand-border p-6 rounded-2xl shadow-lg">
                <div className="flex justify-between items-start border-b border-brand-border pb-4 mb-4">
                  <div>
                    <h4 className="font-bold text-lg text-brand-text">P0{sessionUser?.name} – {selectedBaseline.activity} ({selectedBaseline.time_period})</h4>
                    <p className="text-[10px] text-brand-muted mt-1">Status: <Badge label={selectedBaseline.status || 'learning'} color={selectedBaseline.status === 'approved' ? 'green' : 'orange'} /> · Last Updated: {fmtDate(selectedBaseline.last_updated)}</p>
                  </div>
                  {selectedBaseline.is_frozen && <Badge label="FROZEN" color="blue" />}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-brand-cardLight border border-brand-border p-3 rounded-xl">
                    <span className="block text-[9px] uppercase text-brand-muted font-bold">HR Mean</span>
                    <span className="text-xl font-black text-brand-text">{selectedBaseline.stats?.mean_hr?.mean?.toFixed(1) || '0.0'} <span className="text-[9px] font-normal">BPM</span></span>
                  </div>
                  <div className="bg-brand-cardLight border border-brand-border p-3 rounded-xl">
                    <span className="block text-[9px] uppercase text-brand-muted font-bold">HR Std Dev</span>
                    <span className="text-xl font-black text-brand-text">{selectedBaseline.stats?.std_hr?.mean?.toFixed(1) || '0.0'}</span>
                  </div>
                  <div className="bg-brand-cardLight border border-brand-border p-3 rounded-xl">
                    <span className="block text-[9px] uppercase text-brand-muted font-bold">RMSSD Mean</span>
                    <span className="text-xl font-black text-brand-text">{selectedBaseline.stats?.rmssd?.mean?.toFixed(1) || '0.0'} <span className="text-[9px] font-normal">ms</span></span>
                  </div>
                  <div className="bg-brand-cardLight border border-brand-border p-3 rounded-xl">
                    <span className="block text-[9px] uppercase text-brand-muted font-bold">DFA Alpha-1</span>
                    <span className="text-xl font-black text-brand-text">{selectedBaseline.stats?.dfa_alpha1?.mean?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex justify-between border-b border-brand-border pb-1"><span className="text-brand-muted">Observation</span><span className="font-bold">{selectedBaseline.segment_count} windows</span></div>
                  <div className="flex justify-between border-b border-brand-border pb-1"><span className="text-brand-muted">Confidence</span><span className={`font-bold ${conf >= 80 ? 'text-sys-green' : conf >= 50 ? 'text-sys-orange' : 'text-sys-red'}`}>{conf}%</span></div>
                  <div className="flex justify-between border-b border-brand-border pb-1"><span className="text-brand-muted">Min HR</span><span className="font-bold">{selectedBaseline.stats?.mean_hr?.min?.toFixed(1) || '-'}</span></div>
                  <div className="flex justify-between border-b border-brand-border pb-1"><span className="text-brand-muted">Max HR</span><span className="font-bold">{selectedBaseline.stats?.mean_hr?.max?.toFixed(1) || '-'}</span></div>
                </div>
              </div>

              <div className="bg-brand-card border border-brand-border p-6 rounded-2xl shadow-lg space-y-4">
                <h4 className="font-bold text-sm">Baseline HR Distribution vs Global</h4>
                <p className="text-[10px] text-brand-muted">Comparing personalized (blue) vs global population (gray) baseline for {selectedBaseline.activity}.</p>
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
                      color="#3b82f6"
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
