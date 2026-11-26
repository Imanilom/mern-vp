import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import {
  analyzeDynamicProfile,
  buildDynamicProfileGraph,
  buildRecoveryTrajectory,
  DYNAMIC_ANALYSIS_POLICY,
  fitDynamicModel,
  getJakartaDay,
  parseDynamicAnalysisCsv,
  prepareDynamicWindow,
} from '../utils/caparDynamicAnalysis.js';

const STATE_NAMES = ['zHR', 'defisit lnRMSSD', 'defisit DFA α1'];
const EIGEN_COLORS = ['#397b69', '#547fb4', '#b45d69'];
const PROFILE_SCOPES = [
  { id: 'person', label: '01 · Per individu' },
  { id: 'day', label: '02 · Per hari' },
  { id: 'activity', label: '03 · Per aktivitas' },
  { id: 'window', label: '04 · Per window' },
];

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)).toLocaleString('id-ID') : '—';
}

function formatTime(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getLocalTimePeriod(timestamp) {
  if (!Number.isFinite(timestamp)) return null;
  const hour = new Date(timestamp + (7 * 60 * 60 * 1000)).getUTCHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function getEpisodeId(episode) {
  return String(episode?._id || '');
}

function getEpisodeWindowIds(episode, physiologicalEpisodes) {
  const ids = new Set((episode?.segment_ids || []).map(String));
  if (ids.size || !episode?.parent_episode_id) return ids;
  const parentId = String(episode.parent_episode_id);
  const parentEpisode = physiologicalEpisodes.find((item) => String(item._id || '') === parentId);
  (parentEpisode?.segment_ids || []).forEach((id) => ids.add(String(id)));
  return ids;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarizeDynamicModel(model, {
  windows = 0,
  valid = 0,
  recoveries = [],
  ttrValues = recoveries.map((recovery) => recovery.ttr),
} = {}) {
  const audit = model.audit || {};
  const finiteTtrs = ttrValues.filter(Number.isFinite);
  return {
    windows,
    valid,
    episodes: audit.episode_count || 0,
    pairs: audit.pair_count || 0,
    rank: audit.rank || 0,
    condition: audit.condition_number,
    confirmed: finiteTtrs.length,
    ttr: median(finiteTtrs),
    recovery: recoveries,
    A: model.matrix,
    modes: (model.modes || []).map((mode) => ({
      re: mode.re,
      im: mode.im,
      abs: mode.magnitude,
      tau: mode.tauMinutes,
      period: mode.periodMinutes,
    })),
    rho: audit.spectral_radius,
    stable: model.stable,
    rmse: audit.rmse,
    tau: model.dominantTauMinutes,
    status: model.status,
    reason: model.reason,
    audit,
  };
}

function summarizeRecovery(episode, windows, baselines, physiologicalEpisodes) {
  const result = buildRecoveryTrajectory(episode, windows, baselines, physiologicalEpisodes);
  const startTimestamp = result.points[0]?.timestamp;
  return {
    id: getEpisodeId(episode),
    entry: Number.isFinite(result.firstEntryTimestamp) && Number.isFinite(startTimestamp)
      ? (result.firstEntryTimestamp - startTimestamp) / 60_000
      : null,
    ttr: result.ttrMinutes,
    status: result.status,
  };
}

function makeWindowProfile(window, participant, episodeId, baselines) {
  if (!window) return null;
  const prepared = prepareDynamicWindow(window, baselines);
  const timestamp = prepared.timestamp;
  const timePeriod = window.time_period || getLocalTimePeriod(timestamp);
  const baseline = baselines.find((item) => (
    item.activity === (window.activity_label || 'Unknown')
    && item.time_period === timePeriod
  ));
  const quality = prepared.quality;
  const rmssdMean = baseline?.stats?.rmssd?.mean;
  const rmssdStd = baseline?.stats?.rmssd?.std;
  return {
    participant,
    day: getJakartaDay(timestamp),
    episode: episodeId || window.parent_episode_id || '',
    activity: window.activity_label || 'Unknown',
    context: window.context || null,
    window: String(window._id || ''),
    timestamp: timestamp === null ? null : new Date(timestamp).toISOString(),
    hr: window.features?.mean_hr ?? null,
    rmssd: window.features?.rmssd ?? null,
    dfa: window.features?.dfa_alpha1 ?? null,
    acc: window.features?.motion_intensity ?? null,
    quality: quality.signalQuality === null || quality.completeness === null
      ? null
      : Math.min(quality.signalQuality, quality.completeness),
    hr_base: baseline?.stats?.mean_hr?.mean ?? null,
    hr_sd: baseline?.stats?.mean_hr?.std ?? null,
    rmssd_base: rmssdMean ?? null,
    lnrmssd_sd: Number.isFinite(rmssdMean) && Number.isFinite(rmssdStd) && rmssdMean > 0
      ? Math.sqrt(Math.log1p((rmssdStd / rmssdMean) ** 2))
      : null,
    dfa_base: baseline?.stats?.dfa_alpha1?.mean ?? null,
    dfa_sd: baseline?.stats?.dfa_alpha1?.std ?? null,
  };
}

function Metric({ label, value, detail }) {
  return (
    <div className="capar-dynamic-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function RecoveryChart({ recovery }) {
  const plot = useMemo(() => {
    const valid = recovery.points.filter(({ distance }) => Number.isFinite(distance));
    if (!valid.length) return null;
    const maxMinute = Math.max(1, ...recovery.points.map(({ minute }) => minute));
    const maxDistance = Math.max(recovery.threshold * 1.15, ...valid.map(({ distance }) => distance));
    const x = (minute) => 38 + ((minute / maxMinute) * 520);
    const y = (distance) => 168 - ((distance / maxDistance) * 126);
    const segments = [];
    let activeSegment = [];
    recovery.points.forEach((point) => {
      if (!point.eligible || !Number.isFinite(point.distance)) {
        if (activeSegment.length) segments.push(activeSegment);
        activeSegment = [];
        return;
      }
      const previous = activeSegment[activeSegment.length - 1];
      if (previous) {
        const expectedMinutes = point.windowType === '1min' ? 1 : point.windowType === '5min' ? 5 : null;
        const elapsedMinutes = point.minute - previous.minute;
        if (expectedMinutes === null
          || elapsedMinutes <= 0
          || Math.abs(elapsedMinutes - expectedMinutes) > expectedMinutes * 0.25) {
          segments.push(activeSegment);
          activeSegment = [];
        }
      }
      activeSegment.push(point);
    });
    if (activeSegment.length) segments.push(activeSegment);
    return {
      maxMinute,
      thresholdY: y(recovery.threshold),
      segments: segments.map((segment) => segment.map((point) => `${x(point.minute)},${y(point.distance)}`).join(' ')),
      points: valid.map((point) => ({
        ...point,
        x: x(point.minute),
        y: y(point.distance),
      })),
    };
  }, [recovery]);

  if (!plot) {
    return <p className="capar-dynamic-empty">Belum ada window yang lolos quality gate untuk menggambar deviasi.</p>;
  }
  return (
    <svg className="capar-dynamic-chart" viewBox="0 0 580 205" role="img" aria-label="Deviasi terstandardisasi per window selama episode">
      <line x1="38" y1="168" x2="558" y2="168" />
      <line x1="38" y1="28" x2="38" y2="168" />
      <line className="capar-dynamic-threshold" x1="38" y1={plot.thresholdY} x2="558" y2={plot.thresholdY} />
      {plot.segments.map((points, index) => <polyline key={index} points={points} />)}
      {plot.points.map((point) => (
        <circle
          className={point.isConfirmation ? 'is-confirmed' : point.isPeak ? 'is-peak' : ''}
          cx={point.x}
          cy={point.y}
          key={point.index}
          r="4"
        >
          <title>{`Window ${point.index}: D ${formatNumber(point.distance)}, ${formatTime(point.timestamp)}`}</title>
        </circle>
      ))}
      <text x="38" y="188">0 min</text>
      <text x="558" y="188" textAnchor="end">{formatNumber(plot.maxMinute, 1)} min</text>
      <text x="8" y="24">D</text>
      <text x="555" y={plot.thresholdY - 5} textAnchor="end">Ambang D = {formatNumber(recovery.threshold)}</text>
    </svg>
  );
}

function CouplingGraph({ matrix }) {
  if (!matrix) return null;
  const positions = [
    { x: 90, y: 58, label: 'HR' },
    { x: 310, y: 58, label: 'ln RMSSD' },
    { x: 200, y: 205, label: 'DFA α1' },
  ];
  const edges = [];
  matrix.forEach((row, target) => row.forEach((weight, source) => {
    if (source !== target) edges.push({ source, target, weight });
  }));
  return (
    <svg className="capar-coupling-graph" viewBox="0 0 400 260" role="img" aria-label="Graf bobot prediktif antar state">
      <defs>
        <marker id="capar-coupling-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" />
        </marker>
      </defs>
      {edges.map(({ source, target, weight }) => {
        const from = positions[source];
        const to = positions[target];
        const offset = (source + target) % 2 === 0 ? 24 : -24;
        const middleX = (from.x + to.x) / 2 + offset;
        const middleY = (from.y + to.y) / 2 - offset / 2;
        const labelX = (from.x + (2 * middleX) + to.x) / 4;
        const labelY = (from.y + (2 * middleY) + to.y) / 4;
        return (
          <g className={weight < 0 ? 'is-negative' : ''} key={`${source}-${target}`}>
            <path
              d={`M ${from.x} ${from.y} Q ${middleX} ${middleY} ${to.x} ${to.y}`}
              markerEnd="url(#capar-coupling-arrow)"
            />
            <text x={labelX} y={labelY}>{formatNumber(weight, 3)}</text>
          </g>
        );
      })}
      {positions.map((position, index) => (
        <g key={position.label}>
          <circle cx={position.x} cy={position.y} r="34" />
          <text className="capar-coupling-node-label" x={position.x} y={position.y - 3}>{position.label}</text>
          <text className="capar-coupling-self" x={position.x} y={position.y + 13}>
            self {formatNumber(matrix[index][index], 3)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ProfileRelationshipGraph({
  graph,
  onNodeSelect,
  selectedNodeId,
}) {
  if (!graph?.nodes?.length) {
    return <p className="capar-dynamic-empty">Node konteks dan relasi belum tersedia.</p>;
  }
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const shorten = (value, limit = 22) => (
    String(value || '').length > limit ? `${String(value).slice(0, limit - 1)}…` : String(value || '')
  );
  return (
    <div className="capar-profile-graph-scroll">
      <svg
        aria-label="Graf relasi profil dinamis tersimpan"
        className="capar-profile-graph"
        role="img"
        height={graph.height || 500}
        viewBox={`0 0 ${graph.width || 900} ${graph.height || 500}`}
        width={graph.width || 900}
      >
        <defs>
          <marker id="capar-profile-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" />
          </marker>
        </defs>
        {graph.edges.map((edge, index) => {
          const from = nodesById.get(edge.from);
          const to = nodesById.get(edge.to);
          if (!from || !to) return null;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const startScale = 1 / Math.max(
            Math.abs(dx) / ((from.w || 155) / 2),
            Math.abs(dy) / 24,
            1e-6,
          );
          const endScale = 1 / Math.max(
            Math.abs(dx) / (((to.w || 155) / 2) + 5),
            Math.abs(dy) / 29,
            1e-6,
          );
          const startX = from.x + (dx * startScale);
          const startY = from.y + (dy * startScale);
          const endX = to.x - (dx * endScale);
          const endY = to.y - (dy * endScale);
          return (
            <g className="capar-profile-edge" key={`${edge.from}-${edge.to}-${index}`}>
              <path
                d={`M ${startX} ${startY} L ${endX} ${endY}`}
                markerEnd="url(#capar-profile-arrow)"
              />
              <text x={(startX + endX) / 2} y={(startY + endY) / 2 - 5}>{edge.rel}</text>
            </g>
          );
        })}
        {graph.nodes.map((node) => (
          <g
            aria-label={`${node.title}. ${node.sub || ''}`}
            aria-pressed={selectedNodeId === node.id}
            className={`capar-profile-node is-${node.type}${selectedNodeId === node.id ? ' is-selected' : ''}`}
            key={node.id}
            onClick={() => onNodeSelect?.(node)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onNodeSelect?.(node);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <title>{node.info || node.title}</title>
            <rect
              height="48"
              rx="12"
              width={node.w || 155}
              x={node.x - ((node.w || 155) / 2)}
              y={node.y - 24}
            />
            <text className="capar-profile-node-title" x={node.x} y={node.y - 4}>
              {shorten(node.title)}
            </text>
            <text className="capar-profile-node-sub" x={node.x} y={node.y + 14}>
              {shorten(node.sub, 25)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function EigenvalueChart({ modes }) {
  const scale = 86;
  const centerX = 120;
  const centerY = 112;
  return (
    <svg className="capar-eigen-chart" viewBox="0 0 240 230" role="img" aria-label="Eigenvalue pada bidang kompleks dengan lingkaran satuan">
      <circle className="capar-eigen-unit-circle" cx={centerX} cy={centerY} r={scale} />
      <line x1={centerX - scale - 8} y1={centerY} x2={centerX + scale + 8} y2={centerY} />
      <line x1={centerX} y1={centerY - scale - 8} x2={centerX} y2={centerY + scale + 8} />
      <text x={centerX + scale} y={centerY + 15}>Re(λ)</text>
      <text x={centerX + 5} y={centerY - scale + 2}>Im(λ)</text>
      {modes.map((mode, index) => (
        <circle
          cx={centerX + (mode.re * scale)}
          cy={centerY - (mode.im * scale)}
          fill={EIGEN_COLORS[index % EIGEN_COLORS.length]}
          key={`${mode.re}-${mode.im}-${index}`}
          r="5"
        >
          <title>{`λ${index + 1} = ${formatNumber(mode.re, 4)} ${mode.im < 0 ? '−' : '+'} ${formatNumber(Math.abs(mode.im), 4)}i`}</title>
        </circle>
      ))}
    </svg>
  );
}

function DailyProfileChart({ daily, episodes }) {
  const points = daily
    .map((item) => {
      const eventTimes = episodes
        .filter((episode) => (
          getJakartaDay(episode.onset_time) === item.day
          && (episode.activity || 'Unknown') === item.activity
        ))
        .map((episode) => Number(episode.ttr_min))
        .filter(Number.isFinite);
      return { ...item, ttr: median(eventTimes) };
    })
    .filter((item) => Number.isFinite(item.dominantTauMinutes));
  if (points.length < 2) {
    return <p className="capar-dynamic-empty">Perlu estimasi layak pada sedikitnya dua hari untuk membandingkan profil dinamika.</p>;
  }
  const maxY = Math.max(1, ...points.flatMap(({ dominantTauMinutes, ttr }) => [dominantTauMinutes, ttr || 0]));
  const maxX = points.length - 1;
  const x = (index) => 36 + ((index / maxX) * 510);
  const y = (value) => 126 - ((value / maxY) * 92);
  return (
    <svg className="capar-profile-chart" viewBox="0 0 580 160" role="img" aria-label="Riwayat konstanta waktu dan waktu pemulihan median per hari">
      <line x1="36" y1="126" x2="546" y2="126" />
      <line x1="36" y1="25" x2="36" y2="126" />
      <polyline className="is-tau" points={points.map((point, index) => `${x(index)},${y(point.dominantTauMinutes)}`).join(' ')} />
      <polyline className="is-ttr" points={points.filter(({ ttr }) => ttr !== null).map((point) => `${x(points.indexOf(point))},${y(point.ttr)}`).join(' ')} />
      {points.map((point, index) => (
        <g key={`${point.day}-${point.activity}`}>
          <circle cx={x(index)} cy={y(point.dominantTauMinutes)} r="3.5" />
          {point.ttr !== null && <circle className="is-ttr-point" cx={x(index)} cy={y(point.ttr)} r="3.5" />}
          <text x={x(index)} y="145" textAnchor="middle">{point.day.slice(5)}</text>
        </g>
      ))}
    </svg>
  );
}

export default function CaparDynamicAnalysis({
  patientId = '',
  patientLabel = '',
  windows = [],
  baselines = [],
  activities = [],
  physiologicalEpisodes = [],
  scope = 'person',
  selectedDate = '',
  dateMode = 'day',
  activityFilter = 'all',
  deviceFilter = 'all',
  selectedEpisodeId = '',
  selectedWindowId = '',
  onScopeChange = () => {},
  onDayChange = () => {},
  onActivityChange = () => {},
  onEpisodeChange = () => {},
  onWindowChange = () => {},
}) {
  const [importedSource, setImportedSource] = useState(null);
  const [importError, setImportError] = useState('');
  const [historyTimeline, setHistoryTimeline] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [mongoProfile, setMongoProfile] = useState(null);
  const [profileSaveState, setProfileSaveState] = useState({ status: 'idle', message: '' });
  const [selectedProfileNodeId, setSelectedProfileNodeId] = useState('person');
  const activeWindows = importedSource?.data.windows || windows;
  const activeBaselines = importedSource?.data.baselines || baselines;
  const activeActivities = importedSource?.data.activities || activities;
  const isImported = Boolean(importedSource);

  useEffect(() => {
    if (!patientId || isImported || dateMode !== 'day') {
      setHistoryTimeline(null);
      setHistoryError('');
      setHistoryLoading(false);
      return undefined;
    }
    let active = true;
    setHistoryLoading(true);
    setHistoryError('');
    api.listDoctorCaparTemporalTimeline(patientId, null, true, '', false)
      .then((result) => {
        if (active) setHistoryTimeline(result);
      })
      .catch((error) => {
        if (active) {
          setHistoryTimeline(null);
          setHistoryError(error.message || 'Riwayat profil CAPAR gagal dimuat.');
        }
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => { active = false; };
  }, [patientId, isImported, dateMode]);
  const historyWindows = isImported
    ? activeWindows
    : historyTimeline?.windows || activeWindows;
  const historyActivities = isImported
    ? activeActivities
    : historyTimeline?.activities || activeActivities;
  const historyBaselines = isImported
    ? activeBaselines
    : historyTimeline?.baselines || activeBaselines;
  const historyEpisodes = useMemo(() => (
    isImported
      ? []
      : (historyTimeline?.episodes || physiologicalEpisodes).filter((episode) => (
        (deviceFilter === 'all' || String(episode.device_id || 'UNKNOWN') === deviceFilter)
        && (activityFilter === 'all' || (episode.activity || 'Unknown') === activityFilter)
      ))
  ), [isImported, historyTimeline, physiologicalEpisodes, deviceFilter, activityFilter]);
  const sourceWindows = !isImported && scope === 'person' ? historyWindows : activeWindows;
  const sourceActivities = !isImported && scope === 'person' ? historyActivities : activeActivities;
  const sourceBaselines = !isImported && scope === 'person' ? historyBaselines : activeBaselines;
  const scopedWindows = useMemo(() => {
    let result = isImported
      ? [...sourceWindows]
      : sourceWindows.filter((window) => (
        (deviceFilter === 'all' || String(window.device_id || 'UNKNOWN') === deviceFilter)
        && (activityFilter === 'all' || (window.activity_label || 'Unknown') === activityFilter)
      ));
    if (!isImported && (scope === 'day' || scope === 'activity' || scope === 'window'
      || (dateMode === 'day' && scope !== 'person'))) {
      result = result.filter((window) => getJakartaDay(window.window_start) === selectedDate);
    }
    if (selectedEpisodeId && !isImported && scope === 'window') {
      const selectedEpisode = historyEpisodes.find((episode) => getEpisodeId(episode) === selectedEpisodeId);
      const ids = getEpisodeWindowIds(selectedEpisode, historyEpisodes);
      if (ids.size) result = result.filter((window) => ids.has(String(window._id)));
    }
    if (selectedWindowId && !isImported && scope === 'window') {
      const run = analyzeDynamicProfile({
        windows: result,
        baselines: sourceBaselines,
        activities: sourceActivities,
        activity: 'all',
      }).episodes.find((episode) => episode.windows.some((window) => String(window._id) === selectedWindowId));
      result = run?.windows || [];
    }
    return result;
  }, [
    sourceWindows,
    sourceBaselines,
    sourceActivities,
    scope,
    selectedDate,
    dateMode,
    activityFilter,
    deviceFilter,
    selectedEpisodeId,
    selectedWindowId,
    historyEpisodes,
    isImported,
  ]);
  const profile = useMemo(() => analyzeDynamicProfile({
    windows: scopedWindows,
    baselines: sourceBaselines,
    activities: sourceActivities,
    activity: 'all',
  }), [scopedWindows, sourceBaselines, sourceActivities]);
  const scopedEpisodes = useMemo(() => {
    if (isImported) return [];
    let result = [...historyEpisodes];
    if (scope === 'day' || scope === 'activity' || scope === 'window'
      || (dateMode === 'day' && scope !== 'person')) {
      result = result.filter((episode) => getJakartaDay(episode.onset_time) === selectedDate);
    }
    if (selectedWindowId && scope === 'window') {
      result = result.filter((episode) => getEpisodeWindowIds(episode, historyEpisodes).has(selectedWindowId));
    }
    return result;
  }, [
    isImported,
    historyEpisodes,
    scope,
    dateMode,
    selectedDate,
    selectedWindowId,
  ]);
  const selectableWindows = useMemo(() => {
    let result = sourceWindows.filter((window) => (
      (deviceFilter === 'all' || String(window.device_id || 'UNKNOWN') === deviceFilter)
      && (activityFilter === 'all' || (window.activity_label || 'Unknown') === activityFilter)
    ));
    if (!isImported && scope !== 'person') {
      result = result.filter((window) => getJakartaDay(window.window_start) === selectedDate);
    }
    if (selectedEpisodeId && !isImported) {
      const selectedEpisode = historyEpisodes.find((episode) => getEpisodeId(episode) === selectedEpisodeId);
      const ids = getEpisodeWindowIds(selectedEpisode, historyEpisodes);
      if (ids.size) result = result.filter((window) => ids.has(String(window._id)));
    }
    return result.sort((first, second) => (
      Number(first.window_start) - Number(second.window_start)
    ));
  }, [
    sourceWindows,
    deviceFilter,
    activityFilter,
    isImported,
    scope,
    selectedDate,
    selectedEpisodeId,
    historyEpisodes,
  ]);
  const historyProfile = useMemo(() => analyzeDynamicProfile({
    windows: historyWindows.filter((window) => (
      (deviceFilter === 'all' || String(window.device_id || 'UNKNOWN') === deviceFilter)
      && (activityFilter === 'all' || (window.activity_label || 'Unknown') === activityFilter)
    )),
    baselines: historyBaselines,
    activities: historyActivities,
    activity: 'all',
  }), [
    historyWindows,
    historyBaselines,
    historyActivities,
    deviceFilter,
    activityFilter,
  ]);
  const selectedEpisode = !isImported
    ? scopedEpisodes.find((episode) => getEpisodeId(episode) === selectedEpisodeId)
      || [...scopedEpisodes].sort((first, second) => (
        Number(second.onset_time) - Number(first.onset_time)
      ))[0]
    : null;
  const recovery = selectedEpisode
    ? buildRecoveryTrajectory(selectedEpisode, sourceWindows, sourceBaselines, historyEpisodes)
    : null;
  const eligibleCount = scopedWindows.filter((window) => (
    prepareDynamicWindow(window, sourceBaselines).eligible
  )).length;
  const rejectionReasons = new Map();
  scopedWindows.forEach((window) => {
    prepareDynamicWindow(window, sourceBaselines).reasons.forEach((reason) => (
      rejectionReasons.set(reason, (rejectionReasons.get(reason) || 0) + 1)
    ));
  });
  const baselineContexts = new Map();
  scopedWindows.forEach((window) => {
    const parameters = prepareDynamicWindow(window, sourceBaselines);
    const timePeriod = window.time_period || getLocalTimePeriod(parameters.timestamp);
    const baseline = sourceBaselines.find((item) => (
      item.activity === (window.activity_label || 'Unknown')
      && item.time_period === timePeriod
    ));
    if (baseline) baselineContexts.set(`${baseline.activity}\u0000${baseline.time_period}`, baseline);
  });
  const commonBaseline = baselineContexts.size === 1 ? [...baselineContexts.values()][0] : null;
  const model = profile.overall;
  const activityNames = [...new Set(historyProfile.episodes.map((episode) => episode.activity))];
  const comparisonActivity = activityFilter !== 'all'
    ? activityFilter
    : activityNames.length === 1
      ? activityNames[0]
      : '';
  const dailyForActivity = historyProfile.daily.filter((item) => (
    item.activity === comparisonActivity
    && item.status === 'ESTIMASI'
    && item.audit.baseline_context_count === 1
  ));
  const comparisonBaselineKey = dailyForActivity[0]?.audit.baseline_context_keys?.[0] || '';
  const stableDaily = comparisonBaselineKey
    ? dailyForActivity.filter((item) => (
      item.audit.baseline_context_keys?.[0] === comparisonBaselineKey
    ))
    : [];
  const comparisonDaily = stableDaily;
  const firstDaily = stableDaily[0];
  const lastDaily = stableDaily[stableDaily.length - 1];
  const tauChange = firstDaily && lastDaily
    ? lastDaily.dominantTauMinutes - firstDaily.dominantTauMinutes
    : null;
  const selectedWindow = useMemo(() => (
    (selectedWindowId
      ? scopedWindows.find((window) => String(window._id) === String(selectedWindowId))
      : null)
    || scopedWindows[scopedWindows.length - 1]
    || null
  ), [scopedWindows, selectedWindowId]);
  const recoverySummaries = useMemo(
    () => scopedEpisodes.map((episode) => summarizeRecovery(
      episode,
      sourceWindows,
      sourceBaselines,
      historyEpisodes,
    )),
    [scopedEpisodes, sourceWindows, sourceBaselines, historyEpisodes],
  );
  const ttrMedian = median(recoverySummaries
    .map(({ ttr }) => ttr)
    .filter(Number.isFinite));
  const selectedWindowProfile = useMemo(() => makeWindowProfile(
    selectedWindow,
    patientLabel || patientId,
    selectedEpisode?._id || selectedEpisodeId,
    sourceBaselines,
  ), [selectedWindow, patientLabel, patientId, selectedEpisode, selectedEpisodeId, sourceBaselines]);
  const profileGraph = useMemo(() => buildDynamicProfileGraph({
    participant: patientLabel || patientId,
    scope,
    day: selectedDate,
    windows: scopedWindows,
    activity: activityFilter,
    episodes: scopedEpisodes,
    selectedEpisode,
    selectedWindow,
    selectedWindowAttributes: selectedWindowProfile,
    selectedWindowState: selectedWindow
      ? prepareDynamicWindow(selectedWindow, sourceBaselines)
      : null,
    model,
    profileTau: model.dominantTauMinutes,
    ttrMedian,
  }), [
    patientLabel,
    patientId,
    scope,
    selectedDate,
    scopedWindows,
    activityFilter,
    selectedWindow,
    selectedWindowProfile,
    selectedEpisode,
    scopedEpisodes,
    sourceBaselines,
    model,
    ttrMedian,
  ]);
  const historySummary = useMemo(() => [...new Set(
    historyProfile.episodes.map((episode) => episode.day).filter(Boolean),
  )].sort().slice(-365).map((day) => {
    const dailyEpisodes = historyProfile.episodes.filter((episode) => episode.day === day);
    const dailyWindows = historyWindows.filter((window) => (
      getJakartaDay(window.window_start) === day
      && (deviceFilter === 'all' || String(window.device_id || 'UNKNOWN') === deviceFilter)
    ));
    const ttrValues = historyEpisodes
      .filter((episode) => getJakartaDay(episode.onset_time) === day)
      .map((episode) => Number(episode.ttr_min))
      .filter(Number.isFinite);
    return {
      day,
      activity: activityFilter,
      ...summarizeDynamicModel(fitDynamicModel(dailyEpisodes), {
        windows: dailyWindows.length,
        valid: dailyWindows.filter((window) => (
          prepareDynamicWindow(window, historyBaselines).eligible
        )).length,
        ttrValues,
      }),
    };
  }), [
    historyProfile,
    historyWindows,
    historyEpisodes,
    historyBaselines,
    deviceFilter,
    activityFilter,
  ]);
  const profileSnapshot = useMemo(() => ({
    source: isImported ? 'demo' : 'mongo',
    scope,
    participant: patientLabel || patientId,
    day: selectedDate || null,
    activity: activityFilter,
    episode: selectedEpisode?._id || selectedEpisodeId || null,
    selectedWindow: selectedWindowProfile,
    modelScope: scope === 'day'
      ? 'Semua aktivitas pada hari terpilih'
      : scope === 'activity'
        ? `Aktivitas ${activityFilter} pada hari terpilih`
        : scope === 'window'
          ? 'Window terpilih dan episode terkait'
          : 'Semua aktivitas dan hari individu',
    generated_at: new Date().toISOString(),
    settings: {
      dtMinutes: model.audit.dt_minutes,
      minQuality: DYNAMIC_ANALYSIS_POLICY.qualityThreshold,
      threshold: DYNAMIC_ANALYSIS_POLICY.distanceThreshold,
      dwell: DYNAMIC_ANALYSIS_POLICY.recoveryDwellWindows,
      minPairs: DYNAMIC_ANALYSIS_POLICY.minimumPairs,
      maxCondition: DYNAMIC_ANALYSIS_POLICY.maximumConditionNumber,
    },
    graph: profileGraph,
    model: summarizeDynamicModel(model, {
      windows: scopedWindows.length,
      valid: eligibleCount,
      recoveries: recoverySummaries,
    }),
    history: historySummary,
  }), [
    isImported,
    scope,
    patientLabel,
    patientId,
    selectedDate,
    activityFilter,
    selectedEpisode,
    selectedEpisodeId,
    selectedWindowProfile,
    model,
    profileGraph,
    scopedWindows.length,
    eligibleCount,
    recoverySummaries,
    historySummary,
  ]);

  useEffect(() => {
    if (!patientId || isImported) {
      setProfileSaveState({
        status: isImported ? 'local' : 'idle',
        message: isImported ? 'CSV lokal tidak disimpan ke MongoDB.' : '',
      });
      return undefined;
    }
    if (dateMode === 'day' && historyLoading) {
      setProfileSaveState({ status: 'loading', message: 'Memuat riwayat untuk profil…' });
      return undefined;
    }
    if (dateMode === 'day' && !historyTimeline && !historyError) {
      setProfileSaveState({ status: 'loading', message: 'Memuat riwayat untuk profil…' });
      return undefined;
    }
    if (historyError) {
      setMongoProfile(null);
      setProfileSaveState({ status: 'error', message: historyError });
      return undefined;
    }
    if (!scopedWindows.length) {
      setMongoProfile(null);
      setProfileSaveState({ status: 'empty', message: 'Belum ada window CAPAR; profil tidak disimpan.' });
      return undefined;
    }

    let active = true;
    setProfileSaveState({ status: 'saving', message: 'Menyimpan profil hasil hitung ke MongoDB…' });
    api.saveDoctorCaparDynamicProfile({
      patient_id: patientId,
      scope,
      date: dateMode === 'day' ? selectedDate : '',
      activity: activityFilter || 'all',
      episode_key: String(selectedEpisode?._id || selectedEpisodeId || ''),
      window_id: String(selectedWindow?._id || ''),
      profile: profileSnapshot,
    })
      .then((result) => {
        if (!active) return;
        setMongoProfile(result.data);
        setProfileSaveState({ status: 'saved', message: 'Tersimpan di MongoDB.' });
      })
      .catch((error) => {
        if (!active) return;
        setMongoProfile(null);
        setProfileSaveState({
          status: 'error',
          message: error.message || 'Profil gagal disimpan ke MongoDB.',
        });
      });
    return () => { active = false; };
  }, [
    patientId,
    isImported,
    dateMode,
    historyLoading,
    historyTimeline,
    historyError,
    scopedWindows.length,
    scope,
    selectedDate,
    activityFilter,
    selectedEpisode,
    selectedEpisodeId,
    selectedWindow,
    profileSnapshot,
  ]);

  const mongoProfileMatches = mongoProfile
    && mongoProfile.scope === scope
    && mongoProfile.analysis_date === (dateMode === 'day' ? selectedDate : '')
    && mongoProfile.activity === (activityFilter || 'all')
    && mongoProfile.episode_key === String(selectedEpisode?._id || selectedEpisodeId || '')
    && mongoProfile.window_id === String(selectedWindow?._id || '');
  const displayedProfileGraph = mongoProfileMatches
    ? mongoProfile.payload?.graph || profileGraph
    : profileSnapshot.graph;
  const selectedProfileNode = displayedProfileGraph?.nodes?.find(
    (node) => node.id === selectedProfileNodeId,
  ) || displayedProfileGraph?.nodes?.[0] || null;

  useEffect(() => {
    if (displayedProfileGraph?.nodes?.some((node) => node.id === selectedProfileNodeId)) return;
    setSelectedProfileNodeId(displayedProfileGraph?.nodes?.[0]?.id || '');
  }, [displayedProfileGraph, selectedProfileNodeId]);

  function handleProfileNodeSelect(node) {
    setSelectedProfileNodeId(node.id);
    if (!node.action) return;
    if (node.action.type === 'day') {
      onScopeChange('day');
      onDayChange(node.action.value);
    } else if (node.action.type === 'activity') {
      onScopeChange('activity');
      onActivityChange(node.action.value);
    } else if (node.action.type === 'episode') {
      onScopeChange('window');
      onEpisodeChange(node.action.value);
    } else if (node.action.type === 'window') {
      onScopeChange('window');
      onWindowChange(node.action.value);
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const data = parseDynamicAnalysisCsv(await file.text());
      setImportedSource({ name: file.name, data });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'CSV gagal diimpor.');
    } finally {
      event.target.value = '';
    }
  }

  return (
    <section className="capar-dynamic-analysis" aria-label="Analisis dinamika CAPAR">
      <div className="capar-dynamic-heading">
        <div>
          <span className="eyebrow">PERSONAL DYNAMIC PROFILE · EKSPLORATIF</span>
          <h3>Analisis dinamika &amp; pemulihan</h3>
          <p>Data window dan baseline yang dipilih; koefisien menunjukkan prediksi lintas window, bukan kausalitas.</p>
        </div>
        <div className="capar-dynamic-import">
          <label className="button button-light">
            Impor CSV CAPAR
            <input accept=".csv,text/csv" onChange={handleImport} type="file" />
          </label>
          {importedSource && (
            <button className="button button-light" onClick={() => setImportedSource(null)} type="button">
              Kembali ke data sistem
            </button>
          )}
        </div>
      </div>
      {importError && <p className="capar-dynamic-error" role="alert">{importError}</p>}
      {importedSource && (
        <p className="capar-dynamic-import-note" role="status">
          Analisis sementara dari {importedSource.name} · {activeWindows.length.toLocaleString('id-ID')} window.
          File hanya diproses di browser dan tidak disimpan atau dikirim ke server.
        </p>
      )}

      <div className="capar-dynamic-selectors">
        <label>
          Episode fisiologis
          <select
            onChange={(event) => onEpisodeChange(event.target.value)}
            value={selectedEpisodeId}
          >
            <option value="">Semua episode</option>
            {scopedEpisodes.map((episode) => {
              const id = getEpisodeId(episode);
              return (
                <option key={id} value={id}>
                  {episode.classification || 'Episode'} · {formatTime(Number(episode.onset_time))}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          Window CAPAR
          <select
            onChange={(event) => onWindowChange(event.target.value)}
            value={selectedWindowId}
          >
            <option value="">Window terbaru / sesuai episode</option>
            {selectableWindows.slice(-300).map((window) => (
              <option key={String(window._id)} value={String(window._id)}>
                {window.activity_label || 'Unknown'} · {formatTime(Number(window.window_start))}
              </option>
            ))}
          </select>
        </label>
      </div>
      <nav className="capar-dynamic-scope-tabs" aria-label="Lingkup knowledge graph">
        {PROFILE_SCOPES.map(({ id, label }) => (
          <button
            aria-pressed={scope === id}
            className={scope === id ? 'is-active' : ''}
            key={id}
            onClick={() => onScopeChange(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="capar-dynamic-metrics">
        <Metric label="Window terpilih" value={scopedWindows.length.toLocaleString('id-ID')} />
        <Metric label="Lolos quality gate" value={eligibleCount.toLocaleString('id-ID')} detail="Q signal & kelengkapan ≥95%" />
        <Metric label="Pasangan valid" value={model.audit.pair_count.toLocaleString('id-ID')} detail={`Δt ${formatNumber(model.audit.dt_minutes, 2)} menit`} />
        <Metric label="τ dominan" value={model.status === 'ESTIMASI' ? `${formatNumber(model.dominantTauMinutes, 2)} m` : '—'} detail={model.status} />
      </div>
      <div className="capar-dynamic-dashboard">
        <div className="capar-dynamic-column">
      <section className="capar-dynamic-panel capar-profile-graph-panel">
        <header>
          <div>
            <span className="eyebrow">G = (V, E) · PROFIL DINAMIS</span>
            <h4>Relasi data dan model tersimpan</h4>
          </div>
          <strong className={`capar-dynamic-status ${profileSaveState.status === 'saved' ? 'is-confirmed' : ''}`}>
            {profileSaveState.status === 'saved'
              ? 'TERSIMPAN'
              : profileSaveState.status === 'saving' || profileSaveState.status === 'loading'
                ? 'MENYIMPAN'
                : profileSaveState.status === 'error'
                  ? 'GAGAL'
                  : profileSaveState.status === 'empty'
                    ? 'DATA KOSONG'
                    : 'LOKAL'}
          </strong>
        </header>
        <p className="capar-dynamic-description">
          {profileSaveState.message || (mongoProfileMatches ? 'Ditampilkan dari dokumen MongoDB.' : 'Graf relasi dari hasil hitung untuk konteks terpilih.')}
        </p>
        <ProfileRelationshipGraph
          graph={displayedProfileGraph}
          onNodeSelect={handleProfileNodeSelect}
          selectedNodeId={selectedProfileNode?.id}
        />
        <div className="capar-dynamic-graph-legend">
          <span><i className="is-context" />Entitas &amp; konteks</span>
          <span><i className="is-observation" />Observasi &amp; fitur</span>
          <span><i className="is-model" />Model &amp; interpretasi</span>
        </div>
        {selectedProfileNode && (
          <div className="capar-profile-node-inspector" aria-live="polite">
            <div>
              <strong>{selectedProfileNode.title}</strong>
              <span>{selectedProfileNode.sub}</span>
            </div>
            {selectedProfileNode.info && <p>{selectedProfileNode.info}</p>}
            {Object.keys(selectedProfileNode.attributes || {}).length > 0 && (
              <dl>
                {Object.entries(selectedProfileNode.attributes).map(([key, value]) => (
                  <Fragment key={key}>
                    <dt>{key.replaceAll('_', ' ')}</dt>
                    <dd>{value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
          </div>
        )}
      </section>
      {profile.episodes.some((episode) => episode.inferredGrouping) && (
        <p className="capar-dynamic-import-note">
          Relasi episode aktivitas tersimpan tidak tersedia untuk sebagian window; pasangan di bawah dikelompokkan per hari, device, tipe window, dan aktivitas.
        </p>
      )}

        <section className="capar-dynamic-panel capar-dynamic-recovery">
          <header>
            <div>
              <span className="eyebrow">OBSERVASI · D STANDARDIZED</span>
              <h4>Lintasan pemulihan episode</h4>
            </div>
            <strong className={`capar-dynamic-status ${recovery?.confirmedTimestamp ? 'is-confirmed' : ''}`}>
              {recovery?.status || 'Pilih episode fisiologis'}
            </strong>
          </header>
          {recovery && (
            <>
              <p className="capar-dynamic-description">
                {selectedEpisode?.classification || 'Episode'} · {formatTime(recovery.peakTimestamp)} ·
                {' '}TTR tercatat {formatNumber(recovery.recordedTtrMinutes)} menit
              </p>
              <RecoveryChart recovery={recovery} />
              <p className="capar-dynamic-note">
                {recovery.confirmedTimestamp
                  ? `TTR menurut aturan D: ${formatNumber(recovery.ttrMinutes)} menit; pertama masuk rentang ${formatTime(recovery.firstEntryTimestamp)}.`
                  : 'TTR belum terkonfirmasi oleh dua window berurutan yang lolos quality gate.'}
                {' '}Aturan D ≤ {formatNumber(recovery.threshold)} selama {recovery.dwellWindows} window bukan ambang klinis.
              </p>
              <div className="capar-dynamic-table-scroll">
                <table className="capar-dynamic-table">
                  <thead><tr><th>Window</th><th>Pusat waktu</th><th>HR</th><th>RMSSD</th><th>DFA α1</th><th>ACC (g)</th><th>D</th><th>Q %</th></tr></thead>
                  <tbody>
                    {recovery.points.map((point) => (
                      <tr key={`${point.timestamp}-${point.index}`}>
                        <td>{point.index}</td>
                        <td>{formatNumber(point.minute, 1)} min</td>
                        <td>{formatNumber(point.hr, 1)}</td>
                        <td>{formatNumber(point.rmssd, 1)}</td>
                        <td>{formatNumber(point.dfa, 3)}</td>
                        <td>{formatNumber(point.motion, 3)}</td>
                        <td>{formatNumber(point.distance, 2)}</td>
                        <td>{formatNumber(point.quality * 100, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!recovery && (
            <p className="capar-dynamic-empty">
              {isImported
                ? 'Episode fisiologis tidak disertakan dalam CSV; lintasan episode memakai relasi dari data sistem.'
                : 'Pilih episode fisiologis untuk menelusuri window dan menghitung TTR observasional.'}
            </p>
          )}
        </section>

        <section className="capar-dynamic-panel">
          <header>
            <div>
              <span className="eyebrow">RIWAYAT ANTARHARI</span>
              <h4>Personal Dynamic Profile</h4>
            </div>
            {tauChange !== null && <strong className="capar-dynamic-highlight">{tauChange >= 0 ? '+' : ''}{formatNumber(tauChange)} m</strong>}
          </header>
          <div className="capar-dynamic-profile-summary">
            <Metric label="τ referensi" value={firstDaily ? `${formatNumber(firstDaily.dominantTauMinutes)} m` : '—'} detail={firstDaily?.day || 'Belum ada estimasi'} />
            <Metric label="τ terakhir" value={lastDaily ? `${formatNumber(lastDaily.dominantTauMinutes)} m` : '—'} detail={lastDaily?.day || 'Belum ada estimasi'} />
            <Metric label="Δτ dominan" value={tauChange === null ? '—' : `${tauChange >= 0 ? '+' : ''}${formatNumber(tauChange)} m`} detail="kandidat perubahan dinamika" />
          </div>
          <DailyProfileChart daily={comparisonDaily} episodes={historyEpisodes} />
          <div className="capar-dynamic-table-scroll">
            <table className="capar-dynamic-table">
              <thead><tr><th>Hari</th><th>Aktivitas</th><th>Pairs</th><th>ρ(A)</th><th>τ dom.</th><th>TTR median</th><th>Status</th></tr></thead>
              <tbody>
                {historyProfile.daily.map((item) => {
                  const ttrs = historyEpisodes
                    .filter((episode) => (
                      getJakartaDay(episode.onset_time) === item.day
                      && (episode.activity || 'Unknown') === item.activity
                    ))
                    .map((episode) => Number(episode.ttr_min))
                    .filter(Number.isFinite)
                    .sort((first, second) => first - second);
                  return (
                    <tr key={`${item.day}-${item.activity}`}>
                      <td>{item.day}</td>
                      <td>{item.activity}</td>
                      <td>{item.audit.pair_count}</td>
                      <td>{formatNumber(item.audit.spectral_radius, 3)}</td>
                      <td>{formatNumber(item.dominantTauMinutes, 2)}</td>
                      <td>{formatNumber(median(ttrs), 1)}</td>
                      <td>{item.status}</td>
                    </tr>
                  );
                })}
                {!historyProfile.daily.length && <tr><td colSpan="7">Belum ada window bertanggal untuk scope ini.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="capar-dynamic-note">
            {comparisonDaily.length
              ? `Perbandingan dibatasi ke aktivitas ${comparisonActivity} dan baseline yang sama. `
              : 'Pilih satu aktivitas dengan baseline konsisten untuk membandingkan antarhari. '}
            Hari pertama yang lolos gate adalah referensi awal, bukan baseline dinamik tervalidasi. Perubahan bukan keputusan kesehatan.
          </p>
        </section>

        </div>
        <div className="capar-dynamic-column">
        <section className="capar-dynamic-panel">
          <header>
            <div>
              <span className="eyebrow">x[k+1] = Aᵈ x[k]</span>
              <h4>Dynamic state model</h4>
            </div>
            <strong className="capar-dynamic-status">{model.status}</strong>
          </header>
          <p className="capar-dynamic-description">
            x = [zHR, defisit lnRMSSD, defisit DFA α1] · Δt = {formatNumber(model.audit.dt_minutes)} menit.
            {' '}Fase recovery; beban tambahan dianggap nol.
          </p>
          {model.audit.baseline_context_count > 1 && (
            <p className="capar-dynamic-import-note">
              Matriks merangkum {model.audit.baseline_context_count} konteks baseline terstandardisasi; bandingkan τ antarhari hanya pada aktivitas dan baseline yang sama.
            </p>
          )}
          {model.matrix ? (
            <>
              <div className="capar-dynamic-matrix-wrap">
                <table className="capar-dynamic-matrix">
                  <thead><tr><th>Tujuan ↓ / Sumber →</th>{STATE_NAMES.map((name) => <th key={name}>{name}</th>)}</tr></thead>
                  <tbody>
                    {model.matrix.map((row, index) => (
                      <tr key={STATE_NAMES[index]}>
                        <th>{STATE_NAMES[index]}</th>
                        {row.map((value, column) => <td key={STATE_NAMES[column]}>{formatNumber(value, 3)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h5>Dynamic coupling graph · Aᵢⱼ adalah prediksi j → i</h5>
              <CouplingGraph matrix={model.matrix} />
            </>
          ) : (
            <p className="capar-dynamic-empty">{model.reason}</p>
          )}
          <p className="capar-dynamic-note">Bobot adalah pengaruh prediktif antar-window, bukan relasi kausal. Relasi semantik knowledge graph tidak masuk ke perhitungan eigenvalue.</p>
        </section>

        <section className="capar-dynamic-panel">
          <header>
            <div>
              <span className="eyebrow">ANALISIS MODE</span>
              <h4>Eigenvalue &amp; audit kelayakan</h4>
            </div>
          </header>
          {model.modes.length > 0 && (
            <>
              <EigenvalueChart modes={model.modes} />
              <div className="capar-dynamic-table-scroll">
                <table className="capar-dynamic-table">
                  <thead><tr><th>Mode</th><th>λ diskrit</th><th>|λ|</th><th>τ (min)</th></tr></thead>
                  <tbody>
                    {model.modes.map((mode, index) => (
                      <tr key={`${mode.re}-${mode.im}-${index}`}>
                        <td>{index + 1}</td>
                        <td>{formatNumber(mode.re, 4)} {mode.im < 0 ? '−' : '+'} {formatNumber(Math.abs(mode.im), 4)}i</td>
                        <td>{formatNumber(mode.magnitude, 4)}</td>
                        <td>{formatNumber(mode.tauMinutes, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="capar-dynamic-audit">
            <Metric label="Episode / pasangan" value={`${model.audit.episode_count} / ${model.audit.pair_count}`} />
            <Metric label="Rank X−" value={`${model.audit.rank}/3`} />
            <Metric label="Baseline contexts" value={model.audit.baseline_context_count} />
            <Metric label="Condition number κ" value={formatNumber(model.audit.condition_number)} />
            <Metric label="RMSE training (z)" value={formatNumber(model.audit.rmse, 4)} />
          </div>
          <p className="capar-dynamic-note">
            Gate: ≥18 pasangan · rank 3 · κ ≤100 · interval sampling seragam. Estimasi eksploratif; belum divalidasi out-of-sample, belum ada CI bootstrap.
          </p>
          <p className="capar-dynamic-note">τ adalah konstanta waktu eigenmode diskrit, berbeda dari TTR observasional.</p>
        </section>

        <section className="capar-dynamic-panel capar-dynamic-reference">
          <header>
            <div>
              <span className="eyebrow">BASELINE &amp; BUKTI DATA</span>
              <h4>Referensi fisiologis</h4>
            </div>
            <strong className="capar-dynamic-status">
              {commonBaseline?.is_mature
                ? 'BASELINE MATANG'
                : baselineContexts.size > 1
                  ? 'BASELINE BERVARIASI PER KONTEKS'
                  : 'BASELINE TIDAK LAYAK'}
            </strong>
          </header>
          {baselineContexts.size > 0 ? (
            <div className="capar-dynamic-table-scroll">
              <table className="capar-dynamic-table">
                <thead><tr><th>Konteks</th><th>Indikator</th><th>Baseline</th><th>SD</th></tr></thead>
                <tbody>
                  {[...baselineContexts.values()].flatMap((baseline) => [
                    <tr key={`${baseline._id}-hr`}>
                      <td>{baseline.activity} · {baseline.time_period}</td><td>HR</td>
                      <td>{formatNumber(baseline.stats?.mean_hr?.mean, 1)} BPM</td><td>{formatNumber(baseline.stats?.mean_hr?.std, 2)}</td>
                    </tr>,
                    <tr key={`${baseline._id}-rmssd`}>
                      <td>{baseline.activity} · {baseline.time_period}</td><td>RMSSD</td>
                      <td>{formatNumber(baseline.stats?.rmssd?.mean, 1)} ms</td><td>{formatNumber(baseline.stats?.rmssd?.std, 2)} ms</td>
                    </tr>,
                    <tr key={`${baseline._id}-dfa`}>
                      <td>{baseline.activity} · {baseline.time_period}</td><td>DFA α1</td>
                      <td>{formatNumber(baseline.stats?.dfa_alpha1?.mean, 3)}</td><td>{formatNumber(baseline.stats?.dfa_alpha1?.std, 3)}</td>
                    </tr>,
                  ])}
                </tbody>
              </table>
            </div>
          ) : <p className="capar-dynamic-empty">Baseline belum tersedia untuk aktivitas dan periode waktu pada window terpilih.</p>}
          <p className="capar-dynamic-note">
            {baselineContexts.size} konteks baseline · {scopedWindows.length} window diperiksa · {eligibleCount} lolos gate.
          </p>
          {rejectionReasons.size > 0 && (
            <ul className="capar-dynamic-reasons">
              {[...rejectionReasons.entries()].sort((first, second) => second[1] - first[1]).slice(0, 5).map(([reason, count]) => (
                <li key={reason}>{reason} · {count} window</li>
              ))}
            </ul>
          )}
          <p className="capar-dynamic-disclaimer">D adalah norma Euclidean state terstandardisasi. TTR observasional bukan konfirmasi kesehatan atau ambang klinis.</p>
        </section>
        </div>
      </div>
    </section>
  );
}
