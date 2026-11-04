import { useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ClipboardList, LoaderCircle, RefreshCw } from 'lucide-react';
import { api } from '../api';
import SectionHeading from '../components/SectionHeading';

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
  const [logs, setLogs] = useState([]);
  const [cursor, setCursor] = useState(null);
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
    setCursor(null);
    setHasMore(false);
    api.listDoctorLogs({
      patientId: selectedPatient || undefined,
      category: category || undefined,
    })
      .then((result) => {
        if (!active) return;
        setLogs(result.data || []);
        setCursor(result.next_cursor || null);
        setHasMore(Boolean(result.has_more));
      })
      .catch((reason) => {
        if (active) setError(reason.message || 'Log pasien gagal dimuat.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedPatient, category, reloadKey]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const result = await api.listDoctorLogs({
        patientId: selectedPatient || undefined,
        category: category || undefined,
        cursor,
      });
      setLogs((current) => [...current, ...(result.data || [])]);
      setCursor(result.next_cursor || null);
      setHasMore(Boolean(result.has_more));
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
        <label>
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
        </label>
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

      {error && (
        <div className="notice notice-warning doctor-log-error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <div className="doctor-log-list panel">
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

        {hasMore && (
          <button
            className="button button-light doctor-log-more"
            disabled={loadingMore}
            onClick={loadMore}
          >
            {loadingMore && <LoaderCircle className="spin" size={16} />}
            {loadingMore ? 'Memuat...' : 'Muat log berikutnya'}
          </button>
        )}
      </div>
    </section>
  );
}
