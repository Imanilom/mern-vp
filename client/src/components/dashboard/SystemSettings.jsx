import React from 'react';

export default function SystemSettings() {
  return (
    <div className="htm-card max-w-2xl space-y-8 animate-htm-page-in">
      <h4 className="htm-title border-b border-htm-hairline pb-4">Global Trajectory Threshold Configuration</h4>
      
      <div className="space-y-8">
        <div>
          <div className="flex justify-between mb-2">
            <span className="htm-body-sm font-medium">Alert threshold (≥ score → Alert state)</span>
            <span className="htm-mono-sm font-medium" style={{ color: 'var(--htm-alert)' }}>3.0 SD composite</span>
          </div>
          <input type="range" min="2" max="5" step="0.5" defaultValue="3.0" className="w-full h-2 rounded-lg appearance-none cursor-pointer" style={{ background: 'var(--htm-raised)', accentColor: 'var(--htm-alert)' }} />
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <span className="htm-body-sm font-medium">Caution threshold (≥ score → Caution state)</span>
            <span className="htm-mono-sm font-medium" style={{ color: 'var(--htm-caution)' }}>1.5 SD composite</span>
          </div>
          <input type="range" min="1" max="3" step="0.5" defaultValue="1.5" className="w-full h-2 rounded-lg appearance-none cursor-pointer" style={{ background: 'var(--htm-raised)', accentColor: 'var(--htm-caution)' }} />
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <span className="htm-body-sm font-medium">Baseline maturity minimum samples</span>
            <span className="htm-mono-sm font-medium" style={{ color: 'var(--htm-info)' }}>20 windows</span>
          </div>
          <input type="range" min="5" max="100" defaultValue="20" className="w-full h-2 rounded-lg appearance-none cursor-pointer" style={{ background: 'var(--htm-raised)', accentColor: 'var(--htm-info)' }} />
        </div>
      </div>

      <div className="pt-6 border-t border-htm-hairline flex justify-end">
        <button className="htm-btn htm-btn-primary" onClick={() => alert('Settings saved (UI only)')}>
          Save Configuration
        </button>
      </div>
    </div>
  );
}
