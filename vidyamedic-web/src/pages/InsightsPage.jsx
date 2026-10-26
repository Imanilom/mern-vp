import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  HeartPulse,
  Layers3,
  ShieldCheck,
} from 'lucide-react';
import DataTable from '../components/DataTable';
import MetricCard from '../components/MetricCard';
import SectionHeading from '../components/SectionHeading';
import PersonalFactorRanking from '../components/PersonalFactorRanking';
import { formatDate, getStatusLabel, numberOrNull } from '../utils/formatters';
import { describeMotionBaseline } from '../utils/baselineObservations';
import {
  groupRecoveryMetricsByDay,
  groupPhysiologyByActivity,
  groupPhysiologyByCircadianPeriod,
  groupPhysiologyByFeeling,
} from '../utils/physiologyDistributions';

const PERIODS = [7, 30, 90];

const RECOVERY_MARKOV_STATES = [
  { key: 'BASELINE_COMPATIBLE', label: 'Baseline kompatibel', color: '#5ba67e' },
  { key: 'DEVIATION_CANDIDATE', label: 'Kandidat deviasi', color: '#e3ae4d' },
  { key: 'PERSISTENT_DEVIATION', label: 'Deviasi menetap', color: '#d87970' },
  { key: 'RECOVERY', label: 'Pemulihan', color: '#8c7bc2' },
  { key: 'RECOVERED', label: 'Pulih', color: '#45a6a1' },
  { key: 'UNRESOLVED', label: 'Belum terselesaikan', color: '#9b7773' },
];

function dailyAverages(samples, field) {
  const days = new Map();
  for (const sample of samples) {
    if (sample.is_simulated) continue;
    const value = numberOrNull(sample[field]);
    if (value == null || (field === 'rmssd_ms' && value <= 0)) continue;
    const date = new Date(sample.recorded_at);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const day = days.get(key) || {
      date,
      total: 0,
      weight: 0,
      records: 0,
    };
    const weight = Math.max(1, numberOrNull(sample.sample_count) || 1);
    day.total += value * weight;
    day.weight += weight;
    day.records += 1;
    days.set(key, day);
  }
  return [...days.values()]
    .sort((first, second) => first.date - second.date)
    .map((day) => ({
      date: day.date,
      value: day.total / day.weight,
      records: day.records,
    }));
}

