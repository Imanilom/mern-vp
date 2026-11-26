export function asId(value) {
  return value === null || value === undefined ? '' : String(value);
}

function getJakartaDay(timestamp) {
  return Number.isFinite(timestamp)
    ? new Date(timestamp + (7 * 60 * 60 * 1000)).toISOString().slice(0, 10)
    : null;
}

function toMillis(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.abs(parsed) < 100_000_000_000 ? parsed * 1000 : parsed;
}

function metricProperties(record = {}) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );
}

export function projectCaparGraph({
  patient,
  rows = [],
  windows = [],
  activities = [],
  episodes = [],
  anchors = [],
  deviceSessions = [],
}) {
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();
  const edgeIds = new Set();
  const deferredEdges = [];
  const sourceNodeIds = new Map();
  const activityWindows = new Map();
  const episodeWindows = new Map();
  const deviceIds = new Map();
  const dayIds = new Map();
  const patientId = asId(patient?._id || patient?.id);

  const addNode = (node) => {
    if (!node.id || nodeIds.has(node.id)) return nodeIds.has(node.id) ? node.id : null;
    nodeIds.add(node.id);
    nodes.push(node);
    return node.id;
  };
  const addEdge = (source, target, type, metadata = {}, weight = null, weightUnit = null) => {
    if (!source || !target || source === target) return;
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      deferredEdges.push({ source, target, type, metadata, weight, weightUnit });
      return;
    }
    const id = `${type}:${source}->${target}`;
    if (edgeIds.has(id)) return;
    edgeIds.add(id);
    edges.push({
      id,
      source,
      target,
      type,
      directed: true,
      weight,
      weight_unit: weightUnit,
      timestamp: metadata.timestamp ?? null,
      metadata,
    });
  };
  const ensureDevice = (rawDeviceId) => {
    const deviceId = asId(rawDeviceId) || 'UNKNOWN';
    const id = `device:${deviceId}`;
    if (!deviceIds.has(deviceId)) {
      addNode({
        id,
        type: 'DEVICE',
        label: deviceId,
        timestamp: null,
        properties: { device_id: deviceId },
      });
      deviceIds.set(deviceId, id);
      if (patientId) addEdge(`patient:${patientId}`, id, 'USES_DEVICE', { source: 'observed_source_records' });
    }
    return id;
  };
  const ensureDay = (timestamp) => {
    const day = getJakartaDay(timestamp);
    if (!day) return null;
    if (!dayIds.has(day)) {
      const id = `day:${patientId}:${day}`;
      addNode({
        id,
        type: 'MONITORING_DAY',
        label: day,
        timestamp: Date.parse(`${day}T00:00:00+07:00`),
        properties: { date: day, timezone: 'Asia/Jakarta' },
      });
      dayIds.set(day, id);
      if (patientId) addEdge(`patient:${patientId}`, id, 'HAS_DAY', { source: 'Asia/Jakarta date projection' });
    }
    return dayIds.get(day);
  };

  if (patientId) {
    addNode({
      id: `patient:${patientId}`,
      type: 'PATIENT',
      label: patient.name || patient.email || patientId,
      timestamp: null,
      properties: { patient_id: patientId, email: patient.email || null },
    });
  }

  const temporalGroups = new Map();
  const addTemporalNode = (node, groupKey) => {
    const id = addNode(node);
    if (!id) return;
    const dayId = ensureDay(node.timestamp);
    if (dayId) addEdge(id, dayId, 'OCCURRED_ON', { source: 'timestamp', timezone: 'Asia/Jakarta' });
    if (patientId && node.type === 'PHYSIOLOGICAL_EPISODE') {
      addEdge(`patient:${patientId}`, id, 'HAS_EPISODE', { source: node.provenance?.collection || 'AnomalyEvent' });
    }
    const deviceId = node.properties?.device_id;
    if (deviceId) {
      const deviceNodeId = ensureDevice(deviceId);
      const deviceRelation = {
        RAW_DATA: 'PRODUCES_DATA',
        WINDOW: 'HAS_WINDOW',
        ACTIVITY: 'HAS_ACTIVITY',
        PHYSIOLOGICAL_EPISODE: 'ASSOCIATED_WITH',
      }[node.type];
      if (deviceRelation) {
        addEdge(deviceNodeId, id, deviceRelation, { source: node.provenance?.collection || 'CAPAR source' });
      }
    }
    if (groupKey) {
      if (!temporalGroups.has(groupKey)) temporalGroups.set(groupKey, []);
      temporalGroups.get(groupKey).push({ id, timestamp: node.timestamp });
    }
    return id;
  };

  rows.forEach((row) => {
    const timestamp = toMillis(row.timestamp_ms ?? row.timestamp);
    const sourceId = asId(row.source_id || row._id);
    if (timestamp === null || !sourceId) return;
    const id = `raw:${row.source_collection || 'PolarData'}:${sourceId}`;
    const nodeId = addTemporalNode({
      id,
      type: 'RAW_DATA',
      label: sourceId,
      timestamp,
      properties: metricProperties({
        timestamp,
        hr: row.hr,
        rr: row.rr,
        rrms: row.rrms,
        rr_interval_count: row.rr_interval_count,
        rmssd_ms: row.rmssd_ms,
        sdnn_ms: row.sdnn_ms,
        dfa_alpha1: row.dfa_alpha1,
        activity: row.activity || 'Unknown',
        acc_x: row.acc_x,
        acc_y: row.acc_y,
        acc_z: row.acc_z,
        step_count: row.step_count,
        signal_quality: row.signal_quality,
        data_quality: row.data_quality,
        sensor_contact: row.sensor_contact,
        spo2_pct: row.spo2_pct,
        steps: row.steps,
        device_id: row.device_id || 'UNKNOWN',
      }),
      provenance: { collection: row.source_collection || 'PolarData', source_id: sourceId },
    }, `raw:${row.device_id || 'UNKNOWN'}:${row.source_collection || 'PolarData'}`);
    sourceNodeIds.set(`${row.source_collection || 'PolarData'}:${sourceId}`, nodeId);
    if (row.parent_window_id) {
      addEdge(`window:${row.parent_window_id}`, nodeId, 'HAS_RAW_DATA', {
        source: row.parent_relation_source || 'stored_window_reference',
        inferred: row.parent_relation_source === 'timestamp_overlap',
        interval: 'raw timestamp falls inside window interval',
      });
    }
  });

  windows.forEach((window) => {
    const timestamp = toMillis(window.window_start);
    const sourceId = asId(window._id);
    if (timestamp === null || !sourceId) return;
    const id = addTemporalNode({
      id: `window:${sourceId}`,
      type: 'WINDOW',
      label: `Window ${sourceId}`,
      timestamp,
      end_timestamp: toMillis(window.window_end),
      properties: {
        ...metricProperties(window.features || {}),
        window_start: timestamp,
        window_end: toMillis(window.window_end),
        window_type: window.window_type,
        raw_count: window.raw_count,
        activity: window.activity_label || 'Unknown',
        is_valid: window.is_valid,
        classification: window.classification,
        rr_status: window.rr_status,
        signal_quality_detail: window.signal_quality_detail,
        missing_data_info: window.missing_data_info,
        device_id: window.device_id || 'UNKNOWN',
      },
      provenance: { collection: 'Segment', source_id: sourceId },
    }, `window:${window.device_id || 'UNKNOWN'}:${window.window_type || '5min'}`);
    sourceNodeIds.set(`Segment:${sourceId}`, id);
  });

  activities.forEach((activity) => {
    const timestamp = toMillis(activity.episode_start);
    const sourceId = asId(activity.episode_key || activity._id);
    if (timestamp === null || !sourceId) return;
    const id = addTemporalNode({
      id: `activity:${sourceId}`,
      type: 'ACTIVITY',
      label: activity.activity_label || 'Unknown',
      timestamp,
      end_timestamp: toMillis(activity.episode_end),
      properties: {
        activity: activity.activity_label || 'Unknown',
        episode_start: timestamp,
        episode_end: toMillis(activity.episode_end),
        summary: activity.summary || {},
        window_count: activity.summary?.window_count ?? activity.source_segment_ids?.length ?? 0,
        device_id: activity.device_id || 'UNKNOWN',
        window_type: activity.window_type || '5min',
      },
      provenance: { collection: 'CaparActivityTimeSeries', source_id: sourceId },
    }, `activity:${activity.device_id || 'UNKNOWN'}`);
    sourceNodeIds.set(`CaparActivityTimeSeries:${asId(activity._id || sourceId)}`, id);
    (activity.source_segment_ids || []).forEach((windowId) => {
      const windowNodeId = `window:${windowId}`;
      if (!activityWindows.has(windowNodeId)) activityWindows.set(windowNodeId, []);
      activityWindows.get(windowNodeId).push(id);
      addEdge(id, windowNodeId, 'HAS_WINDOW', {
        source: 'CaparActivityTimeSeries.source_segment_ids',
        inferred: false,
      });
    });
  });

  episodes.forEach((episode) => {
    const timestamp = toMillis(episode.onset_time ?? episode.started_at);
    const sourceId = asId(episode._id);
    if (timestamp === null || !sourceId) return;
    const id = addTemporalNode({
      id: `episode:${sourceId}`,
      type: 'PHYSIOLOGICAL_EPISODE',
      label: `${episode.classification || 'Episode'} ${sourceId}`,
      timestamp,
      end_timestamp: toMillis(episode.resolved_time ?? episode.recovered_at ?? episode.unresolved_at),
      properties: {
        onset_time: timestamp,
        peak_time: toMillis(episode.peak_time),
        resolved_time: toMillis(episode.resolved_time ?? episode.recovered_at),
        duration_ms: episode.duration_ms,
        classification: episode.classification,
        status: episode.status,
        physiological_outcome: episode.physiological_outcome,
        current_state: episode.current_state,
        confidence: episode.confidence,
        activity: episode.activity,
        state_transitions: episode.state_transitions || episode.trajectory?.state_transitions || [],
        trajectory: episode.trajectory || {},
        z_scores_at_peak: episode.z_scores_at_peak || {},
        device_id: episode.device_id || 'UNKNOWN',
        related_segment_ids: (episode.segment_ids || []).map(asId),
      },
      provenance: { collection: 'AnomalyEvent', source_id: sourceId },
    }, `episode:${episode.device_id || 'UNKNOWN'}`);
    (episode.segment_ids || []).forEach((windowId) => {
      const windowNodeId = `window:${windowId}`;
      if (!episodeWindows.has(windowNodeId)) episodeWindows.set(windowNodeId, []);
      episodeWindows.get(windowNodeId).push(id);
      addEdge(id, windowNodeId, 'HAS_WINDOW', {
        source: 'AnomalyEvent.segment_ids',
        inferred: false,
      });
    });
    if (episode.parent_episode_id) {
      addEdge(`episode:${episode.parent_episode_id}`, id, 'ASSOCIATED_WITH', {
        source: 'AnomalyEvent.parent_episode_id',
        inferred: false,
      });
    }
  });

  for (const [windowId, relatedActivities] of activityWindows) {
    const relatedEpisodes = episodeWindows.get(windowId) || [];
    for (const activityId of relatedActivities) {
      for (const episodeId of relatedEpisodes) {
        addEdge(activityId, episodeId, 'ASSOCIATED_WITH', {
          source: 'shared source segment reference',
          inferred: false,
          window_id: windowId,
        });
      }
    }
  }

  for (const [groupKey, group] of temporalGroups) {
    group.sort((first, second) => first.timestamp - second.timestamp || first.id.localeCompare(second.id));
    for (let index = 1; index < group.length; index += 1) {
      const previous = group[index - 1];
      const current = group[index];
      const elapsedSeconds = Math.max(0, (current.timestamp - previous.timestamp) / 1000);
      addEdge(previous.id, current.id, 'NEXT', {
        source: 'timestamp ordering',
        group: groupKey,
        elapsed_seconds: elapsedSeconds,
        meaning: 'temporal progression; not causality',
      }, elapsedSeconds, 'seconds');
    }
  }

  deviceSessions.forEach((session) => {
    const sessionId = asId(session.session_id);
    if (!sessionId) return;
    const sessionNodeId = `session:${sessionId}`;
    addNode({
      id: sessionNodeId,
      type: 'DEVICE_SESSION',
      label: `Session ${sessionId}`,
      timestamp: toMillis(session.start),
      end_timestamp: toMillis(session.end),
      properties: {
        device_id: session.device_id || 'UNKNOWN',
        start: toMillis(session.start),
        end: toMillis(session.end),
        duration_ms: session.duration_ms,
        status: session.status,
        source_level: session.source_level,
        measurement_count: session.measurement_ids?.length || 0,
      },
      provenance: { collection: session.source_level || 'derived_device_session', source_id: sessionId },
    });
    addEdge(ensureDevice(session.device_id), sessionNodeId, 'HAS_SESSION', {
      source: session.source_level || 'device signal session',
      inferred: session.source_level === 'wearable_contact',
    });
    (session.measurement_ids || []).forEach((measurementId) => {
      const sourceNodeId = sourceNodeIds.get(`${session.source_level}:${asId(measurementId)}`);
      if (sourceNodeId) {
        addEdge(sessionNodeId, sourceNodeId, 'PRODUCES_DATA', {
          source: session.source_level,
          inferred: false,
        });
      }
    });
  });

  const eventsByDevice = new Map();
  anchors.forEach((anchor) => {
    const timestamp = toMillis(anchor.timestamp);
    const sourceId = asId(anchor.anchor_id);
    if (timestamp === null || !sourceId) return;
    const id = addNode({
      id: `event:${sourceId}`,
      type: 'DEVICE_EVENT',
      label: anchor.anchor_type,
      timestamp,
      properties: {
        event_type: anchor.anchor_type,
        description: anchor.description,
        confidence: anchor.confidence,
        inferred: Boolean(anchor.inferred),
        device_id: anchor.device_id || 'UNKNOWN',
      },
      provenance: { collection: anchor.source || 'timeline_anchor', source_id: asId(anchor.source_id) || null },
    });
    const deviceNodeId = ensureDevice(anchor.device_id);
    addEdge(deviceNodeId, id, 'OBSERVED_EVENT', {
      source: anchor.source || 'timeline_anchor',
      confidence: anchor.confidence,
      inferred: Boolean(anchor.inferred),
    });
    const deviceKey = asId(anchor.device_id) || 'UNKNOWN';
    if (!eventsByDevice.has(deviceKey)) eventsByDevice.set(deviceKey, []);
    eventsByDevice.get(deviceKey).push({ id, timestamp });
    const dayId = ensureDay(timestamp);
    if (dayId) addEdge(id, dayId, 'OCCURRED_ON', { source: 'timestamp', timezone: 'Asia/Jakarta' });
  });
  for (const events of eventsByDevice.values()) {
    events.sort((first, second) => first.timestamp - second.timestamp || first.id.localeCompare(second.id));
    for (let index = 1; index < events.length; index += 1) {
      const previous = events[index - 1];
      const current = events[index];
      const elapsedSeconds = Math.max(0, (current.timestamp - previous.timestamp) / 1000);
      addEdge(previous.id, current.id, 'NEXT', {
        source: 'event timestamp ordering',
        elapsed_seconds: elapsedSeconds,
        meaning: 'event order; not device removal or causality',
      }, elapsedSeconds, 'seconds');
    }
  }

  for (const edge of deferredEdges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      addEdge(edge.source, edge.target, edge.type, edge.metadata, edge.weight, edge.weightUnit);
    }
  }

  const graph = createAdjacencyList(nodes, edges);
  return {
    ...graph,
    summary: {
      node_count: nodes.length,
      edge_count: edges.length,
      node_types: [...new Set(nodes.map(({ type }) => type))].sort(),
      edge_types: [...new Set(edges.map(({ type }) => type))].sort(),
      representation: 'directed adjacency list',
    },
  };
}

