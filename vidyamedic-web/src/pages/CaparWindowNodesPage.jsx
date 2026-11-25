import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  GitBranch,
  LoaderCircle,
  RefreshCw,
  Save,
  Signal,
} from 'lucide-react';
import { api } from '../api';
import SectionHeading from '../components/SectionHeading';

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
    timeStyle: 'short',
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
        ? `Window ditandai tidak valid, sehingga deviasi HR tidak diinterpretasikan. Status CAPAR: ${getNodeStatus(window)}; tinjau bukti kualitas sensor sebelum membandingkan dengan baseline.`
        : baseline?.is_mature && deviation !== null
        ? `HR window ${deviation >= 0 ? 'lebih tinggi' : 'lebih rendah'} ${formatMetric(Math.abs(deviation))} bpm dari rerata baseline yang cocok${zScore !== null ? ` (z = ${formatMetric(zScore, 2)})` : ''}. Status CAPAR: ${getNodeStatus(window)}. Ini adalah perbandingan observasional, bukan diagnosis; interpretasi juga perlu mempertimbangkan RR, ACC, dan kualitas sinyal.`
        : `Deviasi HR belum dapat dinilai meyakinkan karena baseline yang cocok belum matang atau fitur HR tidak tersedia. Status CAPAR: ${getNodeStatus(window)}; gunakan RR, ACC, dan bukti kualitas sensor sebagai konteks, bukan sebagai diagnosis.`,
    },
  ];
}

export default function CaparWindowNodesPage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
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
    api.listDoctorCaparWindowNodes(selectedPatient, selectedDate || undefined)
      .then((result) => {
        if (!active) return;
        setWindows(result.data || []);
        setDates(result.dates || []);
        setBaselines(result.baselines || []);
        setDailySummary(result);
        setSavedAnalysis(result.daily_analysis || null);
        setTruncated(Boolean(result.truncated));
        if (!selectedDate && result.selected_date) setSelectedDate(result.selected_date);
        setSelectedWindowId('');
      })
      .catch((reason) => {
        if (active) setError(reason.message || 'Window CAPAR gagal dimuat.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedPatient, selectedDate, reloadKey]);

  const activities = useMemo(
    () => [...new Set(windows.map((window) => window.activity_label || 'Unknown'))]
      .sort((first, second) => first.localeCompare(second)),
    [windows],
  );
  const visibleWindows = useMemo(
    () => windows.filter((window) => (
      activityFilter === 'all' || (window.activity_label || 'Unknown') === activityFilter
    )),
    [windows, activityFilter],
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
  const selectedIndex = selectedWindow
    ? visibleWindows.findIndex((window) => window._id === selectedWindow._id)
    : -1;
  const selectedNextWindow = selectedIndex >= 0 ? visibleWindows[selectedIndex + 1] : null;
  const selectedBaseline = selectedWindow
    ? baselines.find((baseline) => (
      baseline.activity === (selectedWindow.activity_label || 'Unknown')
      && baseline.time_period === selectedWindow.time_period
    ))
    : null;
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
    if (!selectedDate) return;
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

      <div className="doctor-log-toolbar panel capar-filter-toolbar">
        <label>
          Pasien
          <span className="doctor-log-select">
            <select
              disabled={loadingPatients}
              onChange={(event) => {
                setSelectedPatient(event.target.value);
                setSelectedDate('');
                setActivityFilter('all');
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
          Tanggal analisis
          <span className="doctor-log-select">
            <select
              disabled={!selectedPatient || !dates.length || loading}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setActivityFilter('all');
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
              onChange={(event) => setActivityFilter(event.target.value)}
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
        <div className="capar-node-summary">
          <strong>{savedNodeCount} / {windows.length}</strong>
          <span>snapshot node tersimpan</span>
        </div>
      </div>

      {error && (
        <div className="notice notice-warning doctor-log-error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}
      {notice && <div className="capar-node-notice"><Check size={16} />{notice}</div>}

      {!selectedPatient ? (
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
                <span className="eyebrow">RINGKASAN HARIAN · {selectedDate}</span>
                <h2>Fisiologi per aktivitas</h2>
                <p>Statistik dihitung dari window valid; kovarians memakai pasangan HR–RR yang tersedia.</p>
              </div>
              <div className="capar-daily-save">
                {savedAnalysis && (
                  <span className="capar-saved-analysis">
                    <Check size={14} /> Tersimpan {formatTime(savedAnalysis.updatedAt)}
                  </span>
                )}
                <button
                  className="button button-primary"
                  disabled={savingDaily || !windows.length}
                  onClick={saveDailyAnalysis}
                >
                  {savingDaily ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}
                  Simpan analisis harian
                </button>
              </div>
            </div>
            {truncated && (
              <div className="notice notice-warning capar-truncated-notice">
                Tampilan dibatasi sampai 10.000 window. Snapshot harian tetap menghitung seluruh data tanggal ini.
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
                <span className="eyebrow">URUTAN WAKTU · WIB</span>
                <h2>{patients.find((patient) => patient._id === selectedPatient)?.name || 'Pasien'}</h2>
              </div>
              <span className="doctor-log-count">{visibleWindows.length} node · {selectedDate}</span>
            </div>
            <div className="capar-legend">
              <span><i className="capar-legend-density" />Ukuran = jumlah sampel sensor per window</span>
              <span><i className="capar-legend-color" />Warna = deviasi HR dari baseline matang; tanpa baseline memakai status CAPAR</span>
              <span><ArrowRight size={14} /> Panah menunjukkan selang waktu dan transisi aktivitas</span>
            </div>
            <ol className="capar-node-list">
              {visibleWindows.map((window, index) => {
                const nextWindow = visibleWindows[index + 1];
                const baseline = getBaselineForWindow(window);
                const size = getNodeSize(window.raw_count, densityRange);
                const color = getNodeColor(window, baseline);
                const elapsedMs = nextWindow
                  ? Math.max(0, (toEpochMs(nextWindow.window_start) ?? 0) - (toEpochMs(window.window_start) ?? 0))
                  : null;
                const currentActivity = window.activity_label || 'Unknown';
                const nextActivity = nextWindow?.activity_label || 'Unknown';
                const transition = nextWindow
                  ? currentActivity !== nextActivity
                  : false;
                const activityTransition = nextWindow && transition
                  ? activityTransitionByEdge.get(`${window._id}:${nextWindow._id}`)
                  : null;
                const isSelected = selectedWindowId === window._id;
                const paragraphs = isSelected
                  ? getWindowParagraphs(window, baseline, nextWindow)
                  : [];

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
                      {nextWindow && (
                        <div className={`capar-node-transition ${transition ? 'is-activity-transition' : ''}`}>
                          <ArrowRight size={14} />
                          {transition && <strong>{currentActivity} → {nextActivity}</strong>}
                          <span>Δt {formatDuration(elapsedMs)}</span>
                          {activityTransition && (
                            <span>durasi aktivitas {formatDuration(activityTransition.activity_duration_ms)}</span>
                          )}
                        </div>
                      )}
                      {isSelected && (
                        <div className="capar-node-interpretation">
                          {paragraphs.map((paragraph) => (
                            <div key={paragraph.label}>
                              <strong>{paragraph.label}</strong>
                              <p>{paragraph.text}</p>
                            </div>
                          ))}
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
      )}
    </section>
  );
}
