import {
  Activity,
  ArrowRight,
  CalendarDays,
  Heart,
  ShieldCheck,
} from 'lucide-react';
import HeartRateChart from '../components/HeartRateChart';
import MetricCard from '../components/MetricCard';
import SectionHeading from '../components/SectionHeading';
import { formatDate, formatTime, getStatusLabel, numberOrNull } from '../utils/formatters';

function isToday(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    && date.toDateString() === new Date().toDateString();
}

export default function DashboardPage({ account, dashboard, onNavigate }) {
  const overview = dashboard.overview?.overview || {};
  const capar = dashboard.insights?.capar || {};
  const todaySamples = (dashboard.history || []).filter(
    (sample) => !sample.is_simulated && isToday(sample.recorded_at),
  );
  const currentSample = overview.latest_wearable_sample?.is_simulated
    ? [...(dashboard.history || [])].reverse().find((sample) => !sample.is_simulated)
    : overview.latest_wearable_sample
      || [...(dashboard.history || [])].reverse().find((sample) => !sample.is_simulated);
  function weightedAverage(field, { positiveOnly = false } = {}) {
    const readings = todaySamples
      .map((sample) => ({
        value: numberOrNull(sample[field]),
        weight: numberOrNull(sample.sample_count) || 1,
      }))
      .filter(({ value }) => value != null && (!positiveOnly || value > 0));
    const totalWeight = readings.reduce((sum, item) => sum + item.weight, 0);
    return totalWeight
      ? Math.round(readings.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight)
      : null;
  }
  const meanHr = weightedAverage('heart_rate_bpm');
  const meanRmssd = weightedAverage('rmssd_ms', { positiveOnly: true });
  const rmssdCount = todaySamples.filter((sample) => {
    const value = numberOrNull(sample.rmssd_ms);
    return value != null && value > 0;
  }).length;
  const latestCheckIn = overview.latest_check_in;
  const profileName = account?.name || 'Peserta';

  return (
    <>
      <SectionHeading
        description={`Ringkasan kesehatan personal untuk ${profileName}. Data hanya ditampilkan saat tersedia dari catatan Anda.`}
        eyebrow="VIDYAMEDIC / DASHBOARD"
        title="Health intelligence"
      />
      <section className="hero-banner">
        <div>
          <span className="eyebrow">RINGKASAN PERSONAL</span>
          <h2>Memahami pola kesehatan Anda, selangkah demi selangkah</h2>
          <p>
            Lihat pengukuran wearable, check-in, dan status analisis personal
            dalam satu tempat. Ringkasan ini bukan diagnosis.
          </p>
        </div>
        <button className="button button-light" onClick={() => onNavigate('deteksi')}>
          Lihat deteksi dini <ArrowRight size={15} />
        </button>
      </section>
      <div className="metric-grid dashboard-metrics">
        <MetricCard
          icon={Heart}
          label="Denyut jantung hari ini"
          note={todaySamples.length ? `${todaySamples.length} ringkasan wearable nyata` : 'Belum ada bacaan nyata hari ini'}
          tone="rose"
          unit="bpm"
          value={meanHr}
        />
        <MetricCard
          icon={Activity}
          label="HRV / RMSSD hari ini"
          note={rmssdCount ? `${rmssdCount} ringkasan memiliki RMSSD` : 'Belum ada RMSSD dari wearable hari ini'}
          tone="green"
          unit="ms"
          value={meanRmssd}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Status analisis"
          note={capar.baseline?.total_contexts
            ? `${capar.baseline.mature_contexts || 0} baseline matang dari ${capar.baseline.total_contexts}`
            : 'Berdasarkan data personal yang tersedia'}
          tone="blue"
          unit=""
          value={getStatusLabel(capar.status)}
        />
        <MetricCard
          icon={CalendarDays}
          label="Check-in 7 hari"
          note={latestCheckIn
            ? `Terakhir dicatat ${formatDate(latestCheckIn.recorded_at, { day: 'numeric', month: 'short' })}`
            : 'Belum ada check-in tercatat'}
          tone="gold"
          unit=""
          value={overview.check_ins_last_7_days ?? '—'}
        />
      </div>
      <div className="content-grid dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Tren denyut jantung</h2>
              <p>30 hari terakhir · bacaan wearable nyata</p>
            </div>
            <span className="live-label"><i /> Data personal</span>
          </div>
          <HeartRateChart samples={dashboard.history || []} />
        </section>
        <section className="panel dashboard-latest">
          <div className="panel-heading">
            <div><h2>Pengukuran terakhir</h2><p>Rekaman wearable personal</p></div>
            <span className="panel-icon"><Heart size={17} /></span>
          </div>
          {currentSample ? (
            <>
              <div className="latest-content">
                <div className="latest-number">
                  {Math.round(currentSample.heart_rate_bpm || 0)}<span>bpm</span>
                </div>
                <div className="latest-date">
                  {formatDate(currentSample.recorded_at, { day: 'numeric', month: 'long', year: 'numeric' })}
                  {' · '}{formatTime(currentSample.recorded_at)}
                </div>
                <div className="latest-divider" />
                <div className="latest-row"><span>Aktivitas</span><strong>{currentSample.activity || 'Tidak dicatat'}</strong></div>
                <div className="latest-row"><span>RMSSD</span><strong>{currentSample.rmssd_ms > 0 ? `${Math.round(currentSample.rmssd_ms)} ms` : 'Belum tersedia'}</strong></div>
              </div>
              <button className="text-button" onClick={() => onNavigate('monitoring')}>
                Buka monitoring <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-chart-icon"><Heart size={20} /></div>
              <strong>Belum ada pengukuran wearable nyata</strong>
              <p>Pengukuran akan muncul setelah perangkat mengirimkan bacaan yang tersimpan.</p>
            </div>
          )}
        </section>
      </div>
      {latestCheckIn && (
        <section className="panel dashboard-checkin">
          <div className="panel-heading">
            <div><h2>Check-in terakhir</h2><p>Catatan harian Anda, terpisah dari pengukuran wearable</p></div>
            <span className="panel-icon"><CalendarDays size={17} /></span>
          </div>
          <div className="dashboard-checkin-row">
            <div>
              <strong>{formatDate(latestCheckIn.recorded_at, { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              <span>{formatTime(latestCheckIn.recorded_at)}</span>
            </div>
            <p>{latestCheckIn.activity || 'Aktivitas belum dicatat'}</p>
            <button className="text-button" onClick={() => onNavigate('laporan')}>
              Lihat riwayat <ArrowRight size={14} />
            </button>
          </div>
        </section>
      )}
      <div className="disclaimer">
        <ShieldCheck size={15} />
        <span>Informasi kesehatan ini bersifat observasional dan bukan diagnosis atau pengganti saran tenaga kesehatan.</span>
      </div>
    </>
  );
}
