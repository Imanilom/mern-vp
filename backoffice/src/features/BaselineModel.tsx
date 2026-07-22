import React, { useState } from 'react';
import {
  CloudArrowUp, DownloadSimple, Eye, ArrowClockwise, Sliders, Pause, X, Receipt,
  Columns, FileText, Trash, FloppyDisk, UserPlus, Check, Lightning
} from '@phosphor-icons/react';

export interface AnalyticsProps {
  selectedParticipantId: string;
  onParticipantChange: (id: string) => void;
}

export const DeviceSelector: React.FC<{
  selectedId: string;
  onChange: (id: string) => void;
  options: { id: string; name: string; device: string }[];
}> = ({ selectedId, onChange, options }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span className="eyebrow" style={{ color: 'var(--muted)' }}>Select Participant:</span>
      <select
        className="select-chip font-mono cursor-pointer"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        style={{
          outline: 'none',
          background: 'var(--surface)',
          color: 'var(--ink)',
          border: '1px solid var(--hairline)',
          fontWeight: 600,
          padding: '5px 12px',
        }}
      >
        {options.map(opt => (
          <option key={opt.id} value={opt.id}>
            {opt.name} ({opt.device})
          </option>
        ))}
      </select>
    </div>
  );
};

export const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        background: 'var(--surface)',
        border: '1px solid var(--primary)',
        borderRadius: 'var(--r-md)',
        padding: '12px 18px',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        animation: 'fadeInUp 200ms var(--ease)',
      }}
    >
      <span className="status-dot"></span>
      <span style={{ fontSize: '13px', fontWeight: 550, color: 'var(--ink)' }}>{message}</span>
    </div>
  );
};

