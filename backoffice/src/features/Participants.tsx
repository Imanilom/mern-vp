import React, { useState } from 'react';
import { Plus, MagnifyingGlass, Clock, Warning } from '@phosphor-icons/react';
import type { Participant } from '../shared/types';

interface ParticipantsProps {
  onSelectParticipant: (id: string) => void;
}

export const Participants: React.FC<ParticipantsProps> = ({ onSelectParticipant }) => {
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = useState<'All' | 'Active' | 'Inactive' | 'Alert' | 'Incomplete'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  React.useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch('/api/patient/all', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mapped: Participant[] = data.map((u: any) => ({
              id: u.guid || u.email.split('@')[0].toUpperCase(),
              status: u.is_active ? 'Active' : 'Inactive',
              device: u.current_device || 'Polar H10',
              lastSeen: u.created_at ? new Date(u.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Unknown',
              completeness: 0,
              currentActivity: 'Unknown',
              trajectoryStatus: 'No data',
              activeAlerts: 0
            }));
            setParticipants(mapped);
          }
        }
      } catch (err) {
        console.error('Failed to fetch patients from API:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, []);

  const filtered = participants.filter(p => {
    // Search query
    if (searchQuery && !p.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    // Filter pills
    if (filter === 'Active' && p.status !== 'Active') return false;
    if (filter === 'Inactive' && p.status !== 'Inactive') return false;
    if (filter === 'Alert' && p.activeAlerts === 0) return false;
    if (filter === 'Incomplete' && p.completeness >= 90) return false;
    return true;
  });

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Participants</h1>
        <button className="btn btn-primary flex items-center gap-1">
          <Plus size={14} /> Add participant
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="filter-bar flex items-center gap-2 mb-4">
        <div className="search flex items-center gap-2 px-3 py-2 border border-hairline rounded-[10px] bg-surface w-[260px]">
          <MagnifyingGlass size={16} className="text-muted" />
          <input 
            type="text" 
            placeholder="Search participant ID…" 
            className="bg-transparent border-none outline-none text-xs w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <span 
          className={`filter-pill ${filter === 'All' ? 'on' : ''}`}
          onClick={() => setFilter('All')}
        >
          All status
        </span>
        <span 
          className={`filter-pill ${filter === 'Active' ? 'on' : ''}`}
          onClick={() => setFilter('Active')}
        >
          Active
        </span>
        <span 
          className={`filter-pill ${filter === 'Inactive' ? 'on' : ''}`}
          onClick={() => setFilter('Inactive')}
        >
          Inactive
        </span>
        <span 
          className={`filter-pill ${filter === 'Alert' ? 'on' : ''}`}
          onClick={() => setFilter('Alert')}
        >
          Ada peringatan
        </span>
        <span 
          className={`filter-pill ${filter === 'Incomplete' ? 'on' : ''}`}
          onClick={() => setFilter('Incomplete')}
        >
          Data tidak lengkap
        </span>
      </div>

      {/* PARTICIPANTS TABLE */}
      <div className="card !p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-hairline">
              <th className="pl-lg py-sm">ID</th>
              <th className="py-sm">Status</th>
              <th className="py-sm">Device</th>
              <th className="py-sm">Last sync</th>
              <th className="py-sm">Completeness</th>
              <th className="py-sm">Current activity</th>
              <th className="py-sm">Trajectory</th>
              <th className="pr-lg py-sm text-right">Alerts</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-lg text-center text-muted">
                  Memuat data peserta dari API...
                </td>
              </tr>
            ) : filtered.map((p) => {
              let trajClass = 'badge-stable';
              if (p.trajectoryStatus === 'Recovering') trajClass = 'badge-caution';
              if (p.trajectoryStatus === 'Deviation') trajClass = 'badge-deviation';
              if (p.trajectoryStatus === 'No data') trajClass = 'badge-inactive';

              return (
                <tr 
                  key={p.id} 
                  className="clickable border-t border-hairline"
                  onClick={() => onSelectParticipant(p.id)}
                >
                  <td className="mono pl-lg py-sm font-semibold">{p.id}</td>
                  <td className="py-sm">
                    <span className={`badge ${p.status === 'Active' ? 'badge-stable' : 'badge-inactive'}`}>
                      <span className="badge-dot"></span>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-sm">{p.device}</td>
                  <td className="mono py-sm text-xs text-mutedColor flex items-center gap-1">
                    <Clock size={12} /> {p.lastSeen}
                  </td>
                  <td className="mono py-sm">{p.completeness}%</td>
                  <td className="py-sm">{p.currentActivity}</td>
                  <td className="py-sm">
                    <span className={`badge ${trajClass}`}>
                      <span className="badge-dot"></span>
                      {p.trajectoryStatus}
                    </span>
                  </td>
                  <td className="pr-lg py-sm text-right">
                    {p.activeAlerts > 0 ? (
                      <span className={`badge ${p.id === 'P003' ? 'badge-alert' : 'badge-monitoring'}`}>
                        <Warning size={12} className="inline mr-1" />
                        {p.activeAlerts}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-lg text-center text-muted">
                  Tidak ada peserta yang cocok dengan kriteria filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
