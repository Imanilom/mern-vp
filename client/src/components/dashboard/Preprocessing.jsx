import React from 'react';
import { Badge, SectionHeader } from './DashboardShared';

export default function Preprocessing({ w1Prog, w1State, setW1State, w2Prog, w2State, setW2State }) {
  return (
    <div className="space-y-6 animate-htm-page-in">
      <SectionHeader 
        title="Preprocessing Pipeline" 
        subtitle="Worker Node Status & Global Configuration"
      />

      <div className="grid md:grid-cols-2 gap-4">
        {/* Worker 1 */}
        <div className="htm-card space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h5 className="htm-title">Worker-01 (Batch 5000)</h5>
              <p className="htm-eyebrow mt-1" style={{ textTransform: 'none' }}>Filtering & Smoothing</p>
            </div>
            <Badge label={w1State} color={w1State === 'Running' ? 'stable' : 'caution'} />
          </div>
          <div className="w-full bg-htm-raised overflow-hidden" style={{ height: '6px', borderRadius: '3px' }}>
            <div 
              className="h-full transition-all duration-300" 
              style={{ width: `${w1Prog}%`, background: 'var(--htm-primary)' }} 
            />
          </div>
          <div className="flex justify-between items-center htm-body-sm">
            <span className="htm-mono" style={{ fontWeight: 500 }}>{Math.round(w1Prog)}%</span>
            <button
              onClick={() => setW1State(w1State === 'Running' ? 'Paused' : 'Running')}
              className="htm-btn htm-btn-sm htm-btn-outline"
              style={{
                color: w1State === 'Running' ? 'var(--htm-caution)' : 'var(--htm-stable)',
                borderColor: w1State === 'Running' ? 'rgba(180,83,9,0.2)' : 'rgba(46,107,74,0.2)',
                background: w1State === 'Running' ? 'var(--htm-caution-bg)' : 'var(--htm-stable-bg)'
              }}
            >
              {w1State === 'Running' ? 'Pause Worker' : 'Resume Worker'}
            </button>
          </div>
        </div>

        {/* Worker 2 */}
        <div className="htm-card space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h5 className="htm-title">Worker-02 (Batch 5000)</h5>
              <p className="htm-eyebrow mt-1" style={{ textTransform: 'none' }}>Segmentasi 3-menit</p>
            </div>
            <Badge label={w2State} color={w2State === 'Running' ? 'stable' : 'caution'} />
          </div>
          <div className="w-full bg-htm-raised overflow-hidden" style={{ height: '6px', borderRadius: '3px' }}>
            <div 
              className="h-full transition-all duration-300" 
              style={{ width: `${w2Prog}%`, background: 'var(--htm-info)' }} 
            />
          </div>
          <div className="flex justify-between items-center htm-body-sm">
            <span className="htm-mono" style={{ fontWeight: 500 }}>{Math.round(w2Prog)}%</span>
            <button
              onClick={() => setW2State(w2State === 'Running' ? 'Paused' : 'Running')}
              className="htm-btn htm-btn-sm htm-btn-outline"
              style={{
                color: w2State === 'Running' ? 'var(--htm-caution)' : 'var(--htm-stable)',
                borderColor: w2State === 'Running' ? 'rgba(180,83,9,0.2)' : 'rgba(46,107,74,0.2)',
                background: w2State === 'Running' ? 'var(--htm-caution-bg)' : 'var(--htm-stable-bg)'
              }}
            >
              {w2State === 'Running' ? 'Pause Worker' : 'Resume Worker'}
            </button>
          </div>
        </div>
      </div>

      <div className="htm-card space-y-6">
        <h4 className="htm-title border-b border-htm-hairline pb-4">Parameter Preprocessing (Konfigurasi Global)</h4>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="htm-input-wrap">
            <label className="htm-input-label">Filter Type</label>
            <select className="htm-input htm-input-mono text-sm" style={{ padding: '8px 4px', background: 'transparent' }}>
              <option>Bandpass (0.5 - 40Hz)</option>
              <option>Lowpass (40Hz)</option>
            </select>
          </div>
          <div className="htm-input-wrap">
            <label className="htm-input-label">Window Size</label>
            <select className="htm-input htm-input-mono text-sm" style={{ padding: '8px 4px', background: 'transparent' }}>
              <option>3 Minutes (180s)</option>
              <option>5 Minutes (300s)</option>
            </select>
          </div>
          <div className="htm-input-wrap">
            <label className="htm-input-label">Outlier Threshold</label>
            <select className="htm-input htm-input-mono text-sm" style={{ padding: '8px 4px', background: 'transparent' }}>
              <option>Z-Score {'>'} 3.0</option>
              <option>Z-Score {'>'} 2.5</option>
            </select>
          </div>
        </div>
        
        <div className="pt-2 flex justify-end">
          <button className="htm-btn htm-btn-primary htm-btn-sm">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
