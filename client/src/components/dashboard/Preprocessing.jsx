import React from 'react';
import { Badge } from './DashboardShared';

export default function Preprocessing({ w1Prog, w1State, setW1State, w2Prog, w2State, setW2State }) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Worker 1 */}
        <div className="bg-brand-card border border-brand-border p-5 rounded-2xl shadow-lg space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h5 className="font-bold text-sm text-brand-text">Worker-01 (Batch 5000)</h5>
              <p className="text-[10px] text-brand-muted font-mono mt-1">Filtering & Smoothing</p>
            </div>
            <Badge label={w1State} color={w1State === 'Running' ? 'green' : 'orange'} />
          </div>
          <div className="h-2 w-full bg-brand-border rounded-full overflow-hidden">
            <div className="h-full bg-sys-blue transition-all duration-300" style={{ width: `${w1Prog}%` }} />
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold">{Math.round(w1Prog)}%</span>
            <button
              onClick={() => setW1State(w1State === 'Running' ? 'Paused' : 'Running')}
              className={`px-3 py-1.5 rounded-lg font-bold text-[10px] ${w1State === 'Running' ? 'bg-sys-orange/15 text-sys-orange hover:bg-sys-orange/25' : 'bg-sys-green/15 text-sys-green hover:bg-sys-green/25'}`}
            >
              {w1State === 'Running' ? 'Pause Worker' : 'Resume Worker'}
            </button>
          </div>
        </div>

        {/* Worker 2 */}
        <div className="bg-brand-card border border-brand-border p-5 rounded-2xl shadow-lg space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h5 className="font-bold text-sm text-brand-text">Worker-02 (Batch 5000)</h5>
              <p className="text-[10px] text-brand-muted font-mono mt-1">Segmentasi 3-menit</p>
            </div>
            <Badge label={w2State} color={w2State === 'Running' ? 'green' : 'orange'} />
          </div>
          <div className="h-2 w-full bg-brand-border rounded-full overflow-hidden">
            <div className="h-full bg-sys-purple transition-all duration-300" style={{ width: `${w2Prog}%` }} />
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold">{Math.round(w2Prog)}%</span>
            <button
              onClick={() => setW2State(w2State === 'Running' ? 'Paused' : 'Running')}
              className={`px-3 py-1.5 rounded-lg font-bold text-[10px] ${w2State === 'Running' ? 'bg-sys-orange/15 text-sys-orange hover:bg-sys-orange/25' : 'bg-sys-green/15 text-sys-green hover:bg-sys-green/25'}`}
            >
              {w2State === 'Running' ? 'Pause Worker' : 'Resume Worker'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-lg space-y-4">
        <h4 className="font-bold text-sm border-b border-brand-border pb-3">Parameter Preprocessing (Konfigurasi Global)</h4>
        <div className="grid md:grid-cols-3 gap-6 text-xs">
          <div>
            <span className="block text-[10px] font-bold text-brand-muted uppercase mb-2">Filter Type</span>
            <select className="w-full bg-brand-cardLight border border-brand-border rounded-lg p-2 font-mono text-brand-text">
              <option>Bandpass (0.5 - 40Hz)</option>
              <option>Lowpass (40Hz)</option>
            </select>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-brand-muted uppercase mb-2">Window Size</span>
            <select className="w-full bg-brand-cardLight border border-brand-border rounded-lg p-2 font-mono text-brand-text">
              <option>3 Minutes (180s)</option>
              <option>5 Minutes (300s)</option>
            </select>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-brand-muted uppercase mb-2">Outlier Threshold</span>
            <select className="w-full bg-brand-cardLight border border-brand-border rounded-lg p-2 font-mono text-brand-text">
              <option>Z-Score {'>'} 3.0</option>
              <option>Z-Score {'>'} 2.5</option>
            </select>
          </div>
        </div>
        <div className="pt-4 flex justify-end">
          <button className="px-4 py-2 bg-sys-blue text-white rounded-lg text-xs font-bold hover:bg-sys-blue/80">Save Configuration</button>
        </div>
      </div>
    </div>
  );
}
