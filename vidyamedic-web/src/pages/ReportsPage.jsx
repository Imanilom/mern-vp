import { useState } from 'react';
import { AlertCircle, Download, FileText, Printer, ShieldCheck } from 'lucide-react';
import DataTable from '../components/DataTable';
import SectionHeading from '../components/SectionHeading';
import { formatDate, formatTime } from '../utils/formatters';

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadCsv(rows) {
  const fields = [
    ['recorded_at', 'Waktu'],
    ['record_type', 'Jenis catatan'],
    ['activity', 'Aktivitas'],
    ['heart_rate_bpm', 'Denyut jantung (bpm)'],
    ['rmssd_ms', 'RMSSD (ms)'],
    ['sleep_minutes', 'Durasi tidur (menit)'],
    ['symptoms', 'Gejala'],
    ['decision_status', 'Status observasi/keputusan'],
    ['evidence_status', 'Status bukti'],
    ['detail', 'Keterangan'],
  ];
  const csv = [
    fields.map(([, label]) => csvCell(label)).join(','),
    ...rows.map((row) => fields.map(([key]) => csvCell(row[key])).join(',')),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `vidyamedic-ringkasan-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ReportsPage({
  dashboard,
  onPeriodChange,
  periodDays = dashboard.periodDays || 30,
}) {
  const [exportError, setExportError] = useState('');
  const wearableRows = (dashboard.history || [])
    .filter((row) => !row.is_simulated)
    .map((row) => ({
      ...row,
      record_type: 'Wearable',
      sleep_minutes: '',
      symptoms: '',
      decision_status: '',
      evidence_status: '',
      detail: '',
    }));
  const checkInRows = (dashboard.checkIns || []).map((row) => ({
    recorded_at: row.recorded_at,
    record_type: 'Check-in',
    activity: row.activity,
    heart_rate_bpm: '',
    rmssd_ms: '',
    sleep_minutes: row.sleep?.duration_minutes ?? '',
    symptoms: Array.isArray(row.symptoms) ? row.symptoms.join('; ') : '',
    decision_status: '',
    evidence_status: '',
    detail: [
      row.deviation_follow_up?.note || '',
      row.deviation_follow_up?.ranked_context_factors?.length
        ? `Ranking kontribusi pengguna: ${row.deviation_follow_up.ranked_context_factors.join(' > ')}`
        : '',
    ].filter(Boolean).join(' · '),
  }));
  const actionRows = (dashboard.patientActions || []).map((row) => ({
    recorded_at: row.createdAt,
    record_type: 'Tindak lanjut',
    activity: row.action_type || '',
    heart_rate_bpm: '',
    rmssd_ms: '',
    sleep_minutes: '',
    symptoms: '',
    decision_status: row.status || '',
    evidence_status: row.decision?.level || '',
    detail: [row.title, row.details].filter(Boolean).join(' · '),
  }));
  const decisionRows = (dashboard.insights?.capar?.deviation_explanations || [])
    .map((item) => ({
      recorded_at: item.occurred_at,
      record_type: 'Observasi CAPAR',
      activity: item.activity || '',
      heart_rate_bpm: item.main_deviation_factors?.find((factor) => (
        ['hr_mean', 'mean_hr'].includes(factor.feature)
      ))?.value ?? '',
      rmssd_ms: item.main_deviation_factors?.find((factor) => factor.feature === 'rmssd')?.value ?? '',
      sleep_minutes: '',
      symptoms: '',
      decision_status: item.classification || item.state || '',
      evidence_status: item.reasoning_uncertainty?.evidence_status || item.explanation_status || '',
      detail: item.reasoning_uncertainty?.interpretation || item.interpretation || '',
    }));
  const rows = [...wearableRows, ...checkInRows, ...decisionRows, ...actionRows]
    .sort((first, second) => new Date(second.recorded_at) - new Date(first.recorded_at));
  const columns = [
    { key: 'recorded_at', label: 'Waktu', render: (row) => `${formatDate(row.recorded_at, { day: 'numeric', month: 'short', year: 'numeric' })} ${formatTime(row.recorded_at)}` },
    { key: 'record_type', label: 'Jenis catatan' },
    { key: 'activity', label: 'Aktivitas', render: (row) => row.activity || '—' },
    { key: 'heart_rate_bpm', label: 'HR', render: (row) => row.heart_rate_bpm == null ? '—' : Math.round(row.heart_rate_bpm) },
    { key: 'rmssd_ms', label: 'RMSSD', render: (row) => row.rmssd_ms == null ? '—' : Math.round(row.rmssd_ms) },
    { key: 'sleep_minutes', label: 'Tidur', render: (row) => row.sleep_minutes === '' ? '—' : `${Math.round(row.sleep_minutes / 60 * 10) / 10} jam` },
    { key: 'symptoms', label: 'Gejala', render: (row) => row.symptoms || '—' },
    { key: 'decision_status', label: 'Status observasi', render: (row) => row.decision_status || '—' },
    { key: 'evidence_status', label: 'Kecukupan bukti', render: (row) => row.evidence_status || '—' },
    { key: 'detail', label: 'Keterangan', render: (row) => row.detail || '—' },
  ];

  function exportRows() {
    setExportError('');
    if (!rows.length) {
      setExportError('Belum ada data riwayat untuk diekspor.');
      return;
    }
    try {
      downloadCsv(rows);
    } catch (error) {
      setExportError(error.message || 'File CSV belum dapat dibuat.');
    }
  }

  return (
    <>
      <SectionHeading
        action={
          <div className="report-actions">
            <button className="button button-light" onClick={() => window.print()}>
              <Printer size={15} /> Cetak
            </button>
            <button className="button button-primary" onClick={exportRows}>
              <Download size={15} /> Unduh CSV
            </button>
          </div>
        }
        description="Riwayat wearable nyata dan check-in yang dimuat dari akun Anda."
        eyebrow="VIDYAMEDIC / LAPORAN"
        title="Laporan kesehatan"
      />
      <div className="report-banner">
        <div className="eyebrow">RINGKASAN PERSONAL</div>
        <h2>Ringkasan {periodDays === 7 ? 'mingguan' : periodDays === 30 ? 'bulanan' : `${periodDays} hari`}</h2>
        <p>
          Berisi {wearableRows.length} ringkasan wearable, {checkInRows.length} check-in,
          dan {decisionRows.length} observasi CAPAR yang tersedia.
          Nilai RMSSD hanya berasal dari pengukuran interval RR wearable, bukan isian check-in.
        </p>
      </div>
      <div className="period-selector" role="group" aria-label="Periode laporan">
        <span>Periode laporan:</span>
        {[7, 30, 90].map((days) => (
          <button
            aria-pressed={periodDays === days}
            className={periodDays === days ? 'period-option active' : 'period-option'}
            key={days}
            onClick={() => onPeriodChange?.(days)}
            type="button"
          >
            {days === 7 ? 'Mingguan' : days === 30 ? 'Bulanan' : '90 hari'}
          </button>
        ))}
        <small>
          Observasi CAPAR dibatasi 30 hari; check-in yang diambil API maksimal 100 catatan.
        </small>
      </div>
      {exportError && (
        <div className="notice notice-warning report-error">
          <AlertCircle size={17} /><span>{exportError}</span>
        </div>
      )}
      <section className="panel historical-panel report-table">
        <div className="panel-heading">
          <div><h2>Riwayat catatan & observasi</h2><p>Data wearable, check-in, dan observasi CAPAR yang tersedia</p></div>
          <span className="panel-icon"><FileText size={17} /></span>
        </div>
        <DataTable
          columns={columns}
          rows={rows.slice(0, 100)}
          rowKey={(row) => `${row.record_type}:${row.recorded_at}:${row.activity || ''}`}
          emptyMessage="Belum ada riwayat pada periode ini."
        />
        {rows.length > 100 && <p className="report-limit">Tabel menampilkan 100 catatan terbaru; CSV memuat semua catatan yang tersedia.</p>}
      </section>
      <div className="report-audit-note">
        <ShieldCheck size={15} />
        <span>Riwayat keputusan di sini terbatas pada observasi dan status yang dikirim API. Log audit administratif lengkap belum tersedia pada endpoint laporan.</span>
      </div>
      <div className="disclaimer">
        <FileText size={15} />
        <span>Laporan disusun dari data yang tersimpan dan bukan interpretasi atau diagnosis medis.</span>
      </div>
    </>
  );
}
