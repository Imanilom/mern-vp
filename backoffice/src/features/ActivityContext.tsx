import React, { useEffect, useState } from 'react';
import {
  ArrowClockwise, FileText, CheckCircle, Warning, ShieldCheck, X, ChartBar
} from '@phosphor-icons/react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { DeviceSelector } from '../shared/components/ParticipantSelector';

export interface AnalyticsProps {
  selectedParticipantId: string;
  onParticipantChange: (id: string) => void;
}

export const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', bottom: '24px', right: '24px', background: 'var(--surface)',
        border: '1px solid var(--primary)', borderRadius: 'var(--r-md)', padding: '12px 18px',
        boxShadow: 'var(--shadow-lg)', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '10px',
        animation: 'fadeInUp 200ms var(--ease)',
      }}
    >
      <span className="status-dot"></span>
      <span style={{ fontSize: '13px', fontWeight: 550, color: 'var(--ink)' }}>{message}</span>
    </div>
  );
};

export const ActivityContext: React.FC<AnalyticsProps> = ({
  selectedParticipantId,
  onParticipantChange
}) => {
  const [toast, setToast] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedDayHasData, setSelectedDayHasData] = useState<'unknown' | 'hasData' | 'noData'>('unknown');

  // Retrieve user role from session
  const storedUser = sessionStorage.getItem('htm_user');
  const authUser = storedUser ? JSON.parse(storedUser) : null;
  const isDoctor = authUser?.role === 'doctor';

  useEffect(() => {
    const fetchActivitiesAndSegments = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const idToFetch = selectedParticipantId;
        if (!idToFetch) return;

        // Fetch activity context summary
        let url = `/api/analysis/activity-context/${idToFetch}`;
        if (selectedDay) url += `?date=${selectedDay}`;
        
        const resAct = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resAct.ok) {
          const data = await resAct.json();
          if (data.success) {
            setActivities(data.data);
            if (selectedDay) {
              setSelectedDayHasData(Array.isArray(data.data) && data.data.length > 0 ? 'hasData' : 'noData');
            } else {
              setSelectedDayHasData('unknown');
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchActivitiesAndSegments();
  }, [selectedParticipantId, selectedDay]);

  return (
    <section>
      <div className="page-head mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Activity Context & Metrik Baseline</h1>
          <p className="text-xs text-muted" style={{ marginTop: 2 }}>
            Role: <strong style={{ color: isDoctor ? 'var(--primary)' : 'var(--ink)' }}>{isDoctor ? 'Doctor (Full Access)' : 'Regular User (Self Only)'}</strong>
          </p>
        </div>
        <DeviceSelector selectedId={selectedParticipantId} onChange={onParticipantChange} />
      </div>

      {/* Date selector */}
      <div className="card mb-4" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Pilih Tanggal</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => { setSelectedDay(e.target.value); setSelectedDayHasData('unknown'); }}
                className="select-chip font-mono"
                style={{ padding: '4px 8px', border: '1px solid var(--hairline)', borderRadius: 4, background: 'var(--surface)', color: 'var(--ink)' }}
              />
              <span className={`badge ${selectedDay ? (selectedDayHasData === 'unknown' ? 'badge-monitoring' : selectedDayHasData === 'hasData' ? 'badge-stable' : 'badge-caution') : 'badge-monitoring'}`} style={{ fontSize: 11, padding: '5px 10px' }}>
                {selectedDay
                  ? (selectedDayHasData === 'unknown' ? 'Mengecek...' : selectedDayHasData === 'hasData' ? 'Ada data' : 'Belum ada data')
                  : 'Semua tanggal'}
              </span>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <button
              onClick={() => { setSelectedDay(''); setSelectedDayHasData('unknown'); }}
              className="select-chip"
              style={{ cursor: 'pointer', padding: '6px 12px' }}
            >
              Semua Waktu
            </button>
          </div>
        </div>
      </div>

      {/* Table 1: Parameter Baseline Quality */}
      <div className="card !p-0 overflow-hidden mb-6">
        <div style={{ padding: '12px 16px', background: 'var(--surface-overlay)', borderBottom: '1px solid var(--hairline)', fontWeight: 600, fontSize: 13 }}>
          ⚙️ Parameter Baseline Quality (Quality Audit)
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                <th className="pl-lg py-sm text-left font-semibold">Parameter</th>
                <th className="text-left font-semibold">Nilai Default</th>
                <th className="text-left font-semibold">Fungsi</th>
                <th className="pr-lg text-left font-semibold">Status Evidensi</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-hairline"><td className="pl-lg py-sm font-semibold">Durasi window</td><td>300 s</td><td>Komparabilitas HRV jangka pendek; dapat diuji 60/120/180/300 s.</td><td className="pr-lg">Berbasis praktik HRV; tetap diuji</td></tr>
              <tr className="border-t border-hairline"><td className="pl-lg py-sm font-semibold">RR minimum</td><td>60 beat</td><td>Mencegah fitur dihitung dari seri terlalu pendek.</td><td className="pr-lg">Operasional</td></tr>
              <tr className="border-t border-hairline"><td className="pl-lg py-sm font-semibold">RR untuk DFA</td><td>64 beat</td><td>Memungkinkan beberapa segmen pada skala pendek/panjang.</td><td className="pr-lg">Operasional</td></tr>
              <tr className="border-t border-hairline"><td className="pl-lg py-sm font-semibold">Artefak maks.</td><td>5%</td><td>Di atas batas ini window diberi peringatan kualitas.</td><td className="pr-lg">Didukung panduan Kubios</td></tr>
              <tr className="border-t border-hairline"><td className="pl-lg py-sm font-semibold">Missing maks.</td><td>10%</td><td>Menjaga kelengkapan window.</td><td className="pr-lg">Usulan; kalibrasi</td></tr>
              <tr className="border-t border-hairline"><td className="pl-lg py-sm font-semibold">Confidence aktivitas</td><td>0.80</td><td>Mengurangi pemilihan baseline konteks yang salah.</td><td className="pr-lg">Usulan model</td></tr>
              <tr className="border-t border-hairline"><td className="pl-lg py-sm font-semibold">n_eff minimum</td><td>30</td><td>Presisi baseline; memperhitungkan autokorelasi.</td><td className="pr-lg">Usulan berbasis presisi</td></tr>
              <tr className="border-t border-hairline"><td className="pl-lg py-sm font-semibold">Hari minimum</td><td>3 hari</td><td>Memasukkan variasi antarhari awal.</td><td className="pr-lg">Usulan; target 5-7 hari</td></tr>
              <tr className="border-t border-hairline"><td className="pl-lg py-sm font-semibold">Window per hari</td><td>5</td><td>Mencegah hari hanya diwakili satu pengamatan.</td><td className="pr-lg">Usulan</td></tr>
              <tr className="border-t border-hairline"><td className="pl-lg py-sm font-semibold">Threshold deviasi (τ)</td><td>2.50</td><td>Kandidat deviasi.</td><td className="pr-lg">Dikalibrasi</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart: RMSSD per aktivitas */}
      <div className="card mb-6" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChartBar size={18} color="var(--primary)" /> Grafik Rata-rata RMSSD per Aktivitas
        </h3>
        {activities.length > 0 ? (
          <div style={{ height: 300, width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={activities} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--hairline)" />
                <XAxis dataKey="activity" stroke="var(--muted)" fontSize={12} />
                <YAxis stroke="var(--muted)" fontSize={12} unit=" ms" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: 8, border: '1px solid var(--hairline)' }}
                  formatter={(value: any) => [`${value} ms`, 'RMSSD']}
                />
                <Legend />
                <Bar dataKey="rmssd" name="Rata-rata RMSSD" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
            Belum ada data aktivitas untuk ditampilkan.
          </div>
        )}
      </div>

      {/* Table 2: Activity Context Aggregated Summary */}
      <div className="card !p-0 overflow-hidden mb-4">
        <div style={{ padding: '12px 16px', background: 'var(--surface-overlay)', borderBottom: '1px solid var(--hairline)', fontWeight: 600, fontSize: 13 }}>
          📊 Metrik Aktivitas (Aggregated Window Stats)
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                <th className="pl-lg py-sm text-left font-semibold">Activity</th>
                <th className="text-left font-semibold">Windows</th>
                <th className="text-left font-semibold">Duration</th>
                <th className="text-left font-semibold">HR mean</th>
                <th className="text-left font-semibold">HR SD</th>
                <th className="text-left font-semibold">RMSSD</th>
                <th className="text-left font-semibold">DFA α1</th>
                <th className="text-left font-semibold">Missing Ratio</th>
                <th className="pr-lg text-right font-semibold">Readiness</th>
              </tr>
            </thead>
            <tbody>
              {activities.length > 0 ? activities.map((act, i) => (
                <tr key={i} className="border-t border-hairline">
                  <td className="pl-lg py-sm font-semibold">
                    {act.activity}
                  </td>
                  <td className="mono">{act.windows}</td>
                  <td className="mono">{act.duration}</td>
                  <td className="mono">{act.mean_hr} bpm</td>
                  <td className="mono">{act.sd_hr}</td>
                  <td className="mono">{act.rmssd} ms</td>
                  <td className="mono">{act.dfa_alpha1}</td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{act.missing_ratio !== undefined ? `${(act.missing_ratio * 100).toFixed(1)}%` : '—'}</td>
                  <td className="pr-lg text-right">
                    <span className={`badge ${act.readiness === 'Ready' ? 'badge-stable' : 'badge-caution'}`}>
                      <span className="badge-dot"></span>{act.readiness}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={9} className="text-center py-4 text-muted">Belum ada rangkuman aktivitas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};
