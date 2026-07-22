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

export const DataAcquisition: React.FC = () => {
  const [toast, setToast] = useState<string | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [queueDepth, setQueueDepth] = useState(0);
  const [rmqHealthy, setRmqHealthy] = useState(false);
  const [dbHealthy, setDbHealthy] = useState(false);
  const [recentData, setRecentData] = useState<any[]>([]);

  React.useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch('/api/pipeline/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setRmqHealthy(data.rabbitmq?.connected || false);
            setDbHealthy(data.mongodb?.connected || false);
            if (data.rabbitmq?.overview) {
              setMessagesCount(Math.round(data.rabbitmq.overview.message_rate_in || 0));
              setQueueDepth(data.rabbitmq.overview.queued_messages || 0);
            }
          }
        }

        const resData = await fetch('/api/pipeline/recent-data', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resData.ok) {
          const body = await resData.json();
          if (body.success && body.data) {
            setRecentData(body.data);
            setMessagesCount(body.data.length);
            setFailedCount(body.data.filter((d: any) => !d.is_valid).length);
          }
        }
      } catch (err) {
        console.error('Failed to fetch pipeline status:', err);
      }
    };
    fetchStatus();
    const intId = setInterval(fetchStatus, 5000);
    return () => clearInterval(intId);
  }, []);

  const handleUpload = () => {
    // Simulated upload trigger
    setToast('Uploading polar_data_2026.csv... Done! Ingested 150 readings.');
  };

  const handleRetry = () => {
    if (failedCount === 0) {
      setToast('No failed messages to retry.');
      return;
    }
    setToast(`Retrying ${failedCount} failed messages... Success!`);
    setFailedCount(0);
  };

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Data acquisition</h1>
        <span className="page-meta">Last message 2 sec ago</span>
      </div>

      <div className="stepper">
        <div className="step">
          <div className="step-dot"><span className="msym">smartphone</span></div>
          <div className="step-label">Flutter</div>
          <div className="step-status">Healthy</div>
        </div>
        <div className="step-line"></div>
        <div className="step">
          <div className="step-dot"><span className="msym">description</span></div>
          <div className="step-label">CSV</div>
          <div className="step-status">Healthy</div>
        </div>
        <div className="step-line"></div>
        <div className="step">
          <div className="step-dot"><span className="msym">sync_alt</span></div>
          <div className="step-label">RabbitMQ</div>
          <div className="step-status">{rmqHealthy ? 'Healthy' : 'Down'}</div>
        </div>
        <div className="step-line"></div>
        <div className="step">
          <div className="step-dot"><span className="msym">dns</span></div>
          <div className="step-label">Backend</div>
          <div className="step-status">Healthy</div>
        </div>
        <div className="step-line"></div>
        <div className="step">
          <div className="step-dot"><span className="msym">database</span></div>
          <div className="step-label">DB Raw</div>
          <div className="step-status">{dbHealthy ? 'Healthy' : 'Down'}</div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><span className="eyebrow">Incoming messages</span><div className="kpi-value">{messagesCount}<span className="text-xs text-muted"> /s</span></div></div>
        <div className="kpi"><span className="eyebrow">Queue depth</span><div className="kpi-value">{queueDepth}</div></div>
        <div className="kpi warn"><span className="eyebrow">Failed messages</span><div className="kpi-value">{failedCount}</div></div>
        <div className="kpi"><span className="eyebrow">Invalid records</span><div className="kpi-value">5<span className="text-xs text-muted"> (0.01%)</span></div></div>
      </div>

      <div className="card !p-0 overflow-hidden mb-4">
        <p className="card-title p-md !m-0 border-b border-hairline">Data masuk terbaru</p>
        <table className="w-full">
          <thead>
            <tr>
              <th className="pl-lg py-sm">Time</th>
              <th>Participant</th>
              <th>HR</th>
              <th>RR</th>
              <th>Activity</th>
              <th>Quality</th>
              <th className="pr-lg text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentData.length > 0 ? recentData.map((row: any, i: number) => (
              <tr key={i} className="border-t border-hairline">
                <td className="mono pl-lg py-sm">{row.window_start ? new Date(row.window_start).toLocaleTimeString() : '—'}</td>
                <td className="mono">{row.user_id?.device_id || 'Unknown'}</td>
                <td className="mono">{row.features?.mean_hr ? Math.round(row.features.mean_hr) : '—'}</td>
                <td className="mono">{row.features?.mean_rr ? Math.round(row.features.mean_rr) : '—'}</td>
                <td>{row.activity_label || 'Unknown'}</td>
                <td className="mono">{row.is_valid ? '98%' : '30%'}</td>
                <td className="pr-lg text-right">
                  <span className={`badge ${row.is_valid ? 'badge-stable' : 'badge-caution'}`}>
                    <span className="badge-dot"></span>{row.is_valid ? 'Valid' : 'Invalid'}
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="text-center py-4 text-muted">No recent data found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="action-bar">
        <button className="btn btn-primary flex items-center gap-1" onClick={handleUpload}>
          <CloudArrowUp size={14} /> Upload CSV
        </button>
        <div className="action-bar-divider"></div>
        <button className="btn btn-outline flex items-center gap-1" onClick={() => setToast('Downloading raw JSON dump... Completed.')}>
          <DownloadSimple size={14} /> Download raw
        </button>
        <button className="btn btn-ghost flex items-center gap-1" onClick={() => setToast('Showing 5 rejected schema validation records.')}>
          <Eye size={14} /> View rejected
        </button>
        <button className="btn btn-ghost flex items-center gap-1" onClick={handleRetry}>
          <ArrowClockwise size={14} /> Retry failed ingestion
        </button>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};
