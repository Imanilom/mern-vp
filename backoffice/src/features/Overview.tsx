import React, { useState, useEffect, useMemo } from 'react';
import { Users, AlertTriangle as Warning, CheckCircle, AlertCircle as WarningCircle, Search as MagnifyingGlass, User, Activity } from 'lucide-react';

interface OverviewProps {
  onViewParticipant: (id: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ onViewParticipant }) => {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Retrieve authUser to check role
  const storedUser = sessionStorage.getItem('htm_user');
  const authUser = storedUser ? JSON.parse(storedUser) : null;
  const isDoctor = authUser?.role === 'doctor';

  useEffect(() => {
    const fetchPatientsAndAlerts = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch('/api/patient/all', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setPatients(data);
          }
        } else {
          setError('Gagal memuat daftar pasien.');
        }
      } catch (err: any) {
        setError(err.message || 'Gagal terhubung ke server');
      } finally {
        setLoading(false);
      }
    };

    fetchPatientsAndAlerts();
  }, []);

  const { total, attentionNeeded } = useMemo(() => {
    return {
      total: patients.length,
      attentionNeeded: patients.filter(p => p.hasAlert).length
    };
  }, [patients]);

  const filteredPatients = useMemo(() => {
    let sorted = [...patients].sort((a, b) => {
      if (a.hasAlert && !b.hasAlert) return -1;
      if (!a.hasAlert && b.hasAlert) return 1;
      return 0;
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      sorted = sorted.filter(p => (p.name || p.username || '').toLowerCase().includes(q));
    }
    return sorted;
  }, [patients, searchQuery]);

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Memuat dashboard...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-center">
        <WarningCircle size={40} color="var(--alert-text)" />
        <p className="text-md font-semibold" style={{ color: 'var(--ink)' }}>Gagal memuat dashboard</p>
        <p className="text-sm max-w-md" style={{ color: 'var(--muted)' }}>{error}</p>
        <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', borderRadius: 'var(--r-md)' }}>
          Coba Lagi
        </button>
      </section>
    );
  }

  // Doctor View Only
  if (!isDoctor) {
    return (
      <section className="p-8 text-center animate-fadein">
        <h1 className="text-2xl font-bold mb-4">Selamat Datang, {authUser?.name || authUser?.username}</h1>
        <p className="text-muted">Gunakan menu di samping untuk melihat profil kesehatan Anda.</p>
        <button className="btn btn-primary mt-6" onClick={() => onViewParticipant(authUser?.guid || authUser?.id)}>
          Lihat Profil Saya
        </button>
      </section>
    );
  }

  return (
    <section className="animate-fadein pb-8">
      <div className="page-head mb-6">
        <div>
          <h1 className="page-title">👨‍⚕️ Patient Monitoring Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            Prioritas pemantauan berdasarkan deviasi fisiologis terkini.
          </p>
        </div>
        <span className="page-meta">{new Date().toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card flex items-center p-5 border-l-4" style={{ borderColor: 'var(--primary)' }}>
          <div className="rounded-full p-3 mr-4" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
            <Users size={28} color="var(--primary)" />
          </div>
          <div>
            <div className="text-3xl font-bold text-[var(--ink)]">{total}</div>
            <div className="text-sm font-semibold text-[var(--muted)] tracking-wide uppercase mt-1">Total Pasien</div>
          </div>
        </div>

        <div className="card flex items-center p-5 border-l-4" style={{ borderColor: attentionNeeded > 0 ? 'var(--alert-text)' : 'var(--success)' }}>
          <div className="rounded-full p-3 mr-4" style={{ background: attentionNeeded > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)' }}>
            {attentionNeeded > 0 ? <Warning size={28} color="var(--alert-text)" /> : <CheckCircle size={28} color="var(--success)" />}
          </div>
          <div>
            <div className="text-3xl font-bold text-[var(--ink)]">{attentionNeeded}</div>
            <div className="text-sm font-semibold text-[var(--muted)] tracking-wide uppercase mt-1">Pasien Perlu Perhatian</div>
          </div>
        </div>
      </div>

      {/* Searchable Patient Table */}
      <div className="card !p-0 overflow-hidden shadow-md">
        <div className="p-4 bg-[var(--surface-overlay)] border-b border-[var(--hairline)] flex justify-between items-center">
          <h2 className="font-semibold text-[var(--ink)] flex items-center gap-2">
            <Activity size={18} color="var(--primary)" /> Prioritas Triase Pasien
          </h2>
          <div className="relative">
            <MagnifyingGlass size={16} color="var(--muted)" className="absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Cari nama pasien..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-[var(--hairline)] rounded-full text-sm bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)] w-64"
            />
          </div>
        </div>
        
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--surface-overlay)] text-left text-[13px] text-[var(--muted)] border-b border-[var(--hairline)]">
              <th className="py-3 pl-6 font-semibold">Nama Pasien</th>
              <th className="py-3 font-semibold">Status / Prioritas</th>
              <th className="py-3 font-semibold">Keterangan Deviasi</th>
              <th className="py-3 pr-6 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.length > 0 ? filteredPatients.map(p => (
              <tr 
                key={p._id || p.guid} 
                className="border-b border-[var(--hairline)] hover:bg-[var(--surface-overlay)] cursor-pointer transition-colors"
                onClick={() => onViewParticipant(p.guid || p._id)}
              >
                <td className="py-4 pl-6 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--primary-glow)] flex items-center justify-center text-[var(--primary)] font-bold text-sm">
                    {p.name ? p.name.charAt(0).toUpperCase() : <User size={16} />}
                  </div>
                  <div>
                    <div className="font-bold text-[var(--ink)]">{p.name || p.username}</div>
                    <div className="text-xs text-[var(--muted)] font-mono">{String(p._id).slice(-6)}</div>
                  </div>
                </td>
                <td className="py-4">
                  {p.hasAlert ? (
                    <span className={`badge ${p.alertPriority === 'High' ? 'bg-red-100 text-red-600 border-red-200' : 'badge-caution'} px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max`}>
                      <span className={`w-2 h-2 rounded-full ${p.alertPriority === 'High' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                      Prioritas {p.alertPriority}
                    </span>
                  ) : (
                    <span className="badge badge-stable px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span> Normal
                    </span>
                  )}
                </td>
                <td className="py-4 text-sm text-[var(--ink)]">
                  {p.recentDeviation ? (
                    <span className="flex items-center gap-1">
                      <WarningCircle size={14} color="var(--alert-text)" /> {p.recentDeviation}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)] italic">Tidak ada deviasi aktif</span>
                  )}
                </td>
                <td className="py-4 pr-6 text-right">
                  <button className="btn btn-outline text-xs px-3 py-1 hover:bg-[var(--primary)] hover:text-white transition-colors">
                    Lihat Detail
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[var(--muted)]">
                  Tidak ada pasien yang cocok dengan pencarian Anda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
