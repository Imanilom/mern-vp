import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine
} from 'recharts';
import { DeviceSelector } from './AnomalyDetection';

const HR_NORMAL_MIN = 60;
const HR_NORMAL_MAX = 100;

export const RawDataView: React.FC = () => {
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('P012');
  const [participants, setParticipants] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');

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
        const res = await fetch(`/api/data/raw/${selectedParticipantId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            const formatted = json.data.map((d: any) => {
              const dt = new Date(d.timestamp);
              return {
                ...d,
                timeLabel: dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                dayKey: dt.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }),
                dayLabel: dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
                sortTs: d.timestamp,
              };
            });
            setData(formatted);

            // Default ke hari terbaru
            if (formatted.length > 0) {
              const lastDay = formatted[formatted.length - 1].dayKey;
              setSelectedDay(lastDay);
            }
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
  }, [selectedParticipantId]);

  // Daftar hari unik yang tersedia, urut dari terbaru
  const availableDays = useMemo(() => {
    const map = new Map<string, string>(); // dayKey -> dayLabel
    data.forEach(d => map.set(d.dayKey, d.dayLabel));
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => (a.key < b.key ? 1 : -1)); // terbaru dulu
  }, [data]);

  // Data yang ditampilkan hanya untuk hari terpilih
  const dayData = useMemo(
    () => data.filter(d => d.dayKey === selectedDay),
    [data, selectedDay]
  );

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

  const selectorOptions = [
    ...(participants.length > 0
      ? participants.map(p => ({
        id: p.guid || p._id,
        name: p.name || p.guid || p._id,
        device: p.current_device || 'Polar H10'
      }))
      : [
        { id: 'P012', name: 'P012', device: 'Polar H10' },
        { id: 'P002', name: 'P002', device: 'Polar H10' }
      ])
  ];

  if (selectedParticipantId && !selectorOptions.some(opt => opt.id === selectedParticipantId)) {
    selectorOptions.unshift({
      id: selectedParticipantId,
      name: selectedParticipantId,
      device: 'Polar H10'
    });
  }

  // Tooltip sederhana, bahasa awam
  const SimpleTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Jam {label}</div>
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
        <DeviceSelector selectedId={selectedParticipantId} onChange={setSelectedParticipantId} options={selectorOptions} />
      </div>

      {/* Pemilih Hari */}
      {availableDays.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {availableDays.map(day => (
            <button
              key={day.key}
              onClick={() => setSelectedDay(day.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: '1px solid var(--hairline)',
                fontSize: 13,
                cursor: 'pointer',
                backgroundColor: selectedDay === day.key ? 'var(--primary)' : 'var(--surface)',
                color: selectedDay === day.key ? '#fff' : 'var(--ink)',
                transition: 'all 0.15s',
              }}
            >
              {day.label}
            </button>
          ))}
        </div>
      )}

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