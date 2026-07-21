import React, { useEffect, useState, useRef } from 'react';
import {
  FaSync, FaRedo, FaPause, FaPlay, FaTerminal, FaTrash,
  FaLayerGroup, FaExclamationTriangle, FaCheckCircle, FaTimesCircle,
  FaHammer, FaLevelUpAlt, FaDatabase, FaServer, FaNetworkWired
} from 'react-icons/fa';
import { Badge, Skeleton, fmtTime } from './DashboardShared';
import { pipelineApi } from '../../utls/api';

// ── Pipeline node definitions (matches your architecture) ───────────────────
const PIPELINE_NODES = [
  { id: 'flutter',   label: 'Flutter App',        icon: FaServer,      color: '#3b82f6' },
  { id: 'rabbitmq',  label: 'RabbitMQ Broker',    icon: FaNetworkWired, color: '#f59e0b' },
  { id: 'dbraw',     label: 'DB Raw Data',         icon: FaDatabase,    color: '#8b5cf6' },
  { id: 'cron',      label: 'CronJob L2',          icon: FaHammer,      color: '#06b6d4' },
  { id: 'worker',    label: 'Preprocessing Workers', icon: FaLayerGroup, color: '#10b981' },
  { id: 'matrix',   label: 'DB Model Matrix',     icon: FaDatabase,    color: '#8b5cf6' },
  { id: 'context',   label: 'Activity Context',   icon: FaServer,      color: '#10b981' },
  { id: 'trajectory',label: 'Trajectory Analysis', icon: FaServer,     color: '#f97316' },
  { id: 'detection', label: 'Anomaly Detection',   icon: FaExclamationTriangle, color: '#ef4444' },
  { id: 'api',       label: 'Backend API',         icon: FaServer,      color: '#3b82f6' },
];

// ── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = '#3b82f6', icon: Icon }) {
  return (
    <div className="bg-brand-cardLight border border-brand-border rounded-2xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
        <Icon style={{ color }} className="text-base" />
      </div>
      <div>
        <span className="block text-[9px] uppercase font-bold text-brand-muted">{label}</span>
        <span className="block text-lg font-black text-brand-text leading-tight">{value}</span>
        {sub && <span className="block text-[9px] text-brand-muted">{sub}</span>}
      </div>
    </div>
  );
}

