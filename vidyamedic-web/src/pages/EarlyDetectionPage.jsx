import {
  Activity,
  AlertCircle,
  CircleHelp,
  Clock3,
  HeartPulse,
  ShieldCheck,
} from 'lucide-react';
import HistoricalDetails from '../components/HistoricalDetails';
import SectionHeading from '../components/SectionHeading';
import { formatDate, getStatusLabel } from '../utils/formatters';

export default function EarlyDetectionPage({ dashboard }) {
  const capar = dashboard.insights?.capar || {};
  const pedagogy = capar.pedagogy || {};
  const latest = capar.latest_state;
  const deviation = pedagogy.why || {};
  const recovery = capar.recovery || {};
  const redFlags = pedagogy.red_flags || {};
  const status = capar.status;
  const isLinkRequired = status === 'link_required';
  const isInsufficient = !status || status === 'insufficient_data';

  return (
    <>
      <SectionHeading
        description="Ringkasan perubahan berdasarkan data yang tersimpan. Informasi ini bukan diagnosis."
        eyebrow="WAWASAN BERBASIS DATA"
        title="Deteksi dini"
      />
      {isLinkRequired && (
        <div className="notice notice-warning">
          <AlertCircle size={18} />
          <span>Akun CAPAR belum terhubung. Hubungkan akun melalui Profil atau aplikasi Vidyamedic agar riwayat CAPAR dapat ditampilkan.</span>
        </div>
      )}
      {isInsufficient && !isLinkRequired && (
        <div className="notice notice-info">
          <CircleHelp size={18} />
          <span>Data CAPAR belum cukup untuk membentuk ringkasan personal. Lanjutkan pencatatan wearable dan check-in secara berkala.</span>
        </div>
      )}
      {redFlags.red_flag && (
        <div className="notice notice-danger">
          <AlertCircle size={19} />
          <span>
            <strong>Ada laporan gejala yang perlu diperhatikan.</strong>
            {' '}{redFlags.message || redFlags.reason || 'Pertimbangkan untuk menghubungi tenaga kesehatan, terutama bila gejala berat atau memburuk.'}
          </span>
        </div>
      )}
      <div className="detection-banner">
        <div className={`detection-emblem ${isInsufficient || isLinkRequired ? 'muted' : ''}`}>
          <ShieldCheck size={28} />
        </div>
        <div>
          <span className="eyebrow">STATUS DATA</span>
          <h2>{getStatusLabel(status)}</h2>
          <p>{capar.disclaimer || dashboard.insights?.disclaimer || 'Status ini merangkum kesiapan dan ketersediaan data, bukan penilaian risiko klinis.'}</p>
        </div>
        <span className="detection-date">
          <Clock3 size={15} />
          {formatDate(dashboard.insights?.generated_at, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
      <div className="content-grid detection-grid">
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Perubahan yang tercatat</h2><p>Informasi CAPAR terbaru</p></div>
            <span className="panel-icon"><Activity size={18} /></span>
          </div>
          {latest ? (
            <div className="detection-detail">
              <div className="detail-row">
                <span>Status terakhir</span><strong>{getStatusLabel(latest.status || latest)}</strong>
              </div>
              <div className="detail-row">
                <span>Waktu pembaruan</span>
                <strong>{formatDate(latest.recorded_at || latest.updated_at, { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </div>
              {deviation.explanation_status && (
                <div className="detail-row">
                  <span>Keterangan</span><strong>{deviation.explanation_status.replaceAll('_', ' ')}</strong>
                </div>
              )}
              {deviation.main_factors?.length > 0 && (
                <div className="factor-list">
                  {deviation.main_factors.slice(0, 4).map((factor, index) => (
                    <span key={`${factor.name || factor}-${index}`}>
                      {typeof factor === 'string' ? factor : factor.label || factor.name || 'Faktor tercatat'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-chart-icon"><Activity size={22} /></div>
              <strong>Belum ada perubahan personal untuk ditampilkan</strong>
              <p>Ringkasan akan muncul setelah data CAPAR yang memadai tersedia.</p>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Pemulihan & tindak lanjut</h2><p>Catatan hasil pemantauan, bukan prediksi</p></div>
            <span className="panel-icon green-icon"><HeartPulse size={18} /></span>
          </div>
          <div className="recovery-stat">
            <div className="recovery-number">
              {recovery.median_recovery_minutes ?? '—'}
              <span>{recovery.median_recovery_minutes != null ? 'menit' : ''}</span>
            </div>
            <span>Median pemulihan tercatat · 30 hari</span>
          </div>
          {recovery.recovery_rate_definition && <p className="muted-copy">{recovery.recovery_rate_definition}</p>}
          <div className="followup-card">
            <ShieldCheck size={17} />
            <span>{pedagogy.action?.message || pedagogy.follow_up?.message || 'Teruskan pencatatan secara berkala dan diskusikan kekhawatiran kesehatan dengan tenaga kesehatan.'}</span>
          </div>
          <div className="caption-note">Ringkasan observasi ini tidak menetapkan penyebab atau diagnosis.</div>
        </section>
      </div>
      <HistoricalDetails capar={capar} checkIns={dashboard.checkIns} />
    </>
  );
}
