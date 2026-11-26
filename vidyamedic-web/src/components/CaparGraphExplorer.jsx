import '@xyflow/react/dist/style.css';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import {
  createAdjacencyList,
  findGraphPath,
  traverseGraph,
} from '../utils/caparGraph';

const NODE_TYPE_LABELS = {
  PATIENT: 'Pasien',
  DEVICE: 'Device',
  DEVICE_SESSION: 'Sesi device',
  MONITORING_DAY: 'Hari monitoring',
  RAW_DATA: 'Raw measurement',
  WINDOW: 'Window CAPAR',
  ACTIVITY: 'Episode aktivitas',
  PHYSIOLOGICAL_EPISODE: 'Episode fisiologis',
  DEVICE_EVENT: 'Event device',
};
const NODE_COLORS = {
  PATIENT: '#234f65',
  DEVICE: '#587889',
  DEVICE_SESSION: '#718996',
  MONITORING_DAY: '#766a98',
  RAW_DATA: '#397b69',
  WINDOW: '#547fb4',
  ACTIVITY: '#c27b3f',
  PHYSIOLOGICAL_EPISODE: '#b45d69',
  DEVICE_EVENT: '#9b8a3c',
};
const LAYOUT_OPTIONS = [
  { id: 'chronological', label: 'Kronologis' },
  { id: 'hierarchical', label: 'Hierarkis' },
  { id: 'activity', label: 'Berpusat aktivitas' },
  { id: 'radial', label: 'Radial' },
  { id: 'force', label: 'Force-directed' },
];
const MAIN_NODE_TYPE = {
  rows: 'RAW_DATA',
  windows: 'WINDOW',
  activities: 'ACTIVITY',
};
const GRAPH_SCOPES = [
  { id: 'person', label: '01 · Per individu' },
  { id: 'day', label: '02 · Per hari' },
  { id: 'activity', label: '03 · Per aktivitas' },
  { id: 'window', label: '04 · Per window' },
];
const NODE_WIDTH = 206;
const NODE_HEIGHT = 96;

function formatClock(timestamp) {
  const numericTimestamp = Number(timestamp);
  const parsedTimestamp = Number.isFinite(numericTimestamp)
    ? numericTimestamp
    : Date.parse(String(timestamp));
  if (!Number.isFinite(parsedTimestamp)) return '';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(parsedTimestamp));
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return Number.isFinite(value) ? String(Number(value.toFixed(2))) : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getNodeActivity(node) {
  if (node.type === 'ACTIVITY') return node.properties?.activity || node.label;
  return node.properties?.activity || '';
}

