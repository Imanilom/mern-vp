import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Layers,
  LoaderCircle,
  Printer,
  RotateCcw,
  RefreshCw,
  Rows3,
  Timer,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { api } from '../api';
import SectionHeading from '../components/SectionHeading';
import { groupChronologicalActivityRuns } from '../utils/caparActivityRuns';

const MODES = [
  { id: 'overview', label: 'Ringkasan hari', icon: CalendarDays },
  { id: 'rows', label: 'Baris data', icon: Rows3 },
  { id: 'windows', label: 'Window CAPAR', icon: Layers },
  { id: 'activities', label: 'Episode aktivitas', icon: Activity },
];
const TIMELINE_VIEWS = [
  { id: 'graph', label: 'Node graph' },
  { id: 'timeseries', label: 'Time series' },
  { id: 'table', label: 'Table' },
];
const TIMELINE_METRICS = [
  { id: 'hr', label: 'HR' },
  { id: 'rr', label: 'RR' },
  { id: 'rmssd', label: 'RMSSD' },
  { id: 'sdnn', label: 'SDNN' },
  { id: 'dfa1', label: 'DFA α1' },
  { id: 'dfa2', label: 'DFA α2' },
  { id: 'acc', label: 'ACC' },
];

const ACTIVITY_COLORS = [
  '#397b69',
  '#547fb4',
  '#c27b3f',
  '#8a6da8',
  '#b45d69',
  '#588f9d',
  '#9b8a3c',
  '#587c4d',
];
const DEVICE_SIGNAL_GAP_MS = 5 * 60_000;
const MIN_VISUAL_ZOOM = 0.75;
const MAX_VISUAL_ZOOM = 2;
const VISUAL_ZOOM_STEP = 0.25;

function toEpochMs(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.abs(timestamp) < 100_000_000_000 ? timestamp * 1000 : timestamp;
}

function getNodeTime(node, mode) {
  if (mode === 'rows') return toEpochMs(node.timestamp_ms ?? node.timestamp);
  if (mode === 'windows') return toEpochMs(node.window_start);
  return toEpochMs(node.episode_start);
}

function getNodeActivity(node, mode) {
  return String((mode === 'rows' ? node.activity : node.activity_label) || 'Unknown');
}

function getNodeId(node, mode) {
  return String(mode === 'activities' ? node.episode_key || node._id : node._id);
}

function getNodeDensity(node, mode) {
  if (mode === 'rows') return 1;
  if (mode === 'windows') return Number(node.raw_count) || 0;
  return Number(node.summary?.raw_sample_count) || Number(node.summary?.window_count) || 0;
}

function getNodeEndTime(node, mode, startTime) {
  const endValue = mode === 'rows'
    ? startTime
    : mode === 'windows'
      ? node.window_end
      : node.episode_end;
  return toEpochMs(endValue) ?? startTime;
}

function getNodeStreamKey(node, mode) {
  return mode === 'rows'
    ? `${node.device_id || 'UNKNOWN'}:${node.source_collection || 'PolarData'}`
    : `${node.device_id || 'UNKNOWN'}:${node.window_type || '5min'}`;
}

function getSignalGapLimit(node, mode) {
  if (mode === 'rows') return DEVICE_SIGNAL_GAP_MS;
  return node.window_type === '1min' ? 60_000 : 300_000;
}

function getTimelineEntries(nodes, mode) {
  return nodes
    .map((node) => {
      const time = getNodeTime(node, mode);
      const rawHr = mode === 'rows'
        ? node.hr
        : mode === 'windows'
          ? node.features?.mean_hr
          : node.summary?.mean_hr;
      return {
        node,
        id: getNodeId(node, mode),
        time,
        endTime: time === null ? null : getNodeEndTime(node, mode, time),
        activity: getNodeActivity(node, mode),
        device: String(node.device_id || 'UNKNOWN'),
        streamKey: getNodeStreamKey(node, mode),
        hr: rawHr === null || rawHr === undefined || rawHr === ''
          ? NaN
          : Number(rawHr),
      };
    })
    .filter((entry) => entry.time !== null)
    .sort((first, second) => first.time - second.time || first.id.localeCompare(second.id));
}

function getDeviceSignalSessions(entries, mode) {
  const sessionsByStream = new Map();
  const ordered = [...entries].sort((first, second) => (
    first.time - second.time || first.id.localeCompare(second.id)
  ));

  ordered.forEach((entry) => {
    const streamSessions = sessionsByStream.get(entry.streamKey) || [];
    const session = streamSessions[streamSessions.length - 1];
    const previous = session?.entries[session.entries.length - 1];
    const gap = previous ? entry.time - previous.endTime : null;
    const sameDay = previous
      && getJakartaDateKey(previous.time) === getJakartaDateKey(entry.time);
    const continues = previous
      && sameDay
      && gap <= getSignalGapLimit(entry.node, mode);

    if (!continues) {
      streamSessions.push({
        streamKey: entry.streamKey,
        device: entry.device,
        isReconnect: Boolean(previous && sameDay),
        startTime: entry.time,
        endTime: entry.endTime,
        entries: [entry],
      });
    } else {
      session.entries.push(entry);
      session.endTime = Math.max(session.endTime, entry.endTime);
    }
    sessionsByStream.set(entry.streamKey, streamSessions);
  });

  return [...sessionsByStream.values()]
    .flat()
    .sort((first, second) => first.startTime - second.startTime
      || first.streamKey.localeCompare(second.streamKey));
}

function formatTime(value) {
  const timestamp = toEpochMs(value);
  if (timestamp === null) return 'Waktu tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(timestamp));
}

function formatNodeClock(value) {
  const timestamp = toEpochMs(value);
  if (timestamp === null) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
}

