import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  GitBranch,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Signal,
} from 'lucide-react';
import { api } from '../api';
import SectionHeading from '../components/SectionHeading';
import {
  calculateRecoveryTime,
  recoveryHeartRate,
} from '../utils/caparDynamicRecovery';

function toEpochMs(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.abs(timestamp) < 100_000_000_000 ? timestamp * 1000 : timestamp;
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

function numericValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDuration(value) {
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds)) return '—';
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  if (totalSeconds < 60) return `${totalSeconds} dtk`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes} m ${seconds} dtk` : `${minutes} m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} j ${remainingMinutes} m`;
}

function getNodeStatus(window) {
  if (window.rr_status) return window.rr_status.replaceAll('_', ' ').toLowerCase();
  if (window.classification) return window.classification;
  return window.analyzed ? 'Sudah dianalisis' : 'Belum dianalisis';
}

const DYNAMIC_STATES = [
  {
    code: 'S0',
    name: 'Baseline-compatible',
    description: 'Observasi kompatibel dengan referensi personal pada konteks yang sesuai.',
  },
  {
    code: 'S1',
    name: 'Deviation candidate',
    description: 'Ada kandidat deviasi; satu window saja belum menunjukkan persistensi.',
  },
  {
    code: 'S2',
    name: 'Persistent deviation',
    description: 'Status persistensi hanya ditampilkan jika status temporal CAPAR menyatakannya.',
  },
  {
    code: 'S3',
    name: 'Recovery',
    description: 'Observasi bergerak menuju referensi personal menurut status temporal CAPAR.',
  },
  {
    code: 'S4',
    name: 'Recovered',
    description: 'Status recovered berasal dari status CAPAR; bukan diagnosis klinis.',
  },
  {
    code: 'S5',
    name: 'Unresolved',
    description: 'Belum disimpulkan otomatis; butuh horizon observasi episode dan bukti yang memadai.',
  },
];

const STATE_BY_CODE = new Map(DYNAMIC_STATES.map((state) => [state.code, state]));
const RR_STATE_MAP = {
  NORMAL: 'S0',
  PROVISIONAL_NORMAL: 'S0',
  DEVIATION_CANDIDATE: 'S1',
  PROVISIONAL_DEVIATION: 'S1',
  PERSISTENT_DEVIATION: 'S2',
  RECOVERING: 'S3',
  RECOVERED: 'S4',
};
const RR_ABSTAIN_STATUSES = new Set([
  'QUALITY_WARNING',
  'INSUFFICIENT_BASELINE',
  'BASELINE_PAUSED',
  'DEVIATION_PAUSED',
  'PERSISTENT_PAUSED',
  'RECOVERY_PAUSED',
]);

function getTemporalState(window) {
  const status = window.rr_status;
  if (!status) return null;
  if (RR_ABSTAIN_STATUSES.has(status)) {
    return { code: 'ABSTAIN', name: 'Bukti belum cukup', provisional: false };
  }
  const code = RR_STATE_MAP[status];
  if (!code) return null;
  return {
    ...STATE_BY_CODE.get(code),
    provisional: status.startsWith('PROVISIONAL_'),
  };
}

function getNodeSize(rawCount, range) {
  const count = Math.max(0, Number(rawCount) || 0);
  if (range.max === range.min) return 22;
  const ratio = Math.sqrt((count - range.min) / (range.max - range.min));
  return Math.round(16 + (ratio * 18));
}

function mixColor(from, to, ratio) {
  const channels = from.map((value, index) => (
    Math.round(value + ((to[index] - value) * ratio))
  ));
  return `rgb(${channels.join(', ')})`;
}

function getNodeColor(window, baseline) {
  const hr = numericValue(window.features?.mean_hr);
  const baselineMean = numericValue(baseline?.stats?.mean_hr?.mean);
  const baselineStd = numericValue(baseline?.stats?.mean_hr?.std);
  if (
    window.is_valid !== false
    && baseline?.is_mature
    && Number.isFinite(hr)
    && Number.isFinite(baselineMean)
    && Number.isFinite(baselineStd)
    && baselineStd > 0
  ) {
    const zScore = Math.max(-3, Math.min(3, (hr - baselineMean) / baselineStd));
    const blue = [76, 125, 190];
    const neutral = [58, 153, 135];
    const orange = [214, 116, 72];
    return zScore < 0
      ? mixColor(blue, neutral, (zScore + 3) / 3)
      : mixColor(neutral, orange, zScore / 3);
  }
  if (window.classification === 'Alert') return '#b85e69';
  if (window.classification === 'Caution') return '#ce9650';
  if (window.classification === 'Normal') return '#4c9a7e';
  return '#788f98';
}

function getJakartaDayKey(value) {
  const timestamp = toEpochMs(value);
  return timestamp === null
    ? null
    : new Date(timestamp + (7 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

const ACTIVITY_PALETTE = [
  '#397b69',
  '#547fb4',
  '#c27b3f',
  '#8a6da8',
  '#b45d69',
  '#588f9d',
  '#9b8a3c',
  '#587c4d',
];

const STATE_STROKES = {
  S0: '#34735b',
  S1: '#8b6b27',
  S2: '#9c4e57',
  S3: '#496d9d',
  S4: '#34735b',
  ABSTAIN: '#6b6178',
};

function CaparWindowGraph({
  windows,
  visibleWindows,
  selectedWindowId,
  onSelect,
  onActivitySelect,
  activityFilter,
  activities,
}) {
  const visibleIds = new Set(visibleWindows.map((window) => String(window._id)));
  const rawCounts = windows.map((window) => Number(window.raw_count) || 0);
  const densityRange = {
    min: rawCounts.length ? Math.min(...rawCounts) : 0,
    max: rawCounts.length ? Math.max(...rawCounts) : 0,
  };
  const windowsByDay = new Map();
  windows.forEach((window) => {
    const day = getJakartaDayKey(window.window_start);
    if (!day) return;
    if (!windowsByDay.has(day)) windowsByDay.set(day, []);
    windowsByDay.get(day).push({ window });
  });
  const days = [...windowsByDay.entries()]
    .map(([day, entries]) => ({ day, entries }))
    .filter(({ entries }) => entries.some(({ window }) => visibleIds.has(String(window._id))));
  const activityColors = new Map(
    activities.map((activity, index) => [activity, ACTIVITY_PALETTE[index % ACTIVITY_PALETTE.length]]),
  );
  if (!visibleWindows.length) {
    return <p className="capar-graph-empty">Tidak ada node untuk filter ini.</p>;
  }

  return (
    <section className="capar-semantic-graph" aria-label="Graf node window CAPAR">
      <div className="capar-graph-heading">
        <div>
          <span className="eyebrow">GRAF SEMANTIK · NODE CAPAR</span>
          <h3>Satu node per window, dikelompokkan menurut hari dan aktivitas</h3>
          <p>Waktu ditampilkan pada setiap node; ukuran node mengikuti jumlah sampel di dalam window.</p>
        </div>
        <span className="capar-graph-count">{visibleWindows.length} node · {days.length} episode harian</span>
      </div>
      <div className="capar-graph-legend" aria-label="Legenda aktivitas">
        {activities.map((activity) => (
          <button
            aria-pressed={activityFilter === activity}
            className={activityFilter === activity ? 'is-active' : ''}
            key={activity}
            onClick={() => onActivitySelect(activity)}
            type="button"
          >
            <i style={{ backgroundColor: activityColors.get(activity) }} />
            {activity}
          </button>
        ))}
        <span className="capar-graph-node-legend">Ukuran = sampel · cincin = state CAPAR</span>
      </div>
      <div className="capar-graph-scroll capar-node-field">
        {days.map(({ day, entries }) => {
          const dayActivities = activities.filter((activity) => (
            entries.some(({ window }) => (
              visibleIds.has(String(window._id))
              && (window.activity_label || 'Unknown') === activity
            ))
          ));
          return (
            <section className="capar-node-day" key={day}>
              <div className="capar-node-day-heading">
                <strong>{day}</strong>
                <span>{entries.filter(({ window }) => visibleIds.has(String(window._id))).length} node</span>
              </div>
              {dayActivities.map((activity) => {
                const activityEntries = entries.filter(({ window }) => (
                  visibleIds.has(String(window._id))
                  && (window.activity_label || 'Unknown') === activity
                ));
                return (
                  <section className="capar-node-activity" key={`${day}:${activity}`}>
                    <h4>
                      <i style={{ backgroundColor: activityColors.get(activity) }} />
                      {activity}
                      <span>{activityEntries.length}</span>
                    </h4>
                    <div className="capar-node-grid">
                      {activityEntries.map(({ window }) => {
                        const state = getTemporalState(window);
                        const color = activityColors.get(activity) || '#788f98';
                        const selected = String(window._id) === String(selectedWindowId);
                        const size = Math.max(
                          28,
                          Math.min(46, getNodeSize(window.raw_count, densityRange) + 10)
                        );
                        const label = `${activity}, ${formatTime(window.window_start)}, HR ${formatMetric(window.features?.mean_hr)} bpm, RR ${formatMetric(window.features?.mean_rr)} ms, ACC ${formatMetric(window.features?.motion_intensity, 3)}, ${state?.name || 'state belum dipetakan'}, ${Number(window.raw_count) || 0} sampel`;
                        return (
                          <button
                            aria-label={label}
                            aria-pressed={selected}
                            className={`capar-node-chip ${selected ? 'is-selected' : ''}`}
                            key={window._id}
                            onClick={() => onSelect(window._id)}
                            title={label}
                            type="button"
                          >
                            <span
                              className="capar-node-bubble"
                              style={{
                                width: `${size}px`,
                                height: `${size}px`,
                                backgroundColor: color,
                                borderColor: STATE_STROKES[state?.code] || '#ffffff',
                              }}
                            >
                              {formatMetric(window.features?.mean_hr, 0)}
                            </span>
                            <time>{formatNodeClock(window.window_start)}</time>
                            <span className="capar-node-chip-meta">
                              RR {formatMetric(window.features?.mean_rr, 0)} · {Number(window.raw_count) || 0} sampel
                            </span>
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
      </div>
      <p className="capar-graph-hint">Klik node untuk membuka interpretasi K1–K4. Waktu pada setiap node memakai zona WIB.</p>
    </section>
  );
}

function getWindowParagraphs(window, baseline, nextWindow) {
  const hr = numericValue(window.features?.mean_hr);
  const rr = numericValue(window.features?.mean_rr);
  const acc = numericValue(window.features?.motion_intensity);
  const baselineMean = numericValue(baseline?.stats?.mean_hr?.mean);
  const baselineStd = numericValue(baseline?.stats?.mean_hr?.std);
  const hasHr = hr !== null;
  const hasRr = rr !== null;
  const hasBaseline = baselineMean !== null;
  const rrEquivalentHr = hasRr && rr > 0 ? 60000 / rr : null;
  const deviation = hasHr && hasBaseline ? hr - baselineMean : null;
  const zScore = (
    deviation !== null
    && window.is_valid !== false
    && baseline?.is_mature
    && baselineStd !== null
    && baselineStd > 0
  ) ? deviation / baselineStd : null;
  const duration = Math.max(
    0,
    (toEpochMs(window.window_end) ?? 0) - (toEpochMs(window.window_start) ?? 0),
  );
  const periodName = window.time_period || 'periode tidak diketahui';
  const baselineStatus = baseline
    ? `${baseline.is_mature ? 'matang' : 'belum matang'} (${baseline.segment_count || 0} window)`
    : 'belum tersedia';
  const baselineMeasurements = (baseline?.segment_count || 0) > 0
    ? ` HR ${formatMetric(baselineMean)} ± ${formatMetric(baselineStd)} bpm, RR ${formatMetric(baseline.stats?.mean_rr?.mean)} ms, ACC ${formatMetric(baseline.stats?.motion_intensity?.mean, 3)}.`
    : ' Statistik baseline belum tersedia.';
  const qualityReasons = window.signal_quality_detail?.reasons;
  const qualityNote = Array.isArray(qualityReasons) && qualityReasons.length
    ? ` Catatan kualitas: ${qualityReasons.join(', ')}.`
    : '';
  const activity = window.activity_label || 'Unknown';
  const nextActivity = nextWindow?.activity_label || 'Unknown';
  const temporalState = getTemporalState(window);
  const temporalStateText = temporalState
    ? `${temporalState.code}${temporalState.provisional ? ' provisional' : ''} · ${temporalState.name}`
    : window.rr_status
    ? `status ${getNodeStatus(window)} belum dipetakan ke S0–S4`
    : 'state belum ditentukan dari data window ini';

  return [
    {
      label: 'K1 · Observasi fisiologi',
      text: `Pada ${formatTime(window.window_start)}, HR terukur ${hasHr ? `${formatMetric(hr)} bpm` : 'tidak tersedia'} dan RR ${hasRr ? `${formatMetric(rr)} ms` : 'tidak tersedia'}.`
        + (rrEquivalentHr !== null
          ? ` Konversi deskriptif RR setara ${formatMetric(rrEquivalentHr)} bpm; ini bukan pengganti HR terukur.`
          : '')
        + ` Kualitas window: ${window.is_valid ? 'valid' : 'ditandai tidak valid'}${window.signal_quality_detail?.q_signal != null ? `, q-signal ${formatMetric(window.signal_quality_detail.q_signal, 2)}` : ''}.${qualityNote}`,
    },
    {
      label: 'K2 · Konteks aktivitas',
      text: `Aktivitas terdeteksi/tercatat: ${activity}; ACC ${Number.isFinite(acc) ? formatMetric(acc, 3) : 'tidak tersedia'}; ${Number(window.raw_count) || 0} sampel sensor dalam window ${formatDuration(duration)}.`
        + (nextWindow
          ? ` Node berikutnya ${activity === nextActivity ? 'melanjutkan aktivitas yang sama' : `bertransisi dari ${activity} ke ${nextActivity}`} setelah ${formatDuration(Math.max(0, (toEpochMs(nextWindow.window_start) ?? 0) - (toEpochMs(window.window_start) ?? 0)))}.`
          : ' Tidak ada node berikutnya pada hari yang dipilih.'),
    },
    {
      label: 'K3 · Profil fisiologis personal',
      text: baseline
        ? `Baseline personal untuk ${window.activity_label || 'Unknown'} pada periode ${periodName} ${baselineStatus}.${baselineMeasurements}`
        : `Baseline personal untuk ${window.activity_label || 'Unknown'} pada periode ${periodName} belum ditemukan; perbandingan personal belum dapat dibuat.`,
    },
    {
      label: 'K4 · Perbandingan kontekstual',
      text: window.is_valid === false
        ? `Window ditandai tidak valid, sehingga deviasi HR tidak diinterpretasikan. Status CAPAR: ${getNodeStatus(window)}; tinjau bukti kualitas sensor sebelum membandingkan dengan baseline. Keadaan dinamis: ${temporalStateText}.`
        : baseline?.is_mature && deviation !== null
        ? `HR window ${deviation >= 0 ? 'lebih tinggi' : 'lebih rendah'} ${formatMetric(Math.abs(deviation))} bpm dari rerata baseline yang cocok${zScore !== null ? ` (z = ${formatMetric(zScore, 2)})` : ''}. Status CAPAR: ${getNodeStatus(window)}; keadaan dinamis: ${temporalStateText}. Ini adalah perbandingan observasional, bukan diagnosis; interpretasi juga perlu mempertimbangkan RR, ACC, dan kualitas sinyal.`
        : `Deviasi HR belum dapat dinilai meyakinkan karena baseline yang cocok belum matang atau fitur HR tidak tersedia. Status CAPAR: ${getNodeStatus(window)}; keadaan dinamis: ${temporalStateText}. Gunakan RR, ACC, dan bukti kualitas sensor sebagai konteks, bukan sebagai diagnosis.`,
    },
  ];
}

function RangeControl({ id, label, value, min, max, step, unit, onChange }) {
  return (
    <label className="capar-range-control" htmlFor={id}>
      <span>{label}<output>{value} {unit}</output></span>
      <input
        id={id}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <small>{min}–{max} {unit}</small>
    </label>
  );
}

function DynamicStateFlow() {
  const [selectedCode, setSelectedCode] = useState('S0');
  const selectedState = STATE_BY_CODE.get(selectedCode);

  return (
    <section className="capar-state-model">
      <div className="capar-simulator-heading">
        <div>
          <span className="eyebrow">MODEL STATE HIBRIDA</span>
          <h3>Keadaan diskrit yang dapat ditelusuri</h3>
        </div>
        <span className="capar-model-note">Pemetaan node memakai rr_status yang tersedia</span>
      </div>
      <div className="capar-state-flow" role="group" aria-label="Pilih keadaan dinamis">
        {DYNAMIC_STATES.slice(0, 5).map((state, index) => (
          <div className="capar-state-flow-step" key={state.code}>
            <button
              aria-pressed={selectedCode === state.code}
              className={`capar-state-chip ${selectedCode === state.code ? 'is-selected' : ''} ${state.code === 'S5' ? 'is-unresolved' : ''}`}
              onClick={() => setSelectedCode(state.code)}
              type="button"
            >
              <strong>{state.code}</strong>
              <span>{state.name}</span>
            </button>
            {index < 4 && <ArrowRight aria-hidden="true" size={14} />}
          </div>
        ))}
        <div className="capar-state-flow-branch">
          <span>Horizon observasi</span>
          <button
            aria-pressed={selectedCode === 'S5'}
            className={`capar-state-chip is-unresolved ${selectedCode === 'S5' ? 'is-selected' : ''}`}
            onClick={() => setSelectedCode('S5')}
            type="button"
          >
            <strong>S5</strong>
            <span>Unresolved</span>
          </button>
        </div>
      </div>
      <div className="capar-state-description">
        <strong>{selectedState.code} · {selectedState.name}</strong>
        <p>{selectedState.description}</p>
        <small>
          Alur ini konseptual; relapse S3→S2 dapat terjadi. S5 tidak ditetapkan hanya karena data berhenti atau satu window menyimpang.
        </small>
      </div>
    </section>
  );
}

function RecoverySimulator({ selectedWindow, selectedBaseline, hidden }) {
  const [baseline, setBaseline] = useState(75);
  const [initial, setInitial] = useState(135);
  const [tauA, setTauA] = useState(3);
  const [tauB, setTauB] = useState(9);
  const [tolerance, setTolerance] = useState(10);
  const [timeHorizon, setTimeHorizon] = useState(30);
  const [sourceSnapshot, setSourceSnapshot] = useState(null);
  const chart = { width: 760, height: 330, left: 52, right: 18, top: 18, bottom: 42 };
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const yMin = Math.max(30, Math.floor(Math.min(baseline - tolerance, initial) - 15));
  const yMax = Math.min(220, Math.ceil(Math.max(baseline + tolerance, initial) + 15));
  const x = (time) => chart.left + ((time / timeHorizon) * plotWidth);
  const y = (heartRate) => chart.top + (((yMax - heartRate) / (yMax - yMin)) * plotHeight);
  const pathFor = (tau) => Array.from({ length: 121 }, (_, index) => {
    const time = (index / 120) * timeHorizon;
    return `${index === 0 ? 'M' : 'L'}${x(time).toFixed(1)},${y(recoveryHeartRate(time, baseline, initial, tau)).toFixed(1)}`;
  }).join(' ');
  const ttrA = calculateRecoveryTime(baseline, initial, tauA, tolerance);
  const ttrB = calculateRecoveryTime(baseline, initial, tauB, tolerance);
  const hrAtTenA = recoveryHeartRate(10, baseline, initial, tauA);
  const hrAtTenB = recoveryHeartRate(10, baseline, initial, tauB);
  const yTicks = Array.from({ length: 5 }, (_, index) => yMin + (((yMax - yMin) / 4) * index));
  const xTicks = Array.from({ length: 7 }, (_, index) => (timeHorizon / 6) * index);
  const toleranceTop = y(Math.min(yMax, baseline + tolerance));
  const toleranceBottom = y(Math.max(yMin, baseline - tolerance));

  function reset() {
    setBaseline(75);
    setInitial(135);
    setTauA(3);
    setTauB(9);
    setTolerance(10);
    setTimeHorizon(30);
    setSourceSnapshot(null);
  }

  function useSelectedNode() {
    const nodeHr = numericValue(selectedWindow?.features?.mean_hr);
    if (!selectedWindow || selectedWindow.is_valid === false || nodeHr === null) return;
    const baselineHr = selectedBaseline?.is_mature
      ? numericValue(selectedBaseline.stats?.mean_hr?.mean)
      : null;
    setInitial(Math.round(nodeHr));
    if (baselineHr !== null) setBaseline(Math.round(baselineHr));
    setSourceSnapshot({
      activity: selectedWindow.activity_label || 'Unknown',
      windowStart: selectedWindow.window_start,
      baselineApplied: baselineHr !== null,
      baselineAdjusted: false,
    });
  }

  return (
    <section className="capar-simulator-panel panel" hidden={hidden} role="tabpanel">
      <div className="capar-simulator-intro">
        <div>
          <span className="eyebrow">DYNAMIC STATE MODEL · SIMULASI</span>
          <h2>Respons dan pemulihan HR</h2>
          <p>Model orde pertama setelah aktivitas berhenti: HR(t) = HR baseline + (HR awal − baseline) × e<sup>−t/τ</sup>.</p>
        </div>
        <div className="capar-simulator-actions">
          <button
            className="button button-light"
            disabled={!selectedWindow || selectedWindow.is_valid === false || numericValue(selectedWindow.features?.mean_hr) === null}
            onClick={useSelectedNode}
            type="button"
          >
            <Activity size={15} /> Gunakan node terpilih
          </button>
          <button className="button button-light" onClick={reset} type="button">
            <RotateCcw size={15} /> Reset
          </button>
        </div>
      </div>
      <p className="capar-simulator-source">
        {sourceSnapshot
          ? `HR awal diambil dari ${sourceSnapshot.activity} · ${formatTime(sourceSnapshot.windowStart)}. Baseline ${sourceSnapshot.baselineAdjusted ? 'disesuaikan manual' : sourceSnapshot.baselineApplied ? 'menggunakan profil cocok yang matang' : 'tetap memakai nilai slider karena baseline cocok belum matang'}. τ tetap parameter simulasi.`
          : selectedWindow
          ? `Node terpilih: ${selectedWindow.activity_label || 'Unknown'} · ${formatTime(selectedWindow.window_start)}. Gunakan tombol untuk memasukkan HR-nya sebagai HR awal simulasi.`
          : 'Pilih node yang valid pada tab Node & data CAPAR untuk memasukkan HR terukurnya ke simulasi.'}
      </p>

      <DynamicStateFlow />

      <div className="capar-simulator-grid">
        <div className="capar-simulator-controls">
          <RangeControl
            id="capar-baseline"
            label="HR baseline"
            value={baseline}
            min={Math.min(20, baseline)}
            max={Math.max(250, baseline)}
            step={1}
            unit="bpm"
            onChange={(value) => {
              setBaseline(value);
              setSourceSnapshot((current) => current && ({ ...current, baselineAdjusted: true }));
            }}
          />
          <RangeControl
            id="capar-initial"
            label="HR awal recovery"
            value={initial}
            min={20}
            max={Math.max(250, initial)}
            step={1}
            unit="bpm"
            onChange={(value) => {
              setInitial(value);
              setSourceSnapshot(null);
            }}
          />
          <RangeControl id="capar-tau-a" label="Konstanta waktu episode A (τ)" value={tauA} min={0.5} max={30} step={0.5} unit="menit" onChange={setTauA} />
          <RangeControl id="capar-tau-b" label="Konstanta waktu episode B (τ)" value={tauB} min={0.5} max={30} step={0.5} unit="menit" onChange={setTauB} />
          <RangeControl id="capar-tolerance" label="Toleransi baseline" value={tolerance} min={1} max={30} step={1} unit="bpm" onChange={setTolerance} />
          <RangeControl id="capar-time-horizon" label="Horizon grafik" value={timeHorizon} min={10} max={60} step={5} unit="menit" onChange={setTimeHorizon} />
        </div>

        <div className="capar-simulator-chart-wrap">
          <svg
            aria-label="Simulasi lintasan pemulihan denyut jantung untuk episode A dan B"
            className="capar-simulator-chart"
            role="img"
            viewBox={`0 0 ${chart.width} ${chart.height}`}
          >
            <rect
              className="capar-chart-tolerance"
              height={Math.max(0, toleranceBottom - toleranceTop)}
              width={plotWidth}
              x={chart.left}
              y={toleranceTop}
            />
            {yTicks.map((tick) => (
              <g key={`y-${tick}`}>
                <line x1={chart.left} x2={chart.left + plotWidth} y1={y(tick)} y2={y(tick)} />
                <text x={chart.left - 9} y={y(tick) + 4} textAnchor="end">{Math.round(tick)}</text>
              </g>
            ))}
            {xTicks.map((tick) => (
              <g key={`x-${tick}`}>
                <line className="capar-chart-x-tick" x1={x(tick)} x2={x(tick)} y1={chart.top + plotHeight} y2={chart.top + plotHeight + 4} />
                <text x={x(tick)} y={chart.top + plotHeight + 19} textAnchor="middle">{Math.round(tick)}</text>
              </g>
            ))}
            <line className="capar-chart-baseline" x1={chart.left} x2={chart.left + plotWidth} y1={y(baseline)} y2={y(baseline)} />
            <path className="capar-chart-episode-a" d={pathFor(tauA)} />
            <path className="capar-chart-episode-b" d={pathFor(tauB)} />
            <text className="capar-chart-axis-label" x={chart.left + (plotWidth / 2)} y={chart.height - 4} textAnchor="middle">Waktu setelah aktivitas (menit)</text>
            <text className="capar-chart-axis-label" transform={`translate(14 ${chart.top + (plotHeight / 2)}) rotate(-90)`} textAnchor="middle">HR (bpm)</text>
          </svg>
          <div className="capar-chart-legend">
            <span><i className="is-episode-a" />Episode A · τ {tauA} m</span>
            <span><i className="is-episode-b" />Episode B · τ {tauB} m</span>
            <span><i className="is-baseline" />Baseline ± toleransi</span>
          </div>
        </div>
      </div>

      <div className="capar-recovery-metrics">
        <article><span>Time to recovery A</span><strong>{formatMetric(ttrA, 1)} menit</strong><small>HR menit ke-10: {formatMetric(hrAtTenA)} bpm</small></article>
        <article><span>Time to recovery B</span><strong>{formatMetric(ttrB, 1)} menit</strong><small>HR menit ke-10: {formatMetric(hrAtTenB)} bpm</small></article>
      </div>
      <p className="capar-simulator-disclaimer">
        Simulasi matematis ilustratif, bukan data eksperimen atau diagnosis. TTR adalah waktu pertama memasuki rentang toleransi tanpa dwell time; parameter tidak diestimasi dari data pasien.
      </p>
    </section>
  );
}

export default function CaparWindowNodesPage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [dateMode, setDateMode] = useState('day');
  const [activityFilter, setActivityFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [activeView, setActiveView] = useState('nodes');
  const [windows, setWindows] = useState([]);
  const [dates, setDates] = useState([]);
  const [baselines, setBaselines] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [savedAnalysis, setSavedAnalysis] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const [selectedWindowId, setSelectedWindowId] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loading, setLoading] = useState(false);
  const [savingSegmentId, setSavingSegmentId] = useState('');
  const [savingDaily, setSavingDaily] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    api.listDoctorPatients()
      .then((data) => {
        if (active) setPatients(data);
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
      setWindows([]);
      setDates([]);
      setBaselines([]);
      setDailySummary(null);
      setSavedAnalysis(null);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    api.listDoctorCaparWindowNodes(
      selectedPatient,
      dateMode === 'day' ? selectedDate || undefined : undefined,
      dateMode === 'all',
    )
      .then((result) => {
        if (!active) return;
        setWindows(result.data || []);
        setDates(result.dates || []);
        setBaselines(result.baselines || []);
        setDailySummary(result);
        setSavedAnalysis(result.daily_analysis || null);
        setTruncated(Boolean(result.truncated));
        if (dateMode === 'day' && !selectedDate && result.selected_date) {
          setSelectedDate(result.selected_date);
        }
        setSelectedWindowId('');
      })
      .catch((reason) => {
        if (active) setError(reason.message || 'Window CAPAR gagal dimuat.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedPatient, selectedDate, dateMode, reloadKey]);

  const activities = useMemo(
    () => [...new Set(windows.map((window) => window.activity_label || 'Unknown'))]
      .sort((first, second) => first.localeCompare(second)),
    [windows],
  );
  const visibleWindows = useMemo(
    () => windows.filter((window) => (
      (activityFilter === 'all' || (window.activity_label || 'Unknown') === activityFilter)
      && (
        stateFilter === 'all'
        || (stateFilter === 'unmapped' && !getTemporalState(window))
        || getTemporalState(window)?.code === stateFilter
      )
    )),
    [windows, activityFilter, stateFilter],
  );
  const visibleWindowIds = useMemo(
    () => new Set(visibleWindows.map((window) => String(window._id))),
    [visibleWindows],
  );
  const windowIndexById = useMemo(
    () => new Map(windows.map((window, index) => [String(window._id), index])),
    [windows],
  );
  const visibleSummaries = useMemo(() => (
    (dailySummary?.activity_summaries || []).filter((summary) => (
      activityFilter === 'all' || summary.activity === activityFilter
    ))
  ), [dailySummary, activityFilter]);
  const activityTransitionByEdge = useMemo(
    () => new Map((dailySummary?.transitions || []).map((transition) => [
      `${transition.from_segment_id}:${transition.to_segment_id}`,
      transition,
    ])),
    [dailySummary],
  );
  const selectedWindow = windows.find((window) => window._id === selectedWindowId) || null;
  const selectedBaseline = selectedWindow
    ? baselines.find((baseline) => (
      baseline.activity === (selectedWindow.activity_label || 'Unknown')
      && baseline.time_period === selectedWindow.time_period
    ))
    : null;
  const selectedWindowParagraphs = selectedWindow
    && visibleWindowIds.has(String(selectedWindow._id))
    ? getWindowParagraphs(
      selectedWindow,
      selectedBaseline,
      getNextWindowInEpisode(selectedWindow),
    )
    : [];
  const combinedDateLabel = dates.length
    ? `${dates[dates.length - 1]} — ${dates[0]}`
    : 'belum ada tanggal';
  const rawCounts = windows.map((window) => Number(window.raw_count) || 0);
  const densityRange = {
    min: rawCounts.length ? Math.min(...rawCounts) : 0,
    max: rawCounts.length ? Math.max(...rawCounts) : 0,
  };
  const maxActivityCount = Math.max(
    1,
    ...(dailySummary?.activity_summaries || []).map((summary) => summary.window_count || 0),
  );
  const savedNodeCount = windows.filter((window) => window.saved).length;

  function getBaselineForWindow(window) {
    return baselines.find((baseline) => (
      baseline.activity === (window.activity_label || 'Unknown')
      && baseline.time_period === window.time_period
    ));
  }

  function getNextWindowInEpisode(window) {
    const index = windowIndexById.get(String(window._id));
    const nextWindow = index === undefined ? null : windows[index + 1];
    return nextWindow
      && getJakartaDayKey(nextWindow.window_start) === getJakartaDayKey(window.window_start)
      ? nextWindow
      : null;
  }

  async function saveNode(window) {
    setSavingSegmentId(window._id);
    setError('');
    setNotice('');
    try {
      const result = await api.saveDoctorCaparWindowNode(selectedPatient, window._id);
      setWindows((current) => current.map((item) => (
        item._id === window._id
          ? { ...item, saved: true, saved_at: result.data?.createdAt || new Date().toISOString() }
          : item
      )));
      setNotice('Snapshot node window CAPAR tersimpan.');
    } catch (reason) {
      setError(reason.message || 'Node gagal disimpan.');
    } finally {
      setSavingSegmentId('');
    }
  }

  async function saveDailyAnalysis() {
    if (!selectedDate || dateMode !== 'day') return;
    setSavingDaily(true);
    setError('');
    setNotice('');
    try {
      const result = await api.saveDoctorCaparDailyAnalysis(selectedPatient, selectedDate);
      setSavedAnalysis(result.data);
      setNotice(`Analisis harian ${selectedDate} tersimpan, termasuk ringkasan seluruh aktivitas.`);
    } catch (reason) {
      setError(reason.message || 'Analisis harian gagal disimpan.');
    } finally {
      setSavingDaily(false);
    }
  }

  return (
    <section className="capar-nodes-page">
      <SectionHeading
        eyebrow="DASHBOARD DOKTER"
        title="Node Window CAPAR"
        description="Telusuri urutan waktu fisiologi dan aktivitas, bandingkan dengan baseline personal, lalu simpan ringkasan per hari."
        action={(
          <button
            className="button button-light"
            disabled={!selectedPatient || loading}
            onClick={() => setReloadKey((key) => key + 1)}
          >
            {loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
            Perbarui
          </button>
        )}
      />

      <div className="capar-view-tabs" role="tablist" aria-label="Tampilan model CAPAR">
        <button
          aria-selected={activeView === 'nodes'}
          className={activeView === 'nodes' ? 'is-active' : ''}
          onClick={() => setActiveView('nodes')}
          role="tab"
          type="button"
        >
          Node & data CAPAR
        </button>
        <button
          aria-selected={activeView === 'simulation'}
          className={activeView === 'simulation' ? 'is-active' : ''}
          onClick={() => setActiveView('simulation')}
          role="tab"
          type="button"
        >
          Dynamic State Model
        </button>
      </div>

      {activeView === 'nodes' && (
      <div className="doctor-log-toolbar panel capar-filter-toolbar">
        <label>
          Pasien
          <span className="doctor-log-select">
            <select
              disabled={loadingPatients}
              onChange={(event) => {
                setSelectedPatient(event.target.value);
                setSelectedDate('');
                setDateMode('day');
                setActivityFilter('all');
                setStateFilter('all');
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
            <ChevronDown aria-hidden="true" size={16} />
          </span>
        </label>
        <label>
          Rentang node
          <span className="doctor-log-select">
            <select
              disabled={!selectedPatient || loading}
              onChange={(event) => {
                setDateMode(event.target.value);
                setActivityFilter('all');
                setStateFilter('all');
                setSelectedWindowId('');
              }}
              value={dateMode}
            >
              <option value="day">Satu hari</option>
              <option value="all">Gabungkan semua hari</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </span>
        </label>
        <label>
          Hari
          <span className="doctor-log-select">
            <select
              disabled={dateMode === 'all' || !selectedPatient || !dates.length || loading}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setActivityFilter('all');
                setStateFilter('all');
              }}
              value={selectedDate}
            >
              {dates.length
                ? dates.map((date) => <option key={date} value={date}>{date}</option>)
                : <option value="">Belum ada data</option>}
            </select>
            <CalendarDays aria-hidden="true" size={16} />
          </span>
        </label>
        <label>
          Filter aktivitas
          <span className="doctor-log-select">
            <select
              disabled={!activities.length}
              onChange={(event) => {
                setActivityFilter(event.target.value);
                setSelectedWindowId('');
              }}
              value={activityFilter}
            >
              <option value="all">Semua aktivitas</option>
              {activities.map((activity) => (
                <option key={activity} value={activity}>{activity}</option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </span>
        </label>
        <label>
          Filter state
          <span className="doctor-log-select">
            <select
              disabled={!windows.length}
              onChange={(event) => {
                setStateFilter(event.target.value);
                setSelectedWindowId('');
              }}
              value={stateFilter}
            >
              <option value="all">Semua state</option>
              {DYNAMIC_STATES.slice(0, 5).map((state) => (
                <option key={state.code} value={state.code}>{state.code} · {state.name}</option>
              ))}
              <option value="ABSTAIN">Bukti belum cukup</option>
              <option value="unmapped">Belum dipetakan</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </span>
        </label>
        <div className="capar-node-summary">
          <strong>{savedNodeCount} / {windows.length}</strong>
          <span>snapshot node tersimpan</span>
        </div>
      </div>
      )}

      {activeView === 'nodes' && error && (
        <div className="notice notice-warning doctor-log-error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}
      {activeView === 'nodes' && notice && <div className="capar-node-notice"><Check size={16} />{notice}</div>}

      <RecoverySimulator
        hidden={activeView !== 'simulation'}
        key={`${selectedPatient}:${dateMode}:${selectedDate}`}
        selectedBaseline={selectedBaseline}
        selectedWindow={selectedWindow}
      />
      {activeView === 'nodes' && (
        !selectedPatient ? (
        <div className="doctor-analysis-empty-state panel">
          <GitBranch size={24} />
          <strong>{loadingPatients ? 'Memuat daftar pasien...' : 'Pilih pasien untuk melihat window CAPAR'}</strong>
          {!loadingPatients && patients.length === 0 && <span>Belum ada pasien yang dapat ditinjau.</span>}
        </div>
      ) : loading ? (
        <div className="doctor-analysis-empty-state panel">
          <LoaderCircle className="spin" size={22} />
          <strong>Memuat window CAPAR...</strong>
        </div>
      ) : !windows.length ? (
        <div className="doctor-analysis-empty-state panel">
          <GitBranch size={24} />
          <strong>Window CAPAR belum tersedia</strong>
          <span>Tidak ditemukan window pada tanggal yang dipilih.</span>
        </div>
      ) : (
        <>
          <section className="capar-daily-panel panel">
            <div className="capar-section-heading">
              <div>
                <span className="eyebrow">
                  {dateMode === 'day' ? `RINGKASAN HARIAN · ${selectedDate}` : `GABUNGAN HARI · ${combinedDateLabel}`}
                </span>
                <h2>Fisiologi per aktivitas</h2>
                <p>
                  {dateMode === 'day'
                    ? 'Statistik dihitung dari window valid; kovarians memakai pasangan HR–RR yang tersedia.'
                    : 'Ringkasan menggabungkan hari yang tersedia; urutan node dan episode hariannya tetap dipisahkan.'}
                </p>
              </div>
              <div className="capar-daily-save">
                {dateMode === 'day' && savedAnalysis && (
                  <span className="capar-saved-analysis">
                    <Check size={14} /> Tersimpan {formatTime(savedAnalysis.updatedAt)}
                  </span>
                )}
                {dateMode === 'day' && (
                  <button
                    className="button button-primary"
                    disabled={savingDaily || !windows.length}
                    onClick={saveDailyAnalysis}
                  >
                    {savingDaily ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}
                    Simpan analisis harian
                  </button>
                )}
              </div>
            </div>
            {truncated && (
              <div className="notice notice-warning capar-truncated-notice">
                Tampilan dan ringkasan dibatasi sampai 10.000 window. Pilih satu hari untuk mempersempit rentang.
              </div>
            )}
            <div className="capar-activity-summaries">
              {visibleSummaries.map((summary) => (
                <article className="capar-activity-summary" key={summary.activity}>
                  <div className="capar-activity-summary-heading">
                    <strong>{summary.activity}</strong>
                    <span>{summary.valid_window_count}/{summary.window_count} valid</span>
                  </div>
                  <div className="capar-density-track" aria-label={`${summary.window_count} window`}>
                    <span style={{ width: `${Math.max(4, (summary.window_count / maxActivityCount) * 100)}%` }} />
                  </div>
                  <div className="capar-activity-summary-stats">
                    <span>Window <strong>{summary.window_count}</strong></span>
                    <span>Sampel sensor <strong>{summary.raw_sample_count}</strong></span>
                    <span>HR rata-rata <strong>{formatMetric(summary.mean_hr)} bpm</strong></span>
                    <span>RR rata-rata <strong>{formatMetric(summary.mean_rr)} ms</strong></span>
                    <span>ACC rata-rata <strong>{formatMetric(summary.mean_motion_intensity, 3)}</strong></span>
                    <span>DFA α1 <strong>{formatMetric(summary.mean_dfa_alpha1, 3)}</strong></span>
                    <span>RMSSD <strong>{formatMetric(summary.mean_rmssd)} ms</strong></span>
                    <span>HR min–max <strong>{formatMetric(summary.min_hr)}–{formatMetric(summary.max_hr)} bpm</strong></span>
                    <span>Varians HR <strong>{formatMetric(summary.hr_variance, 2)} bpm²</strong></span>
                    <span>
                      Kovarians HR–RR
                      <strong>{formatMetric(summary.hr_rr_covariance, 2)} bpm·ms · n={summary.hr_rr_pair_count || 0}</strong>
                    </span>
                  </div>
                </article>
              ))}
            </div>
            {!visibleSummaries.length && <p className="capar-empty-filter">Tidak ada ringkasan untuk filter aktivitas ini.</p>}
          </section>

          <section className="capar-node-panel panel">
            <div className="doctor-log-list-heading">
              <div>
                <span className="eyebrow">URUTAN WAKTU · WIB · NODE PER WINDOW</span>
                <h2>{patients.find((patient) => patient._id === selectedPatient)?.name || 'Pasien'}</h2>
              </div>
              <span className="doctor-log-count">
                {visibleWindows.length} node · {dateMode === 'day' ? selectedDate : `${dates.length} hari`}
              </span>
            </div>
            <CaparWindowGraph
              activities={activities}
              activityFilter={activityFilter}
              onActivitySelect={(activity) => {
                setActivityFilter((current) => (current === activity ? 'all' : activity));
                setSelectedWindowId('');
              }}
              onSelect={(windowId) => setSelectedWindowId((current) => (
                current === windowId ? '' : windowId
              ))}
              selectedWindowId={selectedWindowId}
              visibleWindows={visibleWindows}
              windows={windows}
            />
            {selectedWindowParagraphs.length > 0 && (
              <section className="capar-node-interpretation-panel" aria-live="polite">
                <div className="capar-graph-heading">
                  <div>
                    <span className="eyebrow">NODE TERPILIH · SEMANTIK K1–K4</span>
                    <h3>{selectedWindow.activity_label || 'Unknown'} · {formatTime(selectedWindow.window_start)}</h3>
                  </div>
                  <button className="button button-light" onClick={() => setSelectedWindowId('')} type="button">
                    Tutup
                  </button>
                </div>
                <div className="capar-node-interpretation">
                  {selectedWindowParagraphs.map((paragraph) => (
                    <div key={paragraph.label}>
                      <strong>{paragraph.label}</strong>
                      <p>{paragraph.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <div className="capar-legend">
              <span><i className="capar-legend-density" />Ukuran = jumlah sampel sensor per window</span>
              <span><i className="capar-legend-color" />Warna = deviasi HR dari baseline matang; tanpa baseline memakai status CAPAR</span>
              <span><b className="capar-legend-state">Sx</b> State mengikuti rr_status yang tersedia; S5 tidak disimpulkan otomatis</span>
              <span><ArrowRight size={14} /> Panah menunjukkan selang waktu dan transisi aktivitas</span>
            </div>
            <ol className="capar-node-list">
              {!visibleWindows.length && (
                <li className="capar-nodes-filter-empty">
                  Tidak ada node yang cocok dengan filter aktivitas dan state ini.
                </li>
              )}
              {visibleWindows.map((window, index) => {
                const nextWindow = getNextWindowInEpisode(window);
                const displayNextWindow = nextWindow
                  && visibleWindowIds.has(String(nextWindow._id))
                  ? nextWindow
                  : null;
                const baseline = getBaselineForWindow(window);
                const size = getNodeSize(window.raw_count, densityRange);
                const color = getNodeColor(window, baseline);
                const elapsedMs = displayNextWindow
                  ? Math.max(0, (toEpochMs(displayNextWindow.window_start) ?? 0) - (toEpochMs(window.window_start) ?? 0))
                  : null;
                const currentActivity = window.activity_label || 'Unknown';
                const nextActivity = displayNextWindow?.activity_label || 'Unknown';
                const temporalState = getTemporalState(window);
                const nextTemporalState = displayNextWindow ? getTemporalState(displayNextWindow) : null;
                const transition = displayNextWindow
                  ? currentActivity !== nextActivity
                  : false;
                const stateTransition = Boolean(
                  temporalState?.code
                  && nextTemporalState?.code
                  && temporalState.code !== nextTemporalState.code
                );
                const activityTransition = displayNextWindow && transition
                  ? activityTransitionByEdge.get(`${window._id}:${displayNextWindow._id}`)
                  : null;
                const isSelected = selectedWindowId === window._id;

                return (
                  <li className="capar-node-item" key={window._id}>
                    <button
                      aria-label={`Pilih node ${index + 1}, ${window.activity_label || 'Unknown'}, ${formatTime(window.window_start)}`}
                      className={`capar-node-marker ${window.saved ? 'capar-node-marker-saved' : ''} ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => setSelectedWindowId(isSelected ? '' : window._id)}
                      style={{
                        width: `${size}px`,
                        height: `${size}px`,
                        backgroundColor: window.saved ? '#26795f' : color,
                      }}
                      type="button"
                    >
                      {window.saved ? <Check size={14} /> : index + 1}
                    </button>
                    <article className={`capar-window-card ${isSelected ? 'is-selected' : ''}`}>
                      <button
                        className="capar-window-select"
                        onClick={() => setSelectedWindowId(isSelected ? '' : window._id)}
                        type="button"
                      >
                        <div className="capar-window-heading">
                          <div>
                            <span className="eyebrow">NODE {String(index + 1).padStart(2, '0')} · {window.window_type}</span>
                            <h3>{window.activity_label || 'Unknown'} · {getNodeStatus(window)}</h3>
                          </div>
                          <span className={`capar-window-status ${window.is_valid ? 'is-valid' : 'is-invalid'}`}>
                            {window.is_valid ? 'Data valid' : 'Perlu tinjau'}
                          </span>
                        </div>
                        <div className="capar-window-state-row">
                          {temporalState ? (
                            <span className={`capar-state-badge state-${temporalState.code.toLowerCase()}`}>
                              {temporalState.code}{temporalState.provisional ? ' · provisional' : ''} · {temporalState.name}
                            </span>
                          ) : (
                            <span className="capar-state-badge state-unmapped">
                              {window.rr_status ? 'Status belum dipetakan' : 'State belum tersedia'}
                            </span>
                          )}
                        </div>
                        <time>{formatTime(window.window_start)}</time>
                        <div className="capar-window-metrics">
                          <span>HR <strong>{formatMetric(window.features?.mean_hr)} bpm</strong></span>
                          <span>RR <strong>{formatMetric(window.features?.mean_rr)} ms</strong></span>
                          <span>ACC <strong>{formatMetric(window.features?.motion_intensity, 3)}</strong></span>
                          <span>RMSSD <strong>{formatMetric(window.features?.rmssd)} ms</strong></span>
                          <span>DFA α1 <strong>{formatMetric(window.features?.dfa_alpha1, 3)}</strong></span>
                          <span>Sampel <strong>{Number(window.raw_count) || 0}</strong></span>
                        </div>
                      </button>
                      {window.saved ? (
                        <small className="capar-window-saved-at">Node tersimpan {formatTime(window.saved_at)}</small>
                      ) : (
                        <button
                          className="button button-primary capar-node-save"
                          disabled={savingSegmentId !== '' || !window._id}
                          onClick={() => saveNode(window)}
                        >
                          {savingSegmentId === window._id
                            ? <LoaderCircle className="spin" size={15} />
                            : <Save size={15} />}
                          Simpan node
                        </button>
                      )}
                      {displayNextWindow && (
                        <div className={`capar-node-transition ${transition ? 'is-activity-transition' : ''} ${stateTransition ? 'is-state-transition' : ''}`}>
                          <ArrowRight size={14} />
                          {transition && <strong>{currentActivity} → {nextActivity}</strong>}
                          <span>Δt {formatDuration(elapsedMs)}</span>
                          {stateTransition && (
                            <span className="capar-state-edge">
                              {temporalState.code} → {nextTemporalState.code}
                            </span>
                          )}
                          {activityTransition && (
                            <span>durasi aktivitas {formatDuration(activityTransition.activity_duration_ms)}</span>
                          )}
                        </div>
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>
            <p className="capar-node-disclaimer">
              <Signal size={14} />
              Interpretasi K1–K4 adalah ringkasan observasional. Warna z-score hanya visualisasi perbandingan, bukan batas klinis atau diagnosis.
            </p>
          </section>
        </>
      ))}
    </section>
  );
}
