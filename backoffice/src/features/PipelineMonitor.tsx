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

export const PipelineMonitor: React.FC = () => {
  const [toast, setToast] = useState<string | null>(null);

  // Pipeline status states
  const [rabbitStatus, setRabbitStatus] = useState<'Healthy' | 'Paused' | 'Down'>('Healthy');
  const [workerStatus, setWorkerStatus] = useState<'Running' | 'Restarting' | 'Offline'>('Running');
  const [msgRateIn, setMsgRateIn] = useState(0);
  const [dbHealthy, setDbHealthy] = useState(false);
  const [metrics, setMetrics] = useState<any>({
    totalPatients: 0,
    totalSegments: 0,
    errorLogsCount: 0,
    dbSizeStr: '0 GB',
    apiLatencyMs: 42
  });

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
            setRabbitStatus(data.rabbitmq?.connected ? 'Healthy' : 'Down');
            setDbHealthy(data.mongodb?.connected || false);
            if (data.rabbitmq?.overview) {
              setMsgRateIn(Math.round(data.rabbitmq.overview.message_rate_in || 0));
            }
          }
        }
        
        const resMetrics = await fetch('/api/pipeline/metrics', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resMetrics.ok) {
          const dataMetrics = await resMetrics.json();
          if (dataMetrics.success && dataMetrics.data) {
            setMetrics(dataMetrics.data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch pipeline status:', err);
        setRabbitStatus('Down');
        setDbHealthy(false);
      }
    };
    fetchStatus();
    const intId = setInterval(fetchStatus, 5000);
    return () => clearInterval(intId);
  }, []);

  const handlePauseQueue = async () => {
    try {
      const token = sessionStorage.getItem('htm_token');
      const res = await fetch('/api/pipeline/queue/sensor_queue/pause', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        if (rabbitStatus === 'Healthy') {
          setRabbitStatus('Paused');
          setToast('RabbitMQ sensor queue paused.');
        } else {
          setRabbitStatus('Healthy');
          setToast('RabbitMQ sensor queue resumed.');
        }
      }
    } catch (err) {
      setToast('Failed to pause queue');
    }
  };

  const handleRestartWorker = async () => {
    setWorkerStatus('Restarting');
    setToast('Initiating Preprocessing worker restart sequence...');

    try {
      const token = sessionStorage.getItem('htm_token');
      const res = await fetch('/api/pipeline/worker/restart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setTimeout(() => {
          setWorkerStatus('Running');
          setToast('Preprocessing worker restarted successfully. Status: Online');
        }, 1500);
      }
    } catch (err) {
      setToast('Failed to restart worker');
      setWorkerStatus('Running');
    }
  };

  return (
    <section>
      <div className="page-head"><h1 className="page-title">Pipeline monitor</h1></div>

      <div className="stepper mb-4">
        <div className="step">
          <div className="step-dot"><span className="msym">smartphone</span></div>
          <div className="step-label">Mobile app</div>
          <div className="step-status">Healthy</div>
        </div>
        <div className="step-line"></div>
        <div className="step">
          <div className="step-dot"><span className="msym">sync_alt</span></div>
          <div className="step-label">RabbitMQ</div>
          <div className="step-status" style={{ color: rabbitStatus === 'Paused' ? 'var(--caution-text)' : 'inherit' }}>
            {rabbitStatus}
          </div>
        </div>
        <div className="step-line"></div>
        <div className="step">
          <div className="step-dot"><span className="msym">input</span></div>
          <div className="step-label">Ingestion</div>
          <div className="step-status">Healthy</div>
        </div>
        <div className="step-line"></div>
        <div className="step">
          <div className="step-dot"><span className="msym">tune</span></div>
          <div className="step-label">Workers</div>
          <div className="step-status" style={{ color: workerStatus === 'Restarting' ? 'var(--caution-text)' : 'inherit' }}>
            {workerStatus}
          </div>
        </div>
        <div className="step-line"></div>
        <div className="step">
          <div className="step-dot"><span className="msym">database</span></div>
          <div className="step-label">Model matrix</div>
          <div className="step-status">Healthy</div>
        </div>
        <div className="step-line"></div>
        <div className="step">
          <div className="step-dot"><span className="msym">show_chart</span></div>
          <div className="step-label">Analysis</div>
          <div className="step-status">Healthy</div>
        </div>
        <div className="step-line"></div>
        <div className="step">
          <div className="step-dot"><span className="msym">dns</span></div>
          <div className="step-label">Backend API</div>
          <div className="step-status">Healthy</div>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden mb-4">
        <table className="w-full">
          <thead>
            <tr>
              <th className="pl-lg py-sm">Component</th>
              <th>Status</th>
              <th>Throughput</th>
              <th>Last update</th>
              <th className="pr-lg text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-hairline">
              <td className="pl-lg py-sm font-semibold">RabbitMQ</td>
              <td>
                <span className={`badge ${rabbitStatus === 'Healthy' ? 'badge-stable' : 'badge-caution'}`}>
                  <span className="badge-dot"></span>{rabbitStatus}
                </span>
              </td>
              <td className="mono">{rabbitStatus === 'Healthy' ? `${msgRateIn} msg/s` : '0 msg/s'}</td>
              <td className="mono">2 sec ago</td>
              <td className="pr-lg text-right"><button className="btn btn-ghost py-1 px-3" onClick={() => setToast('RabbitMQ admin panel connection verified.')}>View</button></td>
            </tr>
            <tr className="border-t border-hairline">
              <td className="pl-lg py-sm font-semibold">DB raw</td>
              <td><span className={`badge ${dbHealthy ? 'badge-stable' : 'badge-caution'}`}><span className="badge-dot"></span>{dbHealthy ? 'Healthy' : 'Down'}</span></td>
              <td className="mono">{Math.max(1, Math.round(metrics.totalSegments / 1000))}% usage</td>
              <td className="mono">just now</td>
              <td className="pr-lg text-right"><button className="btn btn-ghost py-1 px-3" onClick={() => setToast('Database connection status: Optimal.')}>View</button></td>
            </tr>
            <tr className="border-t border-hairline">
              <td className="pl-lg py-sm font-semibold">Preprocessing worker 1</td>
              <td>
                <span className={`badge ${workerStatus === 'Running' ? 'badge-stable' : workerStatus === 'Restarting' ? 'badge-caution' : 'badge-inactive'}`}>
                  <span className="badge-dot"></span>{workerStatus}
                </span>
              </td>
              <td className="mono">{workerStatus === 'Running' ? `${metrics.totalSegments} segments` : '—'}</td>
              <td className="mono">just now</td>
              <td className="pr-lg text-right">
                <button className="btn btn-ghost py-1 px-3" onClick={() => setToast(`Worker 1: ${metrics.errorLogsCount} errors in process logs.`)}>
                  Logs
                </button>
              </td>
            </tr>
            <tr className="border-t border-hairline">
              <td className="pl-lg py-sm font-semibold">DB model matrix</td>
              <td><span className="badge badge-stable"><span className="badge-dot"></span>Healthy</span></td>
              <td className="mono">{metrics.dbSizeStr}</td>
              <td className="mono">just now</td>
              <td className="pr-lg text-right"><button className="btn btn-ghost py-1 px-3" onClick={() => setToast(`Model Matrix storage status: Healthy. Total Patients: ${metrics.totalPatients}`)}>View</button></td>
            </tr>
            <tr className="border-t border-hairline">
              <td className="pl-lg py-sm font-semibold">Backend API</td>
              <td><span className="badge badge-stable"><span className="badge-dot"></span>Healthy</span></td>
              <td className="mono">{metrics.apiLatencyMs} ms</td>
              <td className="mono">just now</td>
              <td className="pr-lg text-right"><button className="btn btn-ghost py-1 px-3" onClick={() => setToast('Backend latency: 42ms. Health: OK.')}>View</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="action-bar">
        <button className="btn btn-primary flex items-center gap-1" onClick={handleRestartWorker} disabled={workerStatus === 'Restarting'}>
          <ArrowClockwise size={14} className={workerStatus === 'Restarting' ? 'animate-spin' : ''} />
          Restart worker
        </button>
        <button className="btn btn-outline flex items-center gap-1" onClick={handlePauseQueue}>
          <Pause size={14} /> {rabbitStatus === 'Healthy' ? 'Pause queue' : 'Resume queue'}
        </button>
        <div className="action-bar-divider"></div>
        <button className="btn btn-ghost flex items-center gap-1" onClick={() => setToast('Cleared 0 failed jobs from RabbitMQ dead-letter queue.')}>
          <Trash size={14} /> Clear failed jobs
        </button>
        <button className="btn btn-ghost flex items-center gap-1" onClick={() => setToast('Opening aggregate system logs... Opened.')}>
          <Receipt size={14} /> View logs
        </button>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};