function formatMetric(value, digits = 1) {
  if (value === null || value === undefined || value === '') return '—';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : '—';
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.round((Number(milliseconds) || 0) / 1000));
  if (totalSeconds < 60) return `${totalSeconds} dtk`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes} m ${seconds} dtk` : `${minutes} m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} j ${remainingMinutes} m`;
}

function getFiniteRange(values, fallback = { min: 0, max: 0 }) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return min === Infinity ? fallback : { min, max };
}

function getJakartaDateKey(value) {
  const timestamp = toEpochMs(value);
  return timestamp === null
    ? null
    : new Date(timestamp + (7 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function ZoomControl({ label, value, onChange }) {
  return (
    <div className="capar-zoom-control" aria-label={`Zoom ${label.toLowerCase()}`}>
      <strong>{label}</strong>
      <button
        aria-label={`Perkecil ${label.toLowerCase()}`}
        disabled={value <= MIN_VISUAL_ZOOM}
        onClick={() => onChange(Math.max(MIN_VISUAL_ZOOM, value - VISUAL_ZOOM_STEP))}
        title={`Perkecil ${label.toLowerCase()}`}
        type="button"
      >
        <ZoomOut size={15} />
      </button>
      <output aria-live="polite">{Math.round(value * 100)}%</output>
      <button
        aria-label={`Perbesar ${label.toLowerCase()}`}
        disabled={value >= MAX_VISUAL_ZOOM}
        onClick={() => onChange(Math.min(MAX_VISUAL_ZOOM, value + VISUAL_ZOOM_STEP))}
        title={`Perbesar ${label.toLowerCase()}`}
        type="button"
      >
        <ZoomIn size={15} />
      </button>
      <button
        aria-label={`Reset zoom ${label.toLowerCase()}`}
        disabled={value === 1}
        onClick={() => onChange(1)}
        title="Reset ke 100%"
        type="button"
      >
        <RotateCcw size={13} />
      </button>
    </div>
  );
}

function getMetricValue(node, mode, metric) {
  if (mode === 'rows') {
    if (metric === 'hr') return node.hr;
    if (metric === 'rr') return node.rr;
    if (metric === 'rmssd') return node.rmssd_ms;
    if (metric === 'sdnn') return node.sdnn_ms;
    if (metric === 'dfa1') return node.dfa_alpha1;
    if (metric === 'acc') {
      return Math.sqrt(
        (Number(node.acc_x) || 0) ** 2
        + (Number(node.acc_y) || 0) ** 2
        + (Number(node.acc_z) || 0) ** 2,
      );
    }
    return null;
  }
  const features = mode === 'windows' ? node.features || {} : node.summary || {};
  const activityMetric = {
    hr: mode === 'windows' ? 'mean_hr' : 'mean_hr',
    rr: mode === 'windows' ? 'mean_rr' : 'mean_rr',
    rmssd: mode === 'windows' ? 'rmssd' : 'mean_rmssd',
    sdnn: mode === 'windows' ? 'sdnn' : 'mean_sdnn',
    dfa1: mode === 'windows' ? 'dfa_alpha1' : 'mean_dfa_alpha1',
    dfa2: mode === 'windows' ? 'dfa_alpha2' : 'mean_dfa_alpha2',
    acc: mode === 'windows' ? 'motion_intensity' : 'mean_motion_intensity',
  }[metric];
  return activityMetric ? features[activityMetric] : null;
}

function MetricTimeSeriesLanes({
  nodes,
  mode,
  selectedMetrics,
  viewStart,
  viewEnd,
  selectedId,
  onSelect,
  anchors,
  onAnchorSelect,
  contextLabel,
  exportType,
  baseline,
  windows = [],
  activities = [],
  deviceFilter = 'all',
}) {
  const width = 900;
  const laneHeight = 76;
  const headerHeight = 30;
  const left = 90;
  const right = width - 24;
  const top = 19;
  const bottom = 56;
  const range = Math.max(1, viewEnd - viewStart);
  const entries = useMemo(() => getTimelineEntries(nodes, mode), [nodes, mode]);
  const sessions = useMemo(() => getDeviceSignalSessions(entries, mode), [entries, mode]);
  const visibleAnchors = useMemo(() => anchors
    .filter((anchor) => anchor.timestamp >= viewStart && anchor.timestamp <= viewEnd)
    .slice(0, 1000), [anchors, viewStart, viewEnd]);
  const specs = useMemo(() => TIMELINE_METRICS
    .filter(({ id }) => selectedMetrics.includes(id))
    .map((metric) => ({
      ...metric,
      color: {
        hr: '#c27b3f',
        rr: '#547fb4',
        rmssd: '#397b69',
        sdnn: '#8a6da8',
        dfa1: '#b45d69',
        dfa2: '#9b8a3c',
        acc: '#588f9d',
      }[metric.id],
      unit: ['hr', 'rr', 'rmssd'].includes(metric.id) ? (metric.id === 'hr' ? 'bpm' : 'ms') : '',
      baselineValue: baseline?.stats?.[{
        hr: 'mean_hr',
        rr: 'mean_rr',
        rmssd: 'rmssd',
        sdnn: 'sdnn',
        dfa1: 'dfa_alpha1',
        dfa2: 'dfa_alpha2',
        acc: 'motion_intensity',
      }[metric.id]]?.mean,
      values: nodes.flatMap((node) => {
        const rawValue = getMetricValue(node, mode, metric.id);
        if (rawValue === null || rawValue === undefined || rawValue === '') return [];
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return [];
        return [{ node, value, time: getNodeTime(node, mode), id: getNodeId(node, mode) }];
      }),
    }))
    .filter((metric) => metric.values.length), [nodes, mode, selectedMetrics, baseline]);

  const sessionHeight = 44;
  const activityRuns = useMemo(() => groupChronologicalActivityRuns(entries, {
    getActivity: (entry) => entry.activity,
    getTime: (entry) => entry.time,
    getEndTime: (entry) => entry.endTime,
    getStreamKey: (entry) => entry.streamKey,
    getMaxGap: (_previous, next) => getSignalGapLimit(next.node, mode),
    canMerge: () => mode !== 'activities',
  }).map((run, index) => ({
    ...run,
    label: run.activity,
    color: ACTIVITY_COLORS[index % ACTIVITY_COLORS.length],
  })), [entries, mode]);
  const stateRuns = useMemo(() => groupChronologicalActivityRuns(
    windows
      .filter((window) => deviceFilter === 'all' || String(window.device_id || 'UNKNOWN') === deviceFilter)
      .map((node) => ({
        node,
        id: String(node._id),
        time: getNodeTime(node, 'windows'),
        endTime: getNodeEndTime(node, 'windows', getNodeTime(node, 'windows')),
        streamKey: getNodeStreamKey(node, 'windows'),
        activity: node.rr_status || node.classification || (node.is_valid ? 'Valid' : 'Invalid'),
      }))
      .filter((entry) => entry.time !== null),
    {
      getActivity: (entry) => entry.activity,
      getTime: (entry) => entry.time,
      getEndTime: (entry) => entry.endTime,
      getStreamKey: (entry) => entry.streamKey,
      getMaxGap: (_previous, next) => getSignalGapLimit(next.node, 'windows'),
      canMerge: () => true,
    },
  ).map((run, index) => ({
    ...run,
    label: run.activity,
    color: ACTIVITY_COLORS[(index + 2) % ACTIVITY_COLORS.length],
  })), [windows, deviceFilter]);
  const episodeRuns = useMemo(() => activities
    .filter((episode) => deviceFilter === 'all' || String(episode.device_id || 'UNKNOWN') === deviceFilter)
    .map((episode, index) => ({
      start_time: getNodeTime(episode, 'activities'),
      end_time: getNodeEndTime(episode, 'activities', getNodeTime(episode, 'activities')),
      label: episode.activity_label || 'Unknown',
      color: ACTIVITY_COLORS[(index + 4) % ACTIVITY_COLORS.length],
      stream_key: episode.device_id,
    }))
    .filter((run) => run.start_time !== null), [activities, deviceFilter]);
  const categoricalLanes = [
    { label: 'Activity', runs: activityRuns },
    { label: 'State CAPAR', runs: stateRuns },
    { label: 'Episode', runs: episodeRuns },
  ].filter((lane) => lane.runs.length);
  const deviceNames = [...new Set(sessions.map((session) => session.device))];
  const deviceColors = new Map(
    deviceNames.map((device, index) => [device, ACTIVITY_COLORS[index % ACTIVITY_COLORS.length]]),
  );
  const deviceLegendRows = Math.ceil(deviceNames.length / 4);
  const categoricalHeight = 38;
  const sessionTop = headerHeight + (specs.length * laneHeight) + (categoricalLanes.length * categoricalHeight) + 10;
  const height = sessionTop + sessionHeight + 34 + (deviceLegendRows * 14);
  const x = (time) => left + (((time - viewStart) / range) * (right - left));
  return (
    <svg
      aria-label="Timeline multiskala CAPAR dengan lane metrik, anchor, dan sesi sinyal"
      className="capar-metric-lanes"
      data-export={exportType}
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <text className="capar-timeline-context" textAnchor="middle" x={width / 2} y="14">{contextLabel}</text>
      {specs.map((metric, laneIndex) => {
        const laneTop = headerHeight + (laneIndex * laneHeight);
        const laneBottom = laneTop + laneHeight;
        const values = metric.values.map(({ value }) => value);
        const baselineNumber = metric.baselineValue === null || metric.baselineValue === undefined
          ? NaN
          : Number(metric.baselineValue);
        const scaleValues = Number.isFinite(baselineNumber) ? [...values, baselineNumber] : values;
        const { min, max } = getFiniteRange(scaleValues);
        const valueRange = Math.max(1e-9, max - min);
        const y = (value) => laneTop + bottom - (((value - min) / valueRange) * (bottom - top));
        const valuesById = new Map(metric.values.map((point) => [point.id, point]));
        const sessionSegments = sessions
          .map((session) => session.entries
            .map((entry) => valuesById.get(entry.id))
            .filter(Boolean))
          .filter((segment) => segment.length);
        const markers = metric.values.length <= 120
          ? metric.values
          : metric.values.filter((point, index) => (
            index === 0 || index === metric.values.length - 1
            || index % Math.ceil(metric.values.length / 120) === 0
            || point.id === selectedId
          ));
        return (
          <g key={metric.id}>
            {[0, 1].map((step) => {
              const yPos = laneTop + top + step * (bottom - top);
              return <line className="capar-timeline-grid" key={step} x1={left} x2={right} y1={yPos} y2={yPos} />;
            })}
            <text className="capar-metric-lane-label" x="8" y={laneTop + 29}>{metric.label}</text>
            <text className="capar-metric-lane-range" textAnchor="end" x={width - 3} y={laneTop + 14}>
              {formatMetric(min, 2)}–{formatMetric(max, 2)} {metric.unit}
            </text>
            {visibleAnchors.map((anchor) => (
              <g
                className="capar-metric-anchor"
                key={`${metric.id}:${anchor.anchor_id}`}
                onClick={() => onAnchorSelect(anchor)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onAnchorSelect(anchor);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <line
                  className={anchor.inferred ? 'is-inferred' : ''}
                  x1={x(anchor.timestamp)}
                  x2={x(anchor.timestamp)}
                  y1={laneTop + top}
                  y2={laneTop + bottom}
                />
                <title>{`${anchor.anchor_type} · ${formatTime(anchor.timestamp)} · ${anchor.description}`}</title>
              </g>
            ))}
            {sessionSegments.map((segment, index) => segment.length > 1 && (
              <polyline
                fill="none"
                key={`segment:${index}`}
                points={segment.map((point) => `${x(point.time)},${y(point.value)}`).join(' ')}
                stroke={metric.color}
                strokeWidth="1.8"
              />
            ))}
            {Number.isFinite(baselineNumber) && (
              <g className="capar-metric-baseline">
                <line x1={left} x2={right} y1={y(baselineNumber)} y2={y(baselineNumber)} />
                <text x={right - 2} y={y(baselineNumber) - 3} textAnchor="end">baseline {formatMetric(baselineNumber, 2)}</text>
              </g>
            )}
            {markers.map((point) => (
              <circle
                className={`capar-metric-point ${point.id === selectedId ? 'is-selected' : ''}`}
                cx={x(point.time)}
                cy={y(point.value)}
                fill={metric.color}
                key={point.id}
                onClick={() => onSelect(point.id)}
                r={point.id === selectedId ? 4 : 2}
                tabIndex={0}
                role="button"
                aria-label={`${metric.label} ${formatMetric(point.value, 2)} ${metric.unit} · ${formatTime(point.time)}`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(point.id);
                  }
                }}
              >
                <title>{`${metric.label} ${formatMetric(point.value, 2)} ${metric.unit} · ${formatTime(point.time)}`}</title>
              </circle>
            ))}
            <text className="capar-metric-lane-unit" x={left} y={laneBottom - 2}>{metric.unit}</text>
          </g>
        );
      })}
      {categoricalLanes.map((lane, laneIndex) => {
        const laneY = headerHeight + (specs.length * laneHeight) + (laneIndex * categoricalHeight);
        const runsInView = lane.runs.filter((run) => (
          run.end_time >= viewStart && run.start_time <= viewEnd
        ));
        return (
          <g className="capar-categorical-lane" key={lane.label}>
            <text className="capar-metric-lane-label" x="8" y={laneY + 23}>{lane.label}</text>
            {runsInView.map((run, index) => {
              const startX = x(Math.max(run.start_time, viewStart));
              const endX = x(Math.min(run.end_time, viewEnd));
              const barWidth = Math.max(3, endX - startX);
              return (
                <g key={`${lane.label}:${run.stream_key}:${run.start_time}:${index}`}>
                  <rect fill={run.color} height="16" opacity=".8" rx="4" width={barWidth} x={startX} y={laneY + 10}>
                    <title>{`${lane.label}: ${run.label} · ${formatTime(run.start_time)}–${formatTime(run.end_time)}`}</title>
                  </rect>
                  {barWidth > 55 && (
                    <text className="capar-categorical-lane-text" x={startX + 4} y={laneY + 22}>{run.label}</text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
      {(() => {
        const y = sessionTop + 15;
        return (
          <g className="capar-device-session-lane">
            <line className="capar-timeline-rail" x1={left} x2={right} y1={y} y2={y} />
            <text className="capar-metric-lane-label" x="8" y={y + 3}>Device</text>
            {sessions.map((session, index) => {
              const startX = x(session.visibleStart ?? session.startTime);
              const endX = x(session.visibleEnd ?? session.endTime);
              const color = deviceColors.get(session.device);
              return (
                <g key={`${session.streamKey}:${session.startTime}:${index}`}>
                  <rect
                    fill={color}
                    height="8"
                    opacity=".8"
                    rx="4"
                    width={Math.max(3, endX - startX)}
                    x={startX}
                    y={y - 4}
                  >
                    <title>{`${session.device} · data ${formatTime(session.startTime)}–${formatTime(session.endTime)}`}</title>
                  </rect>
                </g>
              );
            })}
            {visibleAnchors.map((anchor) => (
              <g
                className="capar-timeline-anchor-event"
                key={`device:${anchor.anchor_id}`}
                onClick={() => onAnchorSelect(anchor)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onAnchorSelect(anchor);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <line x1={x(anchor.timestamp)} x2={x(anchor.timestamp)} y1={sessionTop} y2={y + 5} />
                <circle cx={x(anchor.timestamp)} cy={y} r="3" />
                <title>{`${anchor.anchor_type} · ${formatTime(anchor.timestamp)} · ${anchor.description}`}</title>
              </g>
            ))}
            {deviceNames.map((device, index) => {
              const legendX = left + ((index % 4) * 195);
              const legendY = sessionTop + 35 + (Math.floor(index / 4) * 14);
              return (
                <g key={`device-legend:${device}`}>
                  <circle cx={legendX + 4} cy={legendY - 3} fill={deviceColors.get(device)} r="4" />
                  <text className="capar-metric-lane-unit" x={legendX + 12} y={legendY}>{device}</text>
                </g>
              );
            })}
            <text className="capar-timeline-axis-label" textAnchor="start" x={left} y={height - 8}>{formatTime(viewStart)}</text>
            <text className="capar-timeline-axis-label" textAnchor="middle" x={(left + right) / 2} y={height - 8}>Waktu kronologis · WIB</text>
            <text className="capar-timeline-axis-label" textAnchor="end" x={right} y={height - 8}>{formatTime(viewEnd)}</text>
          </g>
        );
      })()}
    </svg>
  );
}

function CaparNodeField({
  nodes,
  mode,
  selectedId,
  activityFilter,
  deviceFilter,
  onSelect,
  zoom,
}) {
  const [page, setPage] = useState(0);
  const pageSize = 200;
  useEffect(() => setPage(0), [nodes, mode, activityFilter, deviceFilter]);
  const allEntries = getTimelineEntries(nodes, mode)
    .map((entry) => ({ ...entry, density: getNodeDensity(entry.node, mode) }));
  const activityNames = [...new Set(allEntries.map((entry) => entry.activity))];
  const activityColors = new Map(
    activityNames.map((name, index) => [name, ACTIVITY_COLORS[index % ACTIVITY_COLORS.length]]),
  );
  const visible = allEntries.filter((entry) => (
    (activityFilter === 'all' || entry.activity === activityFilter)
    && (deviceFilter === 'all' || entry.device === deviceFilter)
  ));
  const entriesByDay = new Map();
  allEntries.forEach((entry) => {
    const day = getJakartaDateKey(entry.time);
    if (!day) return;
    if (!entriesByDay.has(day)) entriesByDay.set(day, []);
    entriesByDay.get(day).push(entry);
  });
  const { min: minDensity, max: maxDensity } = getFiniteRange(
    visible.map(({ density }) => density),
  );

  if (!nodes.length) {
    return <p className="capar-visual-empty">Belum ada node untuk mode dan rentang waktu ini.</p>;
  }
  if (!visible.length) {
    return <p className="capar-visual-empty">Tidak ada node untuk filter aktivitas ini.</p>;
  }
  const pageCount = Math.ceil(visible.length / pageSize);
  const visibleIds = new Set(visible
    .slice(page * pageSize, (page + 1) * pageSize)
    .map((entry) => entry.id));

  return (
    <div className="capar-visual-node-field">
      {[...entriesByDay.entries()].map(([day, dayEntries]) => {
        const runs = groupChronologicalActivityRuns(dayEntries, {
          getActivity: (entry) => entry.activity,
          getTime: (entry) => entry.time,
          getEndTime: (entry) => mode === 'activities'
            ? toEpochMs(entry.node.episode_end) ?? entry.time
            : mode === 'windows'
              ? toEpochMs(entry.node.window_end) ?? entry.time
              : entry.time,
          getStreamKey: (entry) => mode === 'rows'
            ? `${entry.node.device_id || 'UNKNOWN'}:${entry.node.source_collection || 'PolarData'}`
            : `${entry.node.device_id || 'UNKNOWN'}:${entry.node.window_type || '5min'}`,
          getMaxGap: (_previous, next) => mode === 'rows'
            ? 5 * 60_000
            : next.node.window_type === '1min' ? 60_000 : 5 * 60_000,
          canMerge: () => mode !== 'activities',
        });
        return (
          <section className="capar-visual-day-group" key={day}>
            <div className="capar-visual-day-heading">
              <strong>{day}</strong>
              <span>{visible.filter((entry) => getJakartaDateKey(entry.time) === day).length} node</span>
            </div>
            {runs.map((run, runIndex) => {
              const activity = run.activity;
              const activityEntries = run.entries.filter((entry) => (
                visibleIds.has(entry.id)
                && (activityFilter === 'all' || entry.activity === activityFilter)
              ));
              if (!activityEntries.length) return null;
              return (
                <section
                  className="capar-visual-activity-group"
                  key={`${day}:${run.start_time}:${run.stream_key}:${runIndex}`}
                >
                  <div className="capar-visual-activity-heading">
                    <i style={{ backgroundColor: activityColors.get(activity) }} />
                    <strong>{activity}</strong>
                    <time>{formatNodeClock(run.start_time)} – {formatNodeClock(run.end_time)}</time>
                    <span>{activityEntries.length}</span>
                  </div>
                  <div
                    className="capar-visual-node-grid"
                    style={{
                      gap: `${8 * zoom}px`,
                      gridTemplateColumns: `repeat(auto-fill, minmax(${128 * zoom}px, 1fr))`,
                    }}
                  >
                    {activityEntries.map((entry) => {
                      const selected = entry.id === selectedId;
                      const ratio = maxDensity === minDensity
                        ? 0
                        : Math.sqrt((entry.density - minDensity) / (maxDensity - minDensity));
                      const size = mode === 'rows' ? 30 : 30 + (ratio * 18);
                      const hr = mode === 'rows'
                        ? entry.node.hr
                        : mode === 'windows'
                          ? entry.node.features?.mean_hr
                          : entry.node.summary?.mean_hr;
                      const rr = mode === 'rows'
                        ? entry.node.rr
                        : mode === 'windows'
                          ? entry.node.features?.mean_rr
                          : entry.node.summary?.mean_rr;
                      const detail = mode === 'rows'
                        ? `RR ${formatMetric(rr, 0)} ms`
                        : mode === 'windows'
                          ? `${entry.node.window_type} · ${Number(entry.node.raw_count) || 0} sampel`
                          : `${entry.node.summary?.window_count || 0} window`;
                      const label = `${entry.activity}, ${formatTime(entry.time)}, HR ${formatMetric(hr)} bpm, RR ${formatMetric(rr)} ms`;
                      return (
                        <button
                          aria-label={label}
                          aria-pressed={selected}
                          className={`capar-visual-node-card ${selected ? 'is-selected' : ''}`}
                          key={entry.id}
                          onClick={() => onSelect(entry.id)}
                          title={label}
                          type="button"
                        >
                          <span
                            className="capar-visual-node-bubble"
                            style={{
                              height: `${size}px`,
                              width: `${size}px`,
                              backgroundColor: activityColors.get(entry.activity),
                            }}
                          >
                            {formatMetric(hr, 0)}
                          </span>
                          <time>{formatNodeClock(entry.time)}</time>
                          <small>{detail}</small>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </section>
        );
      })}
      <div className="capar-node-pagination">
        <span>
          Node {((page * pageSize) + 1).toLocaleString('id-ID')}–{Math.min((page + 1) * pageSize, visible.length).toLocaleString('id-ID')}
          {' '}dari {visible.length.toLocaleString('id-ID')}
        </span>
        <button
          className="button button-light"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          type="button"
        >
          Sebelumnya
        </button>
        <button
          className="button button-light"
          disabled={page + 1 >= pageCount}
          onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
          type="button"
        >
          Berikutnya
        </button>
      </div>
    </div>
  );
}

function AnchoredTimelineChart({
  nodes,
  mode,
  onSelect,
  selectedId,
  focusId,
  zoom,
  anchors = [],
  onAnchorSelect = () => {},
  selectedMetrics = [],
  baseline = null,
  contextLabel = '',
  exportType = 'current',
  windows = [],
  activities = [],
  deviceFilter = 'all',
}) {
  const allEntries = useMemo(() => getTimelineEntries(nodes, mode), [nodes, mode]);
  if (!allEntries.length) return null;

  const timelineBoundaries = [
    ...allEntries.flatMap((entry) => [entry.time, entry.endTime]),
    ...anchors.map((anchor) => anchor.timestamp),
  ].filter(Number.isFinite);
  const { min: dataStart, max: dataEnd } = getFiniteRange(timelineBoundaries);
  const dataSpan = Math.max(1_000, dataEnd - dataStart);
  const visibleSpan = dataSpan / zoom;
  const focusTime = allEntries.find((entry) => entry.id === focusId)?.time
    ?? ((dataStart + dataEnd) / 2);
  const centeredStart = focusTime - (visibleSpan / 2);
  const viewStart = zoom >= 1
    ? Math.max(dataStart, Math.min(dataEnd - visibleSpan, centeredStart))
    : centeredStart;
  const viewEnd = viewStart + visibleSpan;
  const entries = allEntries.filter((entry) => entry.time >= viewStart && entry.time <= viewEnd);
  const sessions = useMemo(() => getDeviceSignalSessions(allEntries, mode), [allEntries, mode])
    .map((session) => {
      const visibleEntries = session.entries.filter((entry) => (
        entry.time >= viewStart && entry.time <= viewEnd
      ));
      if (!visibleEntries.length) return null;
      return {
        ...session,
        entries: visibleEntries,
        visibleStart: Math.max(session.startTime, viewStart),
        visibleEnd: Math.min(session.endTime, viewEnd),
        startClipped: session.startTime < viewStart,
        endClipped: session.endTime > viewEnd,
      };
    })
    .filter(Boolean);
  const visibleAnchors = anchors
    .filter((anchor) => anchor.timestamp >= viewStart && anchor.timestamp <= viewEnd)
    .slice(0, 250);
  const heartRateEntries = entries.filter((entry) => Number.isFinite(entry.hr));
  const width = 900;
  const height = 246;
  const left = 54;
  const right = width - 24;
  const top = 32;
  const bottom = 164;
  const sessionY = 204;
  const timeRange = Math.max(1, viewEnd - viewStart);
  const heartRates = heartRateEntries.map((entry) => entry.hr);
  const { min: minHr, max: maxHr } = getFiniteRange(heartRates, { min: 0, max: 1 });
  const hrRange = Math.max(1, maxHr - minHr);
  const x = (time) => left + (((time - viewStart) / timeRange) * (right - left));
  const y = (hr) => bottom - (((hr - minHr) / hrRange) * (bottom - top));
  const activityNames = [...new Set(entries.map((entry) => entry.activity))];
  const activityColors = new Map(
    activityNames.map((activity, index) => (
      [activity, ACTIVITY_COLORS[index % ACTIVITY_COLORS.length]]
    )),
  );
  const graphSegments = sessions.map((session) => (
    session.entries.filter((entry) => Number.isFinite(entry.hr))
  )).filter((segment) => segment.length);
  const markerEntries = heartRateEntries.length <= 100
    ? heartRateEntries
    : heartRateEntries.filter((entry, index) => (
      index === 0
      || index === heartRateEntries.length - 1
      || index % Math.ceil(heartRateEntries.length / 100) === 0
      || entry.id === selectedId
    ));
  const leftLabel = viewStart <= dataStart
    ? anchors.some((anchor) => anchor.anchor_type === 'DAY_START' && anchor.timestamp === dataStart)
      ? 'AWAL HARI'
      : 'AWAL DATA'
    : 'AWAL RENTANG';
  const rightLabel = viewEnd >= dataEnd
    ? anchors.some((anchor) => anchor.anchor_type === 'DAY_END' && anchor.timestamp === dataEnd)
      ? 'AKHIR HARI'
      : 'AKHIR DATA'
    : 'AKHIR RENTANG';

  return (
    <section className="capar-timeline-chart" aria-label="Graf kronologis dan sesi sinyal perangkat">
      <div className="capar-timeline-heading">
        <div>
          <strong>Rentang waktu · {Math.round(zoom * 100)}%</strong>
          <span>{entries.length.toLocaleString('id-ID')} dari {allEntries.length.toLocaleString('id-ID')} node · {sessions.length} sesi sinyal</span>
        </div>
        <span>
          Tampil {formatTime(viewStart)} → {formatTime(viewEnd)} · keseluruhan {formatTime(dataStart)} → {formatTime(dataEnd)}.
          Pilih node untuk memusatkan grafik pada waktunya.
        </span>
      </div>
      <div className="capar-timeline-svg-wrap">
        <svg
          aria-label={`Graf HR dari ${formatTime(viewStart)} sampai ${formatTime(viewEnd)}`}
          className="capar-timeline-svg"
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          <text className="capar-timeline-context" textAnchor="middle" x={width / 2} y={14}>{contextLabel}</text>
          <defs>
            <marker
              id="capar-timeline-arrow"
              markerHeight="7"
              markerUnits="strokeWidth"
              markerWidth="7"
              orient="auto"
              refX="6"
              refY="3.5"
              viewBox="0 0 7 7"
            >
              <path d="M0 0 L7 3.5 L0 7 z" fill="#62758a" />
            </marker>
          </defs>
          {[0, 1, 2].map((step) => {
            const gridY = top + (step / 2) * (bottom - top);
            const value = maxHr - ((step / 2) * (maxHr - minHr));
            return (
              <g key={step}>
                <line className="capar-timeline-grid" x1={left} x2={right} y1={gridY} y2={gridY} />
                <text className="capar-timeline-axis-label" textAnchor="end" x={left - 8} y={gridY + 3}>
                  {Math.round(value)} bpm
                </text>
              </g>
            );
          })}
          {graphSegments.map((segment, index) => (
            <g key={`segment:${index}`}>
              {segment.length > 1 && (
                <polyline
                  fill="none"
                  markerEnd="url(#capar-timeline-arrow)"
                  points={segment.map((entry) => `${x(entry.time)},${y(entry.hr)}`).join(' ')}
                  stroke={activityColors.get(segment[0].activity)}
                  strokeWidth="2"
                />
              )}
            </g>
          ))}
          {visibleAnchors.map((anchor) => (
            <g
              className="capar-timeline-anchor-event"
              key={anchor.anchor_id}
              onClick={() => onAnchorSelect(anchor)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onAnchorSelect(anchor);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <line x1={x(anchor.timestamp)} x2={x(anchor.timestamp)} y1={top} y2={sessionY + 4} />
              <circle cx={x(anchor.timestamp)} cy={top + 2} r="3" />
              <title>{`${anchor.anchor_type} · ${formatTime(anchor.timestamp)} · ${anchor.description}`}</title>
            </g>
          ))}
          {markerEntries.map((entry) => (
            <circle
              aria-label={`${entry.activity}, ${formatTime(entry.time)}, HR ${formatMetric(entry.hr)} bpm`}
              className={`capar-timeline-point ${entry.id === selectedId ? 'is-selected' : ''}`}
              cx={x(entry.time)}
              cy={y(entry.hr)}
              fill={activityColors.get(entry.activity)}
              key={entry.id}
              onClick={() => onSelect(entry.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(entry.id);
                }
              }}
              r={entry.id === selectedId ? 5 : 3}
              role="button"
              tabIndex={0}
            >
              <title>{`${entry.activity} · ${formatTime(entry.time)} · HR ${formatMetric(entry.hr)} bpm`}</title>
            </circle>
          ))}
          <line className="capar-timeline-rail" x1={left} x2={right} y1={sessionY} y2={sessionY} />
          {sessions.map((session, index) => {
            const startX = x(session.visibleStart);
            const endX = x(session.visibleEnd);
            const widthPx = Math.max(3, endX - startX);
            return (
              <g key={`${session.streamKey}:${session.startTime}:${index}`}>
                <rect
                  className="capar-timeline-session"
                  height="8"
                  rx="4"
                  style={{ fill: activityColors.get(session.entries[0].activity) }}
                  width={widthPx}
                  x={startX}
                  y={sessionY - 4}
                >
                  <title>{`${session.device} · data ${formatNodeClock(session.visibleStart)}–${formatNodeClock(session.visibleEnd)}`}</title>
                </rect>
                {!session.startClipped && (
                  <circle className="capar-timeline-anchor" cx={startX} cy={sessionY} r="5">
                    <title>Awal data sesi · {formatNodeClock(session.startTime)}</title>
                  </circle>
                )}
                {!session.endClipped && (
                  <circle className="capar-timeline-anchor is-end" cx={endX} cy={sessionY} r="5">
                    <title>Data terakhir sesi · {formatNodeClock(session.endTime)}</title>
                  </circle>
                )}
              </g>
            );
          })}
          <text className="capar-timeline-anchor-label" textAnchor="start" x={left} y={top - 12}>
            {leftLabel} · {formatNodeClock(viewStart)}
          </text>
          <text className="capar-timeline-anchor-label" textAnchor="end" x={right} y={top - 12}>
            {rightLabel} · {formatNodeClock(viewEnd)}
          </text>
          <text className="capar-timeline-axis-label" textAnchor="start" x={left} y={height - 8}>{formatNodeClock(viewStart)}</text>
          <text className="capar-timeline-axis-label" textAnchor="end" x={right} y={height - 8}>{formatNodeClock(viewEnd)}</text>
          <text className="capar-timeline-axis-label" textAnchor="middle" x={(left + right) / 2} y={sessionY + 22}>rentang sesi sinyal tercatat</text>
        </svg>
      </div>
      <MetricTimeSeriesLanes
        anchors={anchors}
        mode={mode}
        nodes={entries.map((entry) => entry.node)}
        onAnchorSelect={onAnchorSelect}
        onSelect={onSelect}
        selectedId={selectedId}
        selectedMetrics={selectedMetrics}
        viewEnd={viewEnd}
        viewStart={viewStart}
        contextLabel={contextLabel}
        exportType={exportType}
        baseline={baseline}
        windows={windows}
        activities={activities}
        deviceFilter={deviceFilter}
      />
      <div className="capar-timeline-sessions" aria-label="Awal dan akhir sesi sinyal perangkat">
        {sessions.map((session, index) => (
          <span key={`${session.streamKey}:${session.startTime}:${index}`}>
            <strong>
              {session.startClipped
                ? 'Sesi berlanjut'
                : session.isReconnect ? 'Data tersambung lagi' : 'Awal data'}
            </strong>
            {formatNodeClock(session.visibleStart)} – {formatNodeClock(session.visibleEnd)}
            <small>{session.device} · {session.entries.length} node dalam rentang</small>
          </span>
        ))}
      </div>
      <p className="capar-timeline-note">
        Zoom mengubah rentang waktu yang diplot. Jeda lebih dari {mode === 'rows' ? '5 menit' : 'durasi window'} memulai sesi sinyal baru.
        Waktu lepas/pasang fisik tidak direkam; batas ini menunjukkan data terakhir dan data tersambung kembali, bukan bukti device benar-benar dilepas.
      </p>
    </section>
  );
}

function ActivitySeriesChart({ points }) {
  const width = 680;
  const height = 132;
  const left = 28;
  const right = width - 20;
  const top = 14;
  const bottom = height - 23;
  const series = [
    { key: 'mean_hr', label: 'HR', color: '#c27b3f' },
    { key: 'mean_rr', label: 'RR', color: '#547fb4' },
  ];
  const getPoints = (key) => {
    const getValue = (point) => (
      point[key] === null || point[key] === undefined || point[key] === ''
        ? NaN
        : Number(point[key])
    );
    const values = points.map(getValue).filter(Number.isFinite);
    if (!values.length) return [];
    const { min, max } = getFiniteRange(values);
    return points.flatMap((point, index) => {
      const value = getValue(point);
      if (!Number.isFinite(value)) return [];
      const px = points.length < 2
        ? (left + right) / 2
        : left + ((index / (points.length - 1)) * (right - left));
      const py = max === min
        ? (top + bottom) / 2
        : bottom - (((value - min) / (max - min)) * (bottom - top));
      return [{ x: px, y: py, value, point }];
    });
  };
  const plotted = series.map((item) => ({ ...item, points: getPoints(item.key) }));

  return (
    <div className="capar-activity-series">
      <div className="capar-activity-series-legend">
        {plotted.map((item) => (
          <span key={item.key}><i style={{ backgroundColor: item.color }} />{item.label}</span>
        ))}
        <small>Garis menampilkan perubahan relatif tiap metrik selama episode.</small>
      </div>
      <svg aria-label="Time series HR dan RR dalam episode aktivitas" viewBox={`0 0 ${width} ${height}`}>
        {[0, 1, 2, 3].map((step) => {
          const py = top + (step / 3) * (bottom - top);
          return <line className="capar-activity-series-grid" key={step} x1={left} x2={right} y1={py} y2={py} />;
        })}
        {plotted.map((item) => (
          <g key={item.key}>
            {item.points.length > 1 && (
              <polyline
                fill="none"
                points={item.points.map((point) => `${point.x},${point.y}`).join(' ')}
                stroke={item.color}
                strokeWidth="2"
              />
            )}
            {item.points.map((point) => (
              <circle
                cx={point.x}
                cy={point.y}
                fill={item.color}
                key={`${item.key}:${point.point.segment_id}`}
                r="3"
              >
                <title>{`${item.label} ${formatMetric(point.value)} · ${formatTime(point.point.window_start)}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