export function createAdjacencyList(nodes = [], edges = []) {
  const nodeById = new Map();
  const outgoing = new Map();
  const incoming = new Map();

  for (const node of nodes) {
    if (!node?.id) throw new Error('Graph node must have a unique non-empty id.');
    if (nodeById.has(node.id)) throw new Error(`Duplicate graph node id: ${node.id}`);
    nodeById.set(node.id, node);
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }

  const edgeById = new Map();
  for (const edge of edges) {
    if (!edge?.id) throw new Error('Graph edge must have a unique non-empty id.');
    if (edgeById.has(edge.id)) throw new Error(`Duplicate graph edge id: ${edge.id}`);
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      throw new Error(`Graph edge ${edge.id} references a missing node.`);
    }
    if (edge.weight !== null && edge.weight !== undefined
      && (!Number.isFinite(Number(edge.weight)) || Number(edge.weight) < 0)) {
      throw new Error(`Graph edge ${edge.id} has an invalid weight.`);
    }
    edgeById.set(edge.id, edge);
    outgoing.get(edge.source).push(edge);
    incoming.get(edge.target).push(edge);
  }

  return { nodes, edges, nodeById, edgeById, outgoing, incoming };
}

function filterEdges(edges, edgeTypes) {
  if (!edgeTypes) return edges;
  return edges.filter((edge) => edgeTypes.has(edge.type));
}

