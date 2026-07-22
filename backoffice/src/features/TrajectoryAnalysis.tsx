import React, { useState } from 'react';

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

export const TrajectoryAnalysis: React.FC<AnalyticsProps> = ({
  selectedParticipantId,
  onParticipantChange
}) => {
  const [activeTab, setActiveTab] = useState('Magnitude');
  const tabs = ['Magnitude', 'Duration', 'Persistence', 'Recovery', 'Slope', 'Multi-feature'];
  const [pointsStr, setPointsStr] = useState("0,95 900,95");
  const [peak, setPeak] = useState({ x: 0, y: 0, score: 0 });
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
  const [trajStats, setTrajStats] = useState({
    magnitude: '0.0',
    started: '—',
    duration: '0 min',
    recovery: '0%',
    estimated: '—',
    status: 'Stable'
  });

  React.useEffect(() => {
    const fetchSegments = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const idToFetch = selectedParticipantId || 'P012';
        const res = await fetch(`/api/analysis/segments/${idToFetch}?limit=20`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data && data.data.length > 0) {
            // Sort ascending by time for graph
            const segments = data.data.sort((a: any, b: any) => a.window_start - b.window_start);
            const latest = segments[segments.length - 1];
            const first = segments[0];
            
            // Build dynamic SVG points
            const width = 900;
            const points = segments.map((seg: any, idx: number) => {
              const x = (idx / (segments.length - 1 || 1)) * width;
              // Map score 0-4 to Y 120-20 (higher score = lower Y, inverted graph)
              const score = seg.anomaly_score || 0;
              const y = 120 - (Math.min(score, 4) / 4) * 100;
              return { x, y, score };
            });
            
            setPointsStr(points.map((p: any) => `${p.x},${p.y}`).join(' '));
            
            // Find peak
            let maxP = points[0];
            points.forEach((p: any) => { if(p.score > maxP.score) maxP = p; });
            setPeak(maxP);

            const durationMs = latest.window_start - first.window_start;
            const durationMin = Math.round(durationMs / 60000);
            
            // Recovery % is how close we are to baseline score 0 from the peak score
            const recoveryPct = maxP.score > 0 ? Math.round(((maxP.score - (latest.anomaly_score || 0)) / maxP.score) * 100) : 100;

            setTrajStats({
              magnitude: latest.anomaly_score ? parseFloat(latest.anomaly_score).toFixed(1) : '0.0',
              started: first.window_start ? new Date(first.window_start).toLocaleTimeString() : '—',
              duration: `${durationMin} min`,
              recovery: `${Math.max(0, recoveryPct)}%`,
              estimated: latest.classification === 'Normal' ? 'Resolved' : '~5 min',
              status: latest.classification === 'Normal' ? 'Stable' : 'Deviation'
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch segments:', err);
      }
    };
    fetchSegments();
  }, [selectedParticipantId]);

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

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Trajectory analysis</h1>
        <DeviceSelector selectedId={selectedParticipantId} onChange={onParticipantChange} options={selectorOptions} />
      </div>

      <div className="traj-status-card mb-4">
        <div>
          <span className={`badge ${trajStats.status === 'Stable' ? 'badge-stable' : 'badge-caution'}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
            <span className="badge-dot"></span>{trajStats.status}
          </span>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
            {trajStats.status === 'Stable' ? 'On baseline' : 'Moving toward baseline'}
          </div>
        </div>
        <div className="traj-figures">
          <div className="traj-figure"><span className="eyebrow">Magnitude</span><div className="traj-figure-value">{trajStats.magnitude}</div></div>
          <div className="traj-figure"><span className="eyebrow">Started</span><div className="traj-figure-value">{trajStats.started}</div></div>
          <div className="traj-figure"><span className="eyebrow">Duration</span><div className="traj-figure-value">{trajStats.duration}</div></div>
          <div className="traj-figure"><span className="eyebrow">Recovery</span><div className="traj-figure-value">{trajStats.recovery}</div></div>
          <div className="traj-figure"><span className="eyebrow">Estimated</span><div className="traj-figure-value">{trajStats.estimated}</div></div>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((tab) => (
          <div
            key={tab}
            className={`tab ${activeTab === tab ? 'on' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </div>
        ))}
      </div>

      <div className="chart-card mb-4">
        <div className="py-md">
          <svg viewBox="0 0 900 200" width="100%" height="200" preserveAspectRatio="none" className="overflow-visible">
            <polygon points="0,60 900,60 900,120 0,120" fill="var(--hairline)" opacity="0.4" />
            <line x1={peak.x} y1="10" x2={peak.x} y2="180" stroke="var(--hairline)" strokeWidth="1" strokeDasharray="1 1" />
            <polyline points="0,90 60,88 120,89 180,91 240,89 300,90 360,89 420,88 480,89 540,90 600,88 660,89 720,90 780,89 840,88 900,89" fill="none" stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 3" />
            <polyline points={pointsStr} fill="none" stroke="var(--deviation-text)" strokeWidth="2" />
            {peak.score > 1.5 && (
              <circle cx={peak.x} cy={peak.y} r="5" fill="var(--alert-text)" />
            )}
          </svg>
        </div>
        <div style={{ display: 'flex', gap: '18px', fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
          <span style={{ color: 'var(--alert-text)' }}>■ Titik puncak ({parseFloat(peak.score.toString()).toFixed(1)})</span>
          <span style={{ color: 'var(--stable-text)' }}>■ Normal (0.0 - 1.5)</span>
        </div>
      </div>
    </section>
  );
};
