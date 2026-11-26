import { getJakartaDateKey, normalizeEpochMs } from './caparWindowAnalytics.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DEFAULT_SIGNAL_GAP_MS = 5 * 60_000;

function nodeTime(node, kind) {
  if (kind === 'row') return normalizeEpochMs(node.timestamp_ms ?? node.timestamp);
  if (kind === 'window') return normalizeEpochMs(node.window_start);
  if (kind === 'activity') return normalizeEpochMs(node.episode_start);
  return normalizeEpochMs(node.recorded_at);
}

function addAnchor(anchors, {
  accountId,
  deviceId,
  timestamp,
  type,
  source,
  sourceId,
  confidence,
  inferred,
  description,
}) {
  if (!Number.isFinite(timestamp)) return;
  const relatedEntityId = sourceId === null || sourceId === undefined
    ? null
    : String(sourceId);
  const key = [type, source, relatedEntityId || 'calendar', timestamp].join(':');
  anchors.set(key, {
    anchor_id: key,
    user_id: String(accountId),
    device_id: String(deviceId || 'UNKNOWN'),
    timestamp,
    anchor_type: type,
    source,
    confidence,
    inferred,
    related_entity_id: relatedEntityId,
    description,
  });
}

function toSourceStream(items, kind) {
  return items
    .map((node) => ({
      node,
      kind,
      timestamp: nodeTime(node, kind),
      end: kind === 'window'
        ? normalizeEpochMs(node.window_end)
        : kind === 'activity'
          ? normalizeEpochMs(node.episode_end)
          : nodeTime(node, kind),
      id: String(node._id || node.episode_key || ''),
      sourceId: String(node.source_id || node._id || node.episode_key || ''),
      source: String(node.source_collection || kind),
      deviceId: String(node.device_id || 'UNKNOWN'),
      activity: String(node.activity || node.activity_label || 'Unknown'),
    }))
    .filter((entry) => entry.timestamp !== null)
    .sort((first, second) => first.timestamp - second.timestamp
      || first.id.localeCompare(second.id));
}

function getSignalGapThreshold(entry, fallback) {
  const windowType = entry.node?.window_type;
  if (windowType === '1min') return 60_000;
  if (windowType === '5min') return 300_000;
  return fallback;
}

function createSignalSessions(stream, accountId, anchors, gapThresholdMs) {
  const sessions = [];
  const byDevice = new Map();
  for (const entry of stream) {
    const streamKey = `${entry.deviceId}:${entry.source}`;
    if (!byDevice.has(streamKey)) byDevice.set(streamKey, []);
    byDevice.get(streamKey).push(entry);
  }

  for (const entries of byDevice.values()) {
    const deviceId = entries[0].deviceId;
    let current = null;
    let previous = null;
    for (const entry of entries) {
      const gapMs = previous ? entry.timestamp - previous.end : null;
      const dayChanged = previous
        && getJakartaDateKey(previous.timestamp) !== getJakartaDateKey(entry.timestamp);
      const gapThreshold = getSignalGapThreshold(entry, gapThresholdMs);
      const gapDetected = previous && (
        gapMs > gapThreshold || dayChanged
      );
      if (!current || gapDetected) {
        if (gapDetected) {
          addAnchor(anchors, {
            accountId,
            deviceId,
            timestamp: previous.end,
            type: 'SIGNAL_LOST',
            source: `${previous.source}_timestamp_gap`,
            sourceId: previous.sourceId,
            confidence: 0.75,
            inferred: true,
            description: `Jeda data terdeteksi; tidak membuktikan perangkat dilepas (${Math.round(gapMs / 1000)} detik).`,
          });
          addAnchor(anchors, {
            accountId,
            deviceId,
            timestamp: entry.timestamp,
            type: 'SIGNAL_RESTORED',
            source: `${entry.source}_timestamp_gap`,
            sourceId: entry.sourceId,
            confidence: 0.75,
            inferred: true,
            description: 'Data berikutnya tercatat setelah jeda sinyal.',
          });
        }
        current = {
          session_id: `${entry.kind}:${deviceId}:${entry.id}`,
          user_id: String(accountId),
          device_id: deviceId,
          source_level: entry.source,
          start: entry.timestamp,
          end: entry.end ?? entry.timestamp,
          duration_ms: Math.max(0, (entry.end ?? entry.timestamp) - entry.timestamp),
          status: gapDetected ? 'signal_gap_inferred' : 'data_observed',
          measurement_ids: [],
        };
        sessions.push(current);
      } else {
        current.end = Math.max(current.end, entry.end ?? entry.timestamp);
        current.duration_ms = Math.max(0, current.end - current.start);
      }
      current.measurement_ids.push(entry.sourceId);
      previous = entry;
    }
  }
  return sessions;
}

