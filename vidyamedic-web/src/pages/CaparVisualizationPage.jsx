import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Activity,
  CalendarDays,
  GitBranch,
  Layers,
  LoaderCircle,
  RefreshCw,
  Rows3,
} from 'lucide-react';
import { api } from '../api';
import SectionHeading from '../components/SectionHeading';

const MODES = [
  { id: 'rows', label: 'Baris data', icon: Rows3 },
  { id: 'windows', label: 'Window CAPAR', icon: Layers },
  { id: 'activities', label: 'Episode aktivitas', icon: Activity },
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

function formatTime(value) {
  const timestamp = toEpochMs(value);
  if (timestamp === null) return 'Waktu tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
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

function getJakartaDateKey(value) {
  const timestamp = toEpochMs(value);
  return timestamp === null
    ? null
    : new Date(timestamp + (7 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function getMinuteOfDay(value) {
  const timestamp = toEpochMs(value);
  if (timestamp === null) return 0;
  const date = new Date(timestamp + (7 * 60 * 60 * 1000));
  return (date.getUTCHours() * 60) + date.getUTCMinutes();
}

function TimelineGraph({
  nodes,
  mode,
  selectedId,
  activityFilter,
  onSelect,
}) {
  const activityNames = [...new Set(nodes.map((node) => getNodeActivity(node, mode)))].sort();
  const activityColors = new Map(
    activityNames.map((name, index) => [name, ACTIVITY_COLORS[index % ACTIVITY_COLORS.length]]),
  );
  const visible = nodes
    .map((node) => ({
      node,
      id: getNodeId(node, mode),
      time: getNodeTime(node, mode),
      activity: getNodeActivity(node, mode),
      density: getNodeDensity(node, mode),
    }))
    .filter((entry) => (
      entry.time !== null
      && (activityFilter === 'all' || entry.activity === activityFilter)
    ))
    .sort((first, second) => first.time - second.time || first.id.localeCompare(second.id));
  const entriesByDay = new Map();
  visible.forEach((entry) => {
    const day = getJakartaDateKey(entry.time);
    if (!day) return;
    if (!entriesByDay.has(day)) entriesByDay.set(day, []);
    entriesByDay.get(day).push(entry);
  });
  const minDensity = visible.length ? Math.min(...visible.map(({ density }) => density)) : 0;
  const maxDensity = visible.length ? Math.max(...visible.map(({ density }) => density)) : 0;
  const width = 1800;
  const plotLeft = 190;
  const plotRight = width - 28;
  const plotWidth = plotRight - plotLeft;
  const laneHeight = 32;
  const headingHeight = 26;
  let nextTop = 28;
  const days = [...entriesByDay.entries()].map(([day, entries]) => {
    const activities = [...new Set(entries.map(({ activity }) => activity))];
    const layout = { day, entries, activities, top: nextTop };
    nextTop += headingHeight + (activities.length * laneHeight) + 10;
    return layout;
  });
  const height = Math.max(100, nextTop + 10);
  const x = (minute) => plotLeft + ((minute / 1440) * plotWidth);
  const y = (layout, activity) => (
    layout.top + headingHeight
      + (layout.activities.indexOf(activity) * laneHeight)
      + (laneHeight / 2)
  );

  if (!nodes.length) {
    return <p className="capar-visual-empty">Belum ada node untuk mode dan rentang waktu ini.</p>;
  }
  if (!visible.length) {
    return <p className="capar-visual-empty">Tidak ada node untuk filter aktivitas ini.</p>;
  }

  return (
    <div className="capar-visual-graph-scroll">
      <svg
        aria-label={`${visible.length} node CAPAR`}
        className="capar-visual-graph"
        role="group"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <marker id="capar-visual-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
            <path d="M0,0 L7,3.5 L0,7 z" />
          </marker>
        </defs>
        {[0, 360, 720, 1080, 1440].map((minute) => (
          <g key={minute}>
            <line className="capar-visual-grid" x1={x(minute)} x2={x(minute)} y1="18" y2={height - 8} />
            <text className="capar-visual-axis" x={x(minute)} y="13" textAnchor="middle">
              {String(Math.floor(minute / 60)).padStart(2, '0')}:00
            </text>
          </g>
        ))}
        {days.map((layout) => (
          <g key={layout.day}>
            <text className="capar-visual-day" x="8" y={layout.top + 13}>{layout.day}</text>
            <text className="capar-visual-axis" x="112" y={layout.top + 13}>
              {layout.entries.length} node
            </text>
            {layout.activities.map((activity) => (
              <g key={`${layout.day}:${activity}:lane`}>
                <text className="capar-visual-activity" x="8" y={y(layout, activity) + 3}>
                  {activity}
                </text>
                <line
                  className="capar-visual-lane"
                  x1={plotLeft}
                  x2={plotRight}
                  y1={y(layout, activity)}
                  y2={y(layout, activity)}
                />
              </g>
            ))}
            {layout.entries.slice(0, -1).map((entry, index) => {
              const next = layout.entries[index + 1];
              return (
                <line
                  className="capar-visual-edge"
                  key={`${entry.id}:${next.id}`}
                  markerEnd="url(#capar-visual-arrow)"
                  x1={x(getMinuteOfDay(entry.time))}
                  x2={x(getMinuteOfDay(next.time))}
                  y1={y(layout, entry.activity)}
                  y2={y(layout, next.activity)}
                />
              );
            })}
            {layout.entries.map((entry, index) => {
              const selected = entry.id === selectedId;
              const ratio = maxDensity === minDensity
                ? 0
                : Math.sqrt((entry.density - minDensity) / (maxDensity - minDensity));
              const radius = mode === 'rows' ? 5 : 5 + (ratio * 6);
              const label = `${entry.activity}, ${formatTime(entry.time)}, node ${index + 1}`;
              return (
                <g
                  aria-label={label}
                  aria-pressed={selected}
                  className={`capar-visual-node ${selected ? 'is-selected' : ''}`}
                  key={entry.id}
                  onClick={() => onSelect(entry.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(entry.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <title>{label}</title>
                  <circle
                    cx={x(getMinuteOfDay(entry.time))}
                    cy={y(layout, entry.activity) + ((index % 3) - 1) * 2}
                    r={selected ? radius + 3 : radius}
                    fill={activityColors.get(entry.activity)}
                  />
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
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
    const min = Math.min(...values);
    const max = Math.max(...values);
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
    const magnitude = Math.sqrt(
      (Number(node.acc_x) || 0) ** 2
      + (Number(node.acc_y) || 0) ** 2
      + (Number(node.acc_z) || 0) ** 2,
    );
    return (
      <section className="panel capar-visual-detail">
        <div className="panel-heading">
          <div><h2>Baris data sensor</h2><p>{formatTime(node.timestamp_ms ?? node.timestamp)}</p></div>
          <span className="capar-visual-badge">{node.activity || 'Aktivitas tidak diketahui'}</span>
        </div>
        <div className="capar-visual-metrics">
          <span>HR<strong>{formatMetric(node.hr)} bpm</strong></span>
          <span>RR<strong>{formatMetric(node.rr)} ms</strong></span>
          <span>ACC magnitude<strong>{formatMetric(magnitude, 3)}</strong></span>
          <span>Steps<strong>{Number(node.step_count) || 0}</strong></span>
          <span>Signal quality<strong>{formatMetric(node.signal_quality, 2)}</strong></span>
          <span>Device<strong>{node.device_id || 'UNKNOWN'}</strong></span>
        </div>
        <div className="capar-visual-interpretation">
          <div><strong>K1 · Observasi fisiologi</strong><p>HR {formatMetric(node.hr)} bpm dan RR {formatMetric(node.rr)} ms dicatat pada waktu yang sama.</p></div>
          <div><strong>K2 · Konteks aktivitas</strong><p>Label aktivitas: {node.activity || 'tidak diketahui'}; akselerasi gabungan: {formatMetric(magnitude, 3)}.</p></div>
          <div><strong>K3 · Profil personal</strong><p>Baris sensor ini belum dikomparasikan dengan baseline personal.</p></div>
          <div><strong>K4 · Interpretasi kontekstual</strong><p>Satu baris adalah observasi, bukan diagnosis atau bukti persistensi.</p></div>
        </div>
        {nextNode && <p className="capar-visual-transition">Jarak waktu ke node berikutnya pada hari yang sama: {formatDuration(getNodeTime(nextNode, 'rows') - getNodeTime(node, 'rows'))}.</p>}
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
          <span>RR mean<strong>{formatMetric(node.features?.mean_rr)} ms</strong></span>
          <span>RMSSD<strong>{formatMetric(node.features?.rmssd)} ms</strong></span>
          <span>DFA α1<strong>{formatMetric(node.features?.dfa_alpha1, 3)}</strong></span>
          <span>ACC intensity<strong>{formatMetric(node.features?.motion_intensity, 3)}</strong></span>
          <span>Jumlah data<strong>{Number(node.raw_count) || 0}</strong></span>
        </div>
        <div className="capar-visual-interpretation">
          <div><strong>K1 · Observasi fisiologi</strong><p>Window berisi HR mean {formatMetric(node.features?.mean_hr)} bpm dan RR mean {formatMetric(node.features?.mean_rr)} ms; kualitas {node.is_valid ? 'valid' : 'perlu perhatian'}.</p></div>
          <div><strong>K2 · Konteks aktivitas</strong><p>{node.activity_label || 'Unknown'} · ACC intensity {formatMetric(node.features?.motion_intensity, 3)} · {Number(node.raw_count) || 0} sampel.</p></div>
          <div><strong>K3 · Profil personal</strong><p>{baseline ? `Baseline HR mean ${formatMetric(baselineMean)} bpm (${baseline.is_mature ? 'matang' : 'belum matang'}).` : 'Baseline personal untuk konteks ini belum tersedia.'}</p></div>
          <div><strong>K4 · Perbandingan konteks</strong><p>{hasHr && hasBaseline ? `HR window berbeda ${formatMetric(hr - baselineMean)} bpm dari baseline personal. Ini adalah perbandingan, bukan diagnosis.` : 'Deviasi tidak dihitung karena HR atau baseline belum tersedia.'}</p></div>
        </div>
        {nextNode && <p className="capar-visual-transition">Selang ke window berikutnya pada hari yang sama: {formatDuration(getNodeTime(nextNode, 'windows') - getNodeTime(node, 'windows'))}.</p>}
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
        <span>RMSSD mean<strong>{formatMetric(summary.mean_rmssd)} ms</strong></span>
        <span>DFA α1 mean<strong>{formatMetric(summary.mean_dfa_alpha1, 3)}</strong></span>
        <span>Raw samples<strong>{Number(summary.raw_sample_count) || 0}</strong></span>
      </div>
      <div className="capar-visual-interpretation">
        <div><strong>K1 · Observasi fisiologi</strong><p>Ringkasan dari {summary.valid_window_count || 0} window valid; HR mean {formatMetric(summary.mean_hr)} bpm, RR mean {formatMetric(summary.mean_rr)} ms.</p></div>
        <div><strong>K2 · Konteks aktivitas</strong><p>Episode {node.activity_label}, device {node.device_id}, pipeline {node.window_type}; {summary.window_count || 0} window berurutan.</p></div>
        <div><strong>K3 · Profil personal</strong><p>Ringkasan tersimpan terpisah per pasien, hari, device, dan tipe window; baseline personal belum dipakai untuk agregat ini.</p></div>
        <div><strong>K4 · Interpretasi kontekstual</strong><p>Rata-rata dan rentang menjelaskan episode ini, tetapi tidak menyimpulkan deviasi klinis.</p></div>
      </div>
      {points.length > 0 && <ActivitySeriesChart points={points} />}
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

export default function CaparVisualizationPage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [dateMode, setDateMode] = useState('day');
  const [mode, setMode] = useState('rows');
  const [activityFilter, setActivityFilter] = useState('all');
  const [nodes, setNodes] = useState([]);
  const [dates, setDates] = useState([]);
  const [baselines, setBaselines] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [truncated, setTruncated] = useState(false);
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
      setNodes([]);
      setDates([]);
      setBaselines([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    setSelectedId('');
    const allDates = dateMode === 'all';
    const loadData = mode === 'rows'
      ? api.listDoctorCaparRows(selectedPatient, selectedDate, allDates)
      : mode === 'windows'
        ? api.listDoctorCaparWindowNodes(selectedPatient, selectedDate, allDates)
        : api.listDoctorCaparActivityEpisodes(selectedPatient, selectedDate, allDates);
    loadData
      .then((result) => {
        if (!active) return;
        setNodes(result.data || []);
        setDates(result.dates || []);
        setTruncated(Boolean(result.truncated));
        setBaselines(result.baselines || []);
        if (result.selected_date && !selectedDate) setSelectedDate(result.selected_date);
        setActivityFilter('all');
      })
      .catch((reason) => {
        if (active) {
          setNodes([]);
          setError(reason.message || 'Visualisasi CAPAR gagal dimuat.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedPatient, selectedDate, dateMode, mode, reloadKey]);

  const filteredNodes = useMemo(() => nodes.filter((node) => (
    activityFilter === 'all' || getNodeActivity(node, mode) === activityFilter
  )), [nodes, mode, activityFilter]);
  const activityNames = useMemo(() => (
    [...new Set(nodes.map((node) => getNodeActivity(node, mode)))].sort()
  ), [nodes, mode]);
  const selectedNode = filteredNodes.find((node) => getNodeId(node, mode) === selectedId)
    || filteredNodes[0]
    || null;
  const resolvedSelectedId = selectedNode ? getNodeId(selectedNode, mode) : '';
  const selectedTime = selectedNode ? getNodeTime(selectedNode, mode) : null;
  const nextNode = selectedNode && selectedTime !== null
    ? filteredNodes
      .filter((node) => (
        getJakartaDateKey(getNodeTime(node, mode)) === getJakartaDateKey(selectedTime)
        && getNodeTime(node, mode) > selectedTime
      ))
      .sort((first, second) => getNodeTime(first, mode) - getNodeTime(second, mode))[0]
    : null;
  const selectedBaseline = selectedNode && mode === 'windows'
    ? baselines.find((baseline) => (
      baseline.activity === (selectedNode.activity_label || 'Unknown')
      && (!selectedNode.time_period || baseline.time_period === selectedNode.time_period)
    ))
    : null;

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

  const modeDescription = mode === 'rows'
    ? 'Setiap titik mewakili satu baris PolarData; data besar dibatasi dan tanggal dapat dipilih.'
    : mode === 'windows'
      ? 'Setiap titik mewakili satu window hasil segmentasi CAPAR, lengkap dengan fitur fisiologis.'
      : 'Satu titik mewakili satu episode aktivitas; data time series dan ringkasan tersimpan di MongoDB.';

  return (
    <section className="capar-visual-page">
      <SectionHeading
        eyebrow="DASHBOARD DOKTER · SEMANTIC CAPAR"
        title="Visualisasi node CAPAR"
        description="Telusuri data sensor dari baris mentah hingga window dan episode aktivitas yang berurutan secara temporal."
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
        {mode === 'activities' && (
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
            onClick={() => setMode(id)}
            type="button"
          >
            <Icon size={16} />{label}
          </button>
        ))}
      </nav>

      <section className="panel capar-visual-main">
        <div className="capar-visual-heading">
          <div>
            <span className="eyebrow">LINIMASA · WIB</span>
            <h2>{MODES.find((item) => item.id === mode)?.label}</h2>
            <p>{modeDescription}</p>
          </div>
          <div className="capar-visual-count">
            <strong>{filteredNodes.length.toLocaleString('id-ID')}</strong>
            <span>node ditampilkan</span>
          </div>
        </div>

        {activityNames.length > 0 && (
          <div className="capar-visual-filters" aria-label="Filter aktivitas">
            <label htmlFor="capar-visual-activity">Aktivitas</label>
            <select
              id="capar-visual-activity"
              onChange={(event) => setActivityFilter(event.target.value)}
              value={activityFilter}
            >
              <option value="all">Semua aktivitas</option>
              {activityNames.map((activity) => <option key={activity} value={activity}>{activity}</option>)}
            </select>
            <span>Satu lane untuk setiap aktivitas · node lebih besar berarti jumlah data lebih banyak.</span>
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
        {!loading && truncated && (
          <p className="capar-visual-truncated">
            {mode === 'rows'
              ? 'Mode baris membatasi hasil terbaru hingga 5.000 node. Pilih satu hari untuk mempersempit data.'
              : 'Jumlah node melebihi batas tampilan API; sebagian data tidak ditampilkan.'}
          </p>
        )}
        {!loading && (
          <TimelineGraph
            activityFilter={activityFilter}
            mode={mode}
            nodes={nodes}
            onSelect={setSelectedId}
            selectedId={resolvedSelectedId}
          />
        )}
        <div className="capar-visual-legend">
          <GitBranch size={14} />
          <span>Panah menunjukkan urutan waktu; pergantian hari tetap menjadi episode terpisah.</span>
        </div>
      </section>

      {!loading && selectedNode && (
        <DetailPanel
          baseline={selectedBaseline}
          mode={mode}
          nextNode={nextNode}
          node={selectedNode}
        />
      )}
      <p className="capar-visual-disclaimer">
        Visualisasi menyajikan data sensor dan ringkasan observasional; interpretasi bukan diagnosis klinis.
      </p>
    </section>
  );
}
