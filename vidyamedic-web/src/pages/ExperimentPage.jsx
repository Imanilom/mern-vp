import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ClipboardList,
  Download,
  HeartPulse,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api';
import DataTable from '../components/DataTable';
import MetricCard from '../components/MetricCard';
import SectionHeading from '../components/SectionHeading';
import { formatDate, formatTime, getStatusLabel, numberOrNull } from '../utils/formatters';

const SECTION_DETAILS = {
  capar_episode: {
    title: 'Episode',
    description: 'Observasi terbaru dari rekaman wearable dan episode CAPAR yang tersimpan.',
  },
  capar_baseline: {
    title: 'Baseline Personal',
    description: 'Konteks baseline CAPAR yang tersedia untuk akun Anda.',
  },
  capar_analytics: {
    title: 'Analitik Pemulihan',
    description: 'Ringkasan outcome episode dan pemulihan yang telah tercatat.',
  },
  capar_ser: {
    title: 'Shared Episode Record',
    description: 'Riwayat sesi dan koreksi peserta yang tersimpan di backend.',
  },
  capar_audit: {
    title: 'Audit Penalaran',
    description: 'Jejak sumber bukti, status pemrosesan, dan versi interpretasi.',
  },
};

const episodeColumns = [
  {
    key: 'recorded_at',
    label: 'Waktu',
    render: (row) => `${formatDate(row.recorded_at, { day: 'numeric', month: 'short' })} ${formatTime(row.recorded_at)}`,
  },
  { key: 'activity', label: 'Aktivitas' },
  { key: 'heart_rate_bpm', label: 'HR', render: (row) => numberOrNull(row.heart_rate_bpm) ?? '—' },
  { key: 'rmssd_ms', label: 'RMSSD', render: (row) => numberOrNull(row.rmssd_ms) == null ? '—' : `${Number(row.rmssd_ms.toFixed(1))} ms` },
  { key: 'source', label: 'Sumber', render: (row) => row.source || 'Wearable' },
];

const baselineColumns = [
  {
    key: 'context',
    label: 'Konteks',
    render: (row) => [row.activity, row.time_period].filter(Boolean).join(' · ') || 'Tidak dicatat',
  },
  { key: 'level', label: 'Kesiapan', render: (row) => getStatusLabel(row.level) },
  { key: 'segment_count', label: 'Segmen' },
  {
    key: 'mean_hr',
    label: 'Rerata HR',
    render: (row) => {
      const value = numberOrNull(row.feature_stats?.mean_hr?.mean);
      return value == null ? '—' : `${Math.round(value)} bpm`;
    },
  },
  {
    key: 'rmssd',
    label: 'Rerata RMSSD',
    render: (row) => {
      const value = numberOrNull(row.feature_stats?.rmssd?.mean);
      return value == null ? '—' : `${value.toFixed(1)} ms`;
    },
  },
];