function getNodeDay(node) {
  if (!Number.isFinite(node.timestamp)) return null;
  return new Date(node.timestamp + (7 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function getNodeDevice(node) {
  return node.properties?.device_id || '';
}

function getLimitedNeighborIds(graph, nodeId, limit = 24) {
  const incoming = graph.incoming.get(nodeId) || [];
  const outgoing = graph.outgoing.get(nodeId) || [];
  return [...new Set([
    ...incoming.slice(0, limit).map((edge) => edge.source),
    ...outgoing.slice(0, limit).map((edge) => edge.target),
  ])];
}

function getAttributeSummary(node) {
  const properties = node.properties || {};
  if (node.type === 'RAW_DATA') {
    return `HR ${formatValue(properties.hr)} bpm · RMSSD ${formatValue(properties.rmssd_ms)} ms · DFA α1 ${formatValue(properties.dfa_alpha1)}`;
  }
  if (node.type === 'WINDOW') {
    return `HR mean ${formatValue(properties.mean_hr)} bpm · RMSSD ${formatValue(properties.rmssd)} ms · ${properties.raw_count || 0} sampel`;
  }
  if (node.type === 'ACTIVITY') {
    return `${properties.window_count || 0} window · ${formatValue(properties.device_id)}`;
  }
  if (node.type === 'PHYSIOLOGICAL_EPISODE') {
    return `${formatValue(properties.classification)} · ${formatValue(properties.status)}`;
  }
  if (node.type === 'DEVICE_SESSION') {
    return `${formatValue(properties.status)} · ${properties.measurement_count || 0} data`;
  }
  if (node.type === 'DEVICE_EVENT') {
    return `${properties.inferred ? 'Inferensi' : 'Tercatat'} · confidence ${formatValue(properties.confidence)}`;
  }
  return node.type === 'DEVICE' ? formatValue(properties.device_id) : formatValue(node.label);
}

function CaparGraphNode({ data, selected }) {
  const color = NODE_COLORS[data.vertex.type] || '#647d8e';
  return (
    <div
      className={`capar-graph-vertex ${selected ? 'is-selected' : ''} ${data.isConnected ? 'is-connected' : ''} ${data.isPath ? 'is-path' : ''}`}
      style={{ '--vertex-color': color }}
      title={data.fullLabel}
    >
      <Handle className="capar-graph-handle" position={Position.Left} type="target" />
      <div className="capar-graph-vertex-heading">
        <span>{NODE_TYPE_LABELS[data.vertex.type] || data.vertex.type}</span>
        <strong>{data.vertex.label}</strong>
      </div>
      <time>{data.timeLabel || 'Waktu tidak tersedia'}</time>
      <small>{data.attributes}</small>
      <Handle className="capar-graph-handle" position={Position.Right} type="source" />
    </div>
  );
}

const nodeTypes = { caparGraphNode: CaparGraphNode };

function getRank(type) {
  return {
    PATIENT: 0,
    DEVICE: 1,
    DEVICE_SESSION: 2,
    MONITORING_DAY: 2,
    PHYSIOLOGICAL_EPISODE: 3,
    ACTIVITY: 3,
    WINDOW: 4,
    DEVICE_EVENT: 4,
    RAW_DATA: 5,
  }[type] ?? 6;
}

function getPositions(vertices, edges, layout, focusId) {
  const ordered = [...vertices].sort((first, second) => (
    (first.timestamp ?? -Infinity) - (second.timestamp ?? -Infinity)
    || first.id.localeCompare(second.id)
  ));
  const positions = new Map();
  const laneCounts = new Map();

  if (layout === 'hierarchical') {
    ordered.forEach((node) => {
      const rank = getRank(node.type);
      const lane = laneCounts.get(rank) || 0;
      laneCounts.set(rank, lane + 1);
      positions.set(node.id, { x: 30 + (rank * 280), y: 30 + (lane * 142) });
    });
    return positions;
  }

  if (layout === 'activity') {
    const activityLanes = new Map();
    ordered.forEach((node) => {
      const activity = getNodeActivity(node) || 'Lainnya';
      if (!activityLanes.has(activity)) activityLanes.set(activity, activityLanes.size);
      const lane = activityLanes.get(activity);
      const index = laneCounts.get(activity) || 0;
      laneCounts.set(activity, index + 1);
      positions.set(node.id, {
        x: 30 + (index * 250),
        y: 30 + (lane * 210) + (getRank(node.type) * 18),
      });
    });
    return positions;
  }

  if (layout === 'radial') {
    const center = focusId && ordered.some((node) => node.id === focusId)
      ? focusId
      : ordered.find((node) => node.type === 'PATIENT')?.id;
    const centerNode = ordered.find((node) => node.id === center);
    if (centerNode) positions.set(centerNode.id, { x: 460, y: 360 });
    const remaining = ordered.filter((node) => node.id !== center);
    remaining.forEach((node, index) => {
      const ring = 1 + Math.floor(index / 20);
      const count = Math.min(20, remaining.length - ((ring - 1) * 20));
      const ringIndex = index % 20;
      const angle = (2 * Math.PI * ringIndex) / Math.max(1, count);
      const radius = 150 + (ring * 120);
      positions.set(node.id, {
        x: 460 + (Math.cos(angle) * radius),
        y: 360 + (Math.sin(angle) * radius),
      });
    });
    return positions;
  }

  ordered.forEach((node, index) => {
    if (layout === 'force' && ordered.length <= 350) {
      const angle = index * 2.399963;
      const radius = 45 * Math.sqrt(index + 1);
      positions.set(node.id, {
        x: 520 + (Math.cos(angle) * radius),
        y: 420 + (Math.sin(angle) * radius),
      });
    } else {
      const lane = getRank(node.type);
      positions.set(node.id, {
        x: 35 + (Math.floor(index / 10) * 255),
        y: 35 + ((index % 10) * 130) + (lane * 12),
      });
    }
  });

  if (layout === 'force') {
    const indexById = new Map(ordered.map((node, index) => [node.id, index]));
    const points = ordered.map((node) => ({ ...positions.get(node.id), vx: 0, vy: 0 }));
    const links = edges
      .map((edge) => [indexById.get(edge.source), indexById.get(edge.target)])
      .filter(([source, target]) => source !== undefined && target !== undefined);
    for (let iteration = 0; iteration < 36; iteration += 1) {
      const forces = points.map(() => ({ x: 0, y: 0 }));
      for (let first = 0; first < points.length; first += 1) {
        for (let second = first + 1; second < points.length; second += 1) {
          const dx = points[first].x - points[second].x;
          const dy = points[first].y - points[second].y;
          const distanceSquared = Math.max(400, (dx * dx) + (dy * dy));
          const force = 2800 / distanceSquared;
          forces[first].x += dx * force;
          forces[first].y += dy * force;
          forces[second].x -= dx * force;
          forces[second].y -= dy * force;
        }
      }
      links.forEach(([source, target]) => {
        const dx = points[target].x - points[source].x;
        const dy = points[target].y - points[source].y;
        forces[source].x += dx * 0.002;
        forces[source].y += dy * 0.002;
        forces[target].x -= dx * 0.002;
        forces[target].y -= dy * 0.002;
      });
      points.forEach((point, index) => {
        point.vx = (point.vx + forces[index].x) * 0.72;
        point.vy = (point.vy + forces[index].y) * 0.72;
        point.x += point.vx;
        point.y += point.vy;
      });
    }
    ordered.forEach((node, index) => positions.set(node.id, {
      x: points[index].x,
      y: points[index].y,
    }));
  }
  return positions;
}

function makeFlowNode(node, position, highlight = {}) {
  return {
    id: node.id,
    type: 'caparGraphNode',
    position,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    data: {
      vertex: node,
      timeLabel: Number.isFinite(node.timestamp) ? formatClock(node.timestamp) : '',
      attributes: getAttributeSummary(node),
      fullLabel: `${node.type} · ${node.label} · ${node.timestamp ? new Date(node.timestamp).toISOString() : 'no timestamp'}`,
      isConnected: highlight.connectedIds?.has(node.id) || false,
      isPath: highlight.pathNodeIds?.has(node.id) || false,
    },
  };
}

function makeFlowEdge(edge, options) {
  const highlighted = options.pathEdgeIds.has(edge.id)
    || options.neighborhoodEdgeIds.has(edge.id)
    || edge.id === options.selectedEdgeId;
  const color = highlighted
    ? '#1d7598'
    : edge.type === 'NEXT'
      ? '#547fb4'
      : edge.type === 'HAS_RAW_DATA' || edge.type === 'HAS_WINDOW'
        ? '#79a391'
        : '#9a899f';
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, color },
    label: options.showWeights && edge.weight !== null && edge.weight !== undefined
      ? `${formatValue(edge.weight)} ${edge.weight_unit || ''}`
      : options.showEdgeTypes ? edge.type : undefined,
    labelStyle: { fontSize: 9, fill: '#425764' },
    labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
    style: {
      stroke: color,
      strokeWidth: highlighted ? 2.5 : 1.4,
      strokeDasharray: edge.metadata?.inferred ? '6 4' : undefined,
    },
    data: { relationship: edge },
  };
}

function GraphInspector({ graph, node, edge, onFocusNode }) {
  if (edge) {
    const { relationship } = edge.data;
    return (
      <aside className="capar-graph-inspector">
        <div className="capar-graph-inspector-title">
          <span className="eyebrow">RELATIONSHIP</span>
          <h3>{relationship.type}</h3>
        </div>
        <p>{relationship.source} → {relationship.target}</p>
        {relationship.weight !== null && relationship.weight !== undefined && (
          <p>Bobot: {formatValue(relationship.weight)} {relationship.weight_unit}</p>
        )}
        <pre>{JSON.stringify(relationship.metadata || {}, null, 2)}</pre>
      </aside>
    );
  }
  if (!node) {
    return (
      <aside className="capar-graph-inspector is-empty">
        <strong>Pilih vertex atau edge</strong>
        <span>Detail relasi masuk/keluar dan atribut vertex ditampilkan di sini.</span>
      </aside>
    );
  }

  const vertex = graph.nodeById.get(node.id);
  const incoming = graph.incoming.get(node.id) || [];
  const outgoing = graph.outgoing.get(node.id) || [];
  const properties = Object.entries(vertex.properties || {})
    .filter(([key]) => key !== 'source_record');
  return (
    <aside className="capar-graph-inspector">
      <div className="capar-graph-inspector-title">
        <span className="eyebrow">{NODE_TYPE_LABELS[vertex.type] || vertex.type}</span>
        <h3>{vertex.label}</h3>
      </div>
      <dl>
        <dt>Node ID</dt><dd>{vertex.id}</dd>
        <dt>Waktu</dt><dd>{vertex.timestamp ? new Date(vertex.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '—'}</dd>
        {vertex.end_timestamp && (
          <><dt>Akhir</dt><dd>{new Date(vertex.end_timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</dd></>
        )}
        <dt>Sumber</dt><dd>{vertex.provenance?.collection || '—'} · {vertex.provenance?.source_id || '—'}</dd>
        {properties.map(([key, value]) => (
          <Fragment key={key}>
            <dt>{key}</dt>
            <dd>{formatValue(value)}</dd>
          </Fragment>
        ))}
      </dl>
      <div className="capar-graph-inspector-relations">
        <strong>Relasi masuk · {incoming.length}</strong>
        {incoming.slice(0, 20).map((relationship) => {
          const related = graph.nodeById.get(relationship.source);
          if (!related) return null;
          return (
            <button key={relationship.id} onClick={() => onFocusNode(related.id)} type="button">
              {relationship.type} ← {related.label}
            </button>
          );
        })}
        {incoming.length > 20 && <small>+{incoming.length - 20} relasi lainnya</small>}
      </div>
      <div className="capar-graph-inspector-relations">
        <strong>Relasi keluar · {outgoing.length}</strong>
        {outgoing.slice(0, 20).map((relationship) => {
          const related = graph.nodeById.get(relationship.target);
          if (!related) return null;
          return (
            <button key={relationship.id} onClick={() => onFocusNode(related.id)} type="button">
              {relationship.type} → {related.label}
            </button>
          );
        })}
        {outgoing.length > 20 && <small>+{outgoing.length - 20} relasi lainnya</small>}
      </div>
    </aside>
  );
}

export default function CaparGraphExplorer({
  graph,
  mode,
  selectedDate,
  dateMode,
  activityFilter,
  deviceFilter,
  onSelectNode,
  showMetrics = true,
  showScopeFilters = true,
  showScopeTabs = false,
  showScopeSelectors = false,
  scope = 'person',
  onScopeChange,
  onDayChange,
  episodes = [],
  windows = [],
  selectedEpisodeId = '',
  onEpisodeChange,
  selectedWindowId = '',
  onWindowChange,
}) {
  const [layout, setLayout] = useState('hierarchical');
  const [graphDay, setGraphDay] = useState(dateMode === 'day' ? selectedDate : 'all');
  const [enabledTypes, setEnabledTypes] = useState(null);
  const [enabledEdges, setEnabledEdges] = useState(null);
  const [visibleCount, setVisibleCount] = useState(200);
  const [search, setSearch] = useState('');
  const [searchedId, setSearchedId] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedEdgeId, setSelectedEdgeId] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [pathStart, setPathStart] = useState('');
  const [pathEnd, setPathEnd] = useState('');
  const [pathResult, setPathResult] = useState(null);
  const [pathMessage, setPathMessage] = useState('');
  const [traversalIds, setTraversalIds] = useState([]);
  const [traversalMethod, setTraversalMethod] = useState('bfs');
  const [useWeightedPath, setUseWeightedPath] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [showEdgeTypes, setShowEdgeTypes] = useState(true);
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const previousLayout = useRef(layout);
  const previousNodeTypeSignature = useRef(null);
  const previousEdgeTypeSignature = useRef(null);
  const mainType = MAIN_NODE_TYPE[mode] || null;

  const allNodeTypes = useMemo(() => [...new Set(graph.nodes.map(({ type }) => type))].sort(), [graph]);
  const allEdgeTypes = useMemo(() => [...new Set(graph.edges.map(({ type }) => type))].sort(), [graph]);
  const nodeTypeSignature = allNodeTypes.join('|');
  const edgeTypeSignature = allEdgeTypes.join('|');
  const days = useMemo(() => [...new Set(graph.nodes
    .map(getNodeDay)
    .filter(Boolean))].sort(), [graph]);
  const episodeOptions = useMemo(() => episodes
    .filter((episode) => (
      (deviceFilter === 'all' || !episode.device_id || String(episode.device_id) === deviceFilter)
      && (activityFilter === 'all' || !episode.activity || episode.activity === activityFilter)
      && (scope !== 'day' || graphDay === 'all'
        || getNodeDay({ timestamp: Number(episode.onset_time) }) === graphDay)
    ))
    .sort((first, second) => Number(second.onset_time) - Number(first.onset_time))
    .slice(0, 500), [episodes, deviceFilter, activityFilter, scope, graphDay]);
  const windowOptions = useMemo(() => windows
    .filter((window) => (
      (deviceFilter === 'all' || !window.device_id || String(window.device_id) === deviceFilter)
      && (activityFilter === 'all' || !window.activity_label || window.activity_label === activityFilter)
      && (scope !== 'day' || graphDay === 'all'
        || getNodeDay({ timestamp: Number(window.window_start) }) === graphDay)
    ))
    .sort((first, second) => Number(second.window_start) - Number(first.window_start))
    .slice(0, 500), [windows, deviceFilter, activityFilter, scope, graphDay]);
  const focusedRootId = selectedEpisodeId
    ? `episode:${selectedEpisodeId}`
    : scope === 'window' && selectedWindowId
      ? `window:${selectedWindowId}`
      : '';
  const focusedNodeIds = useMemo(() => {
    if (scope === 'window' && !focusedRootId) return new Set();
    if (!focusedRootId) return null;
    const root = graph.nodeById.get(focusedRootId);
    if (!root) return new Set();
    const ids = new Set([focusedRootId]);
    const directIds = getLimitedNeighborIds(graph, focusedRootId, 500);
    directIds.forEach((id) => ids.add(id));
    if (root.type === 'PHYSIOLOGICAL_EPISODE') {
      directIds
        .filter((id) => graph.nodeById.get(id)?.type === 'WINDOW')
        .slice(0, 40)
        .forEach((windowId) => {
          getLimitedNeighborIds(graph, windowId, 12).forEach((id) => ids.add(id));
        });
    }
    return ids;
  }, [graph, scope, focusedRootId]);
  const baseNodes = useMemo(() => graph.nodes
    .filter((node) => graphDay === 'all' || getNodeDay(node) === graphDay || !node.timestamp)
    .filter((node) => focusedNodeIds === null || focusedNodeIds.has(node.id))
    .filter((node) => deviceFilter === 'all' || !getNodeDevice(node) || getNodeDevice(node) === deviceFilter)
    .filter((node) => activityFilter === 'all'
      || !getNodeActivity(node)
      || getNodeActivity(node) === activityFilter)
    .filter((node) => !enabledTypes || enabledTypes.has(node.type))
    .sort((first, second) => {
      const firstRank = first.type === 'PATIENT' || first.type === 'DEVICE' || first.type === 'MONITORING_DAY'
        ? 0
        : first.type === mainType ? 1 : 2;
      const secondRank = second.type === 'PATIENT' || second.type === 'DEVICE' || second.type === 'MONITORING_DAY'
        ? 0
        : second.type === mainType ? 1 : 2;
      return firstRank - secondRank
        || (first.timestamp ?? -Infinity) - (second.timestamp ?? -Infinity)
        || first.id.localeCompare(second.id);
    }), [graph, graphDay, focusedNodeIds, deviceFilter, activityFilter, enabledTypes, mainType]);
  const visibleNodes = useMemo(() => {
    const visibleIdSet = new Set(baseNodes.slice(0, visibleCount).map(({ id }) => id));
    const representatives = new Map();
    baseNodes.forEach((node) => {
      if (node.type === mainType) return;
      const byType = representatives.get(node.type) || [];
      if (byType.length < 3) representatives.set(node.type, [...byType, node.id]);
    });
    const representativeIds = [...representatives.values()].flat();
    representativeIds.forEach((nodeId) => visibleIdSet.add(nodeId));
    const forceVisible = new Set([
      ...[...expandedIds].slice(-20),
      ...traversalIds.slice(0, 30),
    ]);
    if (focusedRootId) forceVisible.add(focusedRootId);
    if (searchedId) forceVisible.add(searchedId);
    if (pathResult) {
      pathResult.nodeIds.slice(0, 30).forEach((nodeId) => forceVisible.add(nodeId));
      forceVisible.add(pathResult.nodeIds[pathResult.nodeIds.length - 1]);
    }
    const contextSeeds = [
      ...baseNodes.slice(0, Math.min(50, visibleCount)).map(({ id }) => id),
      ...representativeIds,
      ...forceVisible,
    ];
    for (const nodeId of contextSeeds) {
      getLimitedNeighborIds(graph, nodeId).forEach((neighborId) => forceVisible.add(neighborId));
    }
    forceVisible.forEach((nodeId) => {
      if (focusedNodeIds === null || focusedNodeIds.has(nodeId)) visibleIdSet.add(nodeId);
    });
    return [...visibleIdSet].slice(0, Math.max(visibleCount, 500))
      .map((nodeId) => graph.nodeById.get(nodeId))
      .filter(Boolean);
  }, [baseNodes, visibleCount, expandedIds, traversalIds, searchedId, pathResult, graph, mainType, focusedNodeIds, focusedRootId]);
  const visibleIdSet = useMemo(() => new Set(visibleNodes.map(({ id }) => id)), [visibleNodes]);
  const visibleEdges = useMemo(() => graph.edges.filter((edge) => (
    visibleIdSet.has(edge.source)
    && visibleIdSet.has(edge.target)
    && (!enabledEdges || enabledEdges.has(edge.type))
  )), [graph, visibleIdSet, enabledEdges]);
  const algorithmGraph = useMemo(() => {
    const nodeIds = new Set(baseNodes.map((node) => node.id));
    return createAdjacencyList(
      baseNodes,
      graph.edges.filter((edge) => (
        nodeIds.has(edge.source)
        && nodeIds.has(edge.target)
        && (!enabledEdges || enabledEdges.has(edge.type))
      )),
    );
  }, [baseNodes, graph, enabledEdges]);
  const pageSizeReached = visibleCount < baseNodes.length;
  const selectedFlowNode = flowNodes.find((node) => node.id === selectedNodeId) || null;
  const selectedFlowEdge = flowEdges.find((edge) => edge.id === selectedEdgeId) || null;
  const pathEdgeIds = useMemo(() => new Set(pathResult?.edgeIds || []), [pathResult]);
  const pathNodeIds = useMemo(() => new Set(pathResult?.nodeIds || []), [pathResult]);
  const neighborhoodEdgeIds = useMemo(() => new Set([
    ...(graph.incoming.get(selectedNodeId) || []).map(({ id }) => id),
    ...(graph.outgoing.get(selectedNodeId) || []).map(({ id }) => id),
  ]), [graph, selectedNodeId]);
  const connectedNodeIds = useMemo(() => new Set([
    ...(graph.incoming.get(selectedNodeId) || []).map(({ source }) => source),
    ...(graph.outgoing.get(selectedNodeId) || []).map(({ target }) => target),
    ...traversalIds,
  ]), [graph, selectedNodeId, traversalIds]);
  const nodeCounts = useMemo(() => {
    const counts = new Map();
    graph.nodes.forEach(({ type }) => counts.set(type, (counts.get(type) || 0) + 1));
    return counts;
  }, [graph]);
  const vertexColors = NODE_COLORS;

  useEffect(() => {
    setGraphDay(dateMode === 'day' ? selectedDate : 'all');
    setVisibleCount(200);
  }, [selectedDate, dateMode]);
  useEffect(() => setVisibleCount(200), [mode, activityFilter, deviceFilter, graphDay, enabledTypes]);
  useEffect(() => {
    if (enabledTypes === null) setEnabledTypes(new Set(allNodeTypes));
    if (enabledEdges === null) setEnabledEdges(new Set(allEdgeTypes));
    if (previousNodeTypeSignature.current !== nodeTypeSignature) {
      setEnabledTypes(new Set(allNodeTypes));
    }
    if (previousEdgeTypeSignature.current !== edgeTypeSignature) {
      setEnabledEdges(new Set(allEdgeTypes));
    }
    previousNodeTypeSignature.current = nodeTypeSignature;
    previousEdgeTypeSignature.current = edgeTypeSignature;
  }, [allNodeTypes, allEdgeTypes, nodeTypeSignature, edgeTypeSignature, enabledTypes, enabledEdges]);
  useEffect(() => {
    if (!selectedNodeId || baseNodes.some((node) => node.id === selectedNodeId)) return;
    setSelectedNodeId('');
    setSelectedEdgeId('');
    setTraversalIds([]);
    setPathMessage('');
    setPathResult(null);
  }, [baseNodes, selectedNodeId]);
  useEffect(() => {
    setPathStart('');
    setPathEnd('');
    setPathResult(null);
    setPathMessage('');
    setTraversalIds([]);
  }, [mode, graphDay, activityFilter, deviceFilter, enabledTypes, enabledEdges]);

  const layoutedNodes = useMemo(() => {
    const positions = getPositions(visibleNodes, visibleEdges, layout, layout === 'radial' ? selectedNodeId : '');
    return visibleNodes.map((node) => makeFlowNode(node, positions.get(node.id), {
      connectedIds: connectedNodeIds,
      pathNodeIds,
    }));
  }, [visibleNodes, visibleEdges, layout, layout === 'radial' ? selectedNodeId : '', connectedNodeIds, pathNodeIds]);
  const relationshipOptions = useMemo(() => ({
    pathEdgeIds,
    neighborhoodEdgeIds,
    selectedEdgeId,
    showWeights,
    showEdgeTypes,
  }), [pathResult, selectedNodeId, selectedEdgeId, showWeights, showEdgeTypes]);
  const layoutedEdges = useMemo(() => visibleEdges.map((edge) => makeFlowEdge(edge, relationshipOptions)), [
    visibleEdges,
    relationshipOptions,
  ]);

  useEffect(() => {
    const preservePositions = previousLayout.current === layout;
    setFlowNodes((current) => {
      const positions = preservePositions
        ? new Map(current.map((node) => [node.id, node.position]))
        : new Map();
      return layoutedNodes.map((node) => ({
        ...node,
        position: positions.get(node.id) || node.position,
      }));
    });
    previousLayout.current = layout;
  }, [layoutedNodes, layout, setFlowNodes]);
  useEffect(() => {
    setFlowEdges(layoutedEdges);
  }, [layoutedEdges, setFlowEdges]);

  const handleNodeClick = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId('');
    setSelectedIds((current) => current.includes(node.id) ? current : [...current, node.id]);
    onSelectNode?.(node.id, graph.nodeById.get(node.id));
  }, [graph, onSelectNode]);
  const handleSearch = useCallback((event) => {
    event.preventDefault();
    const value = search.trim().toLowerCase();
    if (!value) {
      setSearchedId('');
      return;
    }
    const match = graph.nodes.find((node) => (
      node.id.toLowerCase().includes(value)
      || node.label.toLowerCase().includes(value)
      || (Number.isFinite(node.timestamp) && new Date(node.timestamp).toISOString().includes(value))
    ));
    if (!match) {
      setSearchedId('');
      setSelectedNodeId('');
      return;
    }
    setSearchedId(match.id);
    setSelectedNodeId(match.id);
    setSelectedEdgeId('');
    setGraphDay(getNodeDay(match) || 'all');
    setExpandedIds((current) => new Set([...current, match.id]));
  }, [search, graph]);
  const handleFocusNode = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId('');
    if (!visibleNodes.some((node) => node.id === nodeId)) {
      setExpandedIds((current) => new Set([...current, nodeId]));
    }
  }, [visibleNodes]);
  const handlePathSearch = useCallback(() => {
    if (!pathStart || !pathEnd) return;
    if (useWeightedPath && !enabledEdges?.has('NEXT')) {
      setPathResult(null);
      setPathMessage('Aktifkan relasi NEXT untuk mencari jalur berbobot temporal.');
      return;
    }
    const result = findGraphPath(algorithmGraph, pathStart, pathEnd, {
      weighted: useWeightedPath,
      edgeTypes: useWeightedPath ? ['NEXT'] : [...(enabledEdges || [])],
    });
    setPathResult(result);
    setPathMessage(result
      ? `Jalur ditemukan: ${result.nodeIds.length} vertex${useWeightedPath ? ` · ${formatValue(result.totalWeight)} detik` : ''}.`
      : 'Tidak ditemukan jalur terarah di antara dua vertex tersebut.');
    setTraversalIds([]);
  }, [algorithmGraph, pathStart, pathEnd, useWeightedPath, enabledEdges]);
  const handleTraversal = useCallback(() => {
    if (!selectedNodeId) return;
    setTraversalIds(traverseGraph(algorithmGraph, selectedNodeId, traversalMethod, [...(enabledEdges || [])]).slice(0, 200));
    setPathResult(null);
    setPathMessage('');
  }, [algorithmGraph, selectedNodeId, traversalMethod, enabledEdges]);
  const handleSelectionChange = useCallback(({ nodes: selected }) => {
    setSelectedIds(selected.map(({ id }) => id));
  }, []);
  const selectedVertex = selectedFlowNode?.data.vertex || graph.nodeById.get(selectedNodeId) || null;
  const outgoingForSelection = selectedNodeId ? graph.outgoing.get(selectedNodeId) || [] : [];

  function exportGraphJson() {
    const payload = {
      schema_version: 'capar-graph/v1',
      exported_at: new Date().toISOString(),
      filters: {
        scope,
        day: graphDay,
        activity: activityFilter,
        device: deviceFilter,
        physiological_episode_id: selectedEpisodeId || null,
        window_id: selectedWindowId || null,
      },
      nodes: graph.nodes,
      edges: graph.edges,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `capar-graph-${graphDay || 'all-days'}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!graph.nodes.length) {
    return <p className="capar-visual-empty">Belum ada vertex atau relasi untuk rentang waktu ini.</p>;
  }

  return (
    <section className="capar-graph-explorer" aria-label="CAPAR graph explorer">
      <header className="capar-graph-explorer-heading">
        <div>
          <span className="eyebrow">G = (V, E) · DIRECTED ADJACENCY GRAPH</span>
          <h3>{mode === 'rows' ? 'Row data graph' : mode === 'windows' ? 'Window graph' : mode === 'activities' ? 'Activity graph' : 'CAPAR temporal graph'}</h3>
          <p>Relasi temporal menunjukkan urutan, bukan sebab-akibat. Nilai fisiologis adalah atribut vertex.</p>
        </div>
        <div className="capar-graph-summary">
          <strong>{graph.summary.node_count.toLocaleString('id-ID')} vertex</strong>
          <span>{graph.summary.edge_count.toLocaleString('id-ID')} edge · {visibleNodes.length.toLocaleString('id-ID')} dirender</span>
          <button className="button button-light" onClick={exportGraphJson} type="button">Ekspor graph JSON</button>
        </div>
      </header>

      {showMetrics && <div className="capar-graph-metrics">
        {[
          ['Pengukuran', nodeCounts.get('RAW_DATA') || 0, 'vertex raw data'],
          ['Window CAPAR', nodeCounts.get('WINDOW') || 0, 'vertex agregasi'],
          ['Aktivitas', nodeCounts.get('ACTIVITY') || 0, 'episode aktivitas tersimpan'],
          ['Episode fisiologis', nodeCounts.get('PHYSIOLOGICAL_EPISODE') || 0, 'event CAPAR'],
        ].map(([label, count, detail]) => (
          <div className="capar-graph-metric" key={label}>
            <strong>{Number(count).toLocaleString('id-ID')}</strong>
            <span>{label}</span>
            <small>{detail}</small>
          </div>
        ))}
      </div>}

      {showScopeTabs && (
        <nav className="capar-graph-scope-tabs" aria-label="Tingkat knowledge graph">
          {GRAPH_SCOPES.map(({ id, label }) => (
            <button
              aria-pressed={scope === id}
              className={scope === id ? 'is-active' : ''}
              key={id}
              onClick={() => onScopeChange?.(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      <div className="capar-graph-toolbar">
        <form className="capar-graph-search" onSubmit={handleSearch}>
          <label htmlFor="capar-graph-search">Cari node ID / waktu</label>
          <input
            id="capar-graph-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ID atau timestamp"
            value={search}
          />
          <button className="button button-light" type="submit">Cari</button>
        </form>
        {showScopeFilters && (
          <label>
            Hari
            <select
              onChange={(event) => {
                setGraphDay(event.target.value);
                onDayChange?.(event.target.value);
              }}
              value={graphDay}
            >
              {dateMode === 'all' && <option value="all">Semua hari</option>}
              {days.map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
          </label>
        )}
        {showScopeSelectors && (
          <>
            <label>
              Episode fisiologis
              <select
                onChange={(event) => onEpisodeChange?.(event.target.value)}
                value={selectedEpisodeId}
              >
                <option value="">Semua episode</option>
                {episodeOptions.map((episode) => {
                  const id = String(episode._id || '');
                  return (
                    <option key={id} value={id}>
                      {episode.classification || 'Episode'} · {formatClock(Number(episode.onset_time))}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Window CAPAR
              <input
                list="capar-window-options"
                onChange={(event) => onWindowChange?.(event.target.value)}
                placeholder="Cari / masukkan ID window"
                value={selectedWindowId}
              />
              <datalist id="capar-window-options">
                {windowOptions.map((window) => (
                  <option key={String(window._id)} label={`${window.activity_label || 'Unknown'} · ${formatClock(Number(window.window_start))}`} value={String(window._id)} />
                ))}
              </datalist>
            </label>
          </>
        )}
        <label>
          Layout
          <select onChange={(event) => setLayout(event.target.value)} value={layout}>
            {LAYOUT_OPTIONS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="capar-graph-check">
          <input checked={showEdgeTypes} onChange={(event) => setShowEdgeTypes(event.target.checked)} type="checkbox" />
          Label relasi
        </label>
        <label className="capar-graph-check">
          <input checked={showWeights} onChange={(event) => setShowWeights(event.target.checked)} type="checkbox" />
          Bobot waktu
        </label>
      </div>

      <div className="capar-graph-filter-groups">
        <fieldset>
          <legend>Vertex categories</legend>
          {allNodeTypes.map((type) => (
            <label key={type}>
              <input
                checked={enabledTypes?.has(type) || false}
                onChange={(event) => setEnabledTypes((current) => {
                  const next = new Set(current || []);
                  if (event.target.checked) next.add(type);
                  else next.delete(type);
                  return next;
                })}
                type="checkbox"
              />
              <i style={{ backgroundColor: NODE_COLORS[type] || '#647d8e' }} />
              {NODE_TYPE_LABELS[type] || type}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Relationship types</legend>
          {allEdgeTypes.map((type) => (
            <label key={type}>
              <input
                checked={enabledEdges?.has(type) || false}
                onChange={(event) => setEnabledEdges((current) => {
                  const next = new Set(current || []);
                  if (event.target.checked) next.add(type);
                  else next.delete(type);
                  return next;
                })}
                type="checkbox"
              />
              {type}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="capar-graph-path-tools">
        <label>
          Dari
          <input list="capar-graph-node-options" onChange={(event) => setPathStart(event.target.value)} placeholder="ID node awal" value={pathStart} />
        </label>
        <label>
          Ke
          <input list="capar-graph-node-options" onChange={(event) => setPathEnd(event.target.value)} placeholder="ID node tujuan" value={pathEnd} />
        </label>
        <datalist id="capar-graph-node-options">
          {baseNodes.slice(0, 250).map((node) => <option key={node.id} value={node.id}>{node.type} · {node.label}</option>)}
        </datalist>
        <label className="capar-graph-check">
          <input checked={useWeightedPath} onChange={(event) => setUseWeightedPath(event.target.checked)} type="checkbox" />
          Jalur berbobot (edge NEXT)
        </label>
        <button className="button button-light" disabled={!pathStart || !pathEnd} onClick={handlePathSearch} type="button">
          Cari jalur
        </button>
        <label>
          Traversal
          <select onChange={(event) => setTraversalMethod(event.target.value)} value={traversalMethod}>
            <option value="bfs">BFS</option>
            <option value="dfs">DFS</option>
          </select>
        </label>
        <button className="button button-light" disabled={!selectedNodeId} onClick={handleTraversal} type="button">
          Jelajahi dari node terpilih
        </button>
        {pathMessage && <span role="status">{pathMessage}</span>}
        {!pathMessage && traversalIds.length > 0 && <span role="status">BFS/DFS terjangkau: {traversalIds.length} vertex (maks. 200 disorot).</span>}
      </div>

      <div className="capar-graph-explorer-legend" aria-label="Legenda graph">
        {allNodeTypes.map((type) => (
          <span key={type}><i style={{ backgroundColor: vertexColors[type] }} />{NODE_TYPE_LABELS[type] || type}</span>
        ))}
        <span className="capar-graph-legend-edge"><i />NEXT · temporal</span>
        <span className="capar-graph-legend-edge is-hierarchy"><i />HAS_* · lineage</span>
        <span className="capar-graph-legend-edge is-inferred"><i />relasi inferensi</span>
      </div>

      <div className="capar-graph-workspace">
        <div className="capar-graph-canvas">
          {visibleNodes.length > 0 ? (
            <ReactFlow
              edges={flowEdges}
              fitView
              maxZoom={2}
              minZoom={0.04}
              multiSelectionKeyCode="Shift"
              nodes={flowNodes}
              nodesConnectable={false}
              nodeTypes={nodeTypes}
              onEdgeClick={(_event, edge) => {
                setSelectedEdgeId(edge.id);
                setSelectedNodeId('');
              }}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              onNodesChange={onNodesChange}
              onSelectionChange={handleSelectionChange}
              panOnDrag
              selectionMode={SelectionMode.Partial}
              selectionOnDrag
              onlyRenderVisibleElements
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#dce8e7" gap={22} />
              <MiniMap
                nodeColor={(node) => NODE_COLORS[node.data?.vertex?.type] || '#647d8e'}
                pannable
                zoomable
              />
              <Controls />
            </ReactFlow>
          ) : (
            <p className="capar-visual-empty">
              {scope === 'window' && !selectedWindowId
                ? 'Pilih ID window CAPAR untuk membuka graf lokalnya.'
                : 'Tidak ada vertex yang cocok dengan filter saat ini.'}
            </p>
          )}
          {pageSizeReached && (
            <div className="capar-graph-load-more">
              <span>{visibleCount.toLocaleString('id-ID')} dari {baseNodes.length.toLocaleString('id-ID')} node dalam filter.</span>
              <button className="button button-light" onClick={() => setVisibleCount((count) => count + 200)} type="button">
                Muat 200 node berikutnya
              </button>
            </div>
          )}
        </div>
        <GraphInspector
          edge={selectedFlowEdge}
          graph={graph}
          node={selectedVertex ? { id: selectedVertex.id } : null}
          onFocusNode={handleFocusNode}
        />
      </div>
      {selectedIds.length > 1 && (
        <p className="capar-graph-selection-status">Dipilih {selectedIds.length} vertex. Pilih dua node pada alat jalur untuk eksplorasi path.</p>
      )}
      {selectedNodeId && (
        <div className="capar-graph-neighbor-tools">
          <button
            className="button button-light"
            onClick={() => setExpandedIds((current) => new Set([...current, selectedNodeId]))}
            type="button"
          >
            Expand tetangga ({(graph.incoming.get(selectedNodeId) || []).length
              + (graph.outgoing.get(selectedNodeId) || []).length} relasi)
          </button>
          <button
            className="button button-light"
            onClick={() => {
              setSearchedId('');
              setExpandedIds((current) => {
                const next = new Set(current);
                next.delete(selectedNodeId);
                return next;
              });
            }}
            type="button"
          >
            Collapse tetangga
          </button>
          {outgoingForSelection.length > 0 && (
            <span>Edge keluar disorot · {outgoingForSelection.length}</span>
          )}
        </div>
      )}
    </section>
  );
}