function DetailPanel({ node, mode, baseline, nextNode }) {
  if (!node) {
    return <div className="panel capar-visual-detail-empty">Pilih node pada grafik untuk melihat detail dan interpretasinya.</div>;
  }
  if (mode === 'rows') {
    const hasAcceleration = [node.acc_x, node.acc_y, node.acc_z]
      .some((value) => value !== null && value !== undefined);
    const magnitude = hasAcceleration
      ? Math.sqrt(
        (Number(node.acc_x) || 0) ** 2
        + (Number(node.acc_y) || 0) ** 2
        + (Number(node.acc_z) || 0) ** 2,
      )
      : null;
    return (
      <section className="panel capar-visual-detail">
        <div className="panel-heading">
          <div><h2>Baris data sensor</h2><p>{formatTime(node.timestamp_ms ?? node.timestamp)}</p></div>
          <span className="capar-visual-badge">{node.activity || 'Aktivitas tidak diketahui'}</span>
        </div>
        <div className="capar-visual-metrics">
          <span>HR<strong>{formatMetric(node.hr)} bpm</strong></span>
          <span>RR<strong>{formatMetric(node.rr)} ms</strong></span>
          <span>RMSSD<strong>{formatMetric(node.rmssd_ms)} ms</strong></span>
          <span>SDNN<strong>{formatMetric(node.sdnn_ms)} ms</strong></span>
          <span>DFA α1<strong>{formatMetric(node.dfa_alpha1, 3)}</strong></span>
          <span>ACC magnitude<strong>{formatMetric(magnitude, 3)}</strong></span>
          <span>Steps<strong>{Number(node.step_count) || 0}</strong></span>
          <span>Signal quality<strong>{formatMetric(node.signal_quality, 2)}</strong></span>
          <span>Data quality<strong>{node.data_quality || 'Tidak tersedia'}</strong></span>
          <span>Sumber<strong>{node.source_collection || 'PolarData'} · {node.source_id || node._id}</strong></span>
          <span>Device<strong>{node.device_id || 'UNKNOWN'}</strong></span>
        </div>
        <div className="capar-visual-interpretation">
          <div><strong>K1 · Observasi fisiologi</strong><p>HR {formatMetric(node.hr)} bpm dan RR {formatMetric(node.rr)} ms dicatat pada waktu yang sama. HRV hanya ditampilkan jika tersedia dari sumber.</p></div>
          <div><strong>K2 · Konteks aktivitas</strong><p>Label aktivitas: {node.activity || 'tidak diketahui'}; akselerasi gabungan: {formatMetric(magnitude, 3)}.</p></div>
          <div><strong>K3 · Profil personal</strong><p>Baris sensor ini belum dikomparasikan dengan baseline personal.</p></div>
          <div><strong>K4 · Interpretasi kontekstual</strong><p>Satu baris adalah observasi, bukan diagnosis atau bukti persistensi.</p></div>
        </div>
        {nextNode && <p className="capar-visual-transition">Jarak waktu ke node berikutnya dalam urutan waktu: {formatDuration(getNodeTime(nextNode, 'rows') - getNodeTime(node, 'rows'))}.</p>}
      </section>
    );
  }
  if (mode === 'windows') {
    const hr = Number(node.features?.mean_hr);
    const rawBaselineMean = baseline?.stats?.mean_hr?.mean;
    const baselineMean = rawBaselineMean === null || rawBaselineMean === undefined
      ? NaN
      : Number(rawBaselineMean);
    const hasHr = Number.isFinite(hr);
    const hasBaseline = Number.isFinite(baselineMean);
    return (
      <section className="panel capar-visual-detail">
        <div className="panel-heading">
          <div><h2>Window CAPAR</h2><p>{formatTime(node.window_start)} · {node.window_type}</p></div>
          <span className="capar-visual-badge">{node.activity_label || 'Unknown'}</span>
        </div>
        <div className="capar-visual-metrics">
          <span>HR mean<strong>{formatMetric(node.features?.mean_hr)} bpm</strong></span>
          <span>HR delta<strong>{formatMetric(node.features?.delta_hr)} bpm</strong></span>
          <span>RR mean<strong>{formatMetric(node.features?.mean_rr)} ms</strong></span>
          <span>SDNN<strong>{formatMetric(node.features?.sdnn)} ms</strong></span>
          <span>RMSSD<strong>{formatMetric(node.features?.rmssd)} ms</strong></span>
          <span>DFA α1<strong>{formatMetric(node.features?.dfa_alpha1, 3)}</strong></span>
          <span>DFA α2<strong>{formatMetric(node.features?.dfa_alpha2, 3)}</strong></span>
          <span>ACC intensity<strong>{formatMetric(node.features?.motion_intensity, 3)}</strong></span>
          <span>Confidence<strong>{formatMetric(node.missing_data_info?.confidence_score, 1)}%</strong></span>
          <span>State<strong>{node.rr_status || node.classification || 'Tidak tersedia'}</strong></span>
          <span>Jumlah data<strong>{Number(node.raw_count) || 0}</strong></span>
        </div>
        <div className="capar-visual-interpretation">
          <div><strong>K1 · Observasi fisiologi</strong><p>Window berisi HR mean {formatMetric(node.features?.mean_hr)} bpm dan RR mean {formatMetric(node.features?.mean_rr)} ms; kualitas {node.is_valid ? 'valid' : 'perlu perhatian'}.</p></div>
          <div><strong>K2 · Konteks aktivitas</strong><p>{node.activity_label || 'Unknown'} · ACC intensity {formatMetric(node.features?.motion_intensity, 3)} · {Number(node.raw_count) || 0} sampel.</p></div>
          <div><strong>K3 · Profil personal</strong><p>{baseline ? `Baseline HR mean ${formatMetric(baselineMean)} bpm (${baseline.is_mature ? 'matang' : 'belum matang'}).` : 'Baseline personal untuk konteks ini belum tersedia.'}</p></div>
          <div><strong>K4 · Perbandingan konteks</strong><p>{hasHr && hasBaseline ? `HR window berbeda ${formatMetric(hr - baselineMean)} bpm dari baseline personal. Ini adalah perbandingan, bukan diagnosis.` : 'Deviasi tidak dihitung karena HR atau baseline belum tersedia.'}</p></div>
        </div>
        {nextNode && <p className="capar-visual-transition">Selang ke window berikutnya dalam urutan waktu: {formatDuration(getNodeTime(nextNode, 'windows') - getNodeTime(node, 'windows'))}.</p>}
      </section>
    );
  }

  const summary = node.summary || {};
  const points = node.series_points || [];
  return (
    <section className="panel capar-visual-detail">
      <div className="panel-heading">
        <div><h2>Episode aktivitas · {node.activity_label}</h2><p>{formatTime(node.episode_start)} – {formatTime(node.episode_end)}</p></div>
        <span className="capar-visual-badge">{summary.window_count || 0} window</span>
      </div>
      <div className="capar-visual-metrics">
        <span>HR mean<strong>{formatMetric(summary.mean_hr)} bpm</strong></span>
        <span>HR min–max<strong>{formatMetric(summary.min_hr)}–{formatMetric(summary.max_hr)} bpm</strong></span>
        <span>HR variance<strong>{formatMetric(summary.hr_variance)}</strong></span>
        <span>RR mean<strong>{formatMetric(summary.mean_rr)} ms</strong></span>
        <span>HR–RR covariance<strong>{formatMetric(summary.hr_rr_covariance)} · n={summary.hr_rr_pair_count || 0}</strong></span>
        <span>SDNN mean/min/max<strong>{formatMetric(summary.mean_sdnn)} / {formatMetric(summary.min_sdnn)} / {formatMetric(summary.max_sdnn)} ms</strong></span>
        <span>RMSSD mean/min/max<strong>{formatMetric(summary.mean_rmssd)} / {formatMetric(summary.min_rmssd)} / {formatMetric(summary.max_rmssd)} ms</strong></span>
        <span>DFA α1 mean<strong>{formatMetric(summary.mean_dfa_alpha1, 3)}</strong></span>
        <span>DFA α2 mean<strong>{formatMetric(summary.mean_dfa_alpha2, 3)}</strong></span>
        <span>ACC min–max<strong>{formatMetric(summary.min_motion_intensity, 3)}–{formatMetric(summary.max_motion_intensity, 3)}</strong></span>
        <span>Quality valid/invalid<strong>{summary.quality_valid_window_count || 0}/{summary.quality_invalid_window_count || 0}</strong></span>
        <span>Confidence mean<strong>{formatMetric(summary.mean_confidence_score, 1)}%</strong></span>
        <span>State transitions<strong>{summary.state_transition_count || 0}</strong></span>
        <span>Raw samples<strong>{Number(summary.raw_sample_count) || 0}</strong></span>
      </div>
      <div className="capar-visual-interpretation">
        <div><strong>K1 · Observasi fisiologi</strong><p>Ringkasan dari {summary.valid_window_count || 0} window valid; HR mean {formatMetric(summary.mean_hr)} bpm, RR mean {formatMetric(summary.mean_rr)} ms.</p></div>
        <div><strong>K2 · Konteks aktivitas</strong><p>Episode {node.activity_label}, device {node.device_id}, pipeline {node.window_type}; {summary.window_count || 0} window berurutan.</p></div>
        <div><strong>K3 · Profil personal</strong><p>Ringkasan tersimpan terpisah per pasien, hari, device, dan tipe window; baseline personal belum dipakai untuk agregat ini.</p></div>
        <div><strong>K4 · Interpretasi kontekstual</strong><p>Rata-rata dan rentang menjelaskan episode ini, tetapi tidak menyimpulkan deviasi klinis.</p></div>
      </div>
      {points.length > 0 && <ActivitySeriesChart points={points} />}
      {node.state_transitions?.length > 0 && (
        <div className="capar-state-transitions">
          <strong>Perubahan state fisiologis CAPAR</strong>
          {node.state_transitions.map((transition) => (
            <span key={`${transition.from_segment_id}:${transition.to_segment_id}`}>
              {formatTime(transition.timestamp)} · {transition.from_state} → {transition.to_state}
              {' · '}window {transition.from_segment_id} → {transition.to_segment_id}
            </span>
          ))}
        </div>
      )}
      <div className="capar-visual-point-list">
        {points.map((point, index) => (
          <span key={String(point.segment_id)}>
            <strong>Window {index + 1}</strong>{formatTime(point.window_start)} · HR {formatMetric(point.mean_hr)} · RR {formatMetric(point.mean_rr)}
          </span>
        ))}
      </div>
    </section>
  );
}