export function getGraphNeighbors(graph, nodeId, direction = 'both', edgeTypes = null) {
  if (!graph.nodeById.has(nodeId)) return [];
  const types = edgeTypes ? new Set(edgeTypes) : null;
  const edges = [
    ...(direction === 'incoming' || direction === 'both' ? graph.incoming.get(nodeId) : []),
    ...(direction === 'outgoing' || direction === 'both' ? graph.outgoing.get(nodeId) : []),
  ];
  const unique = new Map();
  for (const edge of filterEdges(edges, types)) {
    const neighborId = edge.source === nodeId ? edge.target : edge.source;
    const neighbor = graph.nodeById.get(neighborId);
    if (!unique.has(neighborId)) unique.set(neighborId, { node: neighbor, edges: [] });
    unique.get(neighborId).edges.push(edge);
  }
  return [...unique.values()];
}

export function traverseGraph(graph, startId, method = 'bfs', edgeTypes = null) {
  if (!graph.nodeById.has(startId)) return [];
  const types = edgeTypes ? new Set(edgeTypes) : null;
  const visited = new Set([startId]);
  const order = [];
  const frontier = [startId];
  let head = 0;

  while (method === 'dfs' ? frontier.length > 0 : head < frontier.length) {
    const current = method === 'dfs' ? frontier.pop() : frontier[head++];
    order.push(current);
    const edges = filterEdges(graph.outgoing.get(current), types);
    for (const edge of edges) {
      if (visited.has(edge.target)) continue;
      visited.add(edge.target);
      frontier.push(edge.target);
    }
  }
  return order;
}