export function buildCaparTemporalTimeline({
  accountId,
  rows = [],
  windows = [],
  activities = [],
  wearableSamples = [],
  streamLogs = [],
  signalGapMs = DEFAULT_SIGNAL_GAP_MS,
}) {
  const anchors = new Map();
  const levels = [
    { items: rows, kind: 'row', source: 'PolarData' },
    { items: windows, kind: 'window', source: 'Segment' },
    { items: activities, kind: 'activity', source: 'CaparActivityTimeSeries' },
  ];
  const sessions = [];
  const allTimestamps = [];

  for (const level of levels) {
    const stream = toSourceStream(level.items, level.kind);
    if (!stream.length) continue;
    allTimestamps.push(...stream.map(({ timestamp }) => timestamp));
    const deviceStreams = new Map();
    for (const entry of stream) {
      const streamKey = `${entry.deviceId}:${entry.source}`;
      if (!deviceStreams.has(streamKey)) deviceStreams.set(streamKey, []);
      deviceStreams.get(streamKey).push(entry);
      if (level.kind === 'window' || level.kind === 'activity') {
        addAnchor(anchors, {
          accountId,
          deviceId: entry.deviceId,
          timestamp: entry.timestamp,
          type: level.kind === 'window' ? 'WINDOW_BOUNDARY' : 'EPISODE_START',
          source: entry.source,
          sourceId: entry.sourceId,
          confidence: 1,
          inferred: false,
          description: level.kind === 'window' ? 'Batas awal window CAPAR.' : 'Episode aktivitas dimulai.',
        });
      }
      if (level.kind === 'window' || level.kind === 'activity') {
        addAnchor(anchors, {
          accountId,
          deviceId: entry.deviceId,
          timestamp: entry.end ?? entry.timestamp,
          type: level.kind === 'window' ? 'WINDOW_BOUNDARY' : 'EPISODE_END',
          source: entry.source,
          sourceId: entry.sourceId,
          confidence: 1,
          inferred: false,
          description: level.kind === 'window' ? 'Batas akhir window CAPAR.' : 'Episode aktivitas berakhir.',
        });
      }
    }

    for (const deviceEntries of deviceStreams.values()) {
      for (let index = 1; index < deviceEntries.length; index += 1) {
        const previous = deviceEntries[index - 1];
        const current = deviceEntries[index];
        if (previous.activity !== current.activity) {
          addAnchor(anchors, {
            accountId,
            deviceId: current.deviceId,
            timestamp: current.timestamp,
            type: 'ACTIVITY_CHANGE',
            source: current.source,
            sourceId: current.sourceId,
            confidence: 1,
            inferred: false,
            description: `Aktivitas berubah dari ${previous.activity} menjadi ${current.activity}.`,
          });
          addAnchor(anchors, {
            accountId,
            deviceId: current.deviceId,
            timestamp: current.timestamp,
            type: 'ACTIVITY_START',
            source: current.source,
            sourceId: current.sourceId,
            confidence: 1,
            inferred: false,
            description: `Segmen aktivitas ${current.activity} dimulai.`,
          });
        }
      }
      const first = deviceEntries[0];
      addAnchor(anchors, {
        accountId,
        deviceId: first.deviceId,
        timestamp: first.timestamp,
        type: 'ACTIVITY_START',
        source: first.source,
        sourceId: first.sourceId,
        confidence: 1,
        inferred: false,
        description: `Aktivitas awal yang tercatat: ${first.activity}.`,
      });
    }

    const dataStartByDevice = new Map();
    const dataEndByDevice = new Map();
    for (const entry of stream) {
      const streamKey = `${entry.deviceId}:${entry.source}`;
      if (!dataStartByDevice.has(streamKey)) dataStartByDevice.set(streamKey, entry);
      dataEndByDevice.set(streamKey, entry);
    }
    for (const [streamKey, first] of dataStartByDevice) {
      const deviceId = first.deviceId;
      const last = dataEndByDevice.get(streamKey);
      addAnchor(anchors, {
        accountId,
        deviceId,
        timestamp: first.timestamp,
        type: 'DATA_START',
        source: first.source,
        sourceId: first.sourceId,
        confidence: 1,
        inferred: false,
        description: 'Data pertama dalam tingkat visualisasi ini.',
      });
      addAnchor(anchors, {
        accountId,
        deviceId,
        timestamp: last.end ?? last.timestamp,
        type: 'DATA_END',
        source: last.source,
        sourceId: last.sourceId,
        confidence: 1,
        inferred: false,
        description: 'Data terakhir dalam tingkat visualisasi ini.',
      });
    }
    sessions.push(...createSignalSessions(stream, accountId, anchors, signalGapMs));
  }

  const contactByDevice = new Map();
  for (const sample of wearableSamples) {
    const timestamp = nodeTime(sample, 'sample');
    if (timestamp === null) continue;
    const deviceId = String(sample.device_id || 'UNKNOWN');
    allTimestamps.push(timestamp);
    if (!contactByDevice.has(deviceId)) contactByDevice.set(deviceId, []);
    contactByDevice.get(deviceId).push({ sample, timestamp, deviceId });
  }
  for (const [deviceId, samples] of contactByDevice) {
    samples.sort((first, second) => first.timestamp - second.timestamp);
    let openContactSession = null;
    for (let index = 0; index < samples.length; index += 1) {
      const { sample, timestamp } = samples[index];
      const previous = samples[index - 1];
      const contact = sample.sensor_contact === true;
      if (
        sample.data_quality?.status === 'rejected'
        || (sample.signal_confidence !== null
          && sample.signal_confidence !== undefined
          && Number(sample.signal_confidence) <= 0)
      ) {
        addAnchor(anchors, {
          accountId,
          deviceId,
          timestamp,
          type: 'SIGNAL_LOST',
          source: 'PatientAppWearableSample.signal_quality',
          sourceId: sample._id,
          confidence: 1,
          inferred: false,
          description: 'Kualitas sinyal tidak valid/ditolak; ini berbeda dari device removal.',
        });
      }
      if (contact) {
        const gapAfterPrevious = previous && timestamp - previous.timestamp > signalGapMs;
        const contactResumed = previous && previous.sample.sensor_contact !== true;
        if (!previous || contactResumed) {
          addAnchor(anchors, {
            accountId,
            deviceId,
            timestamp,
            type: previous ? 'DEVICE_WORN_AGAIN' : 'DEVICE_WORN',
            source: 'PatientAppWearableSample.sensor_contact',
            sourceId: sample._id,
            confidence: Number.isFinite(Number(sample.signal_confidence))
              ? Number(sample.signal_confidence)
              : 1,
            inferred: false,
            description: 'Kontak sensor tercatat; ini bukti kontak wearable, bukan event pemasangan fisik.',
          });
        }
        if (gapAfterPrevious) {
          addAnchor(anchors, {
            accountId,
            deviceId,
            timestamp: previous.timestamp,
            type: 'SIGNAL_LOST',
            source: 'PatientAppWearableSample.timestamp_gap',
            sourceId: previous.sample._id,
            confidence: 0.75,
            inferred: true,
            description: 'Jeda pengiriman wearable; tidak memastikan device dilepas.',
          });
          addAnchor(anchors, {
            accountId,
            deviceId,
            timestamp,
            type: 'SIGNAL_RESTORED',
            source: 'PatientAppWearableSample.timestamp_gap',
            sourceId: sample._id,
            confidence: 0.75,
            inferred: true,
            description: 'Sampel wearable kembali tercatat setelah jeda.',
          });
        }
        if (!openContactSession || gapAfterPrevious) {
          openContactSession = {
            session_id: `contact:${deviceId}:${String(sample._id)}`,
            user_id: String(accountId),
            device_id: deviceId,
            source_level: 'wearable_contact',
            start: timestamp,
            end: timestamp,
            duration_ms: 0,
            status: gapAfterPrevious
              ? 'contact_after_data_gap'
              : 'sensor_contact_confirmed',
            measurement_ids: [],
          };
          sessions.push(openContactSession);
        }
        openContactSession.end = timestamp;
        openContactSession.duration_ms = Math.max(0, timestamp - openContactSession.start);
        openContactSession.measurement_ids.push(String(sample._id));
      } else {
        if (!previous || previous.sample.sensor_contact === true) {
          addAnchor(anchors, {
            accountId,
            deviceId,
            timestamp,
            type: 'SIGNAL_LOST',
            source: 'PatientAppWearableSample.sensor_contact',
            sourceId: sample._id,
            confidence: 1,
            inferred: false,
            description: 'Kontak sensor tercatat tidak aktif; bukan bukti bahwa device dilepas.',
          });
        }
        if (openContactSession) {
          openContactSession.end = timestamp;
          openContactSession.duration_ms = Math.max(0, timestamp - openContactSession.start);
          openContactSession.status = 'sensor_contact_lost';
          openContactSession = null;
        }
      }
    }
  }

  for (const log of streamLogs) {
    const timestamp = normalizeEpochMs(log.created_at);
    if (timestamp === null) continue;
    const eventTypes = {
      streaming_started: ['DATA_START', 'Streaming aplikasi dimulai.'],
      streaming_stopped: ['DATA_END', 'Streaming aplikasi berhenti; bukan event pelepasan device.'],
      mqtt_failed: ['SIGNAL_LOST', 'Koneksi MQTT gagal.'],
      mqtt_connected: ['SIGNAL_RESTORED', 'Koneksi MQTT tersambung.'],
      publish_failed: ['SIGNAL_LOST', 'Pengiriman data gagal.'],
    };
    const mapped = eventTypes[log.event];
    if (!mapped) continue;
    addAnchor(anchors, {
      accountId,
      deviceId: log.device_id,
      timestamp,
      type: mapped[0],
      source: `MobileStreamLog.${log.event}`,
      sourceId: log._id,
      confidence: 1,
      inferred: false,
      description: mapped[1],
    });
  }

  if (allTimestamps.length) {
    const { minTime, maxTime } = allTimestamps.reduce((range, timestamp) => ({
      minTime: Math.min(range.minTime, timestamp),
      maxTime: Math.max(range.maxTime, timestamp),
    }), { minTime: Infinity, maxTime: -Infinity });
    const firstDay = getJakartaDateKey(minTime);
    const lastDay = getJakartaDateKey(maxTime);
    let dayStart = Date.parse(`${firstDay}T00:00:00.000Z`) - JAKARTA_OFFSET_MS;
    const lastDayStart = Date.parse(`${lastDay}T00:00:00.000Z`) - JAKARTA_OFFSET_MS;
    while (dayStart <= lastDayStart) {
      const dayEnd = dayStart + DAY_MS;
      addAnchor(anchors, {
        accountId,
        deviceId: 'ALL',
        timestamp: dayStart,
        type: 'DAY_START',
        source: 'Asia/Jakarta calendar',
        sourceId: null,
        confidence: 1,
        inferred: false,
        description: `Awal hari ${getJakartaDateKey(dayStart)} WIB.`,
      });
      addAnchor(anchors, {
        accountId,
        deviceId: 'ALL',
        timestamp: dayEnd,
        type: 'DAY_END',
        source: 'Asia/Jakarta calendar',
        sourceId: null,
        confidence: 1,
        inferred: false,
        description: `Akhir hari ${getJakartaDateKey(dayStart)} WIB.`,
      });
      dayStart = dayEnd;
    }
  }

  return {
    anchors: [...anchors.values()].sort((first, second) => (
      first.timestamp - second.timestamp
      || first.anchor_type.localeCompare(second.anchor_type)
    )),
    device_sessions: sessions.sort((first, second) => (
      first.start - second.start || first.session_id.localeCompare(second.session_id)
    )),
  };
}

