import { Check, CircleHelp, ShieldCheck, Sparkles } from 'lucide-react';
import SectionHeading from '../components/SectionHeading';
import { getStatusLabel } from '../utils/formatters';

export default function PredictionPage({ dashboard }) {
  const forecast = dashboard.insights?.capar?.forecast;
  const predictionExposed = dashboard.insights?.capar?.transition_learning?.prediction_exposed === true;

  return (
    <>
      <SectionHeading
        description="Kami hanya menampilkan prediksi personal bila model memenuhi validasi dan confidence yang dipersyaratkan."
        eyebrow="PREDIKSI PERSONAL"
        title="Prediksi"
      />
      <div className="prediction-hero">
        <div className="prediction-orb"><Sparkles size={27} /></div>
        <span className="eyebrow">TRANSPARAN & BERHATI-HATI</span>
        <h2>{predictionExposed ? 'Prediksi tersedia' : 'Prediksi personal belum tersedia'}</h2>
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
