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
}> = ({ selectedId, onChange }) => {
  const list = ['P012', 'P002', 'P003', 'P005', 'P006'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span className="eyebrow" style={{ color: 'var(--muted)' }}>Select Device:</span>
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
        {list.map(id => (
          <option key={id} value={id}>
            {id} (Polar H10)
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

export const Preprocessing: React.FC = () => {
  const [toast, setToast] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);

  // Parameter states
  const [filterType, setFilterType] = useState('Median');
  const [smoothing, setSmoothing] = useState('Moving average');
  const [windowSize, setWindowSize] = useState('3 min');
  const [overlap, setOverlap] = useState('50%');
  const [completeness, setCompleteness] = useState('80%');
  const [outlier, setOutlier] = useState('3.0 SD');

  React.useEffect(() => {
    const fetchJobs = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch('/api/pipeline/jobs', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setJobs(data.data);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchJobs();
  }, []);

  const handleJobAction = async (jobId: string, action: string) => {
    try {
      const token = sessionStorage.getItem('htm_token');
      const res = await fetch(`/api/pipeline/job/${jobId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setToast(data.message || `Job ${jobId} ${action} successful.`);
        // Optimistic update
        setJobs(prev => prev.map(j => {
          if (j.id === jobId) {
            if (action === 'rerun') return { ...j, status: 'Running', progress: 0 };
            if (action === 'pause') return { ...j, status: 'Paused' };
            if (action === 'cancel') return { ...j, status: 'Cancelled' };
          }
          return j;
        }));
      }
    } catch (err: any) {
      setToast('Action failed: ' + err.message);
    }
  };

  const activeJob = jobs.length > 0 ? jobs[0] : null;
  const activeJobId = activeJob ? activeJob.id : 'None';
  const runningCount = jobs.filter(j => j.status === 'Running').length;
  const completedCount = jobs.filter(j => j.status === 'Completed').length;

  const handleRerun = () => {
    if (activeJobId !== 'None') handleJobAction(activeJobId, 'rerun');
  };

  const handlePause = () => {
    if (activeJobId !== 'None') handleJobAction(activeJobId, 'pause');
  };

  const handleCancel = () => {
    if (activeJobId !== 'None') handleJobAction(activeJobId, 'cancel');
  };

  return (
    <section>
      <div className="page-head"><h1 className="page-title">Preprocessing</h1></div>

      <div className="kpi-grid">
        <div className="kpi"><span className="eyebrow">Total jobs</span><div className="kpi-value">32</div></div>
        <div className="kpi"><span className="eyebrow">Running</span><div className="kpi-value">{runningCount}</div></div>
        <div className="kpi"><span className="eyebrow">Completed</span><div className="kpi-value">{completedCount}</div></div>
        <div className="kpi warn"><span className="eyebrow">Failed</span><div className="kpi-value">1</div></div>
      </div>

      <div className="card !p-0 overflow-hidden mb-4">
        <p className="card-title p-md !m-0 border-b border-hairline">Job preprocessing</p>
        <table className="w-full">
          <thead>
            <tr>
              <th className="pl-lg py-sm">Job ID</th>
              <th>Participant</th>
              <th>Batch</th>
              <th style={{ width: '140px' }}>Progress</th>
              <th className="pr-lg text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t border-hairline">
                <td className="mono pl-lg py-sm">{job.id}</td>
                <td className="mono">{job.participant}</td>
                <td className="mono">{job.batch.toLocaleString()}</td>
                <td>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${job.progress}%` }}></div>
                  </div>
                </td>
                <td className="pr-lg text-right">
                  <span className={`badge ${job.status === 'Completed' ? 'badge-stable' : job.status === 'Paused' ? 'badge-caution' : job.status === 'Cancelled' ? 'badge-inactive' : 'badge-monitoring'}`}>
                    <span className="badge-dot"></span>
                    {job.status} {job.status === 'Running' && `${job.progress}%`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card mb-4">
        <p className="card-title border-b border-hairline pb-2 mb-3">Parameter preprocessing — PRE-1023</p>
        <div className="kv-grid font-sans text-xs">
          <div className="kv-item">
            <span className="eyebrow">Filter type</span>
            <select className="select-chip py-1 px-2 mt-1 w-full" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="Median">Median Filter</option>
              <option value="Butterworth">Butterworth Lowpass</option>
              <option value="Chebyshev">Chebyshev Type II</option>
            </select>
          </div>
          <div className="kv-item">
            <span className="eyebrow">Smoothing method</span>
            <select className="select-chip py-1 px-2 mt-1 w-full" value={smoothing} onChange={(e) => setSmoothing(e.target.value)}>
              <option value="Moving average">Moving average</option>
              <option value="Savitzky-Golay">Savitzky-Golay filter</option>
            </select>
          </div>
          <div className="kv-item">
            <span className="eyebrow">Window size</span>
            <select className="select-chip py-1 px-2 mt-1 w-full" value={windowSize} onChange={(e) => setWindowSize(e.target.value)}>
              <option value="3 min">3 minutes</option>
              <option value="5 min">5 minutes</option>
              <option value="10 min">10 minutes</option>
            </select>
          </div>
          <div className="kv-item">
            <span className="eyebrow">Overlap</span>
            <select className="select-chip py-1 px-2 mt-1 w-full" value={overlap} onChange={(e) => setOverlap(e.target.value)}>
              <option value="50%">50% Overlap</option>
              <option value="25%">25% Overlap</option>
              <option value="75%">75% Overlap</option>
            </select>
          </div>
          <div className="kv-item">
            <span className="eyebrow">Min completeness</span>
            <select className="select-chip py-1 px-2 mt-1 w-full" value={completeness} onChange={(e) => setCompleteness(e.target.value)}>
              <option value="80%">80% minimum</option>
              <option value="90%">90% minimum</option>
            </select>
          </div>
          <div className="kv-item">
            <span className="eyebrow">Outlier threshold</span>
            <select className="select-chip py-1 px-2 mt-1 w-full" value={outlier} onChange={(e) => setOutlier(e.target.value)}>
              <option value="3.0 SD">3.0 Standard Dev</option>
              <option value="2.5 SD">2.5 Standard Dev</option>
              <option value="4.0 SD">4.0 Standard Dev</option>
            </select>
          </div>
        </div>
      </div>

      <div className="action-bar">
        <button className="btn btn-primary flex items-center gap-1" onClick={handleRerun} disabled={activeJob?.status === 'Completed' || !activeJob}>
          <ArrowClockwise size={14} /> Jalankan ulang
        </button>
        <button className="btn btn-outline flex items-center gap-1" onClick={handlePause} disabled={activeJob?.status === 'Completed' || activeJob?.status === 'Cancelled' || !activeJob}>
          <Pause size={14} /> {activeJob?.status === 'Paused' ? 'Resume' : 'Pause'}
        </button>
        <div className="action-bar-divider"></div>
        <button className="btn btn-ghost flex items-center gap-1" onClick={handleCancel} disabled={activeJob?.status === 'Completed' || activeJob?.status === 'Cancelled' || !activeJob}>
          <X size={14} /> Cancel
        </button>
        <button className="btn btn-ghost flex items-center gap-1" onClick={() => setToast('LOG PRE-1023: Smoothing applied. MedFilter: OK.')}>
          <Receipt size={14} /> View logs
        </button>
        <button className="btn btn-ghost flex items-center gap-1" onClick={() => setToast('Comparing v1.2 parameters vs v1.1. Parameter variance: 0%')}>
          <Columns size={14} /> Compare before-after
        </button>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};
