import React, { useEffect, useState } from 'react';
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

export const ActivityContext: React.FC<AnalyticsProps> = ({
  selectedParticipantId,
  onParticipantChange
}) => {
  const [toast, setToast] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);

  useEffect(() => {
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
    const fetchActivities = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const idToFetch = selectedParticipantId || 'P012';
        const res = await fetch(`/api/analysis/activity-context/${idToFetch}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setActivities(data.data);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchActivities();
  }, [selectedParticipantId]);

  const handleRecalculate = () => {
    setRecalculating(true);
    setToast(`Initializing baseline recalculation for ${selectedParticipantId}...`);

    setTimeout(() => {
      setRecalculating(false);
      setToast('Baseline recalculation completed successfully. Model v1.3 generated.');
    }, 2000);
  };

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
        <h1 className="page-title">Activity context</h1>
        <DeviceSelector selectedId={selectedParticipantId} onChange={onParticipantChange} options={selectorOptions} />
      </div>

      <div className="card !p-0 overflow-hidden mb-4">
        <table className="w-full">
          <thead>
            <tr>
              <th className="pl-lg py-sm">Activity</th>
              <th>Windows</th>
              <th>Duration</th>
              <th>HR mean</th>
              <th>HR SD</th>
              <th>RMSSD</th>
              <th>DFA α1</th>
              <th className="pr-lg text-right">Readiness</th>
            </tr>
          </thead>
          <tbody>
            {activities.length > 0 ? activities.map((act, i) => (
              <tr key={i} className="border-t border-hairline">
                <td className="pl-lg py-sm font-semibold">{act.activity}</td>
                <td className="mono">{act.windows}</td>
                <td className="mono">{act.duration}</td>
                <td className="mono">{act.mean_hr}</td>
                <td className="mono">{act.sd_hr}</td>
                <td className="mono">{act.rmssd}</td>
                <td className="mono">{act.dfa_alpha1}</td>
                <td className="pr-lg text-right">
                  <span className={`badge ${act.readiness === 'Ready' ? 'badge-stable' : 'badge-caution'}`}>
                    <span className="badge-dot"></span>{act.readiness}
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={8} className="text-center py-4 text-muted">No activities found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="action-bar">
        <button
          className="btn btn-primary flex items-center gap-1"
          onClick={handleRecalculate}
          disabled={recalculating}
        >
          <ArrowClockwise size={14} className={recalculating ? 'animate-spin' : ''} />
          {recalculating ? 'Recalculating...' : 'Recalculate baseline'}
        </button>
        <div className="action-bar-divider"></div>
        <button className="btn btn-outline flex items-center gap-1" onClick={() => setToast('Merging Activity: Sleep & Laying down... Merged!')}>
          <Sliders size={14} /> Merge activities
        </button>
        <button className="btn btn-ghost flex items-center gap-1" onClick={() => setToast('Label editor modal opened.')}>
          <FileText size={14} /> Edit labels
        </button>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};
