import { useState, useEffect, useMemo, type FC } from 'react';
import {
  RefreshCw, Users, HeartPulse, Sparkles, Users as UsersThree, RotateCcw as ClockCounterClockwise
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LineChart, Line, AreaChart, Area, ReferenceLine
} from 'recharts';

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------
type Participant = { _id: string; name?: string; username?: string; guid?: string; };
type BaselineStats = Record<string, { mean?: number; std?: number; n?: number }>;
type BaselineRecord = {
  _id: string;
  activity?: string;
  time_period?: string;
  stats?: BaselineStats;
  is_mature?: boolean;
  segment_count?: number;
  maturity_detail?: { level: string; n_effective: number };
  updatedAt?: string;
};
type BaselineEntry = { participant: Participant; baseline: BaselineRecord; };

const POPULATION_PRIORS: any = {
  Rest: { mean_hr: 65, sdnn: 50, rmssd: 40, dfa_alpha1: 1.15 },
  Light: { mean_hr: 85, sdnn: 40, rmssd: 30, dfa_alpha1: 0.95 },
  Moderate: { mean_hr: 115, sdnn: 25, rmssd: 15, dfa_alpha1: 0.70 },
  Intense: { mean_hr: 145, sdnn: 15, rmssd: 8, dfa_alpha1: 0.50 }
};

const ACTIVITY_COLORS: any = { Rest: '#8b5cf6', Light: '#3b82f6', Moderate: '#f59e0b', Intense: '#ef4444' };
const metricMean = (baseline: BaselineRecord, key: string) => baseline?.stats?.[key]?.mean ?? 0;
const metricStd = (baseline: BaselineRecord, key: string) => baseline?.stats?.[key]?.std ?? 0;

