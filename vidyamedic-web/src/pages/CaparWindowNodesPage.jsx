import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  GitBranch,
  LoaderCircle,
  RefreshCw,
  Save,
} from 'lucide-react';
import { api } from '../api';
import SectionHeading from '../components/SectionHeading';

function formatTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Waktu tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatMetric(value, digits = 1) {
  if (value === null || value === undefined || value === '') return '—';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : '—';
}

function getNodeStatus(window) {
  if (window.classification) return window.classification;
  return window.analyzed ? 'Sudah dianalisis' : 'Belum dianalisis';
}

export default function CaparWindowNodesPage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [windows, setWindows] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loading, setLoading] = useState(false);
  const [savingSegmentId, setSavingSegmentId] = useState('');
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
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    api.listDoctorCaparWindowNodes(selectedPatient)
      .then((data) => {
        if (active) setWindows(data);
      })
      .catch((reason) => {
        if (active) setError(reason.message || 'Window CAPAR gagal dimuat.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedPatient, reloadKey]);

  const chronologicalWindows = useMemo(
    () => [...windows].sort((first, second) => first.window_start - second.window_start),
    [windows],
  );
  const savedCount = windows.filter((window) => window.saved).length;

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
      setNotice('Node window CAPAR berhasil disimpan ke MongoDB.');
    } catch (reason) {
      setError(reason.message || 'Node gagal disimpan.');
    } finally {
      setSavingSegmentId('');
    }
  }

  return (
    <section className="capar-nodes-page">
      <SectionHeading
        eyebrow="DASHBOARD DOKTER"
        title="Node Window CAPAR"
        description="Tinjau window CAPAR sebagai rangkaian node dan simpan snapshot window ke MongoDB."
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

      <div className="doctor-log-toolbar panel">
        <label>
          Pasien
          <span className="doctor-log-select">
            <select
              disabled={loadingPatients}
              onChange={(event) => setSelectedPatient(event.target.value)}
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
        <div className="capar-node-summary">
          <strong>{savedCount} / {windows.length}</strong>
          <span>node tersimpan dari {windows.length} window terbaru</span>
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
      ) : chronologicalWindows.length === 0 ? (
        <div className="doctor-analysis-empty-state panel">
          <GitBranch size={24} />
          <strong>Window CAPAR belum tersedia</strong>
          <span>Belum ditemukan window CAPAR valid untuk pasien ini.</span>
        </div>
      ) : (
        <div className="capar-node-panel panel">
          <div className="doctor-log-list-heading">
            <div>
              <span className="eyebrow">ALUR WINDOW</span>
              <h2>{patients.find((patient) => patient._id === selectedPatient)?.name || 'Pasien'}</h2>
            </div>
            <span className="doctor-log-count">{windows.length} window terbaru · maksimum 100</span>
          </div>
          <ol className="capar-node-list">
            {chronologicalWindows.map((window, index) => (
              <li className="capar-node-item" key={window._id}>
                <span className={`capar-node-marker ${window.saved ? 'capar-node-marker-saved' : ''}`}>
                  {window.saved ? <Check size={15} /> : index + 1}
                </span>
                <article className="capar-window-card">
                  <div className="capar-window-heading">
                    <div>
                      <span className="eyebrow">NODE {String(index + 1).padStart(2, '0')} · {window.window_type}</span>
                      <h3>{getNodeStatus(window)}</h3>
                    </div>
                    <span className={`capar-window-status ${window.saved ? 'is-saved' : ''}`}>
                      {window.saved ? 'Tersimpan' : 'Belum disimpan'}
                    </span>
                  </div>
                  <time>{formatTime(window.window_start)}</time>
                  <div className="capar-window-metrics">
                    <span>Aktivitas <strong>{window.activity_label || 'Unknown'}</strong></span>
                    <span>Skor <strong>{formatMetric(window.anomaly_score, 2)}</strong></span>
                    <span>HR <strong>{formatMetric(window.features?.mean_hr)} bpm</strong></span>
                    <span>RMSSD <strong>{formatMetric(window.features?.rmssd)} ms</strong></span>
                    <span>SDNN <strong>{formatMetric(window.features?.sdnn)} ms</strong></span>
                  </div>
                  {window.saved ? (
                    <small className="capar-window-saved-at">Disimpan {formatTime(window.saved_at)}</small>
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
                </article>
              </li>
            ))}
          </ol>
          <p className="capar-node-disclaimer">
            Node menyimpan snapshot fitur window dan referensi sumbernya; status CAPAR bukan diagnosis klinis.
          </p>
        </div>
      )}
    </section>
  );
}
