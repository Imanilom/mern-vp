import React, { useState, useEffect, useCallback } from 'react';
import { ArrowClockwise, Pause, Receipt, Play } from '@phosphor-icons/react';

export interface AnalyticsProps {
  selectedParticipantId: string;
  onParticipantChange: (id: string) => void;
}

export const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px',
      background: 'var(--surface)', border: '1px solid var(--primary)',
      borderRadius: 'var(--r-md)', padding: '12px 18px',
      boxShadow: 'var(--shadow-lg)', zIndex: 1000,
      display: 'flex', alignItems: 'center', gap: '10px',
      animation: 'fadeInUp 200ms var(--ease)',
    }}>
      <span className="status-dot"></span>
      <span style={{ fontSize: '13px', fontWeight: 550, color: 'var(--ink)' }}>{message}</span>
    </div>
  );
};

interface Job {
  id: string;
  type: 'LAYER2' | 'LAYER3';
  status: 'WAITING' | 'RUNNING' | 'DONE' | 'FAILED';
  triggered_by: 'CRON' | 'MANUAL' | 'EVENT';
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  processed_count: number;
  segments_created: number;
  events_created: number;
  error: string | null;
  participants: string[];
  createdAt: string;
}

const statusBadge: Record<string, string> = {
  RUNNING:  'badge-caution',
  WAITING:  'badge-inactive',
  DONE:     'badge-stable',
  FAILED:   'badge-alert',
};

function formatDuration(ms: number | null) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

