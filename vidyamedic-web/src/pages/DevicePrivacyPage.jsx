import { ArrowRight, Bluetooth, LockKeyhole, ShieldCheck } from 'lucide-react';
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
  const provider = profile.wearable_provider || 'none';

  return (
    <>
      <SectionHeading
        description="Periksa perangkat, preferensi, dan informasi privasi pada akun Anda."
        eyebrow="VIDYAMEDIC / PENGATURAN"
        title="Perangkat & privasi"
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
            <strong>{dashboard.history?.some((item) => !item.is_simulated) ? 'Ada riwayat nyata' : 'Belum ada riwayat nyata'}</strong>
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
            <strong>{sharing.clinician === true ? 'Diizinkan' : 'Tidak diizinkan'}</strong>
          </div>
          <div className="settings-detail">
            <span>Berbagi dengan keluarga</span>
            <strong>{sharing.family === true ? 'Diizinkan' : 'Tidak diizinkan'}</strong>
          </div>
          <div className="settings-detail">
            <span>Ringkasan pagi</span>
            <strong>{preferences.morning_summary === true ? 'Aktif' : 'Nonaktif'}</strong>
          </div>
          <p className="settings-note">Vidyamedic menampilkan data akun yang sedang masuk. Fitur berbagi tidak dapat diubah dari halaman ini.</p>
          <div className="privacy-assurance"><ShieldCheck size={16} /> Data kesehatan tidak ditampilkan sebagai data simulasi.</div>
        </section>
      </div>
      <div className="disclaimer">
        <LockKeyhole size={15} />
        <span>Untuk perubahan profil dan preferensi yang tersedia, gunakan halaman Profil Kesehatan.</span>
      </div>
    </>
  );
}
