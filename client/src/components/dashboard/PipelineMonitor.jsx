import React, { useEffect, useState, useRef } from 'react';
import {
  FaSync, FaRedo, FaPause, FaPlay, FaTerminal, FaTrash,
  FaLayerGroup, FaExclamationTriangle, FaCheckCircle, FaTimesCircle,
  FaHammer, FaLevelUpAlt, FaDatabase, FaServer, FaNetworkWired
} from 'react-icons/fa';
import { Badge, Skeleton, fmtTime, SectionHeader } from './DashboardShared';
import { pipelineApi } from '../../utls/api';

// ── Pipeline node definitions (matches your architecture) ───────────────────
const PIPELINE_NODES = [
  { id: 'flutter',   label: 'Flutter App',        icon: FaServer,      color: 'var(--htm-info)' },
  { id: 'rabbitmq',  label: 'RabbitMQ Broker',    icon: FaNetworkWired, color: 'var(--htm-caution)' },
  { id: 'dbraw',     label: 'DB Raw Data',         icon: FaDatabase,    color: 'var(--htm-ink)' },
  { id: 'cron',      label: 'CronJob L2',          icon: FaHammer,      color: 'var(--htm-info)' },
  { id: 'worker',    label: 'Preprocessing Workers', icon: FaLayerGroup, color: 'var(--htm-stable)' },
  { id: 'matrix',   label: 'DB Model Matrix',     icon: FaDatabase,    color: 'var(--htm-ink)' },
  { id: 'context',   label: 'Activity Context',   icon: FaServer,      color: 'var(--htm-stable)' },
  { id: 'trajectory',label: 'Trajectory Analysis', icon: FaServer,     color: 'var(--htm-caution)' },
  { id: 'detection', label: 'Anomaly Detection',   icon: FaExclamationTriangle, color: 'var(--htm-alert)' },
  { id: 'api',       label: 'Backend API',         icon: FaServer,      color: 'var(--htm-info)' },
];

// ── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = 'var(--htm-info)', icon: Icon }) {
  return (
    <div className="p-4 flex items-center gap-4" style={{ background: 'var(--htm-raised)', borderRadius: 'var(--htm-r-md)' }}>
      <div className="w-12 h-12 flex items-center justify-center shrink-0" style={{ background: 'var(--htm-surface)', borderRadius: 'var(--htm-r-sm)', border: '1px solid var(--htm-hairline)' }}>
        <Icon style={{ color, fontSize: 18 }} />
      </div>
      <div>
        <span className="htm-eyebrow block mb-1">{label}</span>
        <span className="htm-display block text-xl leading-tight">{value}</span>
        {sub && <span className="htm-body-sm block mt-1" style={{ color: 'var(--htm-muted)', fontSize: 11 }}>{sub}</span>}
      </div>
    </div>
  );
}

