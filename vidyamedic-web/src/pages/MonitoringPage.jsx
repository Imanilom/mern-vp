import {
  Activity,
  AlertCircle,
  ArrowRight,
  CircleHelp,
  Clock3,
  Heart,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import HourlyPhysiologyChart from '../components/HourlyPhysiologyChart';
import DataTable from '../components/DataTable';
import MetricCard from '../components/MetricCard';
import SectionHeading from '../components/SectionHeading';
import { formatDate, formatTime, getStatusLabel, numberOrNull } from '../utils/formatters';

const wearableHistoryColumns = [
  {
    key: 'recorded_at',
    label: 'Waktu',
    render: (row) => `${formatDate(row.recorded_at, { day: 'numeric', month: 'short' })} ${formatTime(row.recorded_at)}`,
  },
  { key: 'activity', label: 'Aktivitas' },
  { key: 'heart_rate_bpm', label: 'Denyut jantung', render: (row) => numberOrNull(row.heart_rate_bpm) ?? '—' },
  { key: 'heart_rate_min_bpm', label: 'Min', render: (row) => numberOrNull(row.heart_rate_min_bpm) ?? '—' },
  { key: 'heart_rate_max_bpm', label: 'Maks', render: (row) => numberOrNull(row.heart_rate_max_bpm) ?? '—' },
  { key: 'rmssd_ms', label: 'RMSSD (ms)', render: (row) => numberOrNull(row.rmssd_ms) == null ? '—' : Math.round(row.rmssd_ms) },
  { key: 'sample_count', label: 'Sampel' },
  { key: 'source', label: 'Sumber', render: (row) => row.is_simulated ? 'Simulasi' : row.source === 'capar_polar' ? 'Polar / CAPAR' : 'Wearable' },
];

export default function MonitoringPage({
  dashboard,
  loading,
  refresh,
  onNavigate,
}) {
  const overview = dashboard.overview?.overview || {};
  const samples = dashboard.history || [];
  const latestRealSample = [...samples]
    .filter((item) => !item.is_simulated && Number.isFinite(new Date(item.recorded_at).getTime()))
    .sort((first, second) => new Date(second.recorded_at) - new Date(first.recorded_at))[0];
  const currentSample = overview.latest_wearable_sample?.is_simulated
    ? latestRealSample
    : overview.latest_wearable_sample || latestRealSample;
  const capar = dashboard.insights?.capar || {};
  const caparTimeline = capar.trajectory_24h || [];
  const latestCapar = [...caparTimeline].sort(
    (first, second) => new Date(second.recorded_at) - new Date(first.recorded_at),
  )[0];
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const lastUpdated = currentSample?.recorded_at || latestRealSample?.recorded_at;
  const recentWearable = samples
    .filter((item) => !item.is_simulated && new Date(item.recorded_at).getTime() >= dayAgo)
    .map((item) => ({
      ...item,
      event_type: 'Wearable',
      state: item.data_quality?.status || 'Rekaman wearable',
      quality: item.data_quality?.q_signal ?? item.signal_quality ?? null,
    }));
  const recentCapar = caparTimeline
    .filter((item) => new Date(item.recorded_at).getTime() >= dayAgo)
    .map((item) => ({
      recorded_at: item.recorded_at,
      activity: item.activity,
      heart_rate_bpm: item.features?.mean_hr,
      rmssd_ms: item.features?.rmssd,
      quality: item.quality,
      state: item.personal_state || item.state || 'Segmen CAPAR',
      event_type: 'Segmen CAPAR',
    }));
  const recentCheckIns = (dashboard.checkIns || [])
    .filter((item) => new Date(item.recorded_at).getTime() >= dayAgo)
    .map((item) => ({
      recorded_at: item.recorded_at,
      activity: item.activity || item.posture || 'Konteks tidak dicatat',
      state: [
        item.feeling ? `Mood: ${item.feeling.replaceAll('_', ' ')}` : null,
        item.stress_level ? `Stres: ${item.stress_level}/3` : null,
        item.lifestyle?.meal == null ? null : `Makan: ${item.lifestyle.meal ? 'ya' : 'tidak'}`,
        item.symptoms?.length ? `Gejala: ${item.symptoms.join(', ')}` : null,
      ].filter(Boolean).join(' · ') || 'Check-in',
      event_type: 'Check-in',
    }));
  const integratedTimeline = [...recentWearable, ...recentCapar, ...recentCheckIns]
    .sort((first, second) => new Date(second.recorded_at) - new Date(first.recorded_at))
    .slice(0, 50);
  const mismatches = (capar.deviation_explanations || []).flatMap((item) => (
    item.evidence_conflicts || []
  )).filter((item) => item.type === 'context_sensor_activity_disagreement');
  const signalQuality = numberOrNull(
    latestCapar?.quality ?? currentSample?.data_quality?.q_signal ?? currentSample?.signal_quality,
  );
  const currentSampleAgeMinutes = currentSample
    && Number.isFinite(new Date(currentSample.recorded_at).getTime())
    ? Math.max(0, Math.round((Date.now() - new Date(currentSample.recorded_at).getTime()) / 60000))
    : null;
  const syncStatus = currentSampleAgeMinutes == null
    ? 'Belum ada data perangkat'
    : currentSampleAgeMinutes <= 10
      ? 'Data baru diterima'
      : 'Data tersimpan · tidak live';

  return (
    <>
      <SectionHeading
        action={
          <button className="button button-light" disabled={loading} onClick={refresh}>
            {loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
            Perbarui
          </button>
        }
        description="Amati HR, HRV, aktivitas, konteks, dan kualitas sinyal dalam satu timeline."
        eyebrow="VIDYAMEDIC / MONITORING"
        title="Pemantauan wearable"
      />
      {dashboard.errors?.length > 0 && (
        <div className="notice notice-warning">
          <AlertCircle size={18} />
          <span>Beberapa data belum berhasil dimuat. Periksa koneksi backend atau coba perbarui.</span>
        </div>
      )}
      <div className="monitoring-device-status">
        <span className={`device-status-pill ${currentSampleAgeMinutes != null && currentSampleAgeMinutes <= 10 ? 'recent' : ''}`}>
          <i /> {syncStatus}
        </span>
        <span>Perangkat: {overview.wearable_provider || dashboard.profile?.profile?.wearable_provider || 'Belum dipilih'}</span>
        <span>Terakhir diperbarui: {lastUpdated ? `${formatDate(lastUpdated, { day: 'numeric', month: 'short' })} ${formatTime(lastUpdated)}` : 'Belum tersedia'}</span>
      </div>
      <div className="metric-grid monitoring-metrics monitoring-live-metrics">
        <MetricCard
          icon={Heart}
          label="HR terakhir"
          note={currentSample ? `Terekam ${formatTime(currentSample.recorded_at)}` : 'Belum ada sampel wearable'}
          tone="rose"
          unit="bpm"
          value={numberOrNull(currentSample?.heart_rate_bpm)}
        />
        <MetricCard
          icon={Activity}
          label="RMSSD terakhir"
          note={currentSample?.rmssd_ms > 0 ? `Terekam ${formatTime(currentSample.recorded_at)}` : 'Belum tersedia dari wearable'}
          tone="green"
          unit="ms"
          value={numberOrNull(currentSample?.rmssd_ms)}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Kualitas segmen"
          note={latestCapar ? 'Segmen CAPAR terbaru' : 'Belum tersedia dari CAPAR'}
          tone="blue"
          unit=""
          value={signalQuality == null ? null : `${Math.round(signalQuality * 100)}%`}
        />
      </div>

      <div className="content-grid monitoring-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div><h2>Live Signal Monitor</h2><p>24 jam · HR dan RMSSD dari rekaman aktual, bukan sinyal live</p></div>
            <span className="live-label"><i /> {syncStatus}</span>
          </div>
          <HourlyPhysiologyChart samples={samples} />
        </section>
        <section className="panel latest-panel">
          <div className="panel-heading">
            <div><h2>Konteks & kualitas</h2><p>Ringkasan sumber data terbaru</p></div>
            <span className="panel-icon"><Clock3 size={18} /></span>
          </div>
          {currentSample ? (
            <div className="latest-content">
              <div className="latest-number">
                {currentSample.is_simulated ? '—' : Math.round(currentSample.heart_rate_bpm || 0)}
                <span>bpm</span>
              </div>
              <div className="latest-date">
                {formatDate(currentSample.recorded_at, { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}{formatTime(currentSample.recorded_at)}
              </div>
              <div className="latest-divider" />
              <div className="latest-row">
                <span>Aktivitas</span><strong>{currentSample.activity || 'Tidak dicatat'}</strong>
              </div>
              <div className="latest-row">
                <span>Kualitas sinyal</span>
                <strong>
                  {currentSample.data_quality?.q_signal != null || currentSample.signal_quality != null
                    ? `${Math.round((currentSample.data_quality?.q_signal ?? currentSample.signal_quality) * 100)}%`
                    : '—'}
                </strong>
              </div>
            </div>
          ) : (
            <div className="empty-state small-empty">
              <div className="empty-chart-icon"><Heart size={20} /></div>
              <strong>Belum ada rekaman wearable</strong>
              <p>Pasangkan Polar H10 melalui aplikasi Vidyamedic untuk mulai mencatat data.</p>
            </div>
          )}
          <button className="text-button" onClick={() => onNavigate('deteksi')}>
            Lihat ringkasan deteksi dini <ArrowRight size={15} />
          </button>
        </section>
      </div>
      {mismatches.length > 0 && (
        <div className="notice notice-warning monitoring-context-warning">
          <AlertCircle size={18} />
          <span>
            <strong>Pencocokan konteks diperlukan.</strong>
            {' '}Label aktivitas dari sensor dan laporan pengguna dapat berbeda. Tinjau episode sebelum menentukan tindakan.
            <button className="text-button" onClick={() => onNavigate('deteksi')}> Tinjau event</button>
          </span>
        </div>
      )}
      <section className="panel historical-panel monitoring-timeline">
        <div className="panel-heading">
          <div><h2>Timeline aktivitas terintegrasi</h2><p>Wearable, segmen CAPAR, dan check-in dalam 24 jam terakhir</p></div>
          <span className="panel-icon"><Clock3 size={18} /></span>
        </div>
        <DataTable
          columns={[
            { key: 'event_type', label: 'Sumber' },
            { key: 'recorded_at', label: 'Waktu', render: (row) => `${formatDate(row.recorded_at, { day: 'numeric', month: 'short' })} ${formatTime(row.recorded_at)}` },
            { key: 'activity', label: 'Aktivitas / konteks', render: (row) => row.activity || 'Tidak dicatat' },
            { key: 'heart_rate_bpm', label: 'HR', render: (row) => numberOrNull(row.heart_rate_bpm) == null ? '—' : `${Math.round(row.heart_rate_bpm)} bpm` },
            { key: 'rmssd_ms', label: 'HRV / RMSSD', render: (row) => numberOrNull(row.rmssd_ms) == null ? '—' : `${Math.round(row.rmssd_ms)} ms` },
            { key: 'quality', label: 'Q-signal', render: (row) => numberOrNull(row.quality) == null ? '—' : `${Math.round(row.quality * 100)}%` },
            { key: 'state', label: 'Status / catatan', render: (row) => getStatusLabel(row.state) },
          ]}
          rows={integratedTimeline}
          rowKey={(row) => `${row.event_type}:${row.recorded_at}:${row.activity || ''}`}
          emptyMessage="Belum ada data wearable, CAPAR, atau check-in dalam 24 jam terakhir."
        />
      </section>
      <section className="panel historical-panel wearable-history-panel">
        <div className="panel-heading">
          <div><h2>Riwayat wearable</h2><p>Rekaman 30 hari terakhir, dikelompokkan per 30 menit</p></div>
          <span className="panel-icon"><Clock3 size={18} /></span>
        </div>
        <DataTable
          columns={wearableHistoryColumns}
          rows={historicalSamples}
          rowKey={(row) => `${row.recorded_at}:${row.source}:${row.activity}`}
          emptyMessage="Belum ada data wearable pada periode ini."
        />
      </section>
      <div className="disclaimer">
        <CircleHelp size={16} />
        <span>Ringkasan data wearable dan CAPAR bukan diagnosis atau pengganti saran tenaga kesehatan.</span>
        <span className="disclaimer-date">Pembaruan: {formatTime(lastUpdated)}</span>
      </div>
    </>
  );
}
