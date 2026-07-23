import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine
} from 'recharts';
import { DeviceSelector } from '../shared/components/ParticipantSelector';

const HR_NORMAL_MIN = 60;
const HR_NORMAL_MAX = 100;

export const RawDataView: React.FC = () => {
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('P012');
  const [participants, setParticipants] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch('/api/patient/all', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const d = await res.json();
          if (Array.isArray(d)) setParticipants(d);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPatients();
  }, []);

  useEffect(() => {
    const fetchRawData = async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem('htm_token');
        let url = `/api/data/raw/${selectedParticipantId}?`;
        if (selectedDay) url += `date=${selectedDay}&`;
        if (startTime) url += `startTime=${startTime}&`;
        if (endTime) url += `endTime=${endTime}&`;
        
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            const formatted = json.data.map((d: any) => {
              const dt = new Date(d.timestamp);
              const h = dt.getHours().toString().padStart(2, '0');
              const m = dt.getMinutes().toString().padStart(2, '0');
              return {
                ...d,
                timeLabel: `${h}:${m}`,
                dayKey: dt.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }),
                dayLabel: dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
                sortTs: d.timestamp,
              };
            });
            setData(formatted);

          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (selectedParticipantId) {
      fetchRawData();
    }
  }, [selectedParticipantId, selectedDay, startTime, endTime]);

  // Data yang ditampilkan dari hasil fetch API
  const dayData = useMemo(() => {
    return data;
  }, [data]);

  // Ringkasan statistik sederhana untuk hari itu
  const summary = useMemo(() => {
    if (dayData.length === 0) return null;
    const hrValues = dayData.map(d => d.hr).filter((v: number) => typeof v === 'number');
    const rrValues = dayData.map(d => d.rr).filter((v: number) => typeof v === 'number');
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
    return {
      hrAvg: Math.round(avg(hrValues)),
      hrMax: Math.round(Math.max(...hrValues)),
      hrMin: Math.round(Math.min(...hrValues)),
      rrAvg: Math.round(avg(rrValues)),
      count: dayData.length,
    };
  }, [dayData]);

  const SimpleTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const dataPoint = payload[0].payload;
    return (
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Jam {label}</div>
        <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 4 }}>
          Aktivitas: {dataPoint.activity || 'Tidak diketahui'}
        </div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color }}>
            {p.name}: <strong>{p.value}</strong> {p.dataKey === 'hr' ? 'bpm' : 'ms'}
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="animate-fadein">
      <div className="page-head mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Riwayat Detak Jantung</h1>
        <DeviceSelector selectedId={selectedParticipantId} onChange={setSelectedParticipantId} />
      </div>

      {/* Filter Waktu dan Tanggal */}
      <div className="card mb-4">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Pilih Tanggal</span>
            <input 
              type="date" 
              value={selectedDay} 
              onChange={(e) => setSelectedDay(e.target.value)} 
              className="select-chip font-mono"
              style={{ padding: '4px 8px', border: '1px solid var(--hairline)', borderRadius: 4, background: 'var(--surface)', color: 'var(--ink)' }}
            />
          </div>
          
          <div>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Waktu Mulai</span>
            <input 
              type="time" 
              value={startTime} 
              onChange={(e) => setStartTime(e.target.value)} 
              className="select-chip font-mono"
              style={{ padding: '4px 8px', border: '1px solid var(--hairline)', borderRadius: 4, background: 'var(--surface)', color: 'var(--ink)' }}
            />
          </div>
          
          <div>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Waktu Selesai</span>
            <input 
              type="time" 
              value={endTime} 
              onChange={(e) => setEndTime(e.target.value)} 
              className="select-chip font-mono"
              style={{ padding: '4px 8px', border: '1px solid var(--hairline)', borderRadius: 4, background: 'var(--surface)', color: 'var(--ink)' }}
            />
          </div>
          
          <div style={{ marginTop: 18 }}>
            <button 
              onClick={() => { setStartTime(''); setEndTime(''); setSelectedDay(new Date().toISOString().split('T')[0]); }}
              className="select-chip"
              style={{ cursor: 'pointer', padding: '6px 12px' }}
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* Kartu Ringkasan */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
          <SummaryCard label="Rata-rata Detak Jantung" value={`${summary.hrAvg}`} unit="bpm" color="var(--primary)" />
          <SummaryCard label="Tertinggi" value={`${summary.hrMax}`} unit="bpm" color="var(--alert-text)" />
          <SummaryCard label="Terendah" value={`${summary.hrMin}`} unit="bpm" color="var(--muted)" />
          <SummaryCard label="Jumlah Data" value={`${summary.count}`} unit="titik" color="var(--muted)" />
        </div>
      )}

      {/* Grafik Detak Jantung (HR) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <h2 className="card-title">Detak Jantung (Heart Rate)</h2>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            Area hijau muda = rentang normal orang dewasa saat istirahat (60–100 bpm).
          </p>
        </div>
        <div style={{ height: 260, width: '100%' }}>
          {dayData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dayData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                <XAxis dataKey="timeLabel" stroke="var(--muted)" fontSize={11} tickMargin={8} minTickGap={40} />
                <YAxis stroke="var(--muted)" fontSize={11} domain={['dataMin - 10', 'dataMax + 10']} />
                <ReferenceArea y1={HR_NORMAL_MIN} y2={HR_NORMAL_MAX} fill="#22c55e" fillOpacity={0.08} />
                <ReferenceLine y={HR_NORMAL_MIN} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} />
                <ReferenceLine y={HR_NORMAL_MAX} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Tooltip content={<SimpleTooltip />} />
                <Line type="monotone" dataKey="hr" name="Detak Jantung" stroke="var(--primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      {/* Grafik Jarak Antar Detak (RR) */}
      <div className="card">
        <div style={{ marginBottom: 8 }}>
          <h2 className="card-title">Jarak Antar Detak (RR Interval)</h2>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            Semakin stabil garisnya, semakin teratur irama jantung.
          </p>
        </div>
        <div style={{ height: 220, width: '100%' }}>
          {dayData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dayData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                <XAxis dataKey="timeLabel" stroke="var(--muted)" fontSize={11} tickMargin={8} minTickGap={40} />
                <YAxis stroke="var(--muted)" fontSize={11} domain={['dataMin - 50', 'dataMax + 50']} />
                <Tooltip content={<SimpleTooltip />} />
                <Line type="monotone" dataKey="rr" name="Jarak Antar Detak" stroke="var(--alert-text)" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <span className="badge badge-stable">Memuat data...</span>
        </div>
      )}
    </section>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; unit: string; color: string }> = ({ label, value, unit, color }) => (
  <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color }}>
      {value}
      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>{unit}</span>
    </div>
  </div>
);

const EmptyState = () => (
  <div className="placeholder" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
    <span className="msym" style={{ fontSize: 24, color: 'var(--muted)', marginBottom: 8 }}>monitoring</span>
    <span style={{ color: 'var(--muted)', fontSize: 13 }}>Tidak ada data tersedia untuk hari ini.</span>
  </div>
);