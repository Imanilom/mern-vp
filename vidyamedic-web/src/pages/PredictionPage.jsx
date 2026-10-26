import { useState } from 'react';
import { ArrowRight, Check, CircleHelp, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';
import SectionHeading from '../components/SectionHeading';
import { getStatusLabel } from '../utils/formatters';

export default function PredictionPage({
  dashboard,
  onNavigate,
  onCreateAction,
  onUpdateActionStatus,
}) {
  const [savingAction, setSavingAction] = useState(false);
  const [actionError, setActionError] = useState('');
  const forecast = dashboard.insights?.capar?.forecast;
  const predictionExposed = dashboard.insights?.capar?.transition_learning?.prediction_exposed === true;
  const capar = dashboard.insights?.capar || {};
  const pedagogy = capar.pedagogy || {};
  const recommendation = pedagogy.action || null;
  const followUp = pedagogy.follow_up || null;
  const action = recommendation?.message || followUp?.message;
  const trackedRecommendation = (dashboard.patientActions || []).find((item) => (
    item.title === action?.slice(0, 160)
    && item.details?.startsWith('Sumber: rekomendasi CAPAR.')
    && item.status !== 'FAILED'
  ));
  const actionStatusLabel = {
    CREATED: 'Dibuat',
    DELIVERED: 'Tersedia untuk tindak lanjut',
    ACKNOWLEDGED: 'Dikonfirmasi',
    COMPLETED: 'Selesai',
    FAILED: 'Gagal',
  };
  const episodes = capar.episode_history || [];
  const recoveredEpisodes = episodes.filter((episode) => episode.outcome === 'recovered').length;
  const unresolvedEpisodes = episodes.filter((episode) => episode.outcome === 'unresolved').length;
  const followUpStatus = followUp?.status === 'requested'
    ? 'Menunggu konfirmasi pengguna'
    : followUp?.status
      ? getStatusLabel(followUp.status)
      : 'Belum tersedia dari CAPAR';

  async function trackRecommendation() {
    if (!action || !onCreateAction) return;
    setSavingAction(true);
    setActionError('');
    try {
      await onCreateAction({
        action_type: 'patient_guidance',
        title: action.slice(0, 160),
        details: `Sumber: rekomendasi CAPAR. Prioritas: ${recommendation?.priority || 'tidak tersedia'}.`,
        decision: {
          level: recommendation?.priority || '',
          title: recommendation?.title || '',
          policy_version: recommendation?.policy_version || '',
        },
      });
    } catch (error) {
      setActionError(error.message || 'Rekomendasi gagal dicatat.');
    } finally {
      setSavingAction(false);
    }
  }

  async function advanceRecommendation(status) {
    if (!trackedRecommendation || !onUpdateActionStatus) return;
    setSavingAction(true);
    setActionError('');
    try {
      await onUpdateActionStatus(trackedRecommendation._id, status);
    } catch (error) {
      setActionError(error.message || 'Status tindak lanjut gagal diperbarui.');
    } finally {
      setSavingAction(false);
    }
  }

  return (
    <>
      <SectionHeading
        description="Tindak lanjut yang tersedia dari analisis personal, dengan batas yang jelas saat bukti belum memadai."
        eyebrow="VIDYAMEDIC / REKOMENDASI"
        title="Rekomendasi & keputusan"
      />
      <div className="recommendation-banner">
        <span className="panel-icon green-icon"><ShieldCheck size={18} /></span>
        <div>
          <span className="eyebrow">TINDAK LANJUT BERDASARKAN DATA</span>
          <p>{action || 'Belum ada rekomendasi personal dari backend. Lanjutkan pencatatan wearable dan check-in secara berkala.'}</p>
        </div>
        <button className="text-button" onClick={() => onNavigate('deteksi')}>
          Tinjau data <ArrowRight size={14} />
        </button>
      </div>
      <section className="panel recommendation-supervision">
        <div className="panel-heading">
          <div><h2>Prioritas & supervisi manusia</h2><p>Status rekomendasi dan tindak lanjut yang dikembalikan CAPAR</p></div>
          <span className="panel-icon green-icon"><ShieldCheck size={18} /></span>
        </div>
        <div className="quality-metrics">
          <div>
            <span>Prioritas</span>
            <strong>{recommendation?.priority ? getStatusLabel(recommendation.priority) : 'Belum ditentukan CAPAR'}</strong>
          </div>
          <div>
            <span>Penanggung jawab</span>
            <strong>{recommendation?.owner || 'Belum ditentukan CAPAR'}</strong>
          </div>
          <div>
            <span>Status tindak lanjut</span>
            <strong>{trackedRecommendation
              ? actionStatusLabel[trackedRecommendation.status] || trackedRecommendation.status
              : followUpStatus}</strong>
          </div>
        </div>
        {action && !trackedRecommendation && (
          <button
            className="button button-primary recommendation-review"
            disabled={savingAction}
            onClick={trackRecommendation}
            type="button"
          >
            {savingAction ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
            Catat rekomendasi
          </button>
        )}
        {trackedRecommendation?.status === 'CREATED' && (
          <button
            className="button button-light recommendation-review"
            disabled={savingAction}
            onClick={() => advanceRecommendation('DELIVERED')}
            type="button"
          >
            Siapkan tindak lanjut
          </button>
        )}
        {trackedRecommendation?.status === 'DELIVERED' && (
          <button
            className="button button-light recommendation-review"
            disabled={savingAction}
            onClick={() => advanceRecommendation('ACKNOWLEDGED')}
            type="button"
          >
            Saya akan menindaklanjuti
          </button>
        )}
        {trackedRecommendation?.status === 'ACKNOWLEDGED' && (
          <button
            className="button button-light recommendation-review"
            disabled={savingAction}
            onClick={() => advanceRecommendation('COMPLETED')}
            type="button"
          >
            Tandai tindak lanjut selesai
          </button>
        )}
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {followUp?.status === 'requested' && (
          <button className="button button-light recommendation-review" onClick={() => onNavigate('deteksi')}>
            Konfirmasi kontribusi <ArrowRight size={15} />
          </button>
        )}
        <p className="baseline-footnote">
          Prioritas dan penanggung jawab ditampilkan hanya bila tersedia dari CAPAR; halaman ini tidak membuat eskalasi otomatis.
        </p>
      </section>
      <section className="panel recommendation-outcomes">
        <div className="panel-heading">
          <div><h2>Evaluasi hasil yang tercatat</h2><p>Outcome episode CAPAR dalam 30 hari terakhir</p></div>
          <span className="panel-icon gold-icon"><CircleHelp size={18} /></span>
        </div>
        <div className="quality-metrics">
          <div><span>Episode pulih tercatat</span><strong>{capar.status === 'available' ? recoveredEpisodes : '—'}</strong></div>
          <div><span>Episode belum terselesaikan</span><strong>{capar.status === 'available' ? unresolvedEpisodes : '—'}</strong></div>
          <div><span>Hasil tindakan rekomendasi</span><strong>Tidak disediakan API</strong></div>
        </div>
        <p className="baseline-footnote">
          Outcome episode bukan bukti bahwa rekomendasi tertentu menyebabkan perubahan tersebut.
        </p>
      </section>
      <div className="prediction-hero">
        <div className="prediction-orb"><Sparkles size={27} /></div>
        <span className="eyebrow">STATUS PREDIKSI PERSONAL</span>
        <h2>{predictionExposed ? 'Informasi prediksi tersedia' : 'Prediksi personal belum tersedia'}</h2>
        <p>{forecast?.reason || 'Belum ada prediksi personal yang dapat ditampilkan. Vidyamedic tidak mengarang prediksi saat data atau validasi model belum memadai.'}</p>
        <div className="prediction-status">
          <span className="status-dot" />
          {getStatusLabel(forecast?.status || 'not_exposed')}
        </div>
      </div>
      <div className="content-grid prediction-grid">
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Kapan prediksi ditampilkan?</h2><p>Prinsip penggunaan prediksi Vidyamedic</p></div>
            <span className="panel-icon"><ShieldCheck size={18} /></span>
          </div>
          <div className="criteria-list">
            <div>
              <span className="criteria-check"><Check size={14} /></span>
              <div><strong>Data personal mencukupi</strong><p>Rekaman yang konsisten diperlukan untuk membentuk konteks individual.</p></div>
            </div>
            <div>
              <span className="criteria-check"><Check size={14} /></span>
              <div><strong>Kesiapan transisi tervalidasi</strong><p>Model hanya digunakan jika pola transisi melewati pemeriksaan kualitas.</p></div>
            </div>
            <div>
              <span className="criteria-check"><Check size={14} /></span>
              <div><strong>Confidence dapat dijelaskan</strong><p>Prediksi tidak ditampilkan bila tingkat keyakinan model belum memadai.</p></div>
            </div>
          </div>
        </section>
        <section className="panel prediction-side-note">
          <div className="panel-icon gold-icon"><CircleHelp size={18} /></div>
          <h2>Bukan ramalan kondisi medis</h2>
          <p>Fitur ini tidak memprediksi diagnosis atau keadaan darurat. Bila Anda mengalami gejala berat, segera hubungi tenaga kesehatan atau layanan darurat.</p>
          <div className="caption-note">Informasi prediktif yang kelak tersedia tetap memerlukan interpretasi profesional.</div>
        </section>
      </div>
    </>
  );
}
