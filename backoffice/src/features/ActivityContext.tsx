import React, { useEffect, useState } from 'react';
import {
  CloudArrowUp, DownloadSimple, Eye, ArrowClockwise, Sliders, Pause, X, Receipt,
  Columns, FileText, Trash, FloppyDisk, UserPlus, Check, Lightning
} from '@phosphor-icons/react';

export interface AnalyticsProps {
  selectedParticipantId: string;
  onParticipantChange: (id: string) => void;
}

import { DeviceSelector } from '../shared/components/ParticipantSelector';

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
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]); // Default to today

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
        const idToFetch = selectedParticipantId;
        const res = await fetch(`/api/analysis/activity-context/${idToFetch}?date=${selectedDay}`, {
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
  }, [selectedParticipantId, selectedDay]);

  const handleRecalculate = () => {
    setRecalculating(true);
    setToast(`Initializing baseline recalculation for ${selectedParticipantId}...`);

    setTimeout(() => {
      setRecalculating(false);
      setToast('Baseline recalculation completed successfully. Model v1.3 generated.');
    }, 2000);
  };

  return (
    <section>
      <div className="page-head mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Activity context</h1>
        <DeviceSelector selectedId={selectedParticipantId} onChange={onParticipantChange} />
      </div>

      <div className="card mb-4" style={{ padding: '12px 16px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <div>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Pilih Tanggal</span>
          <input 
            type="date" 
            value={selectedDay} 
            onChange={(e) => setSelectedDay(e.target.value)} 
            className="select-chip font-mono"
            style={{ padding: '4px 8px', border: '1px solid var(--hairline)', borderRadius: 4, background: 'var(--surface)', color: 'var(--ink)' }}
          />
        </div>
        <div style={{ marginTop: 18 }}>
          <button 
            onClick={() => setSelectedDay(new Date().toISOString().split('T')[0])}
            className="select-chip"
            style={{ cursor: 'pointer', padding: '6px 12px' }}
          >
            Reset Tanggal
          </button>
        </div>
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
