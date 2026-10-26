import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  LoaderCircle,
  LockKeyhole,
  Activity,
  Layers3,
  ShieldCheck,
} from 'lucide-react';
import { INITIAL_PROFILE } from '../constants/navigation';
import SectionHeading from '../components/SectionHeading';
import { getInitial, numberOrNull } from '../utils/formatters';
import DataTable from '../components/DataTable';
import MetricCard from '../components/MetricCard';
import PersonalFactorRanking from '../components/PersonalFactorRanking';
import { describeMotionBaseline } from '../utils/baselineObservations';

export default function ProfilePage({ account, dashboard, onSave }) {
  const [form, setForm] = useState(INITIAL_PROFILE);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const profile = dashboard.profile?.profile || {};
  const capar = dashboard.insights?.capar || {};
  const baselines = capar.baseline?.contexts || [];
  const episodes = capar.episode_history || [];
  const recovery = capar.recovery || {};
  const baselineColumns = [
    { key: 'activity', label: 'Aktivitas' },
    { key: 'time_period', label: 'Waktu' },
    { key: 'level', label: 'Kematangan', render: (row) => row.level === 'mature' || row.level === 'mature_legacy' ? 'Matang' : 'Provisional' },
    { key: 'segment_count', label: 'Segmen' },
    { key: 'mean_hr', label: 'Rerata HR', render: (row) => row.feature_stats?.mean_hr?.mean == null ? '—' : `${Math.round(row.feature_stats.mean_hr.mean)} bpm` },
    { key: 'rmssd', label: 'RMSSD', render: (row) => row.feature_stats?.rmssd?.mean == null ? '—' : `${Number(row.feature_stats.rmssd.mean.toFixed(1))} ms` },
    { key: 'dfa_alpha1', label: 'DFA α1', render: (row) => numberOrNull(row.feature_stats?.dfa_alpha1?.mean) == null ? '—' : Number(row.feature_stats.dfa_alpha1.mean.toFixed(3)) },
    { key: 'motion_intensity', label: 'Rerata ACC', render: (row) => numberOrNull(row.feature_stats?.motion_intensity?.mean) == null ? '—' : Number(row.feature_stats.motion_intensity.mean.toFixed(3)) },
    { key: 'motion_observation', label: 'Observasi gerak', render: (row) => describeMotionBaseline(row, baselines) },
    { key: 'quality', label: 'Kualitas baseline', render: (row) => row.quality == null ? '—' : `${Math.round(row.quality * 100)}%` },
  ];

  useEffect(() => {
    setForm({
      ...INITIAL_PROFILE,
      ...profile,
      date_of_birth: profile.date_of_birth
        ? new Date(profile.date_of_birth).toISOString().slice(0, 10)
        : '',
      height_cm: profile.height_cm ?? '',
      weight_kg: profile.weight_kg ?? '',
    });
  }, [dashboard.profile]);

  function change(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage('');
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await onSave({
        date_of_birth: form.date_of_birth || null,
        sex: form.sex || null,
        height_cm: form.height_cm === '' ? null : Number(form.height_cm),
        weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg),
        blood_type: form.blood_type,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        goal: form.goal,
        wearable_provider: form.wearable_provider,
      });
      setMessage('Profil berhasil disimpan.');
    } catch (error) {
      setMessage(error.message || 'Profil belum dapat disimpan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionHeading
        description="Kelola informasi dasar dan preferensi pemantauan kesehatan."
        eyebrow="VIDYAMEDIC / PROFIL KESEHATAN"
        title="Profil kesehatan"
      />
      <div className="profile-layout">
        <aside className="panel profile-summary">
          <div className="avatar-large">{getInitial(account?.name)}</div>
          <h2>{account?.name || 'Peserta Vidyamedic'}</h2>
          <p>{account?.email || 'Email akun'}</p>
          <div className="profile-badge"><ShieldCheck size={15} /> Akun peserta</div>
          <div className="summary-separator" />
          <div className="summary-line">
            <span>Golongan darah</span><strong>{form.blood_type || 'Belum diisi'}</strong>
          </div>
          <div className="summary-line">
            <span>Perangkat</span>
            <strong>{form.wearable_provider === 'polar_h10' ? 'Polar H10' : 'Belum dipilih'}</strong>
          </div>
          <div className="privacy-card">
            <LockKeyhole size={16} />
            <span>Informasi profil Anda hanya dapat diakses oleh akun yang masuk.</span>
          </div>
        </aside>
        <form className="panel profile-form" onSubmit={save}>
          <div className="panel-heading">
            <div><h2>Informasi pribadi</h2><p>Perbarui data agar ringkasan personal lebih relevan.</p></div>
          </div>
          <div className="form-grid">
            <label>Nama lengkap<input disabled value={account?.name || ''} /></label>
            <label>Email<input disabled value={account?.email || ''} /></label>
            <label>
              Tanggal lahir
              <input onChange={(event) => change('date_of_birth', event.target.value)} type="date" value={form.date_of_birth || ''} />
            </label>
            <label>
              Jenis kelamin
              <select onChange={(event) => change('sex', event.target.value)} value={form.sex || ''}>
                <option value="">Pilih</option>
                <option value="female">Perempuan</option>
                <option value="male">Laki-laki</option>
                <option value="other">Lainnya</option>
              </select>
            </label>
            <label>
              Tinggi badan (cm)
              <input min="50" max="250" onChange={(event) => change('height_cm', event.target.value)} placeholder="Contoh: 165" type="number" value={form.height_cm} />
            </label>
            <label>
              Berat badan (kg)
              <input min="2" max="350" onChange={(event) => change('weight_kg', event.target.value)} placeholder="Contoh: 60" type="number" value={form.weight_kg} />
            </label>
            <label>
              Golongan darah
              <select onChange={(event) => change('blood_type', event.target.value)} value={form.blood_type || ''}>
                <option value="">Belum diketahui</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((blood) => (
                  <option key={blood} value={blood}>{blood}</option>
                ))}
              </select>
            </label>
            <label>
              Tujuan pemantauan
              <select onChange={(event) => change('goal', event.target.value)} value={form.goal || 'daily_monitoring'}>
                <option value="daily_monitoring">Pemantauan harian</option>
                <option value="early_awareness">Kesadaran dini</option>
                <option value="fitness">Kebugaran</option>
                <option value="other">Lainnya</option>
              </select>
            </label>
            <label>
              Kontak darurat
              <input onChange={(event) => change('emergency_contact_name', event.target.value)} placeholder="Nama kontak" value={form.emergency_contact_name || ''} />
            </label>
            <label>
              Nomor kontak darurat
              <input onChange={(event) => change('emergency_contact_phone', event.target.value)} placeholder="Nomor telepon" value={form.emergency_contact_phone || ''} />
            </label>
          </div>
          {message && (
            <div className={message.includes('berhasil') ? 'form-success' : 'form-error'}>
              {message.includes('berhasil') ? <Check size={16} /> : <AlertCircle size={16} />}
              {message}
            </div>
          )}
          <div className="form-actions">
            <span>Data medis bukan pengganti konsultasi klinis.</span>
            <button className="button button-primary" disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
              {saving ? 'Menyimpan...' : 'Simpan profil'}
            </button>
          </div>
        </form>
      </div>
      <section className="profile-longitudinal-section">
        <div className="panel-heading profile-section-heading">
          <div>
            <h2>Baseline & perjalanan kesehatan</h2>
            <p>Nilai personal berdasarkan aktivitas, waktu, dan kematangan data CAPAR.</p>
          </div>
          <span className="panel-icon green-icon"><Layers3 size={18} /></span>
        </div>
        <div className="metric-grid profile-history-metrics">
          <MetricCard
            icon={Layers3}
            label="Konteks baseline"
            note={`${capar.baseline?.mature_contexts ?? baselines.filter((item) => item.level === 'mature' || item.level === 'mature_legacy').length} baseline matang`}
            tone="green"
            unit=""
            value={capar.baseline?.total_contexts ?? baselines.length}
          />
          <MetricCard
            icon={Activity}
            label="Episode historis"
            note="Episode yang dikirim CAPAR"
            tone="gold"
            unit=""
            value={episodes.length}
          />
          <MetricCard
            icon={ShieldCheck}
            label="Median pemulihan"
            note="Riwayat terdokumentasi · 30 hari"
            tone="blue"
            unit={recovery.median_recovery_minutes == null ? '' : 'menit'}
            value={recovery.median_recovery_minutes ?? '—'}
          />
        </div>
        <section className="panel historical-panel profile-baseline-panel">
          <div className="panel-heading">
            <div><h2>Baseline fisiologis berdasarkan aktivitas</h2><p>Rerata HR, HRV, DFA α1, dan ACC per aktivitas/waktu berdasarkan statistik CAPAR.</p></div>
            <span className="panel-icon"><Activity size={17} /></span>
          </div>
          <DataTable
            columns={baselineColumns}
            rows={baselines}
            rowKey={(row) => `${row.activity}:${row.time_period}`}
            emptyMessage="Baseline personal belum tersedia. Data akan tampil setelah CAPAR membentuk konteks yang memadai."
          />
          <p className="baseline-footnote profile-motion-note">
            Rerata ACC menggambarkan gerak yang terekam sensor pada baseline aktivitas tersebut. Label observasi membandingkan ACC antar-konteks baseline milik Anda; ACC tidak memastikan jenis gerak atau aktivitas dan dapat dipengaruhi posisi perangkat serta kualitas sensor.
          </p>
        </section>
        <PersonalFactorRanking checkIns={dashboard.checkIns || []} />
        <section className="panel profile-journey-note">
          <div className="panel-heading">
            <div><h2>Rekam perjalanan longitudinal</h2><p>Periode data yang sedang dimuat: {dashboard.periodDays || 30} hari</p></div>
            <span className="panel-icon green-icon"><Activity size={17} /></span>
          </div>
          <p>
            {episodes.length
              ? `${episodes.length} episode CAPAR dan ${dashboard.checkIns?.length || 0} check-in tersedia pada riwayat yang dimuat.`
              : 'Riwayat fisiologis dan check-in akan tersedia di halaman Monitoring dan Laporan saat data tercatat.'}
          </p>
        </section>
      </section>
    </>
  );
}