function NodeRelationshipPanel({
  node,
  mode,
  edge,
  allNodes,
  parentNode,
  childNodes,
  onNavigate,
  onDrillMode,
}) {
  const relationFor = (id) => allNodes.find((item) => getNodeId(item, mode) === id);
  const predecessor = edge?.predecessor_id ? relationFor(edge.predecessor_id) : null;
  const successor = edge?.successor_id ? relationFor(edge.successor_id) : null;
  const parentMode = mode === 'rows' ? 'windows' : mode === 'windows' ? 'activities' : null;
  const childMode = mode === 'rows' ? null : mode === 'windows' ? 'rows' : 'windows';
  return (
    <section className="panel capar-node-relations">
      <div>
        <span className="eyebrow">RELATIONSHIP ENGINE</span>
        <h3>Relasi temporal & sumber data</h3>
      </div>
      <div className="capar-node-relations-grid">
        <div>
          <strong>Predecessor</strong>
          {predecessor
            ? <button type="button" onClick={() => onNavigate(mode, getNodeId(predecessor, mode))}>{formatTime(getNodeTime(predecessor, mode))}</button>
            : <span>Awal urutan</span>}
        </div>
        <div>
          <strong>Node terpilih</strong>
          <span>{getNodeId(node, mode)}</span>
        </div>
        <div>
          <strong>Successor</strong>
          {successor
            ? <button type="button" onClick={() => onNavigate(mode, getNodeId(successor, mode))}>{formatTime(getNodeTime(successor, mode))}</button>
            : <span>Akhir urutan</span>}
        </div>
        <div>
          <strong>Perubahan terhadap predecessor</strong>
          <span>
            {edge?.metric_direction === 'unavailable'
              ? 'Nilai metrik tidak tersedia'
              : `${edge?.metric_direction || '—'} · ΔHR ${edge?.metric_delta_from_predecessor === null || edge?.metric_delta_from_predecessor === undefined ? '—' : formatMetric(edge.metric_delta_from_predecessor, 2)} bpm`}
            {edge?.activity_changed ? ' · aktivitas berubah' : ''}
          </span>
        </div>
        <div>
          <strong>Parent {parentMode || 'node'}</strong>
          {parentNode && parentMode
            ? <button type="button" onClick={() => onNavigate(parentMode, getNodeId(parentNode, parentMode))}>{formatTime(getNodeTime(parentNode, parentMode))} · {parentNode.parent_relation_source || node.parent_relation_source || 'referensi tersimpan'}</button>
            : mode === 'activities'
              ? <button type="button" onClick={() => onDrillMode('overview')}>Day overview</button>
              : <span>Tidak tersedia</span>}
        </div>
        <div>
          <strong>Child nodes · {childNodes.length}</strong>
          {childNodes.length && childMode
            ? <div className="capar-node-child-links">
              {childNodes.slice(0, 8).map((child) => (
                <button key={getNodeId(child, childMode)} onClick={() => onNavigate(childMode, getNodeId(child, childMode))} type="button">
                  {formatTime(getNodeTime(child, childMode))}
                </button>
              ))}
              {childNodes.length > 8 && <span>+{childNodes.length - 8} lainnya</span>}
            </div>
            : <span>{mode === 'rows' ? 'Raw measurement adalah leaf node' : 'Tidak tersedia'}</span>}
        </div>
      </div>
      <p>
        Ref node: {getNodeId(node, mode)} · {mode === 'rows'
          ? node.parent_relation_source
            ? `window parent dicocokkan berdasarkan timestamp overlap (${node.parent_window_id}); bukan daftar input pipeline yang tersimpan.`
            : 'raw measurement tidak menyimpan foreign key ke window.'
          : mode === 'windows'
            ? node.parent_episode_id
              ? 'episode parent ditautkan oleh source_segment_ids.'
              : 'window belum tertaut ke agregat episode.'
            : 'episode menyimpan source_segment_ids ke window CAPAR.'}
      </p>
    </section>
  );
}

