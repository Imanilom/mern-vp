import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { INITIAL_PROFILE } from '../constants/navigation';
import SectionHeading from '../components/SectionHeading';
import { getInitial } from '../utils/formatters';

export default function ProfilePage({ account, dashboard, onSave }) {
  const [form, setForm] = useState(INITIAL_PROFILE);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const profile = dashboard.profile?.profile || {};

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
        eyebrow="AKUN ANDA"
        title="Profil"
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
    </>
  );
}