export default function ExperimentPage({ active, dashboard }) {
  const [scenarioRecords, setScenarioRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordError, setRecordError] = useState('');
  const section = SECTION_DETAILS[active] || SECTION_DETAILS.capar_episode;
  const capar = dashboard.insights?.capar || {};
  const realSamples = useMemo(
    () => (dashboard.history || [])
      .filter((sample) => !sample.is_simulated)
      .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at)),
    [dashboard.history],
  );
  const episodes = capar.episode_history || [];
  const baselines = capar.baseline?.contexts || [];

  useEffect(() => {
    if (active !== 'capar_ser' && active !== 'capar_audit') return undefined;
    let alive = true;
    setLoadingRecords(true);
    setRecordError('');
    api.listScenarioSessions()
      .then(async (response) => {
        const sessions = (response.data || []).slice(0, 20);
        const records = await Promise.all(sessions.map(async (session) => {
          const eventsResponse = await api.listScenarioEvents(session._id);
          return {
            session,
            events: eventsResponse.data || [],
          };
        }));
        if (alive) setScenarioRecords(records);
      })
      .catch((error) => {
        if (alive) setRecordError(error.message || 'Gagal memuat Shared Episode Record.');
      })
      .finally(() => {
        if (alive) setLoadingRecords(false);
      });
    return () => { alive = false; };
  }, [active]);

  const eventRows = scenarioRecords.flatMap(({ session, events }) => (
    events.map((event) => ({ ...event }))
  ));
  const sharedRecordRows = [
    ...scenarioRecords.map(({ session }) => ({
      recorded_at: session.createdAt,
      scenario_id: session.scenario_id,
      source: session.source,
      evidence: 'Sesi dimulai dari observasi tersimpan',
      processing_state: session.interpretations?.at(-1)?.processing_state || '—',
      reason_code: session.interpretations?.at(-1)?.reason_code || '—',
    })),
    ...eventRows.map((event) => ({
      recorded_at: event.event_time,
      scenario_id: event.scenario_id,
      source: event.source,
      evidence: `Koreksi aktivitas: ${event.value}`,
      processing_state: event.processing_state,
      reason_code: event.reason_code || '—',
    })),
  ].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

  const sharedRecordColumns = [
    {
      key: 'recorded_at',
      label: 'Waktu',
      render: (row) => row.recorded_at
        ? `${formatDate(row.recorded_at, { day: 'numeric', month: 'short' })} ${formatTime(row.recorded_at)}`
        : '—',
    },
    { key: 'scenario_id', label: 'Skenario', render: (row) => row.scenario_id?.toUpperCase() || '—' },
    { key: 'source', label: 'Sumber' },
    { key: 'evidence', label: 'Bukti / tindakan' },
    { key: 'processing_state', label: 'Status' },
  ];

  const auditRows = scenarioRecords.map(({ session }) => {
    const interpretation = session.interpretations?.find(
      (item) => item.version === session.current_interpretation_version,
    ) || session.interpretations?.at(-1);
    return {
      scenario_id: session.scenario_id,
      created_at: session.createdAt,
      source: interpretation?.observation?.source || session.source,
      quality: interpretation?.observation?.quality?.gate_passed === true ? 'Lolos' : 'Belum lolos / tidak tersedia',
      status: interpretation?.status || 'UNRESOLVED',
      version: session.current_interpretation_version,
      recovery_status: interpretation?.recovery_observation?.status || '—',
      uncertainty: interpretation?.uncertainty || 'Tidak tersedia',
    };
  });
  const auditColumns = [
    { key: 'scenario_id', label: 'Skenario', render: (row) => row.scenario_id?.toUpperCase() || '—' },
    {
      key: 'created_at',
      label: 'Waktu',
      render: (row) => row.created_at
        ? `${formatDate(row.created_at, { day: 'numeric', month: 'short' })} ${formatTime(row.created_at)}`
        : '—',
    },
    { key: 'source', label: 'Sumber bukti' },
    { key: 'quality', label: 'Quality gate' },
    { key: 'status', label: 'Interpretasi', render: (row) => getStatusLabel(row.status) },
    { key: 'recovery_status', label: 'Status pemulihan' },
    { key: 'version', label: 'Versi' },
  ];

  function exportSer() {
    const withoutAccountIdentifiers = ({
      account_id,
      account_type,
      participant_pseudonym,
      ...record
    }) => record;
    const payload = {
      schema_version: 'vidyamedic-scenario-ser-v1',
      exported_at: new Date().toISOString(),
      sessions: scenarioRecords
        .map(({ session }) => withoutAccountIdentifiers(session)),
      events: eventRows.map(withoutAccountIdentifiers),
      limitations: [
        'Status interpretasi bukan diagnosis.',
        'Satu observasi tidak menetapkan pemulihan selesai.',
      ],
    };
    const url = URL.createObjectURL(new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: 'application/json' },
    ));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vidyamedic-shared-episode-record.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  let content;
  if (active === 'capar_baseline') {
    content = (
      <>
        <div className="metric-grid">
          <MetricCard
            icon={ShieldCheck}
            label="Baseline matang"
            note={`Dari ${capar.baseline?.total_contexts ?? baselines.length} konteks tersimpan`}
            value={capar.baseline?.mature_contexts ?? baselines.filter((item) => item.level === 'mature' || item.level === 'mature_legacy').length}
          />
          <MetricCard
            icon={Activity}
            label="Konteks baseline"
            note="Konteks yang tersedia dari CAPAR"
            tone="blue"
            value={baselines.length}
          />
        </div>
        <section className="panel historical-panel">
          <div className="panel-heading">
            <div><h2>Baseline personal</h2><p>Nilai berasal dari konteks baseline CAPAR yang tersimpan.</p></div>
          </div>
          <DataTable columns={baselineColumns} rows={baselines} emptyMessage="Belum ada baseline personal yang tersedia." />
        </section>
      </>
    );
  } else if (active === 'capar_analytics') {
    const recovered = episodes.filter((episode) => episode.outcome === 'recovered').length;
    const unresolved = episodes.filter((episode) => episode.outcome === 'unresolved').length;
    content = (
      <>
        <div className="metric-grid">
          <MetricCard icon={ClipboardList} label="Episode tercatat" note="Dari riwayat CAPAR" value={episodes.length} />
          <MetricCard icon={HeartPulse} label="Outcome pulih" note="Outcome pulih yang terdokumentasi" tone="green" value={recovered} />
          <MetricCard icon={Activity} label="Belum terselesaikan" note="Tidak ditafsirkan sebagai pulih" tone="gold" value={unresolved} />
        </div>
        <section className="panel historical-panel">
          <div className="panel-heading">
            <div><h2>Ringkasan pemulihan</h2><p>Hanya outcome historis yang tersedia dari CAPAR.</p></div>
          </div>
          <div className="insight-facts episode-facts">
            <div><span>Median pemulihan tercatat</span><strong>{capar.recovery?.median_recovery_minutes == null ? '—' : `${capar.recovery.median_recovery_minutes} menit`}</strong></div>
            <div><span>Recovery rate observasi</span><strong>{capar.recovery?.observed_episode_recovery_rate_pct == null ? '—' : `${capar.recovery.observed_episode_recovery_rate_pct}%`}</strong></div>
          </div>
          <p>{capar.recovery?.recovery_rate_definition || 'Belum ada definisi outcome yang tersedia untuk periode ini.'}</p>
        </section>
      </>
    );
  } else if (active === 'capar_ser' || active === 'capar_audit') {
    content = (
      <>
        {recordError && <div className="notice notice-warning"><AlertCircle size={18} /><span>{recordError}</span></div>}
        {active === 'capar_ser' ? (
          <section className="panel historical-panel">
            <div className="panel-heading">
              <div><h2>Shared Episode Record</h2><p>{loadingRecords ? 'Memuat sesi dan event dari backend…' : `${sharedRecordRows.length} kejadian tercatat`}</p></div>
              <button className="button button-light" disabled={loadingRecords || scenarioRecords.length === 0} onClick={exportSer}>
                <Download size={15} /> Ekspor JSON
              </button>
            </div>
            <DataTable columns={sharedRecordColumns} rows={sharedRecordRows} emptyMessage={loadingRecords ? 'Memuat Shared Episode Record…' : 'Belum ada sesi skenario tersimpan.'} />
          </section>
        ) : (
          <section className="panel historical-panel">
            <div className="panel-heading">
              <div><h2>Audit penalaran</h2><p>{loadingRecords ? 'Memuat jejak bukti…' : 'Quality gate, sumber bukti, dan versi interpretasi.'}</p></div>
            </div>
            <DataTable columns={auditColumns} rows={auditRows} emptyMessage={loadingRecords ? 'Memuat jejak audit…' : 'Belum ada interpretasi skenario tersimpan.'} />
            {auditRows.some((row) => row.scenario_id === 'd') && (
              <div className="notice notice-warning" style={{ marginTop: 14 }}>
                <AlertCircle size={18} />
                <span>Scenario D adalah observasi pascaaktivitas. Satu observasi tidak cukup untuk menyatakan pemulihan selesai.</span>
              </div>
            )}
          </section>
        )}
      </>
    );
  } else {
    const latestSample = realSamples[0];
    const latestEpisode = [...episodes].sort(
      (a, b) => new Date(b.recorded_at || b.created_at) - new Date(a.recorded_at || a.created_at),
    )[0];
    content = (
      <>
        <div className="metric-grid">
          <MetricCard
            icon={HeartPulse}
            label="HR terakhir"
            note={latestSample ? `Direkam ${formatTime(latestSample.recorded_at)}` : 'Belum ada rekaman wearable nyata'}
            tone="rose"
            unit=" bpm"
            value={numberOrNull(latestSample?.heart_rate_bpm) == null ? null : Math.round(latestSample.heart_rate_bpm)}
          />
          <MetricCard
            icon={Activity}
            label="RMSSD terakhir"
            note="Dari rekaman wearable nyata"
            tone="green"
            unit=" ms"
            value={numberOrNull(latestSample?.rmssd_ms)}
          />
          <MetricCard icon={ClipboardList} label="Episode CAPAR" note="Riwayat yang tersedia" tone="blue" value={episodes.length} />
          <MetricCard
            icon={ShieldCheck}
            label="Status episode terbaru"
            note="Bukan diagnosis"
            tone="gold"
            value={latestEpisode ? getStatusLabel(latestEpisode.outcome) : null}
          />
        </div>
        <section className="panel historical-panel">
          <div className="panel-heading">
            <div><h2>Rekaman wearable</h2><p>Data aktual non-simulasi yang tersedia di akun.</p></div>
          </div>
          <DataTable columns={episodeColumns} rows={realSamples.slice(0, 50)} rowKey={(row) => row._id || row.recorded_at} emptyMessage="Belum ada rekaman wearable nyata. Sesi scenario tidak membuat data observasi simulasi." />
        </section>
      </>
    );
  }

  return (
    <>
      <SectionHeading
        description={section.description}
        eyebrow="VIDYAMEDIC / CAPAR EXPERIMENT"
        title={section.title}
      />
      {dashboard.errors?.length > 0 && active !== 'capar_ser' && active !== 'capar_audit' && (
        <div className="notice notice-warning"><AlertCircle size={18} /><span>Data eksperimen sebagian belum tersedia. Perbarui data atau periksa koneksi backend.</span></div>
      )}
      {content}
      <p className="baseline-footnote">Interpretasi bersifat observasional, bukan diagnosis klinis. Pemulihan tidak dapat dipastikan dari satu observasi.</p>
    </>
  );
}
