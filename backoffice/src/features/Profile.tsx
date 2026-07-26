import React, { useState, useEffect } from 'react';
import { User, Check, WarningCircle } from '@phosphor-icons/react';

export const Toast: React.FC<{ message: string; type?: 'success' | 'error'; onClose: () => void }> = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        background: 'var(--surface)',
        border: type === 'success' ? '1px solid var(--primary)' : '1px solid var(--caution)',
        borderRadius: 'var(--r-md)',
        padding: '12px 18px',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        animation: 'fadeInUp 200ms var(--ease)',
      }}
    >
      <span className="status-dot" style={{ background: type === 'success' ? 'var(--primary)' : 'var(--caution)' }}></span>
      <span style={{ fontSize: '13px', fontWeight: 550, color: 'var(--ink)' }}>{message}</span>
    </div>
  );
};

export const Profile: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
    gender: '',
    weight: '',
    height: ''
  });

  const storedUser = sessionStorage.getItem('htm_user');
  const userObj = storedUser ? JSON.parse(storedUser) : null;
  const userId = userObj?.id;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch(`/api/user/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setFormData({
            name: data.name || '',
            email: data.email || '',
            age: data.age || '',
            gender: data.gender || '',
            weight: data.weight || '',
            height: data.height || ''
          });
        }
      } catch (err) {
        console.error('Failed to fetch profile', err);
      }
    };
    fetchProfile();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    setLoading(true);
    try {
      const token = sessionStorage.getItem('htm_token');
      const res = await fetch(`/api/user/update/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setToast({ message: 'Profil berhasil diperbarui.', type: 'success' });
        
        // Update name in session
        if (userObj) {
          userObj.name = formData.name;
          sessionStorage.setItem('htm_user', JSON.stringify(userObj));
        }
      } else {
        const errData = await res.json();
        setToast({ message: `Gagal: ${errData.message}`, type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Terjadi kesalahan jaringan.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <section>
        <div className="card text-center py-xl">
          <WarningCircle size={32} color="var(--caution)" className="mx-auto mb-2" />
          <p>Sesi login tidak valid. Silakan login kembali.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-head mb-5">
        <h1 className="page-title flex items-center gap-2">
          <User size={24} weight="duotone" />
          My Profile
        </h1>
      </div>

      <div className="card" style={{ maxWidth: '600px', padding: '24px' }}>
        <p className="card-title pb-3 border-b border-hairline mb-4">Biodata Pengguna</p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="eyebrow" style={{ fontSize: '11px' }}>Nama Lengkap</label>
              <input type="text" className="select-chip font-sans w-full"
                style={{ padding: '10px 12px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="eyebrow" style={{ fontSize: '11px' }}>Email</label>
              <input type="email" className="select-chip font-sans w-full"
                style={{ padding: '10px 12px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'not-allowed' }}
                value={formData.email} disabled title="Email tidak dapat diubah langsung" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="eyebrow" style={{ fontSize: '11px' }}>Umur (Tahun)</label>
              <input type="number" className="select-chip font-sans w-full"
                style={{ padding: '10px 12px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="eyebrow" style={{ fontSize: '11px' }}>Jenis Kelamin</label>
              <select className="select-chip w-full" 
                style={{ padding: '10px 12px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                <option value="">Pilih...</option>
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="eyebrow" style={{ fontSize: '11px' }}>Berat Badan (kg)</label>
              <input type="number" className="select-chip font-sans w-full"
                style={{ padding: '10px 12px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                value={formData.weight} onChange={(e) => setFormData({...formData, weight: e.target.value})} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="eyebrow" style={{ fontSize: '11px' }}>Tinggi Badan (cm)</label>
              <input type="number" className="select-chip font-sans w-full"
                style={{ padding: '10px 12px', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}
                value={formData.height} onChange={(e) => setFormData({...formData, height: e.target.value})} />
            </div>
          </div>

          <div className="pt-2 border-t border-hairline mt-2 flex justify-end">
            <button type="submit" className="btn btn-primary flex items-center gap-2" disabled={loading}>
              <Check size={16} /> {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </section>
  );
};
