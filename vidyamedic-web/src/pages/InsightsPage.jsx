import { Activity, BarChart3, Layers3, ShieldCheck } from 'lucide-react';
import DataTable from '../components/DataTable';
import HeartRateChart from '../components/HeartRateChart';
import MetricCard from '../components/MetricCard';
import SectionHeading from '../components/SectionHeading';
import { formatDate, getStatusLabel } from '../utils/formatters';

function numberOrDash(value, digits = 0) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(digits)).toString()
    : '—';
}

export default function InsightsPage({ dashboard }) {
  const capar = dashboard.insights?.capar || {};
  const inventory = capar.data_inventory || {};
  const baselines = capar.baseline?.contexts || [];
  const matureBaselines = capar.baseline?.mature_contexts
    ?? baselines.filter((item) => item.level === 'mature' || item.level === 'mature_legacy').length;
  const episodes = capar.episode_history || [];
  const columns = [
    { key: 'context', label: 'Aktivitas / konteks', render: (row) => [row.activity, row.time_period].filter(Boolean).join(' · ') || 'Tidak dicatat' },
    { key: 'level', label: 'Kesiapan', render: (row) => getStatusLabel(row.level) },
    { key: 'segment_count', label: 'Segmen', render: (row) => row.segment_count ?? '—' },
    { key: 'mean_hr', label: 'Rerata HR', render: (row) => numberOrDash(row.feature_stats?.mean_hr?.mean) },
    { key: 'rmssd', label: 'Rerata RMSSD', render: (row) => numberOrDash(row.feature_stats?.rmssd?.mean, 1) },
    { key: 'last_updated', label: 'Diperbarui', render: (row) => formatDate(row.last_updated, { day: 'numeric', month: 'short', year: 'numeric' }) },
  ];

  return (
    <>
      <SectionHeading
        description="Ringkasan analitik berdasarkan rekaman wearable dan hasil CAPAR yang tersedia untuk akun Anda."
        eyebrow="VIDYAMEDIC / BUSINESS INTELLIGENCE"
        title="Pola & cakupan data"
      />
      <div className="metric-grid">
        <MetricCard
          icon={Layers3}
          label="Konteks baseline"
          note={`${matureBaselines} baseline matang`}
          tone="green"
          unit=""
          value={capar.baseline?.total_contexts ?? baselines.length}
        />
        <MetricCard
          icon={Activity}
          label="Segmen analisis"
          note={`${inventory.segments_window_days ?? 30} hari terakhir`}
          tone="blue"
          unit=""
          value={inventory.segments_returned ?? '—'}
        />
        <MetricCard
          icon={BarChart3}
          label="Episode terdokumentasi"
          note="Hanya hasil yang dikirim backend"
          tone="gold"
          unit=""
          value={inventory.episode_analyses_returned ?? episodes.length}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Transisi teramati"
          note="Jumlah transisi yang tersedia"
          tone="rose"
          unit=""
          value={capar.transition_learning?.observed_transitions ?? '—'}
        />
      </div>
      <div className="content-grid monitoring-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div><h2>Tren denyut jantung</h2><p>Observasi nyata dalam jendela riwayat yang dimuat</p></div>
            <span className="panel-icon"><Activity size={17} /></span>
          </div>
          <HeartRateChart samples={dashboard.history || []} />
        </section>
        <section className="panel insight-note">
          <div className="panel-heading">
            <div><h2>Kecukupan analisis</h2><p>Status dari layanan CAPAR</p></div>
            <span className="panel-icon green-icon"><ShieldCheck size={17} /></span>
          </div>
          <div className="insight-status">{getStatusLabel(capar.status)}</div>
          <p>{capar.disclaimer || dashboard.insights?.disclaimer || 'Ringkasan bergantung pada jumlah, kelengkapan, dan kualitas data yang tersedia.'}</p>
          <div className="insight-facts">
            <div><span>Hari data</span><strong>{inventory.distinct_days ?? '—'}</strong></div>
            <div><span>Terakhir diperbarui</span><strong>{formatDate(dashboard.insights?.generated_at, { day: 'numeric', month: 'short' })}</strong></div>
          </div>
        </section>
      </div>
      <section className="panel historical-panel insight-baselines">
        <div className="panel-heading">
          <div><h2>Baseline personal per konteks</h2><p>Nilai referensi yang dihitung backend, jika tersedia</p></div>
          <span className="panel-icon"><Layers3 size={17} /></span>
        </div>
        <DataTable
          columns={columns}
          rows={baselines}
          rowKey={(row) => `${row.activity}:${row.time_period}`}
          emptyMessage="Belum ada baseline personal untuk ditampilkan."
        />
      </section>
      <div className="disclaimer">
        <ShieldCheck size={15} />
        <span>Jumlah dan statistik di sini merupakan ringkasan data observasional, bukan skor klinis atau diagnosis.</span>
      </div>
    </>
  );
}