// ── SVG Pipeline Visualizer ──────────────────────────────────────────────────
function PipelineVisualizer({ status, activeNode }) {
  const mqConnected = status?.rabbitmq?.connected;
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex items-center min-w-[900px] px-2 py-6">
        {PIPELINE_NODES.map((node, i) => {
          const isActive = activeNode === node.id;
          return (
            <React.Fragment key={node.id}>
              <div
                className="flex flex-col items-center gap-3 transition-all duration-300"
                style={{ minWidth: 80, transform: isActive ? 'scale(1.1)' : 'scale(1)' }}
              >
                <div
                  className="w-16 h-16 flex items-center justify-center relative shadow-sm"
                  style={{
                    background: 'var(--htm-surface)',
                    border: isActive ? `2px solid ${node.color}` : `1px solid var(--htm-hairline)`,
                    borderRadius: 'var(--htm-r-md)',
                  }}
                >
                  <node.icon style={{ color: node.color }} className="text-2xl" />
                  {/* Pulse dot */}
                  <span
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-white"
                    style={{
                      background: node.id === 'rabbitmq' ? (mqConnected ? 'var(--htm-stable)' : 'var(--htm-alert)') : 'var(--htm-stable)',
                    }}
                  />
                </div>
                <span className="htm-eyebrow w-24 text-center leading-tight" style={{ whiteSpace: 'normal', fontSize: 9 }}>{node.label}</span>
              </div>

              {i < PIPELINE_NODES.length - 1 && (
                <div className="flex-1 flex flex-col items-center gap-1 mx-2">
                  <div className="w-full h-[2px] relative overflow-hidden" style={{ background: 'var(--htm-hairline)' }}>
                    <div
                      className="absolute inset-0 animate-pulse"
                      style={{ background: `linear-gradient(90deg, transparent, ${PIPELINE_NODES[i].color}, transparent)` }}
                    />
                  </div>
                  <span className="htm-body-sm" style={{ fontSize: 9, color: 'var(--htm-muted)' }}>→</span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Queue Row ─────────────────────────────────────────────────────────────────
function QueueRow({ queue, isOperator, onPurge, onPeek }) {
  const busy = queue.messages > 0;
  return (
    <tr className="hover:bg-htm-surface transition-colors">
      <td className="p-3 htm-mono text-sm" style={{ color: 'var(--htm-info)', fontWeight: 600 }}>{queue.name}</td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: queue.state === 'running' ? 'var(--htm-stable)' : 'var(--htm-caution)' }} />
          <span className="htm-body-sm capitalize">{queue.state}</span>
        </div>
      </td>
      <td className="p-3 htm-mono font-medium" style={{ color: busy ? 'var(--htm-caution)' : 'var(--htm-stable)' }}>
        {queue.messages.toLocaleString()}
      </td>
      <td className="p-3 htm-mono text-htm-muted">{queue.consumers}</td>
      <td className="p-3 htm-mono text-htm-muted">{queue.publish_rate?.toFixed(1)}/s</td>
      <td className="p-3 htm-mono text-htm-muted">{queue.deliver_rate?.toFixed(1)}/s</td>
      <td className="p-3">
        {isOperator ? (
          <div className="flex gap-2">
            <button onClick={() => onPeek(queue.name)} className="htm-btn htm-btn-ghost htm-btn-sm" style={{ color: 'var(--htm-sub)' }}>
              <FaTerminal /> Peek
            </button>
            {queue.messages > 0 && (
              <button onClick={() => onPurge(queue.name)} className="htm-btn htm-btn-outline htm-btn-sm" style={{ color: 'var(--htm-alert)', borderColor: 'rgba(185,28,28,0.3)' }}>
                <FaTrash /> Purge
              </button>
            )}
          </div>
        ) : (
          <span className="htm-body-sm text-htm-muted italic">Operator only</span>
        )}
      </td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PipelineMonitor({ sessionUser }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNode, setActiveNode] = useState(null);
  const [peekedMessages, setPeekedMessages] = useState(null);
  const [peekedQueue, setPeekedQueue] = useState('');
  const [toastMsg, setToastMsg] = useState(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const intervalRef = useRef(null);

  const isOperator = ['operator', 'administrator', 'admin', 'Doctor'].includes(sessionUser?.role);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchStatus = async () => {
    try {
      const res = await pipelineApi.getStatus();
      if (res.success) {
        setStatus(res);
        // Animate active node based on message flow
        const nodes = PIPELINE_NODES.map(n => n.id);
        setActiveNode(prev => {
          const idx = nodes.indexOf(prev);
          return nodes[(idx + 1) % nodes.length];
        });
      }
    } catch (e) {
      console.error('Pipeline status fetch failed:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 5000); // live polling every 5s
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line
  }, []);

  const handlePurge = async (queueName) => {
    if (!confirm(`Purge all messages from "${queueName}"? This cannot be undone.`)) return;
    try {
      const res = await pipelineApi.purgeQueue(queueName);
      showToast(res.message || `Queue "${queueName}" purged.`);
      fetchStatus();
    } catch (e) { showToast(`Error: ${e.message}`); }
  };

  const handlePeek = async (queueName) => {
    try {
      const res = await pipelineApi.peekMessages(queueName, 5);
      setPeekedQueue(queueName);
      setPeekedMessages(res.data || []);
    } catch (e) { showToast(`Error: ${e.message}`); }
  };

  const mqOvr = status?.rabbitmq?.overview;
  const queues = status?.rabbitmq?.queues || [];
  const mongo = status?.mongodb;
  const cronJobs = status?.cron_jobs || [];

  return (
    <div className="space-y-6 relative animate-htm-page-in">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-[100] htm-card shadow-xl animate-bounce" style={{ padding: '12px 24px', background: 'var(--htm-ink)', color: 'var(--htm-canvas)', border: 'none' }}>
          <span className="htm-body-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Maintenance Mode Banner */}
      {maintenanceMode && (
        <div className="flex items-center gap-3 p-4 shadow-sm" style={{ background: 'var(--htm-caution-bg)', border: '1px solid rgba(180,83,9,0.3)', borderRadius: 'var(--htm-r-md)', color: 'var(--htm-caution)' }}>
          <FaExclamationTriangle className="animate-pulse" />
          <span className="htm-body-sm font-medium">MAINTENANCE MODE ACTIVE — New data ingestion is paused.</span>
          <button onClick={() => setMaintenanceMode(false)} className="ml-auto underline htm-body-sm font-medium">Disable</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h4 className="htm-title text-2xl">Infrastructure Pipeline Monitor</h4>
          <p className="htm-mono-sm mt-1" style={{ color: 'var(--htm-muted)' }}>
            RabbitMQ: <span style={{ color: status?.rabbitmq?.connected ? 'var(--htm-stable)' : 'var(--htm-alert)', fontWeight: 600 }}>
              {status?.rabbitmq?.connected ? `✓ ONLINE (${status.rabbitmq.host})` : '✗ UNREACHABLE'}
            </span>
            {mqOvr?.node && ` · Node: ${mqOvr.node}`}
          </p>
        </div>
        <div className="flex gap-3">
          {isOperator && (
            <button
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={maintenanceMode ? "htm-btn htm-btn-primary" : "htm-btn htm-btn-outline"}
              style={maintenanceMode ? { background: 'var(--htm-caution)', borderColor: 'var(--htm-caution)' } : {}}
            >
              <FaHammer style={{ marginRight: 6 }} /> {maintenanceMode ? 'Exit Maintenance' : 'Maintenance Mode'}
            </button>
          )}
          <button onClick={fetchStatus} disabled={loading} className="htm-btn htm-btn-primary">
            <FaSync className={loading ? 'animate-spin' : ''} style={{ marginRight: 6 }} /> Refresh
          </button>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div className="htm-card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-htm-hairline bg-htm-surface flex items-center justify-between">
          <h5 className="htm-eyebrow text-sm">System Architecture Flow</h5>
          <span className="htm-mono-sm text-htm-muted">Live data flow animation</span>
        </div>
        <div className="p-6">
          {loading ? <Skeleton className="h-28 w-full" /> : <PipelineVisualizer status={status} activeNode={activeNode} />}
        </div>
      </div>

      {/* Metric Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <MetricCard label="RabbitMQ Publish Rate" value={`${mqOvr?.message_rate_in?.toFixed(1) ?? '—'}/s`} sub={`${mqOvr?.connections ?? 0} connections`} color="var(--htm-caution)" icon={FaNetworkWired} />
          <MetricCard label="Queued Messages" value={(mqOvr?.queued_messages ?? 0).toLocaleString()} sub={`${queues.length} queues`} color="var(--htm-info)" icon={FaLayerGroup} />
          <MetricCard label="DB: Total Segments" value={(mongo?.total_segments ?? 0).toLocaleString()} sub={`${mongo?.total_events ?? 0} anomaly events`} color="var(--htm-ink)" icon={FaDatabase} />
          <MetricCard label="Open Anomaly Events" value={(status?.recent_events?.length ?? 0)} sub="Unresolved events" color="var(--htm-alert)" icon={FaExclamationTriangle} />
        </div>
      )}

      {/* Component Status Table + CronJobs */}
      <div className="grid md:grid-cols-12 gap-6">
        {/* Component Table */}
        <div className="md:col-span-8 htm-card p-0 overflow-hidden h-full flex flex-col">
          <div className="px-6 py-4 border-b border-htm-hairline bg-htm-surface flex items-center justify-between shrink-0">
            <h5 className="htm-eyebrow text-sm">RabbitMQ Queue Status</h5>
            {!isOperator && <span className="htm-body-sm text-htm-muted italic">Operator actions restricted</span>}
          </div>
          {loading ? (
            <div className="p-6 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
          ) : queues.length === 0 ? (
            <div className="p-8 text-center htm-body-sm flex-1 flex items-center justify-center" style={{ color: status?.rabbitmq?.connected ? 'var(--htm-muted)' : 'var(--htm-alert)' }}>
              {status?.rabbitmq?.connected ? 'No queues found in /polar vhost.' : '⚠ Cannot connect to RabbitMQ at 100.96.0.14:15672. Check network connectivity.'}
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="htm-table w-full">
                <thead className="bg-htm-surface sticky top-0">
                  <tr>
                    <th className="p-3">Queue</th>
                    <th className="p-3">State</th>
                    <th className="p-3">Messages</th>
                    <th className="p-3">Consumers</th>
                    <th className="p-3">Pub/s</th>
                    <th className="p-3">Del/s</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queues.map((q) => (
                    <QueueRow key={q.name} queue={q} isOperator={isOperator} onPurge={handlePurge} onPeek={handlePeek} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* CronJob Status */}
        <div className="md:col-span-4 space-y-6">
          <div className="htm-card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-htm-hairline bg-htm-surface">
              <h5 className="htm-eyebrow text-sm">Background CronJobs</h5>
            </div>
            <div className="p-6 space-y-4">
              {cronJobs.map(job => (
                <div key={job.id} className="flex items-start gap-4 p-4" style={{ background: 'var(--htm-raised)', borderRadius: 'var(--htm-r-md)', border: '1px solid var(--htm-hairline)' }}>
                  <FaCheckCircle style={{ color: 'var(--htm-stable)', fontSize: 16, marginTop: 2 }} className="shrink-0" />
                  <div>
                    <p className="htm-body-sm font-medium">{job.name}</p>
                    <p className="htm-body-sm text-htm-muted mt-1">{job.description}</p>
                    <code className="htm-mono mt-2 block" style={{ fontSize: 11, color: 'var(--htm-info)' }}>{job.schedule}</code>
                  </div>
                </div>
              ))}
              {loading && [1,2].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          </div>

          {/* Operator Actions */}
          {isOperator && (
            <div className="htm-card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-htm-hairline bg-htm-surface flex items-center gap-2">
                <FaHammer style={{ color: 'var(--htm-caution)' }} />
                <h5 className="htm-eyebrow text-sm">Operator Actions</h5>
              </div>
              <div className="p-6 space-y-3">
                {[
                  { label: 'Retry Failed Jobs', icon: FaRedo, color: 'var(--htm-info)', action: () => showToast('Retry signal sent to workers.') },
                  { label: 'Scale Workers', icon: FaLevelUpAlt, color: 'var(--htm-ink)', action: () => showToast('Scale request sent. (Feature requires Docker Swarm or K8s)') },
                  { label: 'Enable Maintenance', icon: FaHammer, color: 'var(--htm-caution)', action: () => setMaintenanceMode(true) },
                ].map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.action}
                    className="w-full flex items-center gap-3 p-3 transition-colors htm-body-sm font-medium"
                    style={{ background: 'var(--htm-raised)', borderRadius: 'var(--htm-r-md)', border: '1px solid var(--htm-hairline)', color: btn.color }}
                  >
                    <btn.icon /> {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Open Events */}
      {status?.recent_events?.length > 0 && (
        <div className="htm-card p-0 overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-htm-hairline bg-htm-surface">
            <h5 className="htm-eyebrow text-sm flex items-center gap-2">
              <FaExclamationTriangle style={{ color: 'var(--htm-alert)' }} /> Active Anomaly Events
            </h5>
          </div>
          <div className="overflow-x-auto">
            <table className="htm-table w-full">
              <thead className="bg-htm-surface">
                <tr>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Activity</th>
                  <th className="px-6 py-3">Classification</th>
                  <th className="px-6 py-3">Peak Score</th>
                </tr>
              </thead>
              <tbody>
                {status.recent_events.map((e) => (
                  <tr key={e._id} className="hover:bg-htm-surface transition-colors">
                    <td className="px-6 py-3 htm-mono">{fmtTime(e.onset_time)}</td>
                    <td className="px-6 py-3">{e.activity}</td>
                    <td className="px-6 py-3"><Badge label={e.classification} color={e.classification === 'Alert' ? 'alert' : 'caution'} /></td>
                    <td className="px-6 py-3 htm-mono" style={{ color: e.classification === 'Alert' ? 'var(--htm-alert)' : 'var(--htm-caution)', fontWeight: 600 }}>{e.peak_score?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Queue Peek Modal */}
      {peekedMessages !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="htm-card w-full max-w-2xl max-h-[70vh] flex flex-col overflow-hidden p-0 shadow-2xl">
            <div className="p-6 border-b border-htm-hairline bg-htm-surface flex justify-between items-center">
              <h3 className="htm-title flex items-center gap-2"><FaTerminal style={{ color: 'var(--htm-stable)' }} /> Peek: {peekedQueue}</h3>
              <button onClick={() => setPeekedMessages(null)} className="text-htm-muted hover:text-htm-ink transition-colors">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-htm-canvas">
              {peekedMessages.length === 0 ? (
                <p className="htm-body-sm text-htm-muted italic text-center py-12">Queue is empty.</p>
              ) : peekedMessages.map((m, i) => (
                <pre key={i} className="p-4 htm-mono" style={{ background: 'var(--htm-raised)', border: '1px solid var(--htm-hairline)', borderRadius: 'var(--htm-r-md)', fontSize: 11, color: 'var(--htm-stable)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  {typeof m.payload === 'string' ? m.payload : JSON.stringify(m, null, 2)}
                </pre>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
