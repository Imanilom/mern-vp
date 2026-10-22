import { Activity, CalendarDays, HeartPulse, Layers3 } from 'lucide-react';
import DataTable from './DataTable';
import { formatDate, formatTime, getStatusLabel } from '../utils/formatters';

function formatNumber(value, digits = 1) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(digits)).toString()
    : '—';
}

function formatDuration(milliseconds) {
  return typeof milliseconds === 'number' && Number.isFinite(milliseconds)
    ? `${formatNumber(milliseconds / 60000)} menit`
    : '—';
}

function formatContext(activity, period) {
  return [activity, period].filter(Boolean).join(' · ') || 'Konteks tidak dicatat';
}

function BaselineHistory({ contexts = [] }) {
  const columns = [
    { key: 'context', label: 'Konteks', render: (row) => formatContext(row.activity, row.time_period) },
    { key: 'level', label: 'Kematangan', render: (row) => getStatusLabel(row.level) },
    { key: 'segment_count', label: 'Segmen' },
    { key: 'mean_hr', label: 'Rerata HR', render: (row) => formatNumber(row.feature_stats?.mean_hr?.mean, 0) },
    { key: 'rmssd', label: 'RMSSD', render: (row) => formatNumber(row.feature_stats?.rmssd?.mean) },
    { key: 'quality', label: 'Kualitas', render: (row) => row.quality == null ? '—' : `${formatNumber(row.quality * 100, 0)}%` },
    { key: 'distinct_days', label: 'Hari berbeda', render: (row) => row.maturity_detail?.distinct_days ?? '—' },
    { key: 'last_updated', label: 'Diperbarui', render: (row) => formatDate(row.last_updated, { day: 'numeric', month: 'short', year: 'numeric' }) },
  ];

  return (
    <section className="panel historical-panel">
      <div className="panel-heading">
        <div><h2>Baseline pribadi</h2><p>Statistik referensi berdasarkan konteks aktivitas dan periode</p></div>
        <span className="panel-icon"><Layers3 size={18} /></span>
      </div>
      <DataTable
        columns={columns}
        rows={contexts}
        rowKey={(row) => `${row.activity}:${row.time_period}`}
        emptyMessage="Baseline belum tersedia untuk akun ini."
      />
      {contexts.some((context) => context.maturity_detail?.failed_gates?.length > 0) && (
        <div className="baseline-footnote">
          Baseline yang belum matang dapat memiliki gerbang kualitas yang belum terpenuhi.
        </div>
      )}
    </section>
  );
}

function CaparTrajectory({ trajectory = [] }) {
  const rows = [...trajectory].slice(-20).reverse();
  const columns = [
    { key: 'recorded_at', label: 'Waktu', render: (row) => `${formatDate(row.recorded_at, { day: 'numeric', month: 'short' })} ${formatTime(row.recorded_at)}` },
    { key: 'activity', label: 'Aktivitas' },
    { key: 'personal_state', label: 'Relasi baseline', render: (row) => getStatusLabel(row.personal_state) },
    { key: 'mahalanobis_distance', label: 'Jarak statistik', render: (row) => formatNumber(row.mahalanobis_distance, 2) },
    { key: 'hr_mean', label: 'HR', render: (row) => formatNumber(row.features?.hr_mean, 0) },
    { key: 'rmssd', label: 'RMSSD', render: (row) => formatNumber(row.features?.rmssd) },
    { key: 'quality', label: 'Sinyal', render: (row) => row.quality == null ? '—' : `${formatNumber(row.quality * 100, 0)}%` },
  ];

  return (
    <section className="panel historical-panel">
      <div className="panel-heading">
        <div><h2>Riwayat analisis CAPAR</h2><p>Maksimal 20 segmen terakhir dari jendela historis 30 hari</p></div>
        <span className="panel-icon green-icon"><Activity size={18} /></span>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => `${row.recorded_at}:${row.activity}`}
        emptyMessage="Belum ada segmen CAPAR yang dapat ditampilkan."
      />
    </section>
  );
}

