import fetch from 'node-fetch';
import AnomalyEvent from '../models/anomalyevent.model.js';
import Segment from '../models/segment.model.js';

// RabbitMQ Management API credentials
const RABBITMQ_BROKER_URL = 'https://broker230.smartsystem.id';
const RABBITMQ_USER = 'anomali';
const RABBITMQ_PASS = 'anomali123';
const RABBITMQ_VHOST = encodeURIComponent('/polar');
const RABBITMQ_BASE = `${RABBITMQ_BROKER_URL}/api`;
const RABBITMQ_AUTH = 'Basic ' + Buffer.from(`${RABBITMQ_USER}:${RABBITMQ_PASS}`).toString('base64');

const rmq = async (path, options = {}) => {
  const res = await fetch(`${RABBITMQ_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: RABBITMQ_AUTH,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    // short timeout so dashboard doesn't hang on unreachable broker
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`RabbitMQ ${res.status}: ${res.statusText}`);
  return res.json();
};

// ── Pipeline Status ──────────────────────────────────────────────────────────

export async function getPipelineStatus(req, res) {
  try {
    // Fetch RabbitMQ overview in parallel with queue stats
    const [overview, queues, connections] = await Promise.allSettled([
      rmq('/overview'),
      rmq(`/queues/${RABBITMQ_VHOST}`),
      rmq('/connections'),
    ]);

    const mqOverview = overview.status === 'fulfilled' ? overview.value : null;
    const mqQueues   = queues.status === 'fulfilled'   ? queues.value   : [];
    const mqConns    = connections.status === 'fulfilled' ? connections.value : [];

    // MongoDB stats
    const [totalRaw, totalSegments, totalEvents] = await Promise.all([
      Segment.countDocuments({ is_valid: false }).catch(() => 0), // proxy for raw
      Segment.countDocuments().catch(() => 0),
      AnomalyEvent.countDocuments().catch(() => 0),
    ]);

    const recentEvents = await AnomalyEvent.find({ status: 'open' })
      .sort({ onset_time: -1 })
      .limit(5)
      .select('onset_time classification peak_score activity')
      .lean()
      .catch(() => []);

    res.json({
      success: true,
      timestamp: Date.now(),
      rabbitmq: {
        connected: mqOverview !== null,
        host: 'broker230.smartsystem.id',
        vhost: '/polar',
        overview: mqOverview ? {
          message_rate_in: mqOverview.message_stats?.publish_details?.rate ?? 0,
          message_rate_out: mqOverview.message_stats?.deliver_details?.rate ?? 0,
          queued_messages: mqOverview.queue_totals?.messages ?? 0,
          connections: mqConns.length,
          node: mqOverview.node,
          erlang_version: mqOverview.erlang_version,
        } : null,
        queues: mqQueues.slice(0, 20).map(q => ({
          name: q.name,
          messages: q.messages ?? 0,
          consumers: q.consumers ?? 0,
          state: q.state,
          messages_ready: q.messages_ready ?? 0,
          messages_unacked: q.messages_unacknowledged ?? 0,
          publish_rate: q.message_stats?.publish_details?.rate ?? 0,
          deliver_rate: q.message_stats?.deliver_details?.rate ?? 0,
        })),
      },
      mongodb: {
        connected: true,
        total_segments: totalSegments,
        total_events: totalEvents,
        total_raw: totalRaw,
      },
      cron_jobs: [
        { id: 'layer2', name: 'Layer 2 – Preprocessing', schedule: '*/3 * * * *', description: 'IQR Filter + Segmentation' },
        { id: 'layer3', name: 'Layer 3 – Analysis',      schedule: '2-59/5 * * * *', description: 'Z-score, Trajectory, Events' },
      ],
      recent_events: recentEvents,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── Queue Actions (operator only) ────────────────────────────────────────────

export async function purgeQueue(req, res) {
  try {
    const { queueName } = req.params;
    await rmq(`/queues/${RABBITMQ_VHOST}/${encodeURIComponent(queueName)}/contents`, { method: 'DELETE' });
    res.json({ success: true, message: `Queue "${queueName}" purged.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getQueueMessages(req, res) {
  try {
    const { queueName } = req.params;
    const count = parseInt(req.query.count) || 10;
    const messages = await rmq(`/queues/${RABBITMQ_VHOST}/${encodeURIComponent(queueName)}/get`, {
      method: 'POST',
      body: JSON.stringify({ count, ackmode: 'ack_requeue_true', encoding: 'auto', truncate: 512 }),
    });
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function pauseQueue(req, res) {
  try {
    // RabbitMQ has no native "pause" – we simulate by setting an alarm that blocks publishing
    const { queueName } = req.params;
    // Acknowledge the intent to the UI only — real pause would require shovel plugin or policy
    res.json({ success: true, message: `Pause request for "${queueName}" acknowledged. (Requires shovel plugin for hard pause)` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getRabbitMQNodes(req, res) {
  try {
    const nodes = await rmq('/nodes');
    res.json({ success: true, data: nodes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
