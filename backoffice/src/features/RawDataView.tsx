import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import { DeviceSelector } from '../shared/components/ParticipantSelector';

const HR_NORMAL_MIN = 60;
const HR_NORMAL_MAX = 100;

// Helper: today in YYYY-MM-DD (lokal, bukan UTC)
const todayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export interface RawDataProps {
  selectedParticipantId?: string;
  onParticipantChange?: (id: string) => void;
}

export const RawDataView: React.FC<RawDataProps> = ({ selectedParticipantId: propParticipantId, onParticipantChange }) => {
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(propParticipantId || '');

  useEffect(() => {
    if (propParticipantId) setSelectedParticipantId(propParticipantId);
  }, [propParticipantId]);

  const handleSelectParticipant = (id: string) => {
    setSelectedParticipantId(id);
    if (onParticipantChange) onParticipantChange(id);
  };

  const [participants, setParticipants] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Default ke string kosong agar bisa melihat data apa pun (tidak terkunci di hari ini)
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedDayHasData, setSelectedDayHasData] = useState<boolean | null>(null);
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  // Simpan timestamp terakhir untuk live polling incremental (?since=)
  const lastTimestampRef = useRef<number | null>(null);

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

  // Fungsi fetch data — bisa full atau incremental (?since=)
  const fetchRawData = async (incremental = false) => {
    if (!selectedParticipantId) return;
    if (!incremental) {
      setLoading(true);
      setSelectedDayHasData(null);
    }
    try {
      const token = sessionStorage.getItem('htm_token');
      let url = `/api/data/raw/${selectedParticipantId}?`;

      if (incremental && lastTimestampRef.current) {
        // Hanya ambil data baru setelah timestamp terakhir
        url += `since=${lastTimestampRef.current}&`;
      } else {
        // Full fetch: filter tanggal dan waktu
        if (selectedDay)  url += `date=${selectedDay}&`;
        if (startTime)    url += `startTime=${startTime}&`;
        if (endTime)      url += `endTime=${endTime}&`;
      }

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;

      const json = await res.json();
      if (!json.success) return;

      // Format data
      const formatted = json.data.map((d: any) => {
        const dt = new Date(d.timestamp);
        const h = dt.getHours().toString().padStart(2, '0');
        const m = dt.getMinutes().toString().padStart(2, '0');
        const s = dt.getSeconds().toString().padStart(2, '0');
        return {
          ...d,
          timeLabel: `${h}:${m}:${s}`,
          sortTs: d.timestamp,
        };
      });

      // Update lastTimestamp untuk live polling berikutnya
      if (json.lastTimestamp) {
        lastTimestampRef.current = json.lastTimestamp;
      }

      if (incremental && formatted.length > 0) {
        // Tambahkan ke data yang sudah ada, pertahankan 2000 titik terakhir
        setData(prev => [...prev, ...formatted].slice(-2000));
        setSelectedDayHasData(true);
      } else {
        setData(formatted);
        lastTimestampRef.current = json.lastTimestamp ?? null;
        setSelectedDayHasData(formatted.length > 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!incremental) setLoading(false);
    }
  };

  // Fetch penuh saat participant / filter berubah
  useEffect(() => {
    if (selectedParticipantId) {
      lastTimestampRef.current = null; // Reset live pointer
      fetchRawData(false);
    }
  }, [selectedParticipantId, selectedDay, startTime, endTime]);

  // Live polling setiap 10 detik — hanya fetch data baru via ?since=
  useEffect(() => {
    if (!selectedParticipantId) return;
    const intervalId = setInterval(() => fetchRawData(true), 10000);
    return () => clearInterval(intervalId);
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

  // Poincaré Plot (Scatter Plot) Data with accurate SD1 & SD2
  const poincareData = useMemo(() => {
    const rrIntervals = dayData.map(d => d.rr).filter(v => typeof v === 'number' && v > 0);
    if (rrIntervals.length < 2) return { points: [], sd1: 0, sd2: 0, ratio: 0 };

    const points = [];
    let sumDiff = 0, sumAdd = 0;
    const n = rrIntervals.length - 1;

    // Calculate means
    for (let i = 0; i < n; i++) {
      const rr_n = rrIntervals[i];
      const rr_n1 = rrIntervals[i+1];
      points.push({ x: rr_n, y: rr_n1 });
      sumDiff += (rr_n - rr_n1);
      sumAdd += (rr_n + rr_n1);
    }
    const meanDiff = sumDiff / n;
    const meanAdd = sumAdd / n;

    // Calculate sum of squared differences from the mean
    let sumSqDiff = 0;
    let sumSqAdd = 0;
    for (let i = 0; i < n; i++) {
      const rr_n = rrIntervals[i];
      const rr_n1 = rrIntervals[i+1];
      sumSqDiff += Math.pow((rr_n - rr_n1) - meanDiff, 2);
      sumSqAdd += Math.pow((rr_n + rr_n1) - meanAdd, 2);
    }

    // Sample variance (divided by n - 1)
    const varDiff = sumSqDiff / (n - 1 || 1);
    const varAdd = sumSqAdd / (n - 1 || 1);

    const sd1 = Math.sqrt(0.5 * varDiff);
    const sd2 = Math.sqrt(0.5 * varAdd);

    return { 
      points, 
      sd1: Math.round(sd1 * 100) / 100, 
      sd2: Math.round(sd2 * 100) / 100,
      ratio: sd2 !== 0 ? Math.round((sd1 / sd2) * 100) / 100 : 0
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
        <DeviceSelector selectedId={selectedParticipantId} onChange={handleSelectParticipant} />
      </div>

      {/* Filter Waktu dan Tanggal */}
      <div className="card mb-4">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Pilih Tanggal</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input 
                type="date" 
                value={selectedDay} 
                onChange={(e) => { setSelectedDay(e.target.value); setSelectedDayHasData(null); }} 
                className="select-chip font-mono"
                style={{ padding: '4px 8px', border: '1px solid var(--hairline)', borderRadius: 4, background: 'var(--surface)', color: 'var(--ink)' }}
              />
              <span className={`badge ${selectedDay ? (selectedDayHasData === null ? 'badge-monitoring' : selectedDayHasData ? 'badge-stable' : 'badge-caution') : 'badge-monitoring'}`} style={{ fontSize: 11, padding: '5px 10px' }}>
                {selectedDay
                  ? (selectedDayHasData === null ? 'Mengecek...' : selectedDayHasData ? 'Ada data' : 'Belum ada data')
                  : 'Semua tanggal'}
              </span>
            </div>
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
              onClick={() => { setStartTime(''); setEndTime(''); setSelectedDay(''); setSelectedDayHasData(null); }}
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
      <div className="card" style={{ marginBottom: 16 }}>
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

      {/* Scatter Plot Poincaré (RR vs RR+1) */}
      <div className="card">
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="card-title">Scatter Plot HRV (Poincaré Plot)</h2>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              Distribusi interval detak jantung ($RR_n$ vs $RR_{"{n+1}"}$) untuk analisis variabilitas (Non-linear HRV).
            </p>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>SD1 (Short-term)</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>{poincareData.sd1} ms</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>SD2 (Long-term)</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--alert-text)' }}>{poincareData.sd2} ms</span>
            </div>
          </div>
        </div>
        <div style={{ height: 350, width: '100%' }}>
          {poincareData.points.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                <XAxis type="number" dataKey="x" name="RRn" unit="ms" domain={['dataMin - 50', 'dataMax + 50']} stroke="var(--muted)" fontSize={11} label={{ value: 'RR_n (ms)', position: 'insideBottom', offset: -10, fill: 'var(--muted)' }} />
                <YAxis type="number" dataKey="y" name="RRn+1" unit="ms" domain={['dataMin - 50', 'dataMax + 50']} stroke="var(--muted)" fontSize={11} label={{ value: 'RR_{n+1} (ms)', angle: -90, position: 'insideLeft', fill: 'var(--muted)' }} />
                <ZAxis range={[30, 30]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: 8, fontSize: 12 }} />
                <Scatter name="RR Intervals" data={poincareData.points} fill="var(--primary)" opacity={0.6} />
              </ScatterChart>
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