export function buildTemporalEdges(nodes, { getTime, getActivity, getMetric, getId }) {
  const ordered = [...nodes].sort((first, second) => (
    getTime(first) - getTime(second) || String(getId(first)).localeCompare(String(getId(second)))
  ));
  return ordered.map((node, index) => {
    const previous = ordered[index - 1] || null;
    const next = ordered[index + 1] || null;
    const rawCurrentMetric = getMetric(node);
    const rawPreviousMetric = previous ? getMetric(previous) : null;
    const currentMetric = rawCurrentMetric === null || rawCurrentMetric === undefined || rawCurrentMetric === ''
      ? NaN
      : Number(rawCurrentMetric);
    const previousMetric = rawPreviousMetric === null || rawPreviousMetric === undefined || rawPreviousMetric === ''
      ? NaN
      : Number(rawPreviousMetric);
    const delta = Number.isFinite(currentMetric) && Number.isFinite(previousMetric)
      ? currentMetric - previousMetric
      : null;
    return {
      node_id: String(getId(node)),
      predecessor_id: previous ? String(getId(previous)) : null,
      successor_id: next ? String(getId(next)) : null,
      elapsed_from_predecessor_ms: previous ? getTime(node) - getTime(previous) : null,
      activity_changed: previous ? getActivity(node) !== getActivity(previous) : false,
      metric_delta_from_predecessor: delta,
      metric_direction: delta === null ? 'unavailable' : delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'stable',
    };
  });
}
