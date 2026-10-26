import {
  ArrowRight,
  Bluetooth,
  CheckCircle2,
  CircleHelp,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import SectionHeading from '../components/SectionHeading';

const providerLabels = {
  none: 'Belum dipilih',
  polar_h10: 'Polar H10',
  apple_watch: 'Apple Watch',
  garmin: 'Garmin',
  fitbit: 'Fitbit',
  other: 'Lainnya',
};

export default function DevicePrivacyPage({ dashboard, onNavigate }) {
  const profile = dashboard.profile?.profile || {};
  const preferences = profile.notification_preferences || {};
  const sharing = profile.data_sharing || {};
  const sharingLabel = (value) => value === true
    ? 'Diizinkan'
    : value === false
      ? 'Tidak diizinkan'
      : 'Belum tersedia';
  const preferenceLabel = (value) => value === true
    ? 'Aktif'
    : value === false
      ? 'Nonaktif'
      : 'Belum tersedia';
  const provider = profile.wearable_provider || 'none';
  const realSamples = (dashboard.history || []).filter((item) => !item.is_simulated);
  const latestSample = [...realSamples].sort(
    (first, second) => new Date(second.recorded_at) - new Date(first.recorded_at),
  )[0];

  return (
    <>
      <SectionHeading
        description="Ringkasan integrasi, privasi, kualitas data, dan status pengelolaan model yang tersedia untuk akun Anda."
        eyebrow="VIDYAMEDIC / ADMINISTRASI"
        title="Administrasi"
      />
      <div className="content-grid device-settings-grid">
        <section className="panel device-settings-panel">
          <div className="panel-heading">
            <div><h2>Wearable</h2><p>Preferensi perangkat yang tersimpan di profil</p></div>
            <span className="panel-icon"><Bluetooth size={18} /></span>
          </div>
          <div className="settings-detail">
            <span>Perangkat pilihan</span>
            <strong>{providerLabels[provider] || providerLabels.other}</strong>
          </div>
          <div className="settings-detail">
            <span>Status data wearable</span>
            <strong>{realSamples.length ? `${realSamples.length} ringkasan nyata` : 'Belum ada riwayat nyata'}</strong>
          </div>
          <div className="settings-detail">
            <span>Sinkronisasi terakhir</span>
            <strong>{latestSample
              ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(latestSample.recorded_at))
              : 'Belum tersedia'}</strong>
          </div>
          <p className="settings-note">Pilihan perangkat tidak memastikan perangkat sedang tersambung. Status bacaan ditentukan dari data yang berhasil diterima.</p>
          <button className="button button-light" onClick={() => onNavigate('profil')}>
            Kelola profil wearable <ArrowRight size={15} />
          </button>
        </section>
        <section className="panel device-settings-panel">
          <div className="panel-heading">
            <div><h2>Privasi & persetujuan</h2><p>Status yang dikembalikan oleh profil akun</p></div>
            <span className="panel-icon green-icon"><LockKeyhole size={18} /></span>
          </div>
          <div className="settings-detail">
            <span>Berbagi dengan tenaga kesehatan</span>
            <strong>{sharingLabel(sharing.clinician)}</strong>
          </div>
          <div className="settings-detail">
            <span>Berbagi dengan keluarga</span>
            <strong>{sharingLabel(sharing.family)}</strong>
          </div>
          <div className="settings-detail">
            <span>Ringkasan pagi</span>
            <strong>{preferenceLabel(preferences.morning_summary)}</strong>
          </div>
          <p className="settings-note">Vidyamedic menampilkan data akun yang sedang masuk. Fitur berbagi tidak dapat diubah dari halaman ini.</p>
          <div className="privacy-assurance"><ShieldCheck size={16} /> Data kesehatan tidak ditampilkan sebagai data simulasi.</div>
        </section>
      </div>
      <div className="content-grid device-settings-grid administration-grid">
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Hak akses & persetujuan</h2><p>Informasi yang tersedia pada profil akun</p></div>
            <span className="panel-icon green-icon"><LockKeyhole size={18} /></span>
          </div>
          <div className="settings-detail"><span>Sesi masuk</span><strong><CheckCircle2 size={14} /> Terautentikasi</strong></div>
          <div className="settings-detail"><span>Berbagi klinisi</span><strong>{sharingLabel(sharing.clinician)}</strong></div>
          <div className="settings-detail"><span>Berbagi keluarga</span><strong>{sharingLabel(sharing.family)}</strong></div>
          <p className="settings-note">Manajemen peran dan perubahan hak akses membutuhkan endpoint administrasi khusus; dashboard tidak mengubah izin.</p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Kualitas, keamanan & audit</h2><p>Status data yang diterima aplikasi</p></div>
            <span className="panel-icon"><ShieldCheck size={18} /></span>
          </div>
          <div className="settings-detail"><span>Data wearable nyata</span><strong>{realSamples.length}</strong></div>
          <div className="settings-detail"><span>Segmen CAPAR (30 hari)</span><strong>{dashboard.insights?.capar?.data_inventory?.segments_returned ?? '—'}</strong></div>
          <div className="settings-detail"><span>Log audit administratif</span><strong>Belum tersedia di API web</strong></div>
          <p className="settings-note">Halaman ini hanya menampilkan status yang diizinkan API; tidak mengklaim pemeriksaan keamanan atau audit yang belum diimplementasikan.</p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Versi & evaluasi model AI</h2><p>Informasi validasi yang tersedia di CAPAR</p></div>
            <span className="panel-icon gold-icon"><SlidersHorizontal size={18} /></span>
          </div>
          <div className="settings-detail"><span>Prediksi personal</span><strong>{dashboard.insights?.capar?.forecast?.status === 'available' ? 'Tersedia' : 'Tidak diekspos'}</strong></div>
          <div className="settings-detail"><span>Transisi teramati</span><strong>{dashboard.insights?.capar?.transition_learning?.observed_transitions ?? '—'}</strong></div>
          <div className="settings-detail"><span>Versi model / hasil validasi</span><strong>Belum disediakan API</strong></div>
          <div className="settings-note"><CircleHelp size={15} /> Prediksi tidak ditampilkan ketika kesiapan transisi atau confidence belum tervalidasi.</div>
        </section>
      </div>
      <div className="disclaimer">
        <LockKeyhole size={15} />
        <span>Gunakan halaman Profil Kesehatan untuk mengubah profil dan preferensi yang memang tersedia.</span>
      </div>
    </>
  );
}
