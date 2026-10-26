import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  AlertCircle,
  Check,
  LoaderCircle,
  LockKeyhole,
  Activity,
  Layers3,
  ListOrdered,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { INITIAL_PROFILE } from '../constants/navigation';
import SectionHeading from '../components/SectionHeading';
import { getInitial, numberOrNull } from '../utils/formatters';
import DataTable from '../components/DataTable';
import MetricCard from '../components/MetricCard';
import { describeMotionBaseline } from '../utils/baselineObservations';

const PERSONAL_FACTORS = [
  { value: 'mood', label: 'Mood' },
  { value: 'meal', label: 'Makan' },
  { value: 'stress', label: 'Stres' },
  { value: 'physical_activity', label: 'Aktivitas fisik' },
  { value: 'sleep', label: 'Tidur' },
  { value: 'other', label: 'Faktor lain' },
];

export default function ProfilePage({ account, dashboard, onSave }) {
  const [form, setForm] = useState(INITIAL_PROFILE);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [personalFactorRanking, setPersonalFactorRanking] = useState([]);
  const [newPersonalFactor, setNewPersonalFactor] = useState('');
  const [savingFactorRanking, setSavingFactorRanking] = useState(false);
  const [factorRankingMessage, setFactorRankingMessage] = useState('');
  const [personalSettings, setPersonalSettings] = useState({
    goal: 'daily_monitoring',
    monitoring_priority: 'activity_rest',
    ai_processing_consent: false,
  });
  const [savingPersonalSettings, setSavingPersonalSettings] = useState(false);
  const [personalSettingsMessage, setPersonalSettingsMessage] = useState('');
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
    setPersonalFactorRanking(profile.personal_factor_ranking || []);
    setPersonalSettings({
      goal: profile.goal || INITIAL_PROFILE.goal,
      monitoring_priority: profile.monitoring_priority || INITIAL_PROFILE.monitoring_priority,
      ai_processing_consent: profile.ai_processing_consent?.granted === true,
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
        wearable_provider: form.wearable_provider,
      });
      setMessage('Profil berhasil disimpan.');
    } catch (error) {
      setMessage(error.message || 'Profil belum dapat disimpan.');
    } finally {
      setSaving(false);
    }
  }

  function addPersonalFactor() {
    if (!newPersonalFactor || personalFactorRanking.includes(newPersonalFactor)) return;
    setPersonalFactorRanking((current) => [...current, newPersonalFactor]);
    setNewPersonalFactor('');
    setFactorRankingMessage('');
  }

  function movePersonalFactor(factor, offset) {
    setPersonalFactorRanking((current) => {
      const index = current.indexOf(factor);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setFactorRankingMessage('');
  }

  async function savePersonalFactorRanking() {
    setSavingFactorRanking(true);
    setFactorRankingMessage('');
    try {
      await onSave({ personal_factor_ranking: personalFactorRanking });
      setFactorRankingMessage('Ranking faktor personal berhasil disimpan.');
    } catch (error) {
      setFactorRankingMessage(error.message || 'Ranking faktor belum dapat disimpan.');
    } finally {
      setSavingFactorRanking(false);
    }
  }

  async function savePersonalSettings() {
    setSavingPersonalSettings(true);
    setPersonalSettingsMessage('');
    try {
      await onSave({
        goal: personalSettings.goal,
        monitoring_priority: personalSettings.monitoring_priority,
        ai_processing_consent: {
          granted: personalSettings.ai_processing_consent,
        },
      });
      setPersonalSettingsMessage('Tujuan, prioritas, dan persetujuan berhasil disimpan.');
    } catch (error) {
      setPersonalSettingsMessage(error.message || 'Preferensi belum dapat disimpan.');
    } finally {
      setSavingPersonalSettings(false);
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
        <section className="panel profile-personal-settings">
          <div className="panel-heading">
            <div>
              <h2>Riwayat & tujuan</h2>
              <p>Preferensi untuk mengarahkan fokus penjelasan dan tindak lanjut personal.</p>
            </div>
            <span className="panel-icon"><Activity size={18} /></span>
          </div>
          <div className="profile-personal-settings-grid">
            <label>
              Tujuan pemantauan
              <select
                onChange={(event) => setPersonalSettings((current) => ({ ...current, goal: event.target.value }))}
                value={personalSettings.goal}
              >
                <option value="patterns_recovery">Pola & recovery</option>
                <option value="daily_monitoring">Pemantauan harian</option>
                <option value="early_awareness">Kesadaran dini</option>
                <option value="fitness">Kebugaran</option>
                <option value="other">Lainnya</option>
              </select>
            </label>
            <label>
              Prioritas personal
              <select
                onChange={(event) => setPersonalSettings((current) => ({ ...current, monitoring_priority: event.target.value }))}
                value={personalSettings.monitoring_priority}
              >
                <option value="activity_rest">Aktivitas & istirahat</option>
                <option value="sleep_recovery">Tidur & pemulihan</option>
                <option value="symptoms">Gejala yang dirasakan</option>
                <option value="daily_patterns">Pola harian</option>
                <option value="other">Lainnya</option>
              </select>
            </label>
          </div>
          <div className="profile-consent-row">
            <label className="profile-consent-control">
              <input
                checked={personalSettings.ai_processing_consent}
                onChange={(event) => setPersonalSettings((current) => ({
                  ...current,
                  ai_processing_consent: event.target.checked,
                }))}
                type="checkbox"
              />
              <span>
                <strong>Persetujuan pemrosesan untuk analisis AI/CAPAR</strong>
                <small>
                  Izinkan pemrosesan segmen wearable, baseline, check-in, dan episode untuk deteksi dini serta reasoning Bayesian.
                  Persetujuan dapat ditarik kapan saja; penarikan menghentikan analisis berikutnya.
                </small>
              </span>
            </label>
            <div className="profile-consent-status">
              <span>Status</span>
              <strong>{profile.ai_processing_consent?.granted === true ? 'Aktif' : 'Belum diberikan'}</strong>
              {profile.ai_processing_consent?.recorded_at && (
                <small>Terakhir diperbarui {new Intl.DateTimeFormat('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(profile.ai_processing_consent.recorded_at))}</small>
              )}
            </div>
          </div>
          <div className="detail-row profile-clinical-status">
            <span>Interpretasi klinis</span><strong>Belum diverifikasi</strong>
          </div>
          <p className="baseline-footnote">
            Tujuan dan prioritas membantu menyusun konteks penjelasan, bukan mengubah probabilitas/model Bayesian. Persetujuan ini mengendalikan analisis AI/CAPAR; data wearable dan check-in tetap dapat dicatat.
          </p>
          {personalSettingsMessage && (
            <div className={personalSettingsMessage.includes('berhasil') ? 'form-success' : 'form-error'} role="status">
              {personalSettingsMessage.includes('berhasil') ? <Check size={15} /> : <AlertCircle size={15} />}
              {personalSettingsMessage}
            </div>
          )}
          <div className="form-actions">
            <span>Perubahan efektif setelah disimpan.</span>
            <button
              className="button button-primary"
              disabled={savingPersonalSettings}
              onClick={savePersonalSettings}
              type="button"
            >
              {savingPersonalSettings ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
              {savingPersonalSettings ? 'Menyimpan...' : 'Simpan tujuan & persetujuan'}
            </button>
          </div>
        </section>
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
        <section className="panel personal-factor-editor">
          <div className="panel-heading">
            <div>
              <h2>Ranking faktor personal</h2>
              <p>Atur faktor yang menurut Anda paling berpengaruh untuk ditampilkan bersama kontribusi sinyal AI.</p>
            </div>
            <span className="panel-icon"><ListOrdered size={18} /></span>
          </div>
          <div className="personal-factor-editor-add">
            <label htmlFor="personal-factor-select">Tambah faktor</label>
            <select
              id="personal-factor-select"
              onChange={(event) => setNewPersonalFactor(event.target.value)}
              value={newPersonalFactor}
            >
              <option value="">Pilih faktor</option>
              {PERSONAL_FACTORS
                .filter((factor) => !personalFactorRanking.includes(factor.value))
                .map((factor) => (
                  <option key={factor.value} value={factor.value}>{factor.label}</option>
                ))}
            </select>
            <button
              className="button button-light"
              disabled={!newPersonalFactor}
              onClick={addPersonalFactor}
              type="button"
            >
              <Plus size={15} /> Tambah
            </button>
          </div>
          {personalFactorRanking.length ? (
            <ol className="personal-factor-edit-list">
              {personalFactorRanking.map((factor, index) => (
                <li key={factor}>
                  <span className="personal-factor-rank">{index + 1}</span>
                  <strong>{PERSONAL_FACTORS.find((item) => item.value === factor)?.label || factor}</strong>
                  <div>
                    <button
                      aria-label={`Naikkan ${factor} dalam ranking`}
                      className="icon-button factor-rank-button"
                      disabled={index === 0}
                      onClick={() => movePersonalFactor(factor, -1)}
                      type="button"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      aria-label={`Turunkan ${factor} dalam ranking`}
                      className="icon-button factor-rank-button"
                      disabled={index === personalFactorRanking.length - 1}
                      onClick={() => movePersonalFactor(factor, 1)}
                      type="button"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      aria-label={`Hapus ${factor} dari ranking`}
                      className="icon-button factor-rank-button"
                      onClick={() => {
                        setPersonalFactorRanking((current) => current.filter((item) => item !== factor));
                        setFactorRankingMessage('');
                      }}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-state small-empty">
              <strong>Belum ada ranking faktor</strong>
              <p>Tambahkan mood, makan, stres, aktivitas, tidur, atau faktor lain sesuai urutan personal Anda.</p>
            </div>
          )}
          <p className="baseline-footnote">
            Ranking ini hanya preferensi/laporan Anda. AI menampilkannya terpisah dari kontribusi statistik sinyal dan tidak menganggapnya sebagai hubungan sebab-akibat.
          </p>
          {factorRankingMessage && (
            <div className={factorRankingMessage.includes('berhasil') ? 'form-success' : 'form-error'} role="status">
              {factorRankingMessage.includes('berhasil') ? <Check size={15} /> : <AlertCircle size={15} />}
              {factorRankingMessage}
            </div>
          )}
          <div className="form-actions">
            <span>Perubahan tersimpan pada profil setelah menekan simpan.</span>
            <button
              className="button button-primary"
              disabled={savingFactorRanking}
              onClick={savePersonalFactorRanking}
              type="button"
            >
              {savingFactorRanking ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
              {savingFactorRanking ? 'Menyimpan...' : 'Simpan ranking'}
            </button>
          </div>
        </section>
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
