import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ClipboardList,
  GitBranch,
  HeartPulse,
  Lightbulb,
  LoaderCircle,
  MessageSquareText,
  Radio,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { api } from '../api';
import SectionHeading from '../components/SectionHeading';
import DoctorLogAnalytics from '../components/DoctorLogAnalytics';

const DOCTOR_VIEWS = [
  { id: 'logs', label: 'Semua log', icon: ClipboardList },
  { id: 'baseline', label: 'Baseline', icon: HeartPulse },
  { id: 'deviation', label: 'Deviasi', icon: TrendingUp },
  { id: 'recordings', label: 'Rekaman', icon: Radio },
  { id: 'observations', label: 'Hasil observasi', icon: Lightbulb },
  { id: 'answers', label: 'Jawaban pasien', icon: MessageSquareText },
  { id: 'nodes', label: 'Node & grafik', icon: GitBranch },
];

const ANALYSIS_CATEGORIES = {
  baseline: ['hil_baseline'],
  deviation: ['hil_scenario', 'hil_realtime'],
  recordings: ['hil_scenario', 'hil_realtime', 'wearable'],
  observations: ['hil_explanation', 'hil_scenario', 'scenario_session'],
  answers: ['check_in', 'scenario_questionnaire', 'scenario_event', 'hil_scenario'],
  nodes: ['hil_scenario', 'scenario_session'],
};

const LOG_CATEGORIES = [
  ['hil_session', 'Sesi HIL'],
  ['hil_scenario', 'Log skenario HIL'],
  ['hil_explanation', 'Penjelasan HIL'],
  ['hil_realtime', 'Evaluasi HIL realtime'],
  ['hil_baseline', 'Baseline HIL'],
  ['check_in', 'Check-in pasien'],
  ['patient_event', 'Aktivitas pasien'],
  ['wearable', 'Data wearable'],
  ['patient_action', 'Tindakan dan rekomendasi'],
  ['scenario_session', 'Sesi skenario'],
  ['scenario_event', 'Event skenario'],
  ['scenario_questionnaire', 'Kuesioner skenario'],
];

const CATEGORY_LABELS = Object.fromEntries(LOG_CATEGORIES);

function getLogQueries(activeView, category) {
  if (activeView === 'logs') return [category || null];
  return ANALYSIS_CATEGORIES[activeView] || [];
}

async function fetchLogPages({ patientId, categories, cursors = {}, limit = 100 }) {
  const pages = await Promise.all(categories.map(async (category) => {
    const key = category || 'all';
    const result = await api.listDoctorLogs({
      patientId: patientId || undefined,
      category: category || undefined,
      cursor: cursors[key] || undefined,
      limit,
    });
    return { key, result };
  }));
  const nextCursors = { ...cursors };
  for (const { key, result } of pages) {
    if (result.next_cursor) nextCursors[key] = result.next_cursor;
    else delete nextCursors[key];
  }
  const data = pages.flatMap(({ result }) => result.data || [])
    .sort((first, second) => {
      const timeDifference = new Date(second.log_at).getTime() - new Date(first.log_at).getTime();
      return timeDifference
        || String(second._id).localeCompare(String(first._id))
        || String(second.log_type).localeCompare(String(first.log_type));
    });
  return {
    data,
    cursors: nextCursors,
    hasMore: Object.keys(nextCursors).length > 0,
  };
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Waktu tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
}

function getLogSummary(log) {
  return log.event_type
    || log.action_type
    || log.evaluation_kind
    || log.instrument
    || log.activity
    || log.status
    || log.provider
    || log.scenario_id
    || 'Catatan pasien';
}

function getLogDetail(log) {
  return log.explanation
    || log.details
    || log.title
    || log.score_summary
    || log.recommendation
    || log.clarification
    || '';
}