// ---------------------------------------------------------------------------
// BaselineModel
// ---------------------------------------------------------------------------
export const BaselineModel: FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [records, setRecords] = useState<BaselineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedActivity, setSelectedActivity] = useState('Rest');
  const [selectedUser, setSelectedUser] = useState<string>('all');

  const isDoctor = true; // For demo

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem('htm_token');
        const res = await fetch('/api/patient/all', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const patients = await res.json();
        if (cancelled) return;
        setParticipants(patients);

        const perUser = await Promise.all(patients.map(async (p: any) => {
          const resB = await fetch(`/api/analysis/baseline/${p._id}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!resB.ok) return [];
          const dataB = await resB.json();
          return (dataB.data || []).map((b: any) => ({ participant: p, baseline: b }));
        }));
        setRecords(perUser.flat());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const activities = useMemo(() => Array.from(new Set(records.map(r => r.baseline.activity).filter(Boolean))), [records]);
  
  const currentRecords = useMemo(() => {
    return records.filter(r => r.baseline.activity === selectedActivity && (selectedUser === 'all' || r.participant._id === selectedUser));
  }, [records, selectedActivity, selectedUser]);

  // RR Distribution Mock (Gaussian approximation based on Mean HR and SDNN)
  const rrDistributionData = useMemo(() => {
    if (currentRecords.length === 0) return [];
    // Just take the first matching record to show distribution
    const rec = currentRecords[0].baseline;
    const meanHR = metricMean(rec, 'mean_hr') || 70;
    const sdnn = metricMean(rec, 'sdnn') || 40;
    const meanRR = 60000 / (meanHR || 1);
    
    const data = [];
    for (let x = meanRR - sdnn * 3; x <= meanRR + sdnn * 3; x += (sdnn * 6) / 20) {
      // Gaussian formula
      const y = (1 / (sdnn * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - meanRR) / sdnn, 2));
      data.push({ rr: Math.round(x), prob: y * 1000 }); // scale up for visual
    }
    return data;
  }, [currentRecords]);

  // Population Comparison Data
  const comparisonData = useMemo(() => {
    if (currentRecords.length === 0) return [];
    const rec = currentRecords[0].baseline;
    const prior = POPULATION_PRIORS[selectedActivity] || POPULATION_PRIORS.Rest;
    
    return [
      { metric: 'HR Mean', personal: metricMean(rec, 'mean_hr'), population: prior.mean_hr },
      { metric: 'SDNN', personal: metricMean(rec, 'sdnn'), population: prior.sdnn },
      { metric: 'RMSSD', personal: metricMean(rec, 'rmssd'), population: prior.rmssd },
      { metric: 'DFA α1 (x100)', personal: metricMean(rec, 'dfa_alpha1') * 100, population: prior.dfa_alpha1 * 100 },
    ];
  }, [currentRecords, selectedActivity]);

  return (
    <section className="animate-fadein pb-8">
      <div className="page-head mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Baseline Personal & Distribusi Fisiologis</h1>
          <p className="text-sm text-muted mt-1">Pemodelan baseline, komparasi populasi, dan analisis distribusi RR.</p>
        </div>
        <button className="btn btn-outline" onClick={() => setRefreshKey(k => k + 1)}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6 flex gap-4 p-4">
        <div>
          <label className="eyebrow block mb-2">Aktivitas</label>
          <select className="select-chip" value={selectedActivity} onChange={e => setSelectedActivity(e.target.value)}>
            {activities.length > 0 ? activities.map((a: any) => <option key={a} value={a}>{a}</option>) : <option value="Rest">Rest</option>}
          </select>
        </div>
        <div>
          <label className="eyebrow block mb-2">Pasien</label>
          <select className="select-chip" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
            <option value="all">Pertama Ditemukan</option>
            {participants.map(p => <option key={p._id} value={p._id}>{p.name || p.username}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">Memuat data baseline...</div>
      ) : currentRecords.length === 0 ? (
        <div className="card text-center py-8 text-muted">Belum ada baseline untuk filter ini.</div>
      ) : (
        <>
          {/* Top Panel: Maturity & Status */}
          <div className="card mb-6 p-5 border-l-4" style={{ borderColor: currentRecords[0].baseline.is_mature ? 'var(--success)' : 'var(--warning)' }}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                  <Sparkles color="var(--primary)" /> 
                  Kematangan Baseline: {currentRecords[0].baseline.maturity_detail?.level?.toUpperCase() || 'COLD START'}
                </h3>
                <p className="text-sm text-muted">
                  Segment valid: {currentRecords[0].baseline.segment_count || 0}. 
                  Efektif N: {currentRecords[0].baseline.maturity_detail?.n_effective || 0}.
                </p>
              </div>
              <div className="text-right">
                <span className={`badge ${currentRecords[0].baseline.is_mature ? 'badge-stable' : 'badge-caution'}`}>
                  {currentRecords[0].baseline.is_mature ? 'Mature (Siap digunakan)' : 'Provisional (Cold Start)'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* RR Distribution */}
            <div className="card p-5">
              <h3 className="font-semibold text-md mb-4 flex items-center gap-2">
                <HeartPulse color="var(--alert-text)" /> Estimasi Distribusi RR (Normal)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={rrDistributionData} margin={{ left: -20, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--hairline)" />
                  <XAxis dataKey="rr" fontSize={12} stroke="var(--muted)" />
                  <YAxis fontSize={12} stroke="var(--muted)" />
                  <Tooltip contentStyle={{ borderRadius: 8 }} labelFormatter={v => `RR: ${v} ms`} />
                  <Area type="monotone" dataKey="prob" name="Densitas" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-xs text-center text-muted mt-2">Sumbu X: RR (ms), Sumbu Y: Kepadatan Probabilitas (Skala Visual)</p>
            </div>

            {/* Population Comparison */}
            <div className="card p-5">
              <h3 className="font-semibold text-md mb-4 flex items-center gap-2">
                <UsersThree color="var(--primary)" /> Komparasi vs Referensi Populasi
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={comparisonData} margin={{ left: -20, top: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--hairline)" />
                  <XAxis dataKey="metric" fontSize={12} stroke="var(--muted)" />
                  <YAxis fontSize={12} stroke="var(--muted)" />
                  <Tooltip contentStyle={{ borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="personal" name="Personal Baseline" fill="var(--primary)" radius={[4,4,0,0]} barSize={24} />
                  <Bar dataKey="population" name="Referensi Populasi" fill="var(--muted)" fillOpacity={0.6} radius={[4,4,0,0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </section>
  );
};