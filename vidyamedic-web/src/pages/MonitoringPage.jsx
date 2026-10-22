import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CircleHelp,
  Clock3,
  Heart,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import HeartRateChart from '../components/HeartRateChart';
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
  account,
  dashboard,
  loading,
  refresh,
  onNavigate,
}) {
  const overview = dashboard.overview?.overview || {};
  const samples = dashboard.history || [];
  const currentSample = overview.latest_wearable_sample
    || [...samples].reverse().find((item) => !item.is_simulated);
  const capar = dashboard.insights?.capar || {};
  const today = new Date().toDateString();
  const todayHeartRates = samples
    .filter((item) => !item.is_simulated)
    .filter((item) => new Date(item.recorded_at).toDateString() === today)
    .map((item) => numberOrNull(item.heart_rate_bpm))
    .filter((value) => value != null);
  const meanHr = todayHeartRates.length
    ? Math.round(todayHeartRates.reduce((total, value) => total + value, 0) / todayHeartRates.length)
    : null;
  const lastUpdated = currentSample?.recorded_at || samples.at(-1)?.recorded_at;
  const historicalSamples = [...samples].reverse().slice(0, 20);

  return (
    <>
      <SectionHeading
        action={
          <button className="button button-light" disabled={loading} onClick={refresh}>
            {loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
            Perbarui
          </button>
        }
        description={`Selamat datang, ${account?.name || 'Peserta'}. Berikut ringkasan data kesehatan Anda.`}
        eyebrow="RINGKASAN HARI INI"
        title="Monitoring"
      />
      {dashboard.errors?.length > 0 && (
        <div className="notice notice-warning">
          <AlertCircle size={18} />
          <span>Beberapa data belum berhasil dimuat. Periksa koneksi backend atau coba perbarui.</span>
        </div>
      )}
      {currentSample?.is_simulated && (
        <div className="notice notice-warning">
          <AlertCircle size={18} />
          <span>Data terakhir berasal dari simulasi dan tidak digunakan sebagai pengukuran nyata.</span>
        </div>
      )}
      <div className="metric-grid">
        <MetricCard
          icon={Heart}
          label="Denyut jantung terakhir"
          note={currentSample ? `Terekam ${formatTime(currentSample.recorded_at)}` : 'Belum ada sampel wearable'}
          tone="rose"
          unit="bpm"
          value={currentSample?.is_simulated ? null : numberOrNull(currentSample?.heart_rate_bpm)}
        />
        <MetricCard
          icon={Activity}
          label="Rerata hari ini"
          note={todayHeartRates.length ? `${todayHeartRates.length} titik rekaman nyata` : 'Belum ada data nyata hari ini'}
          tone="green"
          unit="bpm"
          value={meanHr}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Status CAPAR"
          note={capar.baseline?.total_contexts ? `${capar.baseline.mature_contexts || 0} baseline matang dari ${capar.baseline.total_contexts}` : 'Ringkasan berdasarkan data yang tersedia'}
          tone="blue"
          unit=""
          value={getStatusLabel(capar.status)}
        />
        <MetricCard
          icon={CalendarDays}
          label="Check-in 7 hari"
          note="Jumlah catatan check-in tersimpan"
          tone="gold"
          unit=""
          value={overview.check_ins_last_7_days ?? '—'}
        />
      </div>

      <div className="content-grid monitoring-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div><h2>Tren denyut jantung</h2><p>Riwayat 30 hari · sampel nyata</p></div>
            <span className="live-label"><i /> Data personal</span>
          </div>
          <HeartRateChart samples={samples} />
        </section>
        <section className="panel latest-panel">
          <div className="panel-heading">
            <div><h2>Aktivitas terbaru</h2><p>Rekaman wearable terakhir</p></div>
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
              {currentSample.is_simulated && <span className="simulation-tag">SIMULASI</span>}
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