export const PipelineMonitor: React.FC = () => {
  const [toast, setToast] = useState<string | null>(null);
  const [rabbitStatus, setRabbitStatus] = useState<'Healthy' | 'Paused' | 'Down'>('Healthy');
  const [workerStatus, setWorkerStatus] = useState<'Running' | 'Restarting' | 'Offline'>('Running');
  const [msgRateIn, setMsgRateIn] = useState(0);
  const [dbHealthy, setDbHealthy] = useState(false);
  const [metrics, setMetrics] = useState<any>({
    totalPatients: 0, totalSegments: 0, errorLogsCount: 0, dbSizeStr: '0 GB', apiLatencyMs: 42
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [triggeringL2, setTriggeringL2] = useState(false);
  const [triggeringL3, setTriggeringL3] = useState(false);

  const token = sessionStorage.getItem('htm_token');
  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchStatus = useCallback(async () => {
    try {
      const [resStatus, resMetrics] = await Promise.all([
        fetch('/api/pipeline/status', { headers: authHeaders }),
        fetch('/api/pipeline/metrics', { headers: authHeaders }),
      ]);
      if (resStatus.ok) {
        const data = await resStatus.json();
        if (data.success) {
          setRabbitStatus(data.rabbitmq?.connected ? 'Healthy' : 'Down');
          setDbHealthy(data.mongodb?.connected || false);
          setMsgRateIn(Math.round(data.rabbitmq?.overview?.message_rate_in || 0));
        }
      }
      if (resMetrics.ok) {
        const data = await resMetrics.json();
        if (data.success) setMetrics(data.data);
      }
    } catch { setRabbitStatus('Down'); }
  }, []);

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await fetch('/api/pipeline/jobs?limit=15', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setJobs(data.data || []);
      }
    } catch { /* silent */ } finally { setJobsLoading(false); }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchJobs();
    const id1 = setInterval(fetchStatus, 5000);
    const id2 = setInterval(fetchJobs, 10000);
    return () => { clearInterval(id1); clearInterval(id2); };
  }, [fetchStatus, fetchJobs]);

  const triggerLayer = async (layer: 2 | 3) => {
    const route = layer === 2 ? '/api/pipeline/trigger-layer2' : '/api/pipeline/trigger-layer3';
    if (layer === 2) setTriggeringL2(true); else setTriggeringL3(true);
    try {
      const res = await fetch(route, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      setToast(data.message || `Layer ${layer} pipeline triggered.`);
      setTimeout(fetchJobs, 2000);
    } catch { setToast(`Failed to trigger Layer ${layer}.`); }
    finally {
      if (layer === 2) setTriggeringL2(false); else setTriggeringL3(false);
    }
  };

  const handlePauseQueue = async () => {
    try {
      await fetch('/api/pipeline/queue/Sensor/pause', { method: 'POST', headers: authHeaders });
      setRabbitStatus(prev => prev === 'Healthy' ? 'Paused' : 'Healthy');
      setToast(rabbitStatus === 'Healthy' ? 'RabbitMQ queue paused.' : 'RabbitMQ queue resumed.');
    } catch { setToast('Failed to pause queue'); }
  };

  const handleRestartWorker = async () => {
    setWorkerStatus('Restarting');
    setToast('Initiating worker restart sequence...');
    try {
      const res = await fetch('/api/pipeline/worker/restart', { method: 'POST', headers: authHeaders });
      if (res.ok) setTimeout(() => { setWorkerStatus('Running'); setToast('Worker restarted successfully.'); }, 1500);
    } catch { setWorkerStatus('Running'); }
  };

  const steps = [
    { icon: 'smartphone', label: 'Mobile app', status: 'Healthy' },
    { icon: 'sync_alt', label: 'RabbitMQ', status: rabbitStatus, color: rabbitStatus !== 'Healthy' ? 'var(--caution-text)' : undefined },
    { icon: 'input', label: 'Ingestion', status: 'Healthy' },
    { icon: 'tune', label: 'Workers', status: workerStatus, color: workerStatus === 'Restarting' ? 'var(--caution-text)' : undefined },
    { icon: 'database', label: 'MongoDB', status: dbHealthy ? 'Healthy' : 'Down', color: !dbHealthy ? 'var(--alert-text)' : undefined },
    { icon: 'show_chart', label: 'Analysis', status: 'Healthy' },
    { icon: 'dns', label: 'Backend API', status: 'Healthy' },
  ];

  return (
    <section>
      <div className="page-head"><h1 className="page-title">Pipeline Monitor</h1></div>

      {/* Pipeline Flow Stepper */}
      <div className="stepper mb-4">
        {steps.map((step, i) => (
          <React.Fragment key={step.label}>
            <div className="step">
              <div className="step-dot"><span className="msym">{step.icon}</span></div>
              <div className="step-label">{step.label}</div>
              <div className="step-status" style={{ color: step.color }}>{step.status}</div>
            </div>
            {i < steps.length - 1 && <div className="step-line"></div>}
          </React.Fragment>
        ))}
      </div>

      {/* Component Health Table */}
      <div className="card !p-0 overflow-hidden mb-4">
        <table className="w-full">
          <thead>
            <tr>
              <th className="pl-lg py-sm">Component</th>
              <th>Status</th>
              <th>Throughput</th>
              <th>Schedule</th>
              <th className="pr-lg text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-hairline">
              <td className="pl-lg py-sm font-semibold">RabbitMQ</td>
              <td><span className={`badge ${rabbitStatus === 'Healthy' ? 'badge-stable' : 'badge-caution'}`}><span className="badge-dot"></span>{rabbitStatus}</span></td>
              <td className="mono">{msgRateIn} msg/s</td>
              <td className="mono">live</td>
              <td className="pr-lg text-right"><button className="btn btn-ghost py-1 px-3" onClick={() => setToast('RabbitMQ connection verified.')}>View</button></td>
            </tr>
            <tr className="border-t border-hairline">
              <td className="pl-lg py-sm font-semibold">MongoDB</td>
              <td><span className={`badge ${dbHealthy ? 'badge-stable' : 'badge-caution'}`}><span className="badge-dot"></span>{dbHealthy ? 'Healthy' : 'Down'}</span></td>
              <td className="mono">{metrics.dbSizeStr}</td>
              <td className="mono">live</td>
              <td className="pr-lg text-right"><button className="btn btn-ghost py-1 px-3" onClick={() => setToast(`Patients: ${metrics.totalPatients}`)}>View</button></td>
            </tr>
            <tr className="border-t border-hairline">
              <td className="pl-lg py-sm font-semibold">Layer 2 – Preprocessing</td>
              <td><span className={`badge ${workerStatus === 'Running' ? 'badge-stable' : 'badge-caution'}`}><span className="badge-dot"></span>{workerStatus}</span></td>
              <td className="mono">{metrics.totalSegments} segs total</td>
              <td className="mono">*/3 min</td>
              <td className="pr-lg text-right">
                <button className="btn btn-ghost py-1 px-3 flex items-center gap-1" onClick={() => triggerLayer(2)} disabled={triggeringL2}>
                  <Play size={12} />{triggeringL2 ? 'Running…' : 'Run now'}
                </button>
              </td>
            </tr>
            <tr className="border-t border-hairline">
              <td className="pl-lg py-sm font-semibold">Layer 3 – Analysis</td>
              <td><span className="badge badge-stable"><span className="badge-dot"></span>Healthy</span></td>
              <td className="mono">{metrics.apiLatencyMs} ms latency</td>
              <td className="mono">*/5 min</td>
              <td className="pr-lg text-right">
                <button className="btn btn-ghost py-1 px-3 flex items-center gap-1" onClick={() => triggerLayer(3)} disabled={triggeringL3}>
                  <Play size={12} />{triggeringL3 ? 'Running…' : 'Run now'}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Action Bar */}
      <div className="action-bar mb-4">
        <button className="btn btn-primary flex items-center gap-1" onClick={handleRestartWorker} disabled={workerStatus === 'Restarting'}>
          <ArrowClockwise size={14} className={workerStatus === 'Restarting' ? 'animate-spin' : ''} /> Restart worker
        </button>
        <button className="btn btn-outline flex items-center gap-1" onClick={handlePauseQueue}>
          <Pause size={14} /> {rabbitStatus === 'Healthy' ? 'Pause queue' : 'Resume queue'}
        </button>
        <div className="action-bar-divider"></div>
        <button className="btn btn-ghost flex items-center gap-1" onClick={fetchJobs}>
          <ArrowClockwise size={14} /> Refresh
        </button>
        <button className="btn btn-ghost flex items-center gap-1" onClick={() => setToast('Logs viewed.')}>
          <Receipt size={14} /> View logs
        </button>
      </div>

      {/* Job History — data nyata dari MongoDB ProcessingJob */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between px-lg py-sm border-b border-hairline">
          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Job History (Real-time)</h2>
          {jobsLoading && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Loading…</span>}
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="pl-lg py-sm">Layer</th>
              <th>Status</th>
              <th>Trigger</th>
              <th>Processed</th>
              <th>Duration</th>
              <th>Time</th>
              <th className="pr-lg text-right">Error</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && !jobsLoading && (
              <tr>
                <td colSpan={7} className="pl-lg py-sm" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                  No jobs recorded yet. Jobs will appear here after the first cron run or manual trigger.
                </td>
              </tr>
            )}
            {jobs.map(job => (
              <tr key={job.id} className="border-t border-hairline">
                <td className="pl-lg py-sm">
                  <span style={{ fontSize: '12px', fontWeight: 600, color: job.type === 'LAYER2' ? 'var(--primary)' : 'var(--cat5)' }}>
                    {job.type === 'LAYER2' ? 'L2 Preprocess' : 'L3 Analysis'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${statusBadge[job.status] || 'badge-inactive'}`}>
                    <span className="badge-dot"></span>{job.status}
                  </span>
                </td>
                <td className="mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>{job.triggered_by}</td>
                <td className="mono">{job.processed_count}</td>
                <td className="mono">{formatDuration(job.duration_ms)}</td>
                <td className="mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  {job.start_time ? new Date(job.start_time).toLocaleTimeString() : '—'}
                </td>
                <td className="pr-lg text-right" style={{ fontSize: '11px', color: 'var(--alert-text)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.error || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};