function getNodePopupMetrics(node, mode) {
  if (mode === 'rows') {
    const hasAcceleration = [node.acc_x, node.acc_y, node.acc_z]
      .some((value) => value !== null && value !== undefined);
    const magnitude = hasAcceleration
      ? Math.sqrt(
        (Number(node.acc_x) || 0) ** 2
        + (Number(node.acc_y) || 0) ** 2
        + (Number(node.acc_z) || 0) ** 2,
      )
      : null;
    return [
      { label: 'HR', value: `${formatMetric(node.hr)} bpm` },
      { label: 'RR', value: `${formatMetric(node.rr)} ms` },
      { label: 'RMSSD', value: `${formatMetric(node.rmssd_ms)} ms` },
      { label: 'SDNN', value: `${formatMetric(node.sdnn_ms)} ms` },
      { label: 'DFA α1', value: formatMetric(node.dfa_alpha1, 3) },
      { label: 'Aktivitas', value: node.activity || 'Tidak diketahui' },
      { label: 'ACC', value: formatMetric(magnitude, 3) },
      { label: 'Langkah', value: String(Number(node.step_count) || 0) },
      { label: 'Kualitas sinyal', value: formatMetric(node.signal_quality, 2) },
      { label: 'Sumber', value: node.source_collection || 'PolarData' },
    ];
  }
  if (mode === 'windows') {
    return [
      { label: 'HR mean', value: `${formatMetric(node.features?.mean_hr)} bpm` },
      { label: 'HR delta', value: `${formatMetric(node.features?.delta_hr)} bpm` },
      { label: 'RR mean', value: `${formatMetric(node.features?.mean_rr)} ms` },
      { label: 'SDNN', value: `${formatMetric(node.features?.sdnn)} ms` },
      { label: 'RMSSD', value: `${formatMetric(node.features?.rmssd)} ms` },
      { label: 'DFA α1', value: formatMetric(node.features?.dfa_alpha1, 3) },
      { label: 'DFA α2', value: formatMetric(node.features?.dfa_alpha2, 3) },
      { label: 'ACC intensity', value: formatMetric(node.features?.motion_intensity, 3) },
      { label: 'Sampel', value: String(Number(node.raw_count) || 0) },
      { label: 'State CAPAR', value: node.rr_status || 'Tidak tersedia' },
      { label: 'Aktivitas', value: node.activity_label || 'Unknown' },
      { label: 'Device', value: node.device_id || 'UNKNOWN' },
    ];
  }

  const summary = node.summary || {};
  return [
    { label: 'HR mean', value: `${formatMetric(summary.mean_hr)} bpm` },
    { label: 'HR min–max', value: `${formatMetric(summary.min_hr)}–${formatMetric(summary.max_hr)}` },
    { label: 'RR mean', value: `${formatMetric(summary.mean_rr)} ms` },
    { label: 'RMSSD mean', value: `${formatMetric(summary.mean_rmssd)} ms` },
    { label: 'SDNN mean', value: `${formatMetric(summary.mean_sdnn)} ms` },
    { label: 'DFA α1 mean', value: formatMetric(summary.mean_dfa_alpha1, 3) },
    { label: 'DFA α2 mean', value: formatMetric(summary.mean_dfa_alpha2, 3) },
    { label: 'HR variance', value: formatMetric(summary.hr_variance, 2) },
    { label: 'HR–RR covariance', value: formatMetric(summary.hr_rr_covariance, 2) },
    { label: 'Window', value: String(Number(summary.window_count) || 0) },
    { label: 'Sampel sensor', value: String(Number(summary.raw_sample_count) || 0) },
    { label: 'State transition', value: String(Number(summary.state_transition_count) || 0) },
    { label: 'Device', value: node.device_id || 'UNKNOWN' },
  ];
}