// ── SVG Pipeline Visualizer ──────────────────────────────────────────────────
function PipelineVisualizer({ status, activeNode }) {
  const mqConnected = status?.rabbitmq?.connected;
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-center min-w-[900px] px-2 py-4">
        {PIPELINE_NODES.map((node, i) => {
          const isActive = activeNode === node.id;
          return (
            <React.Fragment key={node.id}>
              <div
                className={`flex flex-col items-center gap-2 transition-all duration-300 ${isActive ? 'scale-110' : ''}`}
                style={{ minWidth: 80 }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center relative shadow-lg"
                  style={{
                    background: `${node.color}15`,
                    border: `2px solid ${node.color}44`,
                    boxShadow: isActive ? `0 0 20px ${node.color}60` : 'none',
                  }}
                >
                  <node.icon style={{ color: node.color }} className="text-xl" />
                  {/* Pulse dot */}
                  <span
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-brand-dark"
                    style={{
                      background: node.id === 'rabbitmq' ? (mqConnected ? '#10b981' : '#ef4444') : '#10b981',
                    }}
                  />
                </div>
                <span className="text-[8px] font-bold text-center leading-tight text-brand-muted w-20 text-center">{node.label}</span>
              </div>

              {i < PIPELINE_NODES.length - 1 && (
                <div className="flex-1 flex flex-col items-center gap-1 mx-1">
                  <div className="w-full h-0.5 relative overflow-hidden" style={{ background: '#202a3d' }}>
                    <div
                      className="absolute inset-0 animate-pulse"
                      style={{ background: `linear-gradient(90deg, transparent, ${PIPELINE_NODES[i].color}, transparent)` }}
                    />
                  </div>
                  <span className="text-[7px] text-brand-muted">↓</span>
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
    <tr className="border-t border-brand-border hover:bg-brand-cardLight transition-colors">
      <td className="px-3 py-2.5 font-mono text-xs font-bold text-sys-blue">{queue.name}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${queue.state === 'running' ? 'bg-sys-green animate-pulse' : 'bg-sys-orange'}`} />
          <span className="text-xs capitalize text-brand-text">{queue.state}</span>
        </div>
      </td>
      <td className={`px-3 py-2.5 font-bold text-xs ${busy ? 'text-sys-orange' : 'text-sys-green'}`}>
        {queue.messages.toLocaleString()}
      </td>
      <td className="px-3 py-2.5 text-xs text-brand-muted">{queue.consumers}</td>
      <td className="px-3 py-2.5 text-xs text-brand-muted">{queue.publish_rate?.toFixed(1)}/s</td>
      <td className="px-3 py-2.5 text-xs text-brand-muted">{queue.deliver_rate?.toFixed(1)}/s</td>
      <td className="px-3 py-2.5">
        {isOperator ? (
          <div className="flex gap-1.5">
            <button onClick={() => onPeek(queue.name)} className="text-[9px] px-2 py-1 rounded bg-brand-border text-brand-muted hover:text-brand-text hover:bg-brand-card transition-colors flex items-center gap-1">
              <FaTerminal className="text-[8px]" /> Peek
            </button>
            {queue.messages > 0 && (
              <button onClick={() => onPurge(queue.name)} className="text-[9px] px-2 py-1 rounded bg-sys-red/10 text-sys-red hover:bg-sys-red/20 transition-colors flex items-center gap-1">
                <FaTrash className="text-[8px]" /> Purge
              </button>
            )}
          </div>
        ) : (
          <span className="text-[9px] text-brand-muted italic">Operator only</span>
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
    <div className="space-y-6 relative">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-[100] bg-brand-cardLight border border-brand-border text-brand-text px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Maintenance Mode Banner */}
      {maintenanceMode && (
        <div className="flex items-center gap-3 bg-sys-orange/10 border border-sys-orange/30 text-sys-orange px-5 py-3 rounded-2xl text-xs font-bold">
          <FaExclamationTriangle className="animate-pulse" />
          MAINTENANCE MODE ACTIVE — New data ingestion is paused.
          <button onClick={() => setMaintenanceMode(false)} className="ml-auto underline">Disable</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h4 className="font-black text-sm">Infrastructure Pipeline Monitor</h4>
          <p className="text-[10px] text-brand-muted font-mono">
            RabbitMQ: <span className={status?.rabbitmq?.connected ? 'text-sys-green' : 'text-sys-red font-bold'}>
              {status?.rabbitmq?.connected ? `✓ ONLINE (${status.rabbitmq.host})` : '✗ UNREACHABLE'}
            </span>
            {mqOvr?.node && ` · Node: ${mqOvr.node}`}
          </p>
        </div>
        <div className="flex gap-2">
          {isOperator && (
            <button
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-xl border transition-colors flex items-center gap-1.5 ${maintenanceMode ? 'bg-sys-orange text-white border-sys-orange' : 'bg-brand-cardLight border-brand-border text-brand-muted hover:text-brand-text'}`}
            >
              <FaHammer /> {maintenanceMode ? 'Exit Maintenance' : 'Maintenance Mode'}
            </button>
          )}
          <button onClick={fetchStatus} disabled={loading} className="px-3 py-1.5 bg-sys-blue text-white text-[10px] font-bold rounded-xl flex items-center gap-1.5 hover:bg-sys-blue/80 transition-colors disabled:opacity-60">
            <FaSync className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div className="bg-brand-card border border-brand-border rounded-2xl shadow-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-brand-border bg-brand-cardLight flex items-center justify-between">
          <h5 className="font-bold text-xs uppercase tracking-wide">System Architecture Flow</h5>
          <span className="text-[9px] text-brand-muted font-mono">Live data flow animation</span>
        </div>
        <div className="p-4">
          {loading ? <Skeleton className="h-28 w-full" /> : <PipelineVisualizer status={status} activeNode={activeNode} />}
        </div>
      </div>

      {/* Metric Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="RabbitMQ Publish Rate" value={`${mqOvr?.message_rate_in?.toFixed(1) ?? '—'}/s`} sub={`${mqOvr?.connections ?? 0} connections`} color="#f59e0b" icon={FaNetworkWired} />
          <MetricCard label="Queued Messages" value={(mqOvr?.queued_messages ?? 0).toLocaleString()} sub={`${queues.length} queues`} color="#3b82f6" icon={FaLayerGroup} />
          <MetricCard label="DB: Total Segments" value={(mongo?.total_segments ?? 0).toLocaleString()} sub={`${mongo?.total_events ?? 0} anomaly events`} color="#8b5cf6" icon={FaDatabase} />
          <MetricCard label="Open Anomaly Events" value={(status?.recent_events?.length ?? 0)} sub="Unresolved events" color="#ef4444" icon={FaExclamationTriangle} />
        </div>
      )}

      {/* Component Status Table + CronJobs */}
      <div className="grid md:grid-cols-12 gap-6">
        {/* Component Table */}
        <div className="md:col-span-8 bg-brand-card border border-brand-border rounded-2xl shadow-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-brand-border bg-brand-cardLight flex items-center justify-between">
            <h5 className="font-bold text-xs uppercase tracking-wide">RabbitMQ Queue Status</h5>
            {!isOperator && <span className="text-[9px] text-brand-muted italic">Operator actions restricted</span>}
          </div>
          {loading ? (
            <div className="p-5 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
          ) : queues.length === 0 ? (
            <div className={`p-6 text-center text-xs ${status?.rabbitmq?.connected ? 'text-brand-muted' : 'text-sys-red'}`}>
              {status?.rabbitmq?.connected ? 'No queues found in /polar vhost.' : '⚠ Cannot connect to RabbitMQ at 100.96.0.14:15672. Check network connectivity.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-brand-cardLight text-brand-muted text-[9px] uppercase font-bold border-b border-brand-border">
                  <tr>
                    <th className="px-3 py-2">Queue</th>
                    <th className="px-3 py-2">State</th>
                    <th className="px-3 py-2">Messages</th>
                    <th className="px-3 py-2">Consumers</th>
                    <th className="px-3 py-2">Pub/s</th>
                    <th className="px-3 py-2">Del/s</th>
                    <th className="px-3 py-2">Actions</th>
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
        <div className="md:col-span-4 space-y-4">
          <div className="bg-brand-card border border-brand-border rounded-2xl shadow-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-brand-border bg-brand-cardLight">
              <h5 className="font-bold text-xs uppercase tracking-wide">Background CronJobs</h5>
            </div>
            <div className="p-4 space-y-3">
              {cronJobs.map(job => (
                <div key={job.id} className="flex items-start gap-3 p-3 bg-brand-cardLight border border-brand-border rounded-xl">
                  <FaCheckCircle className="text-sys-green text-sm mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-brand-text">{job.name}</p>
                    <p className="text-[9px] text-brand-muted">{job.description}</p>
                    <code className="text-[9px] text-sys-purple">{job.schedule}</code>
                  </div>
                </div>
              ))}
              {loading && [1,2].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          </div>

          {/* Operator Actions */}
          {isOperator && (
            <div className="bg-brand-card border border-brand-border rounded-2xl shadow-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-brand-border bg-brand-cardLight flex items-center gap-2">
                <FaHammer className="text-sys-orange text-xs" />
                <h5 className="font-bold text-xs uppercase tracking-wide">Operator Actions</h5>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { label: 'Retry Failed Jobs', icon: FaRedo, color: 'text-sys-blue', action: () => showToast('Retry signal sent to workers.') },
                  { label: 'Scale Workers', icon: FaLevelUpAlt, color: 'text-sys-purple', action: () => showToast('Scale request sent. (Feature requires Docker Swarm or K8s)') },
                  { label: 'Enable Maintenance', icon: FaHammer, color: 'text-sys-orange', action: () => setMaintenanceMode(true) },
                ].map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.action}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl bg-brand-cardLight border border-brand-border hover:border-brand-muted transition-colors text-left text-xs ${btn.color} font-bold`}
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
        <div className="bg-brand-card border border-brand-border rounded-2xl shadow-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-brand-border bg-brand-cardLight">
            <h5 className="font-bold text-xs uppercase tracking-wide flex items-center gap-2">
              <FaExclamationTriangle className="text-sys-red" /> Active Anomaly Events
            </h5>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-brand-cardLight text-[9px] uppercase font-bold text-brand-muted border-b border-brand-border">
                <tr>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Activity</th>
                  <th className="px-4 py-2">Classification</th>
                  <th className="px-4 py-2">Peak Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {status.recent_events.map((e) => (
                  <tr key={e._id} className="hover:bg-brand-cardLight transition-colors">
                    <td className="px-4 py-2 font-mono">{fmtTime(e.onset_time)}</td>
                    <td className="px-4 py-2">{e.activity}</td>
                    <td className="px-4 py-2"><Badge label={e.classification} color={e.classification === 'Alert' ? 'red' : 'orange'} /></td>
                    <td className={`px-4 py-2 font-bold ${e.classification === 'Alert' ? 'text-sys-red' : 'text-sys-orange'}`}>{e.peak_score?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Queue Peek Modal */}
      {peekedMessages !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-brand-card border border-brand-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-brand-border bg-brand-cardLight flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2"><FaTerminal className="text-sys-green" /> Peek: {peekedQueue}</h3>
              <button onClick={() => setPeekedMessages(null)} className="text-brand-muted hover:text-brand-text">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {peekedMessages.length === 0 ? (
                <p className="text-xs text-brand-muted italic text-center py-6">Queue is empty.</p>
              ) : peekedMessages.map((m, i) => (
                <pre key={i} className="bg-brand-dark border border-brand-border rounded-xl p-3 text-[9px] text-sys-green font-mono overflow-x-auto whitespace-pre-wrap">
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