export function isGraphReachable(graph, startId, targetId, edgeTypes = null) {
  return traverseGraph(graph, startId, 'bfs', edgeTypes).includes(targetId);
}

export function findGraphPath(graph, startId, targetId, { weighted = false, edgeTypes = null } = {}) {
  if (!graph.nodeById.has(startId) || !graph.nodeById.has(targetId)) return null;
  if (startId === targetId) return { nodeIds: [startId], edgeIds: [], totalWeight: 0 };
  const types = edgeTypes ? new Set(edgeTypes) : null;

  if (!weighted) {
    const queue = [startId];
    const previous = new Map([[startId, null]]);
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      for (const edge of filterEdges(graph.outgoing.get(current), types)) {
        if (previous.has(edge.target)) continue;
        previous.set(edge.target, { nodeId: current, edge });
        if (edge.target === targetId) {
          return reconstructPath(previous, targetId, 0);
        }
        queue.push(edge.target);
      }
    }
    return null;
  }

  const distances = new Map([[startId, 0]]);
  const previous = new Map();
  const pending = new MinPriorityQueue();
  pending.push(startId, 0);
  while (pending.size) {
    const { value: current, priority } = pending.pop();
    if (priority > distances.get(current)) continue;
    if (current === targetId) return reconstructPath(previous, targetId, distances.get(targetId));
    for (const edge of filterEdges(graph.outgoing.get(current), types)) {
      if (edge.weight === null || edge.weight === undefined || !Number.isFinite(Number(edge.weight))) continue;
      const candidate = distances.get(current) + Number(edge.weight);
      if (candidate >= (distances.get(edge.target) ?? Infinity)) continue;
      distances.set(edge.target, candidate);
      previous.set(edge.target, { nodeId: current, edge });
      pending.push(edge.target, candidate);
    }
  }
  return null;
}

