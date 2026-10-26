import {
  Activity,
  ArrowRight,
  CalendarDays,
  Heart,
  ShieldCheck,
} from 'lucide-react';
import HourlyPhysiologyChart from '../components/HourlyPhysiologyChart';
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
  const episodes = capar.episode_history || [];
  const pendingFollowUp = capar.pedagogy?.follow_up?.status === 'requested';
  const unresolvedEpisodes = episodes.filter((episode) => episode.outcome === 'unresolved').length;
  const pendingActions = Number(pendingFollowUp) + unresolvedEpisodes;
  const latestRealSample = currentSample && !currentSample.is_simulated ? currentSample : null;
  const lastSampleAgeMinutes = latestRealSample
    ? Number.isFinite(new Date(latestRealSample.recorded_at).getTime())
      ? Math.max(0, Math.round((Date.now() - new Date(latestRealSample.recorded_at).getTime()) / 60000))
      : null
    : null;
  const wearableStatus = lastSampleAgeMinutes == null
    ? 'Belum ada sinkronisasi'
    : lastSampleAgeMinutes <= 10
      ? 'Data baru diterima'
      : `Terakhir ${lastSampleAgeMinutes} menit lalu`;
  const signalQuality = numberOrNull(
    latestRealSample?.signal_quality ?? latestRealSample?.data_quality?.q_signal,
  );
  const attentionCount = (capar.deviation_explanations || []).filter(
    (item) => item.explanation_status === 'available',
  ).length;

  return (
    <>
      <SectionHeading
        description={`Ringkasan kesehatan personal untuk ${profileName}. Data hanya ditampilkan saat tersedia dari catatan Anda.`}
        eyebrow="VIDYAMEDIC / DASHBOARD"
        title="Dashboard"
      />
      <section className="hero-banner">
        <div>
          <span className="eyebrow">PUSAT KENDALI KESEHATAN</span>
          <h2>Ringkasan kondisi hari ini dan perjalanan kesehatan Anda</h2>
          <p>
            KPI personal, tren fisiologis, episode, kualitas data, dan tindak lanjut
            yang tersedia dari akun Anda.
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
          icon={Activity}
          label="Episode terdokumentasi"
          note={`${attentionCount} memerlukan tinjauan konteks`}
          tone="gold"
          unit=""
          value={capar.status === 'available' ? episodes.length : '—'}
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
      <div className="content-grid dashboard-grid dashboard-status-grid">
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Perhatian & tindak lanjut</h2><p>Item yang perlu ditinjau berdasarkan catatan CAPAR</p></div>
            <span className="panel-icon gold-icon"><ShieldCheck size={17} /></span>
          </div>
          {capar.status !== 'available' ? (
            <div className="dashboard-no-followup">
              <ShieldCheck size={17} />
              <span>Status CAPAR belum tersedia; tindak lanjut belum dapat ditentukan.</span>
            </div>
          ) : pendingActions ? (
            <div className="dashboard-followups">
              {pendingFollowUp && (
                <div className="dashboard-followup-item">
                  <span className="followup-dot" />
                  <div>
                    <strong>Konfirmasi kontribusi perubahan</strong>
                    <p>CAPAR menunggu masukan aktivitas, mood, makan, atau stres yang Anda rasakan.</p>
                  </div>
                  <button className="text-button" onClick={() => onNavigate('deteksi')}>Tinjau</button>
                </div>
              )}
              {unresolvedEpisodes > 0 && (
                <div className="dashboard-followup-item">
                  <span className="followup-dot" />
                  <div>
                    <strong>{unresolvedEpisodes} episode belum terselesaikan</strong>
                    <p>Status mengikuti dokumentasi episode CAPAR, bukan diagnosis.</p>
                  </div>
                  <button className="text-button" onClick={() => onNavigate('insight')}>Lihat BI</button>
                </div>
              )}
            </div>
          ) : (
            <div className="dashboard-no-followup">
              <ShieldCheck size={17} />
              <span>Tidak ada tindak lanjut terbuka yang dikirim CAPAR.</span>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Perangkat & kualitas data</h2><p>Status berdasarkan rekaman wearable terakhir</p></div>
            <span className="panel-icon green-icon"><Activity size={17} /></span>
          </div>
          <div className="detail-row"><span>Perangkat pilihan</span><strong>{overview.wearable_provider || 'Belum dipilih'}</strong></div>
          <div className="detail-row"><span>Sinkronisasi</span><strong>{wearableStatus}</strong></div>
          <div className="detail-row"><span>Kualitas sinyal terakhir</span><strong>{signalQuality == null ? 'Belum tersedia' : `${Math.round(signalQuality * 100)}%`}</strong></div>
          <p className="baseline-footnote">Status sinkronisasi tidak membuktikan perangkat sedang terhubung langsung.</p>
        </section>
      </div>
      <div className="content-grid dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Tren fisiologis per jam</h2>
              <p>Pola 24 jam · hari ini atau rerata dari hari yang memiliki data</p>
            </div>
            <span className="live-label"><i /> Pola harian</span>
          </div>
          <HourlyPhysiologyChart samples={dashboard.history || []} />
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
                  {currentSample.is_simulated ? '—' : Math.round(currentSample.heart_rate_bpm || 0)}
                  {!currentSample.is_simulated && <span>bpm</span>}
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