function TemporalDataTable({ nodes, mode, onSelect, selectedId }) {
  const [page, setPage] = useState(0);
  const pageSize = 100;
  useEffect(() => setPage(0), [nodes, mode]);
  const pageCount = Math.max(1, Math.ceil(nodes.length / pageSize));
  const pageNodes = nodes.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <div className="capar-temporal-table-wrap">
      <table className="capar-temporal-table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Node / sumber</th>
            <th>HR</th>
            <th>RR</th>
            <th>RMSSD</th>
            <th>SDNN</th>
            <th>DFA α1</th>
            <th>ACC</th>
            <th>Aktivitas</th>
            <th>Device</th>
            <th>Kualitas</th>
          </tr>
        </thead>
        <tbody>
          {pageNodes.map((node) => {
            const id = getNodeId(node, mode);
            const isRow = mode === 'rows';
            const isWindow = mode === 'windows';
            const metrics = isRow ? node : isWindow ? node.features || {} : node.summary || {};
            const time = getNodeTime(node, mode);
            const accValue = isRow
              ? Math.sqrt((Number(node.acc_x) || 0) ** 2 + (Number(node.acc_y) || 0) ** 2 + (Number(node.acc_z) || 0) ** 2)
              : isWindow ? metrics.motion_intensity : metrics.mean_motion_intensity;
            return (
              <tr className={id === selectedId ? 'is-selected' : ''} key={id}>
                <td>{formatTime(time)}</td>
                <td>
                  <button className="capar-table-node-link" onClick={() => onSelect(id)} type="button">
                    {id}
                  </button>
                </td>
                <td>{formatMetric(isRow ? metrics.hr : isWindow ? metrics.mean_hr : metrics.mean_hr)}</td>
                <td>{formatMetric(isRow ? metrics.rr : isWindow ? metrics.mean_rr : metrics.mean_rr)}</td>
                <td>{formatMetric(isRow ? metrics.rmssd_ms : isWindow ? metrics.rmssd : metrics.mean_rmssd)}</td>
                <td>{formatMetric(isRow ? metrics.sdnn_ms : isWindow ? metrics.sdnn : metrics.mean_sdnn)}</td>
                <td>{formatMetric(isRow ? metrics.dfa_alpha1 : isWindow ? metrics.dfa_alpha1 : metrics.mean_dfa_alpha1, 3)}</td>
                <td>{formatMetric(accValue, 3)}</td>
                <td>{getNodeActivity(node, mode)}</td>
                <td>{node.device_id || 'UNKNOWN'}</td>
                <td>{isRow ? formatMetric(node.signal_quality, 2) : isWindow ? (node.is_valid ? 'Valid' : 'Invalid') : `${metrics.valid_window_count || 0}/${metrics.window_count || 0} valid`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="capar-node-pagination">
        <span>
          Baris {nodes.length ? (page * pageSize) + 1 : 0}–{Math.min((page + 1) * pageSize, nodes.length)}
          {' '}dari {nodes.length.toLocaleString('id-ID')}
        </span>
        <button className="button button-light" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} type="button">
          Sebelumnya
        </button>
        <button className="button button-light" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} type="button">
          Berikutnya
        </button>
      </div>
    </div>
  );
}

function TemporalAnchorList({ anchors, selectedAnchor, onSelect }) {
  const [page, setPage] = useState(0);
  const pageSize = 50;
  useEffect(() => setPage(0), [anchors]);
  const pageCount = Math.max(1, Math.ceil(anchors.length / pageSize));
  const pageAnchors = anchors.slice(page * pageSize, (page + 1) * pageSize);
  if (!anchors.length) {
    return <p className="capar-visual-empty">Tidak ada anchor untuk rentang ini.</p>;
  }
  return (
    <div className="capar-anchor-list">
      <div className="capar-anchor-list-heading">
        <strong>Temporal anchors · {anchors.length.toLocaleString('id-ID')}</strong>
        <span>Garis pada lane dapat dipilih untuk melihat sumber, confidence, dan entitas terkait.</span>
      </div>
      {selectedAnchor && (
        <article className="capar-anchor-detail" aria-live="polite">
          <strong>{selectedAnchor.anchor_type} · {formatTime(selectedAnchor.timestamp)}</strong>
          <p>{selectedAnchor.description}</p>
          <span>
            {selectedAnchor.inferred ? 'Diinferensikan' : 'Tercatat'}
            {' · '}Confidence {formatMetric(selectedAnchor.confidence, 2)}
            {' · '}{selectedAnchor.source}
            {selectedAnchor.related_entity_id ? ` · Ref ${selectedAnchor.related_entity_id}` : ''}
          </span>
        </article>
      )}
      <div className="capar-anchor-list-items">
        {pageAnchors.map((anchor) => (
          <button
            aria-pressed={selectedAnchor?.anchor_id === anchor.anchor_id}
            className={`capar-anchor-item ${anchor.inferred ? 'is-inferred' : ''}`}
            key={anchor.anchor_id}
            onClick={() => onSelect(anchor)}
            type="button"
          >
            <time>{formatTime(anchor.timestamp)}</time>
            <strong>{anchor.anchor_type}</strong>
            <span>{anchor.device_id} · {anchor.inferred ? 'inferensi' : 'aktual'}</span>
          </button>
        ))}
      </div>
      <div className="capar-node-pagination">
        <span>{anchors.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, anchors.length)} dari {anchors.length}</span>
        <button className="button button-light" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button">Sebelumnya</button>
        <button className="button button-light" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} type="button">Berikutnya</button>
      </div>
    </div>
  );
}

function DeviceSessionList({ sessions, deviceFilter }) {
  const [page, setPage] = useState(0);
  const pageSize = 100;
  useEffect(() => setPage(0), [sessions, deviceFilter]);
  const visible = sessions.filter((session) => (
    deviceFilter === 'all' || session.device_id === deviceFilter
  ));
  if (!visible.length) return null;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const statusLabel = (status) => ({
    data_observed: 'Data tercatat',
    signal_gap_inferred: 'Gap sinyal diinferensikan',
    sensor_contact_confirmed: 'Kontak sensor tercatat',
    sensor_contact_lost: 'Kontak sensor hilang',
    contact_after_data_gap: 'Kontak setelah gap data',
  }[status] || status);
  return (
    <section className="capar-device-sessions">
      <div>
        <strong>Device sessions · {visible.length.toLocaleString('id-ID')}</strong>
        <span>Session dibentuk dari bukti data; gap bukan bukti device dilepas.</span>
      </div>
      <div className="capar-device-session-cards">
        {visible.slice(page * pageSize, (page + 1) * pageSize).map((session) => (
          <article key={session.session_id}>
            <strong>{session.device_id} · {statusLabel(session.status)}</strong>
            <span>{formatTime(session.start)} – {formatTime(session.end)}</span>
            <small>{formatDuration(session.duration_ms)} · {session.measurement_ids.length} sumber · {session.source_level}</small>
          </article>
        ))}
      </div>
      {visible.length > pageSize && (
        <div className="capar-node-pagination">
          <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, visible.length)} dari {visible.length.toLocaleString('id-ID')}</span>
          <button className="button button-light" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button">Sebelumnya</button>
          <button className="button button-light" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} type="button">Berikutnya</button>
        </div>
      )}
    </section>
  );
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function createTemporalCsv(timelineData) {
  const header = [
    'granularity',
    'node_id',
    'timestamp',
    'end_timestamp',
    'hr_bpm',
    'rr_ms',
    'rmssd_ms',
    'sdnn_ms',
    'dfa_alpha1',
    'dfa_alpha2',
    'acc_x',
    'acc_y',
    'acc_z',
    'activity',
    'device_id',
    'signal_quality',
    'source_reference',
    'parent_reference',
  ];
  const rows = (timelineData?.rows || []).map((node) => [
    'row',
    node._id,
    formatTime(node.timestamp_ms ?? node.timestamp),
    formatTime(node.timestamp_ms ?? node.timestamp),
    node.hr,
    node.rr,
    node.rmssd_ms,
    node.sdnn_ms,
    node.dfa_alpha1,
    null,
    node.acc_x,
    node.acc_y,
    node.acc_z,
    node.activity,
    node.device_id,
    node.signal_quality,
    node._id,
    node.parent_window_id,
  ]);
  const windows = (timelineData?.windows || []).map((node) => [
    'window',
    node._id,
    formatTime(node.window_start),
    formatTime(node.window_end),
    node.features?.mean_hr,
    node.features?.mean_rr,
    node.features?.rmssd,
    node.features?.sdnn,
    node.features?.dfa_alpha1,
    node.features?.dfa_alpha2,
    null,
    null,
    null,
    node.activity_label,
    node.device_id,
    node.signal_quality_detail?.q_signal,
    node._id,
    node.parent_episode_id,
  ]);
  const activities = (timelineData?.activities || []).map((node) => [
    'activity',
    node.episode_key || node._id,
    formatTime(node.episode_start),
    formatTime(node.episode_end),
    node.summary?.mean_hr,
    node.summary?.mean_rr,
    node.summary?.mean_rmssd,
    null,
    node.summary?.mean_dfa_alpha1,
    null,
    null,
    null,
    null,
    node.activity_label,
    node.device_id,
    null,
    (node.source_segment_ids || []).join('|'),
    null,
  ]);
  const content = [header, ...rows, ...windows, ...activities]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
  return `\uFEFF${content}`;
}