function PeriodTrend({ samples, field, title, unit }) {
  const points = dailyAverages(samples, field);
  if (!points.length) {
    return (
      <div className="empty-chart trend-chart-empty">
        <div className="empty-chart-icon"><Activity size={20} /></div>
        <strong>Belum ada tren {title.toLowerCase()}</strong>
        <span>Belum ada ringkasan wearable nyata pada periode ini.</span>
      </div>
    );
  }
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const polyline = points.map((point, index) => (
    `${18 + (index / Math.max(1, points.length - 1)) * 564},${138 - ((point.value - min) / range) * 112}`
  )).join(' ');

  return (
    <div className="period-trend">
      <div className="period-trend-scale"><span>{Math.round(max)} {unit}</span><span>{Math.round(min)} {unit}</span></div>
      <svg aria-label={`Tren harian ${title}`} className="period-trend-svg" role="img" viewBox="0 0 600 150">
        {[26, 82, 138].map((lineY) => (
          <line className="chart-grid" key={lineY} x1="0" x2="600" y1={lineY} y2={lineY} />
        ))}
        {points.length > 1 && <polyline className="period-trend-line" fill="none" points={polyline} />}
        {points.map((point, index) => (
          <circle
            className="period-trend-point"
            cx={18 + (index / Math.max(1, points.length - 1)) * 564}
            cy={138 - ((point.value - min) / range) * 112}
            key={point.date.toISOString()}
            r="3.2"
          >
            <title>{`${formatDate(point.date, { day: 'numeric', month: 'short' })}: ${point.value.toFixed(1)} ${unit}, ${point.records} ringkasan`}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-x-labels">
        <span>{formatDate(points[0].date, { day: 'numeric', month: 'short' })}</span>
        <span>{formatDate(points[Math.floor(points.length / 2)].date, { day: 'numeric', month: 'short' })}</span>
        <span>{formatDate(points.at(-1).date, { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  );
}

function PhysiologyDistribution({ title, rows, labelKey, label, associationNote }) {
  const availableRows = rows.filter((row) => row.records > 0);
  return (
    <section className="distribution-group">
      <h3>{title}</h3>
      {availableRows.length ? (
        <div className="distribution-rows">
          {availableRows.map((row) => (
            <div className="distribution-row" key={row[labelKey]}>
              <strong>{label(row)}</strong>
              <span>HR {row.heartRate == null ? '—' : `${row.heartRate.toFixed(1)} bpm`}</span>
              <span>RMSSD {row.rmssd == null ? '—' : `${row.rmssd.toFixed(1)} ms`}</span>
              <small>{row.records} sampel berbobot</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="baseline-footnote">Belum ada data wearable nyata untuk pengelompokan ini.</p>
      )}
      {associationNote && <p className="baseline-footnote">{associationNote}</p>}
    </section>
  );
}

function formatWibDate(value, options) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Belum tersedia'
    : new Intl.DateTimeFormat('id-ID', { ...options, timeZone: 'Asia/Jakarta' }).format(date);
}

function RecoveryTrend({ episodes }) {
  const days = groupRecoveryMetricsByDay(episodes);
  return (
    <section className="panel recovery-trend-panel">
      <div className="panel-heading">
        <div><h2>Periksa tren pemulihan hari ke hari</h2><p>Rerata AUC deviasi dan waktu ke pemulihan (TTR) per hari, hanya bila tercatat CAPAR</p></div>
        <span className="panel-icon green-icon"><Activity size={17} /></span>
      </div>
      {days.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Tanggal (WIB)</th><th>Rerata AUC</th><th>Rerata TTR</th><th>Episode tercatat</th></tr></thead>
            <tbody>{days.map((day) => (
              <tr key={day.dateKey}>
                <td>{formatWibDate(day.date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td>{day.auc == null ? '—' : day.auc.toFixed(2)}</td>
                <td>{day.ttrMinutes == null ? '—' : `${day.ttrMinutes.toFixed(1)} menit`}</td>
                <td>{day.episodes}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state small-empty">
          <strong>Belum ada AUC atau TTR CAPAR untuk dibandingkan</strong>
          <p>Nilai tidak diisi dari data lain dan akan muncul setelah episode menyimpan metrik pemulihan.</p>
        </div>
      )}
    </section>
  );
}

export default function InsightsPage({
  dashboard,
  onPeriodChange,
  periodDays = dashboard.periodDays || 30,
}) {
  const [field, setField] = useState('heart_rate_bpm');
  const capar = dashboard.insights?.capar || {};
  const inventory = capar.data_inventory || {};
  const baselines = capar.baseline?.contexts || [];
  const matureBaselines = capar.baseline?.mature_contexts
    ?? baselines.filter((item) => item.level === 'mature' || item.level === 'mature_legacy').length;
  const episodes = capar.episode_history || [];
  const samples = dashboard.history || [];
  const realSamples = samples.filter((sample) => !sample.is_simulated);
  const circadianDistribution = groupPhysiologyByCircadianPeriod(realSamples);
  const activityDistribution = groupPhysiologyByActivity(realSamples);
  const feelingDistribution = groupPhysiologyByFeeling(realSamples, dashboard.checkIns || []);
  const recoveryIntelligence = capar.transition_learning?.recovery_intelligence
    || capar.recovery_intelligence;
  const average = (key) => {
    const values = realSamples
      .map((sample) => ({
        value: numberOrNull(sample[key]),
        weight: Math.max(1, numberOrNull(sample.sample_count) || 1),
      }))
      .filter((item) => item.value != null && (key !== 'rmssd_ms' || item.value > 0));
    const weight = values.reduce((sum, item) => sum + item.weight, 0);
    return weight
      ? values.reduce((sum, item) => sum + item.value * item.weight, 0) / weight
      : null;
  };
  const avgHr = average('heart_rate_bpm');
  const avgRmssd = average('rmssd_ms');
  const contexts = useMemo(() => {
    const count = new Map();
    for (const sample of realSamples) {
      const activity = sample.activity || 'Tidak dicatat';
      count.set(activity, (count.get(activity) || 0) + (numberOrNull(sample.sample_count) || 1));
    }
    const total = [...count.values()].reduce((sum, value) => sum + value, 0);
    return [...count.entries()]
      .map(([activity, value]) => ({ activity, value, percent: total ? Math.round(value / total * 100) : 0 }))
      .sort((first, second) => second.value - first.value)
      .slice(0, 6);
  }, [realSamples]);
  const baselineColumns = [
    { key: 'context', label: 'Aktivitas / konteks', render: (row) => [row.activity, row.time_period].filter(Boolean).join(' · ') || 'Tidak dicatat' },
    { key: 'level', label: 'Kesiapan', render: (row) => getStatusLabel(row.level) },
    { key: 'segment_count', label: 'Segmen' },
    { key: 'mean_hr', label: 'Rerata HR', render: (row) => numberOrNull(row.feature_stats?.mean_hr?.mean) == null ? '—' : Math.round(row.feature_stats.mean_hr.mean) },
    { key: 'rmssd', label: 'Rerata RMSSD', render: (row) => numberOrNull(row.feature_stats?.rmssd?.mean) == null ? '—' : Number(row.feature_stats.rmssd.mean.toFixed(1)) },
    { key: 'dfa_alpha1', label: 'DFA α1', render: (row) => numberOrNull(row.feature_stats?.dfa_alpha1?.mean) == null ? '—' : Number(row.feature_stats.dfa_alpha1.mean.toFixed(3)) },
    { key: 'motion_intensity', label: 'Rerata ACC', render: (row) => numberOrNull(row.feature_stats?.motion_intensity?.mean) == null ? '—' : Number(row.feature_stats.motion_intensity.mean.toFixed(3)) },
    { key: 'motion_observation', label: 'Observasi gerak', render: (row) => describeMotionBaseline(row, baselines) },
    { key: 'last_updated', label: 'Diperbarui', render: (row) => formatDate(row.last_updated, { day: 'numeric', month: 'short', year: 'numeric' }) },
  ];
  const recovered = episodes.filter((episode) => episode.outcome === 'recovered').length;
  const unresolved = episodes.filter((episode) => episode.outcome === 'unresolved').length;

  return (
    <>
      <SectionHeading
        description="Analisis tren fisiologis, episode, pemulihan, dan pola menurut konteks untuk mendukung keputusan personal."
        eyebrow="VIDYAMEDIC / BUSINESS INTELLIGENCE"
        title="Business Intelligence"
      />
      <div className="period-selector" role="group" aria-label="Periode analisis BI">
        <span>Periode:</span>
        {PERIODS.map((days) => (
          <button
            aria-pressed={periodDays === days}
            className={periodDays === days ? 'period-option active' : 'period-option'}
            key={days}
            onClick={() => onPeriodChange?.(days)}
            type="button"
          >
            {days} hari
          </button>
        ))}
        <small>Riwayat wearable dimuat dari periode yang dipilih.</small>
      </div>
      <div className="metric-grid">
        <MetricCard
          icon={HeartPulse}
          label="Rerata HR"
          note={`${realSamples.length} ringkasan wearable nyata`}
          tone="rose"
          unit="bpm"
          value={avgHr == null ? null : Math.round(avgHr)}
        />
        <MetricCard
          icon={Activity}
          label="Rerata RMSSD"
          note="Hanya bacaan wearable dengan RMSSD"
          tone="green"
          unit="ms"
          value={avgRmssd == null ? null : Number(avgRmssd.toFixed(1))}
        />
        <MetricCard
          icon={BarChart3}
          label="Episode CAPAR"
          note="Endpoint CAPAR menyajikan maksimal 30 hari"
          tone="gold"
          unit=""
          value={episodes.length}
        />
        <MetricCard
          icon={Layers3}
          label="Baseline matang"
          note={`Dari ${capar.baseline?.total_contexts ?? baselines.length} konteks`}
          tone="blue"
          unit=""
          value={matureBaselines}
        />
      </div>
      <div className="content-grid monitoring-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div><h2>Tren fisiologis historis</h2><p>Rerata harian dari wearable nyata · periode {periodDays} hari</p></div>
            <span className="panel-icon"><Activity size={17} /></span>
          </div>
          <div className="hourly-chart-switch" role="group" aria-label="Pilih metrik tren historis">
            {[
              ['heart_rate_bpm', 'Denyut jantung'],
              ['rmssd_ms', 'RMSSD'],
            ].map(([key, label]) => (
              <button
                aria-pressed={field === key}
                className={field === key ? 'hourly-chart-option active' : 'hourly-chart-option'}
                key={key}
                onClick={() => setField(key)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <PeriodTrend
            field={field}
            samples={samples}
            title={field === 'heart_rate_bpm' ? 'Denyut jantung' : 'RMSSD'}
            unit={field === 'heart_rate_bpm' ? 'bpm' : 'ms'}
          />
        </section>
        <section className="panel insight-note">
          <div className="panel-heading">
            <div><h2>Episode & pemulihan</h2><p>Hasil historis CAPAR yang terdokumentasi</p></div>
            <span className="panel-icon green-icon"><ShieldCheck size={17} /></span>
          </div>
          <div className="insight-facts episode-facts">
            <div><span>Pulih tercatat</span><strong>{recovered}</strong></div>
            <div><span>Belum terselesaikan</span><strong>{unresolved}</strong></div>
            <div><span>Median recovery</span><strong>{capar.recovery?.median_recovery_minutes == null ? '—' : `${capar.recovery.median_recovery_minutes} menit`}</strong></div>
            <div><span>Recovery rate observasi</span><strong>{capar.recovery?.observed_episode_recovery_rate_pct == null ? '—' : `${capar.recovery.observed_episode_recovery_rate_pct}%`}</strong></div>
          </div>
          <p>{capar.recovery?.recovery_rate_definition || 'Rasio hanya tersedia bila episode memiliki outcome terdokumentasi; bukan prediksi pemulihan.'}</p>
        </section>
      </div>
      <section className="panel context-analytics">
        <div className="panel-heading">
          <div><h2>Analisis berdasarkan konteks aktivitas</h2><p>Proporsi sampel wearable nyata pada periode terpilih</p></div>
          <span className="panel-icon"><BarChart3 size={17} /></span>
        </div>
        {contexts.length ? contexts.map((item) => (
          <div className="context-bar-row" key={item.activity}>
            <div><span>{item.activity}</span><strong>{item.percent}%</strong></div>
            <div className="evidence-progress"><span style={{ width: `${item.percent}%` }} /></div>
          </div>
        )) : <p className="baseline-footnote">Belum ada konteks aktivitas pada wearable nyata di periode ini.</p>}
      </section>
      <section className="panel physiology-distribution">
        <div className="panel-heading">
          <div><h2>Distribusi pola fisiologis</h2><p>Rerata HR dan RMSSD menurut periode sirkadian, aktivitas, serta mood yang tercatat</p></div>
          <span className="panel-icon"><Layers3 size={17} /></span>
        </div>
        <div className="distribution-grid">
          <PhysiologyDistribution
            label={(row) => row.label}
            labelKey="key"
            rows={circadianDistribution}
            title="Variasi sirkadian · WIB"
          />
          <PhysiologyDistribution
            label={(row) => row.activity.replaceAll('_', ' ')}
            labelKey="activity"
            rows={activityDistribution}
            title="Variasi aktivitas"
          />
          <PhysiologyDistribution
            associationNote="Mood dicocokkan dengan bacaan wearable terdekat dalam ±60 menit; hubungan waktu ini bukan bukti sebab-akibat."
            label={(row) => row.feeling.replaceAll('_', ' ')}
            labelKey="feeling"
            rows={feelingDistribution}
            title="Variasi mood"
          />
        </div>
      </section>
      <PersonalFactorRanking checkIns={dashboard.checkIns || []} compact />
      <section className="panel recovery-intelligence">
        <div className="panel-heading">
          <div><h2>Recovery Intelligence · Markov CAPAR</h2><p>Estimasi transisi state personal tiga langkah dari riwayat CAPAR, bukan diagnosis klinis</p></div>
          <span className="panel-icon green-icon"><ShieldCheck size={17} /></span>
        </div>
        {recoveryIntelligence?.status === 'available' && recoveryIntelligence.state_distribution ? (
          <>
            <div className="recovery-markov-circles">
              {RECOVERY_MARKOV_STATES.map((state) => {
                const percentage = numberOrNull(recoveryIntelligence.state_distribution[state.key]);
                if (percentage == null) return null;
                const share = Math.max(0, Math.min(100, percentage));
                return (
                  <div className="recovery-markov-state" key={state.key}>
                    <div
                      aria-label={`${state.label}: ${share}%`}
                      className="recovery-markov-ring"
                      role="img"
                      style={{
                        '--state-color': state.color,
                        '--state-share': `${share}%`,
                      }}
                    >
                      <div><strong>{share}%</strong></div>
                    </div>
                    <span>{state.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="recovery-markov-meta">
              <span>State saat ini: <strong>{getStatusLabel(recoveryIntelligence.current_state)}</strong></span>
              <span>{recoveryIntelligence.observed_transitions} transisi personal · horizon {recoveryIntelligence.horizon_windows} langkah</span>
            </div>
          </>
        ) : (
          <div className="empty-state small-empty">
            <strong>Data tidak cukup untuk estimasi Markov personal</strong>
            <p>{recoveryIntelligence?.reason || 'CAPAR belum menyediakan transisi personal yang cukup. Persentase tidak ditampilkan.'}</p>
          </div>
        )}
        <p className="baseline-footnote">
          Lingkaran menampilkan distribusi state hasil proyeksi transisi CAPAR personal; “data tidak cukup” merupakan status tanpa persentase.
          {recoveryIntelligence?.disclaimer ? ` ${recoveryIntelligence.disclaimer}` : ''}
        </p>
      </section>
      <RecoveryTrend episodes={episodes} />
      <section className="panel historical-panel insight-baselines">
        <div className="panel-heading">
          <div><h2>Baseline fisiologis berdasarkan aktivitas</h2><p>HR, HRV, DFA α1, dan rerata ACC untuk setiap konteks CAPAR</p></div>
          <span className="panel-icon"><Layers3 size={17} /></span>
        </div>
        <DataTable
          columns={baselineColumns}
          rows={baselines}
          rowKey={(row) => `${row.activity}:${row.time_period}`}
          emptyMessage="Belum ada baseline personal untuk ditampilkan."
        />
        <p className="baseline-footnote profile-motion-note">
          ACC menunjukkan intensitas gerak yang tertangkap sensor. Observasi membandingkan baseline antaraktivitas yang tersimpan, bukan mengidentifikasi aktivitas tertentu; nilai dapat dipengaruhi posisi perangkat dan kualitas sensor.
        </p>
      </section>
      <div className="disclaimer">
        <ShieldCheck size={15} />
        <span>Analitik merupakan ringkasan observasional, bukan skor klinis atau diagnosis. Data episode CAPAR yang disediakan API dibatasi pada 30 hari terakhir.</span>
      </div>
    </>
  );
}
