import React from 'react';

export default function SystemSettings() {
  return (
    <div className="bg-brand-card border border-brand-border p-6 rounded-2xl shadow-lg max-w-2xl space-y-6">
      <h4 className="font-bold text-sm border-b border-brand-border pb-3">Global Trajectory Threshold Configuration</h4>
      
      <div className="space-y-4 text-xs font-semibold">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-brand-muted">Alert threshold (≥ score → Alert state)</span>
            <span className="text-sys-red">3.0 SD composite</span>
          </div>
          <input type="range" min="2" max="5" step="0.5" defaultValue="3.0" className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-sys-red" />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-brand-muted">Caution threshold (≥ score → Caution state)</span>
            <span className="text-sys-orange">1.5 SD composite</span>
          </div>
          <input type="range" min="1" max="3" step="0.5" defaultValue="1.5" className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-sys-orange" />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-brand-muted">Baseline maturity minimum samples</span>
            <span className="text-sys-blue">20 windows</span>
          </div>
          <input type="range" min="5" max="100" defaultValue="20" className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-sys-blue" />
        </div>
      </div>

      <div className="pt-4 border-t border-brand-border flex justify-end">
        <button className="px-5 py-2 bg-sys-blue text-white rounded-xl font-bold text-xs" onClick={() => alert('Settings saved (UI only)')}>
          Save Configuration
        </button>
      </div>
    </div>
  );
}