export default function DoctorLogsPage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [category, setCategory] = useState('');
  const [activeView, setActiveView] = useState('logs');
  const [logs, setLogs] = useState([]);
  const [cursors, setCursors] = useState({});
  const [hasMore, setHasMore] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
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
    let active = true;
    setLoading(true);
    setError('');
    setLogs([]);
    setCursors({});
    setHasMore(false);
    fetchLogPages({
      patientId: selectedPatient || undefined,
      categories: getLogQueries(activeView, category),
      limit: 100,
    })
      .then((result) => {
        if (!active) return;
        setLogs(result.data);
        setCursors(result.cursors);
        setHasMore(result.hasMore);
      })
      .catch((reason) => {
        if (active) setError(reason.message || 'Log pasien gagal dimuat.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedPatient, category, activeView, reloadKey]);

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const result = await fetchLogPages({
        patientId: selectedPatient || undefined,
        categories: getLogQueries(activeView, category),
        cursors,
        limit: 100,
      });
      setLogs((current) => [...current, ...result.data]);
      setCursors(result.cursors);
      setHasMore(result.hasMore);
    } catch (reason) {
      setError(reason.message || 'Log berikutnya gagal dimuat.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="doctor-logs-page">
      <SectionHeading
        eyebrow="DASHBOARD DOKTER"
        title="Log pasien"
        description="Tinjau seluruh aktivitas pasien, termasuk riwayat sesi dan evaluasi HIL."
      />

      <div className="doctor-log-toolbar panel">
        <label>
          Pasien
          <span className="doctor-log-select">
            <select
              disabled={loadingPatients}
              onChange={(event) => setSelectedPatient(event.target.value)}
              value={selectedPatient}
            >
              <option value="">Semua pasien</option>
              {patients.map((patient) => (
                <option key={patient._id} value={patient._id}>
                  {patient.name || patient.email} · {patient.email}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </span>
        </label>
        {activeView === 'logs' && <label>
          Jenis log
          <span className="doctor-log-select">
            <select onChange={(event) => setCategory(event.target.value)} value={category}>
              <option value="">Semua jenis log</option>
              {LOG_CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </span>
        </label>}
        <button
          aria-label="Muat ulang log"
          className="button button-light doctor-log-refresh"
          disabled={loading}
          onClick={() => setReloadKey((key) => key + 1)}
          title="Muat ulang log"
        >
          {loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
          Perbarui
        </button>
      </div>

      <nav className="doctor-view-tabs" aria-label="Menu analisis pasien">
        {DOCTOR_VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            aria-current={activeView === id ? 'page' : undefined}
            className={`doctor-view-tab ${activeView === id ? 'doctor-view-tab-active' : ''}`}
            key={id}
            onClick={() => {
              setActiveView(id);
              if (id !== 'logs') setCategory('');
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="notice notice-warning doctor-log-error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {activeView === 'logs' ? <div className="doctor-log-list panel">
        <div className="doctor-log-list-heading">
          <div>
            <span className="eyebrow">LINIMASA</span>
            <h2>{selectedPatient ? 'Riwayat pasien terpilih' : 'Riwayat semua pasien'}</h2>
          </div>
          <span className="doctor-log-count">{logs.length} log dimuat</span>
        </div>

        {loading ? (
          <div className="doctor-log-state">
            <LoaderCircle className="spin" size={22} />
            <span>Memuat log pasien...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="doctor-log-state">
            <ClipboardList size={23} />
            <span>Belum ada log untuk filter ini.</span>
          </div>
        ) : (
          <div className="doctor-log-items">
            {logs.map((log) => (
              <details className="doctor-log-item" key={`${log.log_type}:${log._id}`}>
                <summary>
                  <span className="doctor-log-icon"><ClipboardList size={16} /></span>
                  <span className="doctor-log-main">
                    <strong>{getLogSummary(log).replaceAll('_', ' ')}</strong>
                    <span>
                      {log.patient_name || 'Pasien'} · {CATEGORY_LABELS[log.log_type] || log.log_type}
                    </span>
                    {getLogDetail(log) && <span className="doctor-log-detail">{getLogDetail(log)}</span>}
                  </span>
                  <time>{formatTimestamp(log.log_at)}</time>
                  <ChevronDown className="doctor-log-chevron" size={17} />
                </summary>
                <pre>{JSON.stringify(log, null, 2)}</pre>
              </details>
            ))}
          </div>
        )}

      </div> : (
        <DoctorLogAnalytics activeView={activeView} logs={logs} />
      )}

      {hasMore && !loading && (
        <button
          className="button button-light doctor-log-more"
          disabled={loadingMore}
          onClick={loadMore}
        >
          {loadingMore && <LoaderCircle className="spin" size={16} />}
          {loadingMore ? 'Memuat...' : 'Muat data berikutnya untuk grafik'}
        </button>
      )}
    </section>
  );
}