async function downloadTimelinePng(exportType, filename) {
  const svg = document.querySelector(`[data-export="${exportType}"]`);
  if (!svg) throw new Error('Grafik untuk diekspor tidak tersedia.');
  const bounds = svg.viewBox.baseVal;
  if (!bounds.width || !bounds.height) throw new Error('Ukuran grafik tidak valid untuk ekspor.');
  const scale = Math.min(3, 6000 / bounds.width, 24000 / bounds.height);
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(Math.round(bounds.width)));
  clone.setAttribute('height', String(Math.round(bounds.height)));
  const originalNodes = [svg, ...svg.querySelectorAll('*')];
  const clonedNodes = [clone, ...clone.querySelectorAll('*')];
  originalNodes.forEach((original, index) => {
    const computed = window.getComputedStyle(original);
    const cloned = clonedNodes[index];
    [
      'fill',
      'stroke',
      'stroke-width',
      'stroke-dasharray',
      'font-family',
      'font-size',
      'font-weight',
      'text-anchor',
      'opacity',
    ].forEach((property) => {
      cloned.style.setProperty(property, computed.getPropertyValue(property));
    });
  });
  const source = new XMLSerializer().serializeToString(clone);
  const imageUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.src = imageUrl;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Grafik gagal dirender menjadi PNG.'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bounds.width * scale));
    canvas.height = Math.max(1, Math.round(bounds.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas ekspor tidak tersedia pada browser ini.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Browser gagal membuat file PNG.');
    const link = document.createElement('a');
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(blobUrl);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function NodeDetailPopup({
  node,
  mode,
  index,
  total,
  previousNode,
  nextNode,
  onClose,
  onNavigate,
}) {
  const time = getNodeTime(node, mode);
  const metrics = getNodePopupMetrics(node, mode);
  const activity = getNodeActivity(node, mode);

  return (
    <div
      className="capar-node-popup-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="capar-node-popup-title"
        aria-modal="true"
        className="capar-node-popup"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
        role="dialog"
        tabIndex={-1}
      >
        <div className="capar-node-popup-heading">
          <div>
            <span className="eyebrow">DETAIL NODE · {index + 1} / {total}</span>
            <h2 id="capar-node-popup-title">{activity} · {formatTime(time)}</h2>
          </div>
          <button autoFocus aria-label="Tutup detail node" className="capar-node-popup-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="capar-node-popup-diagram">
          <div className="capar-popup-time-node">
            <span>NODE TERPILIH</span>
            <strong>{formatNodeClock(time)}</strong>
            <small>{activity}</small>
          </div>
          <div className="capar-popup-branch-stem" aria-hidden="true"><ArrowDown size={18} /></div>
          <div className="capar-popup-metrics">
            {metrics.map((metric) => (
              <div className="capar-popup-metric" key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
          {mode === 'rows' && [node.rmssd_ms, node.sdnn_ms, node.dfa_alpha1].some((value) => (
            value === null || value === undefined
          )) && (
            <p className="capar-popup-data-note">
              HRV yang tidak tersedia pada sumber baris ini tidak dihitung ulang dari satu sampel. Nilai hanya ditampilkan jika telah disediakan oleh sumber data.
            </p>
          )}
          <p className="capar-popup-reference">
            Sumber {node.source_collection || (mode === 'rows' ? 'PolarData' : mode === 'windows' ? 'Segment' : 'CaparActivityTimeSeries')}
            {' · '}Ref {node.source_id || node._id}
            {node.parent_window_id ? ` · Parent window ${node.parent_window_id}` : ''}
            {node.parent_episode_id ? ` · Parent episode ${node.parent_episode_id}` : ''}
          </p>
        </div>

        <div className="capar-popup-direction">
          <button
            className="button button-light"
            disabled={!previousNode}
            onClick={() => previousNode && onNavigate(getNodeId(previousNode, mode))}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={15} />
            {previousNode ? `Sebelumnya · ${formatTime(getNodeTime(previousNode, mode))}` : 'Awal urutan'}
          </button>
          <span><strong>ARAH WAKTU</strong> {formatNodeClock(time)} →</span>
          <button
            className="button button-primary"
            disabled={!nextNode}
            onClick={() => nextNode && onNavigate(getNodeId(nextNode, mode))}
            type="button"
          >
            {nextNode ? `Berikutnya · ${formatTime(getNodeTime(nextNode, mode))}` : 'Akhir urutan'}
            <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}

export default function CaparVisualizationPage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [dateMode, setDateMode] = useState('day');
  const [mode, setMode] = useState('overview');
  const [timelineData, setTimelineData] = useState(null);
  const dataMode = mode === 'overview'
    ? timelineData?.windows?.length ? 'windows' : 'rows'
    : mode;
  const nodes = timelineData?.[dataMode] || [];
  const [visualZoom, setVisualZoom] = useState(1);
  const [activityFilter, setActivityFilter] = useState('all');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [viewMode, setViewMode] = useState('graph');
  const [selectedMetrics, setSelectedMetrics] = useState(TIMELINE_METRICS.map(({ id }) => id));
  const [dates, setDates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedAnchor, setSelectedAnchor] = useState(null);
  const [nodePopupOpen, setNodePopupOpen] = useState(false);
  const truncatedSources = Object.entries(timelineData?.truncated || {})
    .filter(([, value]) => value)
    .map(([source]) => source);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    api.listDoctorPatients()
      .then((data) => {
        if (!active) return;
        setPatients(data);
        setSelectedPatient((current) => current || data[0]?._id || '');
      })
      .catch((reason) => {
        if (active) setError(reason.message || 'Daftar pasien gagal dimuat.');
      })
      .finally(() => {
        if (active) setLoadingPatients(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedPatient) {
      setTimelineData(null);
      setDates([]);
      setNodePopupOpen(false);
      setSelectedAnchor(null);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    setSelectedId('');
    setSelectedAnchor(null);
    setNodePopupOpen(false);
    api.listDoctorCaparTemporalTimeline(selectedPatient, selectedDate, dateMode === 'all')
      .then((result) => {
        if (!active) return;
        setTimelineData(result);
        setDates(result.dates || []);
        if (result.selected_date && !selectedDate) setSelectedDate(result.selected_date);
        setActivityFilter('all');
        setDeviceFilter('all');
      })
      .catch((reason) => {
        if (active) {
          setTimelineData(null);
          setError(reason.message || 'Visualisasi CAPAR gagal dimuat.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedPatient, selectedDate, dateMode, reloadKey]);

  const filteredNodes = useMemo(() => nodes.filter((node) => (
      (activityFilter === 'all' || getNodeActivity(node, dataMode) === activityFilter)
      && (deviceFilter === 'all' || String(node.device_id || 'UNKNOWN') === deviceFilter)
  )), [nodes, dataMode, activityFilter, deviceFilter]);
  const activityNames = useMemo(() => (
      [...new Set(nodes.map((node) => getNodeActivity(node, dataMode)))].sort()
  ), [nodes, dataMode]);
  const deviceNames = useMemo(() => (
      [...new Set((timelineData?.[dataMode] || []).map((node) => String(node.device_id || 'UNKNOWN')))].sort()
  ), [timelineData, dataMode]);
  const orderedFilteredNodes = useMemo(() => [...filteredNodes].sort((first, second) => (
      getNodeTime(first, dataMode) - getNodeTime(second, dataMode)
      || getNodeId(first, dataMode).localeCompare(getNodeId(second, dataMode))
  )), [filteredNodes, dataMode]);
  const selectedNode = orderedFilteredNodes.find((node) => getNodeId(node, dataMode) === selectedId)
    || orderedFilteredNodes[0]
    || null;
  const resolvedSelectedId = selectedNode ? getNodeId(selectedNode, dataMode) : '';
  const selectedIndex = selectedNode
    ? orderedFilteredNodes.findIndex((node) => getNodeId(node, dataMode) === resolvedSelectedId)
    : -1;
  const previousNode = selectedIndex > 0 ? orderedFilteredNodes[selectedIndex - 1] : null;
  const nextNode = selectedIndex >= 0 && selectedIndex < orderedFilteredNodes.length - 1
    ? orderedFilteredNodes[selectedIndex + 1]
    : null;
  const selectedBaseline = selectedNode && dataMode === 'windows'
    ? timelineData?.baselines?.find((baseline) => (
      baseline.activity === (selectedNode.activity_label || 'Unknown')
      && (!selectedNode.time_period || baseline.time_period === selectedNode.time_period)
    ))
    : null;
  const temporalEdges = timelineData?.temporal_edges?.[dataMode] || [];
  const selectedEdge = temporalEdges.find((edge) => edge.node_id === resolvedSelectedId) || null;
  const allLevelNodes = timelineData?.[dataMode] || [];
  const parentMode = dataMode === 'rows' ? 'windows' : dataMode === 'windows' ? 'activities' : null;
  const parentId = dataMode === 'rows'
    ? selectedNode?.parent_window_id
    : selectedNode?.parent_episode_id;
  const parentNode = parentMode && parentId
    ? (timelineData?.[parentMode] || []).find((node) => getNodeId(node, parentMode) === String(parentId)) || null
    : null;
  const childMode = dataMode === 'rows' ? null : dataMode === 'windows' ? 'rows' : 'windows';
  const childNodes = !selectedNode || !childMode
    ? []
    : (timelineData?.[childMode] || []).filter((node) => (
      dataMode === 'windows'
        ? String(node.parent_window_id || '') === String(selectedNode._id)
        : String(node.parent_episode_id || '') === String(selectedNode.episode_key || selectedNode._id)
    ));
  const timelineAnchors = timelineData?.anchors || [];
  const visibleTimelineAnchors = deviceFilter === 'all'
    ? timelineAnchors
    : timelineAnchors.filter((anchor) => (
      anchor.device_id === deviceFilter || anchor.device_id === 'ALL'
    ));
  const contextLabel = [
    'CAPAR TEMPORAL TIMELINE',
    `User ${timelineData?.user_id || selectedPatient}`,
    `Device ${deviceFilter === 'all' ? 'semua' : deviceFilter}`,
    dateMode === 'all' ? 'seluruh hari' : selectedDate,
  ].filter(Boolean).join(' · ');
  const fullContextLabel = [
    'CAPAR TEMPORAL TIMELINE · FULL RANGE',
    `User ${timelineData?.user_id || selectedPatient}`,
    'Semua device',
    dateMode === 'all' ? 'seluruh hari' : selectedDate,
  ].filter(Boolean).join(' · ');

  function selectNode(nodeId, targetMode = dataMode) {
    if (targetMode !== mode) setMode(targetMode);
    setSelectedId(nodeId);
    setNodePopupOpen(true);
  }

  async function exportPng(type) {
    setError('');
    try {
      await downloadTimelinePng(
        type,
        `capar-${type}-${selectedPatient}-${selectedDate || 'all-days'}.png`,
      );
    } catch (reason) {
      setError(reason.message || 'Ekspor PNG gagal.');
    }
  }

  function exportCsv() {
    if (!timelineData) return;
    const blob = new Blob([createTemporalCsv(timelineData)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `capar-timeline-${selectedPatient}-${selectedDate || 'all-days'}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function rebuildEpisodes() {
    if (!selectedPatient || rebuilding) return;
    setRebuilding(true);
    setError('');
    setNotice('');
    try {
      const result = await api.rebuildDoctorCaparActivityEpisodes(
        selectedPatient,
        selectedDate,
        dateMode === 'all',
      );
      setNotice(result.message || 'Agregat episode aktivitas diperbarui.');
      setReloadKey((key) => key + 1);
    } catch (reason) {
      setError(reason.message || 'Agregat episode aktivitas gagal dibuat.');
    } finally {
      setRebuilding(false);
    }
  }

  const modeDescription = mode === 'overview'
    ? 'Day overview menyinkronkan data raw, window, episode, anchor, dan sesi device pada rentang waktu yang sama.'
    : mode === 'rows'
    ? 'Setiap node mewakili satu baris PolarData; kelompok mengikuti urutan aktivitas dan waktu.'
    : mode === 'windows'
      ? 'Setiap node mewakili satu window CAPAR; perubahan aktivitas berdasarkan timestamp memulai kelompok baru.'
      : 'Satu node mewakili satu episode aktivitas; ringkasan dan time series tersimpan di MongoDB.';

  return (
    <section className="capar-visual-page">
      <SectionHeading
        eyebrow="SCIENTIFIC MONITORING · CAPAR"
        title="Temporal Visualization"
        description="Visualisasi temporal multis skala dari raw measurements, window CAPAR, episode aktivitas, anchor, dan device signal."
        action={(
          <button
            className="button button-light capar-visual-print"
            disabled={loading || !nodes.length}
            onClick={() => window.print()}
            type="button"
          >
            <Printer size={16} /> Cetak / simpan PDF
          </button>
        )}
      />

      <div className="panel capar-visual-toolbar">
        <label>
          Pasien
          <select
            disabled={loadingPatients}
            onChange={(event) => {
              setSelectedPatient(event.target.value);
              setSelectedDate('');
            }}
            value={selectedPatient}
          >
            <option value="">Pilih pasien</option>
            {patients.map((patient) => (
              <option key={patient._id} value={patient._id}>
                {patient.name || patient.email} · {patient.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rentang hari
          <select
            onChange={(event) => setDateMode(event.target.value)}
            value={dateMode}
          >
            <option value="day">Satu hari</option>
            <option value="all">Gabungkan semua hari</option>
          </select>
        </label>
        {dateMode === 'day' && (
          <label>
            Tanggal
            <select
              onChange={(event) => setSelectedDate(event.target.value)}
              value={selectedDate}
            >
              {dates.length === 0 && <option value="">Belum ada data</option>}
              {dates.map((date) => <option key={date} value={date}>{date}</option>)}
            </select>
          </label>
        )}
        {deviceNames.length > 0 && (
          <label>
            Device
            <select
              onChange={(event) => {
                setDeviceFilter(event.target.value);
                setSelectedId('');
                setNodePopupOpen(false);
              }}
              value={deviceFilter}
            >
              <option value="all">Semua device</option>
              {deviceNames.map((device) => <option key={device} value={device}>{device}</option>)}
            </select>
          </label>
        )}
        {dataMode === 'activities' && (
          <button
            className="button button-primary"
            disabled={loading || rebuilding || !selectedPatient}
            onClick={rebuildEpisodes}
            type="button"
          >
            {rebuilding ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
            Bangun ulang agregat
          </button>
        )}
        <button
          aria-label="Muat ulang node"
          className="button button-light"
          disabled={loading}
          onClick={() => setReloadKey((key) => key + 1)}
          title="Muat ulang node"
          type="button"
        >
          {loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
          Perbarui
        </button>
      </div>

      <nav className="capar-visual-tabs" aria-label="Tingkat visualisasi CAPAR">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            aria-pressed={mode === id}
            className={mode === id ? 'is-active' : ''}
            key={id}
            onClick={() => {
              setMode(id);
              setSelectedId('');
              setSelectedAnchor(null);
              setNodePopupOpen(false);
            }}
            type="button"
          >
            <Icon size={16} />{label}
          </button>
        ))}
      </nav>

      <div className="capar-export-toolbar" aria-label="Ekspor temporal visualization">
        <button className="button button-light" disabled={loading || !timelineData?.rows?.length} onClick={() => exportPng('full')} type="button">
          Export Full Timeline PNG
        </button>
        <button className="button button-light" disabled={loading || !nodes.length} onClick={() => exportPng('current')} type="button">
          Export Current View PNG
        </button>
        <button className="button button-light" disabled={loading || !timelineData} onClick={() => window.print()} type="button">
          <Printer size={15} /> Export PDF
        </button>
        <button className="button button-light" disabled={loading || !timelineData} onClick={exportCsv} type="button">
          Export Data CSV
        </button>
      </div>

      <section className="panel capar-visual-main">
        <div className="capar-visual-heading">
          <div>
            <span className="eyebrow">NODE SEMANTIK · WIB</span>
            <h2>{MODES.find((item) => item.id === mode)?.label}</h2>
            <p>{modeDescription}</p>
          </div>
          <div className="capar-visual-count">
            <strong>{mode === 'overview'
              ? (timelineData?.count?.rows || 0).toLocaleString('id-ID')
              : filteredNodes.length.toLocaleString('id-ID')}</strong>
            <span>{mode === 'overview' ? 'raw measurements' : 'node ditampilkan'}</span>
            {mode === 'overview' && (
              <small>
                {timelineData?.count?.windows || 0} windows · {timelineData?.count?.activities || 0} episodes
              </small>
            )}
          </div>
        </div>

        {nodes.length > 0 && (
          <div className="capar-visual-zoom-toolbar" aria-label="Pengaturan zoom visualisasi">
            <ZoomControl label="Grafik & node" onChange={setVisualZoom} value={visualZoom} />
          </div>
        )}

        {activityNames.length > 0 && (
          <div className="capar-visual-filters" aria-label="Filter aktivitas">
            <label htmlFor="capar-visual-activity">Aktivitas</label>
            <select
              id="capar-visual-activity"
              onChange={(event) => {
                setActivityFilter(event.target.value);
                setSelectedId('');
                setNodePopupOpen(false);
              }}
              value={activityFilter}
            >
              <option value="all">Semua aktivitas</option>
              {activityNames.map((activity) => <option key={activity} value={activity}>{activity}</option>)}
            </select>
            <span>Opsional · default menampilkan semua aktivitas.</span>
          </div>
        )}
        <p className="capar-visual-all-activities">
          Hari overview memuat seluruh aktivitas tanpa filter aktif. Filter aktivitas/device bersifat opsional.
        </p>

        <nav className="capar-timeline-view-tabs" aria-label="Tampilan timeline">
          {TIMELINE_VIEWS.map((view) => (
            <button
              aria-pressed={viewMode === view.id}
              className={viewMode === view.id ? 'is-active' : ''}
              key={view.id}
              onClick={() => setViewMode(view.id)}
              type="button"
            >
              {view.label}
            </button>
          ))}
        </nav>

        {viewMode !== 'table' && (
          <div className="capar-metric-filters" aria-label="Pilih lane metrik">
            <strong>Metric lanes</strong>
            {TIMELINE_METRICS.map((metric) => (
              <label key={metric.id}>
                <input
                  checked={selectedMetrics.includes(metric.id)}
                  onChange={(event) => setSelectedMetrics((current) => (
                    event.target.checked
                      ? [...new Set([...current, metric.id])]
                      : current.filter((value) => value !== metric.id)
                  ))}
                  type="checkbox"
                />
                {metric.label}
              </label>
            ))}
          </div>
        )}

        {loading && (
          <div className="capar-visual-loading"><LoaderCircle className="spin" size={20} />Memuat data CAPAR…</div>
        )}
        {error && <div className="capar-visual-error" role="alert"><AlertCircle size={16} />{error}</div>}
        {notice && <p className="capar-visual-notice" role="status">{notice}</p>}
        {!loading && mode === 'activities' && !nodes.length && !error && (
          <div className="capar-visual-build-hint">
            <CalendarDays size={18} />
            <span>Agregat episode aktivitas untuk rentang ini belum dibuat. Jalankan “Bangun ulang agregat” untuk menyimpan time series dari window CAPAR.</span>
          </div>
        )}
        {!loading && truncatedSources.length > 0 && (
          <p className="capar-visual-truncated">
            Data sumber {truncatedSources.join(', ')} melampaui batas 50.000 dokumen dan dipotong; anchor, relasi, CSV, atau timeline yang bergantung padanya mungkin belum lengkap.
          </p>
        )}
        {!loading && (
          <>
            {viewMode === 'table' ? (
              <>
                <TemporalDataTable
                  mode={dataMode}
                  nodes={filteredNodes}
                  onSelect={selectNode}
                  selectedId={resolvedSelectedId}
                />
                <div className="capar-export-current-hidden">
                  <AnchoredTimelineChart
                    anchors={visibleTimelineAnchors}
                    baseline={selectedBaseline}
                    contextLabel={contextLabel}
                    exportType="current"
                    focusId={selectedId}
                    mode={dataMode}
                    nodes={filteredNodes}
                    onAnchorSelect={setSelectedAnchor}
                    onSelect={selectNode}
                    selectedId={resolvedSelectedId}
                    selectedMetrics={selectedMetrics}
                    zoom={visualZoom}
                    windows={timelineData?.windows || []}
                    activities={timelineData?.activities || []}
                    deviceFilter={deviceFilter}
                  />
                </div>
              </>
            ) : (
              <>
                <AnchoredTimelineChart
                  anchors={visibleTimelineAnchors}
                  baseline={selectedBaseline}
                  contextLabel={contextLabel}
                  exportType="current"
                  focusId={selectedId}
                  mode={dataMode}
                  nodes={filteredNodes}
                  onAnchorSelect={setSelectedAnchor}
                  onSelect={selectNode}
                  selectedId={resolvedSelectedId}
                  selectedMetrics={selectedMetrics}
                  zoom={visualZoom}
                  windows={timelineData?.windows || []}
                  activities={timelineData?.activities || []}
                  deviceFilter={deviceFilter}
                />
                {viewMode === 'graph' && (
                  <CaparNodeField
                    activityFilter={activityFilter}
                    deviceFilter={deviceFilter}
                    mode={dataMode}
                    nodes={nodes}
                    onSelect={selectNode}
                    selectedId={resolvedSelectedId}
                    zoom={visualZoom}
                  />
                )}
              </>
            )}
          </>
        )}
        {!loading && (
          <TemporalAnchorList
            anchors={visibleTimelineAnchors}
            onSelect={setSelectedAnchor}
            selectedAnchor={selectedAnchor}
          />
        )}
        {!loading && (
          <DeviceSessionList
            deviceFilter={deviceFilter}
            sessions={timelineData?.device_sessions || []}
          />
        )}
        {!loading && (
          <div className="capar-export-full">
            <AnchoredTimelineChart
              anchors={timelineAnchors}
              baseline={null}
              contextLabel={fullContextLabel}
              exportType="full"
              focusId=""
              mode={dataMode}
              nodes={nodes}
              onAnchorSelect={() => {}}
              onSelect={() => {}}
              selectedId=""
              selectedMetrics={TIMELINE_METRICS.map(({ id }) => id)}
              zoom={1}
              windows={timelineData?.windows || []}
              activities={timelineData?.activities || []}
              deviceFilter="all"
            />
          </div>
        )}
        <div className="capar-visual-legend">
          <Timer size={14} />
          <span>Panah menunjukkan arah awal → akhir; pilih node untuk popup HRV dan navigasi ke node sebelumnya/berikutnya.</span>
        </div>
      </section>

      {!loading && selectedNode && (
        <DetailPanel
          baseline={selectedBaseline}
          mode={dataMode}
          nextNode={nextNode}
          node={selectedNode}
        />
      )}
      {!loading && selectedNode && (
        <NodeRelationshipPanel
          allNodes={allLevelNodes}
          childNodes={childNodes}
          edge={selectedEdge}
          mode={dataMode}
          node={selectedNode}
          onNavigate={(targetMode, nodeId) => selectNode(nodeId, targetMode)}
          onDrillMode={(targetMode) => {
            setMode(targetMode);
            setSelectedId('');
            setNodePopupOpen(false);
          }}
          parentNode={parentNode}
        />
      )}
      {!loading && nodePopupOpen && selectedNode && (
        <NodeDetailPopup
          index={selectedIndex}
          mode={dataMode}
          nextNode={nextNode}
          node={selectedNode}
          onClose={() => setNodePopupOpen(false)}
          onNavigate={selectNode}
          previousNode={previousNode}
          total={orderedFilteredNodes.length}
        />
      )}
      <p className="capar-visual-disclaimer">
        Visualisasi menyajikan data sensor dan ringkasan observasional; interpretasi bukan diagnosis klinis.
      </p>
    </section>
  );
}