class MinPriorityQueue {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(value, priority) {
    const item = { value, priority };
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].priority <= item.priority) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }

  pop() {
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      let index = 0;
      while (true) {
        const left = (index * 2) + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        const child = right < this.items.length
          && this.items[right].priority < this.items[left].priority
          ? right
          : left;
        if (this.items[child].priority >= last.priority) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
}

function reconstructPath(previous, targetId, totalWeight) {
  const nodeIds = [targetId];
  const edgeIds = [];
  let current = targetId;
  while (previous.get(current)) {
    const step = previous.get(current);
    edgeIds.push(step.edge.id);
    current = step.nodeId;
    nodeIds.push(current);
  }
  nodeIds.reverse();
  edgeIds.reverse();
  return { nodeIds, edgeIds, totalWeight };
}

export function getWeaklyConnectedComponents(graph, edgeTypes = null) {
  const types = edgeTypes ? new Set(edgeTypes) : null;
  const seen = new Set();
  const components = [];
  for (const nodeId of graph.nodeById.keys()) {
    if (seen.has(nodeId)) continue;
    const component = [];
    const queue = [nodeId];
    let head = 0;
    seen.add(nodeId);
    while (head < queue.length) {
      const current = queue[head++];
      component.push(current);
      const neighbors = getGraphNeighbors(graph, current, 'both', types);
      for (const { node } of neighbors) {
        if (seen.has(node.id)) continue;
        seen.add(node.id);
        queue.push(node.id);
      }
    }
    components.push(component);
  }
  return components;
}