function EpisodeHistory({ episodes = [] }) {
  const columns = [
    { key: 'start_at', label: 'Mulai', render: (row) => `${formatDate(row.start_at, { day: 'numeric', month: 'short' })} ${formatTime(row.start_at)}` },
    { key: 'activity', label: 'Aktivitas' },
    { key: 'classification', label: 'Klasifikasi', render: (row) => getStatusLabel(row.classification) },
    { key: 'outcome', label: 'Hasil', render: (row) => getStatusLabel(row.outcome) },
    { key: 'peak_deviation', label: 'Puncak deviasi', render: (row) => formatNumber(row.peak_deviation, 2) },
    { key: 'recovery_time_ms', label: 'Waktu pulih', render: (row) => formatDuration(row.recovery_time_ms) },
    { key: 'relapse_detected', label: 'Relaps', render: (row) => row.relapse_detected ? `Ya (${row.relapse_count || 1})` : 'Tidak tercatat' },
  ];

  return (
    <section className="panel historical-panel">
      <div className="panel-heading">
        <div><h2>Riwayat episode</h2><p>Episode terdokumentasi dalam 30 hari terakhir</p></div>
        <span className="panel-icon gold-icon"><HeartPulse size={18} /></span>
      </div>
      <DataTable
        columns={columns}
        rows={episodes.slice(0, 20)}
        rowKey={(row) => row.episode_id || row.start_at}
        emptyMessage="Belum ada episode terdokumentasi."
      />
    </section>
  );
}

function CheckInHistory({ checkIns = [] }) {
  const columns = [
    { key: 'recorded_at', label: 'Waktu', render: (row) => `${formatDate(row.recorded_at, { day: 'numeric', month: 'short' })} ${formatTime(row.recorded_at)}` },
    { key: 'activity', label: 'Aktivitas' },
    { key: 'sleep', label: 'Tidur', render: (row) => row.sleep?.duration_minutes == null ? '—' : `${formatNumber(row.sleep.duration_minutes / 60)} jam` },
    { key: 'stress_level', label: 'Stres', render: (row) => row.stress_level ?? '—' },
    { key: 'symptoms', label: 'Gejala', render: (row) => row.symptoms?.length ? row.symptoms.join(', ') : 'Tidak dicatat' },
  ];

  return (
    <section className="panel historical-panel">
      <div className="panel-heading">
        <div><h2>Riwayat check-in</h2><p>Catatan personal dalam 30 hari terakhir</p></div>
        <span className="panel-icon"><CalendarDays size={18} /></span>
      </div>
      <DataTable
        columns={columns}
        rows={checkIns.slice(0, 20)}
        rowKey={(row) => row._id}
        emptyMessage="Belum ada check-in dalam periode ini."
      />
    </section>
  );
}

export default function HistoricalDetails({ capar, checkIns }) {
  const inventory = capar.data_inventory || {};
  const whereAmI = capar.pedagogy?.where_am_i || {};
  const thresholds = whereAmI.personal_reference_thresholds;
  const thresholdEntries = thresholds && typeof thresholds === 'object'
    ? Object.entries(thresholds)
    : [];

  return (
    <div className="historical-details">
      <section className="inventory-grid" aria-label="Ringkasan jumlah data historis">
        <div className="inventory-card"><span>Baseline</span><strong>{inventory.baselines ?? capar.baseline?.total_contexts ?? 0}</strong></div>
        <div className="inventory-card"><span>Segmen analisis</span><strong>{inventory.segments_returned ?? 0}</strong><small>{inventory.segments_window_days ?? 30} hari terakhir</small></div>
        <div className="inventory-card"><span>Episode</span><strong>{inventory.episode_analyses_returned ?? capar.episode_history?.length ?? 0}</strong></div>
        <div className="inventory-card"><span>Transisi tercatat</span><strong>{capar.transition_learning?.observed_transitions ?? 0}</strong></div>
      </section>
      {(whereAmI.mahalanobis_distance != null || thresholdEntries.length > 0) && (
        <section className="panel historical-panel personal-distance-panel">
          <div className="panel-heading">
            <div><h2>Perbandingan dengan baseline personal</h2><p>{whereAmI.meaning || 'Jarak statistik bukan penilaian risiko klinis.'}</p></div>
            <span className="panel-icon"><Activity size={18} /></span>
          </div>
          <div className="detail-row">
            <span>Status</span><strong>{getStatusLabel(whereAmI.baseline_relation || whereAmI.state)}</strong>
          </div>
          <div className="detail-row">
            <span>Jarak Mahalanobis</span><strong>{formatNumber(whereAmI.mahalanobis_distance, 2)}</strong>
          </div>
          {thresholdEntries.length > 0 && (
            <div className="factor-list">
              {thresholdEntries.map(([name, value]) => (
                <span key={name}>{name.replaceAll('_', ' ')}: {formatNumber(value, 2)}</span>
              ))}
            </div>
          )}
        </section>
      )}
      <BaselineHistory contexts={capar.baseline?.contexts || []} />
      <CaparTrajectory trajectory={capar.trajectory_30d || []} />
      <EpisodeHistory episodes={capar.episode_history || []} />
      <CheckInHistory checkIns={checkIns || []} />
      {inventory.segments_truncated && (
        <p className="baseline-footnote">
          Riwayat segmen dibatasi oleh backend; angka total yang tampil adalah jumlah yang dikirim, bukan keseluruhan arsip.
        </p>
      )}
    </div>
  );
}