export const BaselineModel: React.FC<AnalyticsProps> = ({
  selectedParticipantId,
  onParticipantChange
}) => {
  const [showCompare, setShowCompare] = useState(false);
  const [baselineData, setBaselineData] = useState<any>(null);
  const [prevBaseline, setPrevBaseline] = useState<any>(null);
  const [allBaselines, setAllBaselines] = useState<any[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);

  React.useEffect(() => {
    const fetchPatients = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch('/api/patient/all', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setParticipants(data);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPatients();
  }, []);

  React.useEffect(() => {
    const fetchBaseline = async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem('htm_token');
        // fallback to P012 if empty
        const idToFetch = selectedParticipantId || 'P012';
        const res = await fetch(`/api/analysis/baseline/${idToFetch}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data && data.data.length > 0) {
            setAllBaselines(data.data);
            setSelectedActivity(data.data[0].activity);
          } else {
            setAllBaselines([]);
            setSelectedActivity('');
            setBaselineData(null);
            setPrevBaseline(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch baseline:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBaseline();
  }, [selectedParticipantId]);

  React.useEffect(() => {
    if (allBaselines.length > 0 && selectedActivity) {
      const active = allBaselines.find(b => b.activity === selectedActivity) || allBaselines[0];
      const prev = allBaselines.find(b => b.activity === selectedActivity && b._id !== active._id) || null;
      
      const flattenStats = (b: any) => {
        if(!b) return null;
        return {
          ...b,
          hr_mean: b.stats?.mean_hr?.mean,
          hr_sd: b.stats?.std_hr?.mean || b.stats?.mean_hr?.std,
          rmssd_mean: b.stats?.rmssd?.mean,
          dfa_alpha1_mean: b.stats?.dfa_alpha1?.mean,
          samples_count: b.segment_count,
          confidence: b.is_mature ? 0.95 : (b.segment_count / 20)
        };
      };

      setBaselineData(flattenStats(active));
      setPrevBaseline(flattenStats(prev));
    } else {
      setBaselineData(null);
      setPrevBaseline(null);
    }
  }, [allBaselines, selectedActivity]);

  const selectorOptions = [
    ...(participants.length > 0
      ? participants.map(p => ({
          id: p.guid || p._id,
          name: p.name || p.guid || p._id,
          device: p.current_device || 'Polar H10'
        }))
      : [
          { id: 'P012', name: 'P012', device: 'Polar H10' },
          { id: 'P002', name: 'P002', device: 'Polar H10' },
          { id: 'P003', name: 'P003', device: 'Polar H10' },
          { id: 'P005', name: 'P005', device: 'Polar H10' },
          { id: 'P006', name: 'P006', device: 'Polar H10' }
        ])
  ];

  if (selectedParticipantId && !selectorOptions.some(opt => opt.id === selectedParticipantId)) {
    selectorOptions.unshift({
      id: selectedParticipantId,
      name: selectedParticipantId,
      device: 'Polar H10'
    });
  }

  // Generate pseudo-distribution based on mean
  const generateDistribution = (mean: number, sd: number) => {
    const bars = [];
    // Map mean 50-130 bpm to index 0-8
    const peakIndex = (mean - 50) / 10;
    const variance = Math.max(0.8, (sd || 10) / 10);
    
    for (let i = 0; i < 9; i++) {
      let val = Math.exp(-Math.pow(i - peakIndex, 2) / (2 * variance * variance));
      bars.push(Math.max(0.05, val) * 95);
    }
    return bars;
  };

  const distBars = baselineData?.hr_mean ? generateDistribution(baselineData.hr_mean, baselineData.hr_sd) : [20, 35, 55, 95, 85, 60, 40, 22, 12];

  // Generate baseline band trajectory
  const generateBand = (mean: number, sd: number) => {
    // Map mean 50-130 to Y center 45 to 15 (higher mean = higher up on graph = lower Y)
    const center = Math.max(15, Math.min(45, 45 - ((mean - 50) / 80) * 30));
    const bandWidth = Math.max(5, Math.min(25, (sd || 10) * 1.5));
    const top = center - bandWidth;
    const bot = center + bandWidth;
    const polygon = `0,${top} 300,${top} 300,${bot} 0,${bot}`;
    
    const pts = [];
    for (let i=0; i<=8; i++) {
      const x = i * (300/8);
      const y = center + (Math.sin(mean * i * 3) * (bandWidth - 2));
      pts.push(`${Math.round(x)},${Math.round(y)}`);
    }
    const polyline = pts.join(' ');
    
    return { polygon, polyline };
  };

  const band = generateBand(baselineData?.hr_mean || 77, baselineData?.hr_sd || 6.1);

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Baseline model</h1>
        <DeviceSelector selectedId={selectedParticipantId} onChange={onParticipantChange} options={selectorOptions} />
      </div>

      <div className="form-row mb-4">
        <span className="select-chip font-mono">{selectedParticipantId}</span>
        {allBaselines.length > 0 ? (
          <select 
            className="select-chip" 
            value={selectedActivity} 
            onChange={(e) => setSelectedActivity(e.target.value)}
            style={{ outline: 'none', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            {Array.from(new Set(allBaselines.map(b => b.activity))).map(act => (
              <option key={act as string} value={act as string}>{act as string}</option>
            ))}
          </select>
        ) : (
          <span className="select-chip">{baselineData?.activity || 'No Activity'}</span>
        )}
        <span className="select-chip font-mono">v{baselineData?.version || '1.0'} · {baselineData?.updated_at ? new Date(baselineData.updated_at).toLocaleDateString() : '—'}</span>
      </div>

      <div className="metric-row mb-4">
        <div className="metric"><span className="eyebrow">HR mean</span><div className="metric-value">{baselineData?.hr_mean ? Math.round(baselineData.hr_mean) : 77} bpm</div></div>
        <div className="metric"><span className="eyebrow">HR SD</span><div className="metric-value">{baselineData?.hr_sd ? baselineData.hr_sd.toFixed(1) : 6.1}</div></div>
        <div className="metric"><span className="eyebrow">RMSSD mean</span><div className="metric-value">{baselineData?.rmssd_mean ? Math.round(baselineData.rmssd_mean) : 31} ms</div></div>
        <div className="metric"><span className="eyebrow">DFA Alpha-1</span><div className="metric-value">{baselineData?.dfa_alpha1_mean ? baselineData.dfa_alpha1_mean.toFixed(2) : 1.09}</div></div>
        <div className="metric"><span className="eyebrow">Observation</span><div className="metric-value">{baselineData?.samples_count || 518} win</div></div>
        <div className="metric"><span className="eyebrow">Confidence</span><div className="metric-value">{baselineData?.confidence ? Math.round(baselineData.confidence * 100) : 94}%</div></div>
      </div>

      <div className="two-col mb-4">
        <div className="chart-card">
          <p className="card-title">Distribution (HR)</p>
          <div className="bars" style={{ height: '80px' }}>
            {distBars.map((h, i) => (
              <div key={i} className={`bar ${h > 75 ? 'peak' : ''}`} style={{ height: `${h}%`, transition: 'height 0.3s ease' }}></div>
            ))}
          </div>
        </div>
        <div className="chart-card flex flex-col justify-between">
          <p className="card-title !m-0">Baseline band</p>
          <div className="py-md">
            <svg viewBox="0 0 300 60" width="100%" height="60" preserveAspectRatio="none" className="overflow-visible" style={{ transition: 'all 0.3s ease' }}>
              <polygon points={band.polygon} fill="var(--hairline)" opacity="0.4" style={{ transition: 'all 0.3s ease' }} />
              <polyline points={band.polyline} fill="none" stroke="var(--primary)" strokeWidth="2" style={{ transition: 'all 0.3s ease' }} />
            </svg>
          </div>
        </div>
      </div>

      {showCompare && (
        <div className="card mb-4 animate-fadein" style={{ borderColor: 'var(--primary)', borderWidth: '1.5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <p className="card-title !m-0" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Columns size={16} style={{ color: 'var(--primary)' }} />
              Model Comparison: v1.2 vs v1.1 ({selectedParticipantId})
            </p>
            <span className="badge badge-stable" style={{ fontSize: '11px' }}>Comparison Ready</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Active Model */}
            <div style={{ background: 'var(--surface-raised)', padding: '14px', borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)' }}>
              <span className="badge badge-stable mb-3" style={{ fontSize: '10.5px' }}><span className="badge-dot"></span>Active</span>
              <div className="kv-grid font-sans text-xs">
                <div className="kv-item"><span className="eyebrow">HR Mean</span><div className="kv-value">{baselineData?.hr_mean ? Math.round(baselineData.hr_mean) : '—'} bpm</div></div>
                <div className="kv-item"><span className="eyebrow">HR SD</span><div className="kv-value">{baselineData?.hr_sd ? baselineData.hr_sd.toFixed(1) : '—'}</div></div>
                <div className="kv-item"><span className="eyebrow">RMSSD</span><div className="kv-value">{baselineData?.rmssd_mean ? Math.round(baselineData.rmssd_mean) : '—'} ms</div></div>
                <div className="kv-item"><span className="eyebrow">DFA Alpha-1</span><div className="kv-value">{baselineData?.dfa_alpha1_mean ? baselineData.dfa_alpha1_mean.toFixed(2) : '—'}</div></div>
                <div className="kv-item"><span className="eyebrow">Confidence</span><div className="kv-value">{baselineData?.confidence ? Math.round(baselineData.confidence * 100) : 0}%</div></div>
                <div className="kv-item"><span className="eyebrow">Windows</span><div className="kv-value">{baselineData?.samples_count || 0} win</div></div>
              </div>
            </div>

            {/* Previous Model */}
            <div style={{ background: 'var(--surface-raised)', padding: '14px', borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)', opacity: 0.85 }}>
              <span className="badge badge-inactive mb-3" style={{ fontSize: '10.5px' }}><span className="badge-dot"></span>Previous</span>
              <div className="kv-grid font-sans text-xs">
                <div className="kv-item"><span className="eyebrow">HR Mean</span><div className="kv-value">{prevBaseline?.hr_mean ? Math.round(prevBaseline.hr_mean) : '—'} bpm</div></div>
                <div className="kv-item"><span className="eyebrow">HR SD</span><div className="kv-value">{prevBaseline?.hr_sd ? prevBaseline.hr_sd.toFixed(1) : '—'}</div></div>
                <div className="kv-item"><span className="eyebrow">RMSSD</span><div className="kv-value">{prevBaseline?.rmssd_mean ? Math.round(prevBaseline.rmssd_mean) : '—'} ms</div></div>
                <div className="kv-item"><span className="eyebrow">DFA Alpha-1</span><div className="kv-value">{prevBaseline?.dfa_alpha1_mean ? prevBaseline.dfa_alpha1_mean.toFixed(2) : '—'}</div></div>
                <div className="kv-item"><span className="eyebrow">Confidence</span><div className="kv-value">{prevBaseline?.confidence ? Math.round(prevBaseline.confidence * 100) : 0}%</div></div>
                <div className="kv-item"><span className="eyebrow">Windows</span><div className="kv-value">{prevBaseline?.samples_count || 0} win</div></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="action-bar">
        <button
          className={`btn ${showCompare ? 'btn-outline' : 'btn-primary'} flex items-center gap-1`}
          onClick={() => setShowCompare(!showCompare)}
        >
          <Columns size={14} /> Compare models
        </button>
        <button className="btn btn-outline flex items-center gap-1"><Check size={14} /> Freeze model</button>
        <div className="action-bar-divider"></div>
        <button className="btn btn-ghost flex items-center gap-1"><ArrowClockwise size={14} /> Rollback</button>
        <button className="btn btn-ghost flex items-center gap-1"><DownloadSimple size={14} /> Export</button>
      </div>
    </section>
  );
};
