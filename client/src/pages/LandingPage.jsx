import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaHeartbeat, FaShieldAlt, FaChartLine, FaUsers, FaMicrochip,
  FaExclamationTriangle, FaCheckCircle, FaDatabase, FaArrowRight,
  FaBrain, FaWaveSquare, FaNetworkWired, FaClock,
} from 'react-icons/fa';

// Color palette map — avoids Tailwind purge issues with dynamic class names
const COLORS = {
  blue:   { text: '#3b82f6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.20)' },
  green:  { text: '#10b981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.20)' },
  yellow: { text: '#fbbf24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.20)' },
  orange: { text: '#f97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.20)' },
  red:    { text: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.20)' },
  purple: { text: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.20)' },
};

// ── Mini Sparkline ────────────────────────────────────────────────────────────
function Spark({ points, color, h = 40 }) {
  if (!points?.length) return null;
  const W = 120;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = (max - min) || 1;
  const toY = (v) => h - ((v - min) / range) * (h - 4) - 2;
  const toX = (i) => (i / (points.length - 1)) * W;
  const pts = points.map((v, i) => ({ x: toX(i), y: toY(v) }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = pts[i].x + (pts[i + 1].x - pts[i].x) / 2;
    d += ` C ${cx} ${pts[i].y} ${cx} ${pts[i + 1].y} ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  const fill = `${d} L ${pts[pts.length - 1].x} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="w-full" style={{ height: h }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg-${color.replace('#','')})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ target, suffix = '', duration = 1200 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.floor(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return <>{val}{suffix}</>;
}

// ── Pulse dot ─────────────────────────────────────────────────────────────────
function PulseDot({ color }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
    </span>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
function Pill({ label, colorKey }) {
  const c = COLORS[colorKey] || COLORS.blue;
  return (
    <span className="flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full border"
      style={{ color: c.text, background: c.bg, borderColor: c.border }}>
      <PulseDot color={c.text} />
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();

  const [rate, setRate] = useState(847);
  const [alertCount] = useState(4);
  const [sparkHr, setSparkHr] = useState([72, 74, 71, 76, 73, 78, 75, 77, 74, 76]);
  const [sparkIngest, setSparkIngest] = useState([820, 840, 810, 855, 848, 870, 845, 860, 847, 847]);

  useEffect(() => {
    const t = setInterval(() => {
      const nr = Math.max(790, Math.min(920, rate + Math.floor(Math.random() * 30) - 15));
      setRate(nr);
      setSparkIngest(prev => [...prev.slice(1), nr]);
      setSparkHr(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(1), Math.max(60, Math.min(95, last + Math.floor(Math.random() * 6) - 3))];
      });
    }, 2000);
    return () => clearInterval(t);
  }, [rate]);

  const pipelineSteps = [
    { label: 'Biosensor', sub: 'Polar H10 / BLE', colorKey: 'green', icon: <FaHeartbeat /> },
    { label: 'Ingestion', sub: `${rate} msg/s`, colorKey: 'blue', icon: <FaMicrochip /> },
    { label: 'Preprocess', sub: 'IQR + 3min Seg', colorKey: 'purple', icon: <FaDatabase /> },
    { label: 'Baseline AI', sub: 'Welford Online', colorKey: 'yellow', icon: <FaBrain /> },
    { label: 'Anomaly Det.', sub: 'Z-Score + DFA', colorKey: 'orange', icon: <FaExclamationTriangle /> },
    { label: 'Web Console', sub: 'Dashboard', colorKey: 'blue', icon: <FaChartLine /> },
  ];

  const kpis = [
    {
      icon: <FaMicrochip />, colorKey: 'blue',
      label: 'Ingestion Rate', val: rate, suffix: '',
      valStr: `${rate} msg/s`,
      spark: sparkIngest, note: 'RabbitMQ live stream',
    },
    {
      icon: <FaUsers />, colorKey: 'green',
      label: 'Active Participants', val: 25, suffix: '',
      valStr: '25 Online',
      spark: [18, 20, 22, 23, 24, 24, 25, 25, 25, 25], note: 'Sensor terhubung aktif',
    },
    {
      icon: <FaExclamationTriangle />, colorKey: 'orange',
      label: 'Open Anomaly Events', val: alertCount, suffix: '',
      valStr: `${alertCount} Events`,
      spark: [1, 2, 3, 2, 4, 3, 5, 4, 4, alertCount], note: 'Perlu review klinisi',
    },
    {
      icon: <FaCheckCircle />, colorKey: 'green',
      label: 'Pipeline Uptime', val: 100, suffix: '%',
      valStr: '100%',
      spark: [95, 98, 97, 100, 98, 99, 100, 100, 100, 100], note: 'Layer 2 & 3 aktif',
    },
  ];

  const features = [
    {
      icon: <FaWaveSquare />, colorKey: 'blue',
      title: 'Real-time HR & HRV Monitoring',
      desc: 'Streaming biosensor HR, RR, RMSSD, SDNN setiap detik via BLE/RabbitMQ ke pipeline analisis.',
    },
    {
      icon: <FaBrain />, colorKey: 'purple',
      title: 'Personalized Baseline (Welford)',
      desc: 'Model baseline per individu × aktivitas × waktu sirkadian. Update inkremental tanpa menyimpan historis penuh.',
    },
    {
      icon: <FaChartLine />, colorKey: 'yellow',
      title: 'Trajectory Analysis & DFA',
      desc: 'Detrended Fluctuation Analysis (α1/α2) + anomaly score komposit berbasis Z-score multi-fitur.',
    },
    {
      icon: <FaShieldAlt />, colorKey: 'red',
      title: 'Anomaly Detection & Alerting',
      desc: 'Event lifecycle OPEN → PEAK → CLOSED dengan persistence check, recovery time, dan detection delay.',
    },
    {
      icon: <FaNetworkWired />, colorKey: 'green',
      title: 'Pipeline CronJob Otomatis',
      desc: 'Layer 2 (3 menit): IQR filter + segmentasi. Layer 3 (5 menit): analisis, update baseline, buat event.',
    },
    {
      icon: <FaUsers />, colorKey: 'blue',
      title: 'Multi-role Web Console',
      desc: 'Dashboard terpadu 12 menu untuk Peneliti, Dokter, Analis, dan Operator — Overview hingga Reports.',
    },
  ];

  const systemNodes = [
    { name: 'Layer 2 CronJob (3 min)', colorKey: 'green', status: 'Active', detail: 'IQR Filter + Segmentasi' },
    { name: 'Layer 3 CronJob (5 min)', colorKey: 'green', status: 'Active', detail: 'Z-score + Event Generation' },
    { name: 'MongoDB Connection', colorKey: 'green', status: 'Connected', detail: 'Atlas / Local cluster' },
    { name: 'RabbitMQ Broker', colorKey: 'green', status: 'Running', detail: `${rate} msg/s throughput` },
    { name: 'API Server', colorKey: 'blue', status: 'Port 3030', detail: 'Express + REST' },
    { name: 'Open Anomaly Events', colorKey: 'orange', status: `${alertCount} Active`, detail: 'Perlu review di dashboard' },
  ];

  return (
    <div className="min-h-screen bg-brand-dark text-brand-text font-sans overflow-x-hidden">

      {/* Background blobs */}
      <div className="fixed top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', transform: 'translate(-20%, -20%)' }} />
      <div className="fixed bottom-0 right-0 w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)', transform: 'translate(20%, 20%)' }} />

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-brand-dark/80 backdrop-blur-xl border-b border-brand-border px-6 md:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 border rounded-xl text-xl" style={{ color: COLORS.blue.text, background: COLORS.blue.bg, borderColor: COLORS.blue.border }}>
            <FaHeartbeat className="animate-pulse" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight">Health Trajectory</span>
            <span className="ml-2 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
              style={{ color: COLORS.blue.text, background: COLORS.blue.bg, border: `1px solid ${COLORS.blue.border}` }}>
              Platform
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-[10px] text-brand-muted">
            <PulseDot color={COLORS.green.text} />
            <span className="font-semibold">Backend Active</span>
          </div>
          <button
            onClick={() => navigate('/web/login')}
            className="flex items-center gap-2 px-4 py-2 text-white text-xs font-extrabold rounded-xl transition-all active:scale-95 shadow-lg"
            style={{ background: COLORS.blue.text, boxShadow: '0 4px 20px rgba(59,130,246,0.25)' }}
          >
            Buka Web Console <FaArrowRight className="text-[10px]" />
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative z-10 px-6 md:px-12 pt-20 pb-14 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6 border"
          style={{ color: COLORS.blue.text, background: COLORS.blue.bg, borderColor: COLORS.blue.border }}>
          <FaShieldAlt /> Enterprise Health Analytics · Real-time
        </div>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-5 leading-tight">
          <span className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #fff 0%, #e2e8f0 40%, #3b82f6 100%)' }}>
            Health Trajectory
          </span>
          <br />
          <span className="text-2xl md:text-3xl font-semibold text-brand-muted">
            Biosensor · Baseline · Anomaly Detection
          </span>
        </h1>
        <p className="text-brand-muted text-sm md:text-base max-w-2xl mx-auto mb-10 leading-relaxed">
          Sistem pemantauan kesehatan terintegrasi berbasis biosensor wearable dengan analisis trajectory personal,
          deteksi anomali klinis real-time, dan laporan evaluasi komprehensif untuk penelitian kardiovaskular.
        </p>
        <button
          onClick={() => navigate('/web/login')}
          className="group inline-flex items-center gap-3 px-8 py-4 text-white font-extrabold text-sm rounded-2xl transition-all active:scale-95"
          style={{ background: COLORS.blue.text, boxShadow: '0 8px 32px rgba(59,130,246,0.3)' }}
        >
          Masuk ke Web Console
          <FaArrowRight className="transform group-hover:translate-x-1 transition-transform" />
        </button>
      </section>

      {/* ── KPI STRIP ── */}
      <section className="relative z-10 px-6 md:px-12 pb-12 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((k, i) => {
            const c = COLORS[k.colorKey];
            return (
              <div key={i} className="bg-brand-card border border-brand-border rounded-2xl p-5 shadow-xl hover:-translate-y-1 transition-transform">
                <div className="flex items-center justify-between mb-3">
                  <span style={{ color: c.text }} className="text-base">{k.icon}</span>
                  <PulseDot color={c.text} />
                </div>
                <div className="text-2xl font-black mb-0.5" style={{ color: c.text }}>
                  {k.valStr}
                </div>
                <div className="text-[9px] text-brand-muted font-bold uppercase tracking-wide mb-2">{k.label}</div>
                <Spark points={k.spark} color={c.text} h={36} />
                <div className="text-[9px] text-brand-muted mt-1.5 font-mono">{k.note}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── PIPELINE FLOW ── */}
      <section className="relative z-10 px-6 md:px-12 py-10 max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-extrabold">Arsitektur Pipeline</h2>
          <p className="text-brand-muted text-xs mt-1">End-to-end dari sensor ke dashboard dalam 5 layer</p>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xl overflow-x-auto">
          <div className="flex items-center min-w-[700px]">
            {pipelineSteps.map((s, i, arr) => {
              const c = COLORS[s.colorKey];
              return (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center text-center flex-1">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg mb-2 border"
                      style={{ color: c.text, background: c.bg, borderColor: c.border }}>
                      {s.icon}
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wide">{s.label}</span>
                    <span className="text-[9px] text-brand-muted mt-0.5">{s.sub}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex-1 max-w-[48px] flex items-center px-1">
                      <div className="h-px flex-1 bg-brand-border relative overflow-hidden rounded-full">
                        <div className="absolute inset-0 animate-pulse" style={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }} />
                      </div>
                      <FaArrowRight className="text-brand-muted text-[8px] ml-1 shrink-0" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── LIVE STATUS + HR CHART ── */}
      <section className="relative z-10 px-6 md:px-12 py-8 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6">

          {/* System status */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xl">
            <h3 className="font-extrabold text-sm mb-4 flex items-center gap-2" style={{ color: COLORS.blue.text }}>
              <FaNetworkWired /> Status Sistem Real-time
            </h3>
            <div className="space-y-2.5">
              {systemNodes.map((n, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-brand-border/40 last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-brand-text">{n.name}</p>
                    <p className="text-[9px] text-brand-muted">{n.detail}</p>
                  </div>
                  <Pill label={n.status} colorKey={n.colorKey} />
                </div>
              ))}
            </div>
          </div>

          {/* Live HR sparkline */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="font-extrabold text-sm flex items-center gap-2 mb-1" style={{ color: COLORS.red.text }}>
                <FaHeartbeat /> Live HR Trajectory
              </h3>
              <p className="text-[9px] text-brand-muted mb-4">Update setiap 2 detik · Sample participant · Moving window</p>
              <Spark points={sparkHr} color={COLORS.red.text} h={90} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Current HR', val: `${sparkHr[sparkHr.length - 1]} BPM`, colorKey: 'red' },
                { label: 'Avg HR', val: `${Math.round(sparkHr.reduce((a, b) => a + b, 0) / sparkHr.length)} BPM`, colorKey: 'blue' },
                { label: 'Variability', val: `±${Math.round(Math.max(...sparkHr) - Math.min(...sparkHr))} BPM`, colorKey: 'yellow' },
              ].map((s, i) => (
                <div key={i} className="bg-brand-cardLight border border-brand-border rounded-xl p-3 text-center">
                  <span className="text-[8px] text-brand-muted uppercase font-bold block">{s.label}</span>
                  <span className="text-sm font-black block mt-0.5" style={{ color: COLORS[s.colorKey].text }}>{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative z-10 px-6 md:px-12 py-10 max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-extrabold">Kemampuan Sistem</h2>
          <p className="text-brand-muted text-xs mt-1">6 modul analitik terintegrasi dalam satu platform</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const c = COLORS[f.colorKey];
            return (
              <div key={i}
                className="group bg-brand-card border border-brand-border p-5 rounded-2xl shadow-lg hover:-translate-y-1 transition-all"
                style={{ '--hc': c.border }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 border group-hover:scale-110 transition-transform"
                  style={{ color: c.text, background: c.bg, borderColor: c.border }}>
                  {f.icon}
                </div>
                <h4 className="font-bold text-sm text-brand-text mb-1.5">{f.title}</h4>
                <p className="text-[11px] text-brand-muted leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA BOTTOM ── */}
      <section className="relative z-10 px-6 md:px-12 py-14 max-w-6xl mx-auto">
        <div className="bg-gradient-to-br from-brand-card to-brand-cardLight border border-brand-border rounded-3xl p-10 shadow-2xl relative overflow-hidden text-center">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full opacity-15 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />
          <div className="relative z-10">
            <FaChartLine className="text-4xl mx-auto mb-4" style={{ color: COLORS.blue.text }} />
            <h2 className="text-2xl md:text-3xl font-extrabold mb-3">Siap Menganalisis Data?</h2>
            <p className="text-brand-muted text-sm max-w-lg mx-auto mb-8 leading-relaxed">
              Login ke Web Console untuk mengakses 12 menu analitik — dari Overview hingga
              Trajectory Analysis, Anomaly Detection, dan laporan evaluasi komprehensif.
            </p>
            <button
              onClick={() => navigate('/web/login')}
              className="group inline-flex items-center gap-3 px-8 py-4 text-white font-extrabold text-sm rounded-2xl transition-all active:scale-95"
              style={{ background: COLORS.blue.text, boxShadow: '0 8px 32px rgba(59,130,246,0.3)' }}
            >
              Buka Web Console Sekarang
              <FaArrowRight className="transform group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-[9px] text-brand-muted mt-4 font-semibold uppercase tracking-wider">
              Akses terbatas · Peneliti · Dokter · Analis · Operator Sistem
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-brand-border px-6 md:px-12 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <FaHeartbeat style={{ color: COLORS.blue.text }} />
          <span className="font-bold">Health Trajectory Platform</span>
          <span className="text-brand-muted">· VidyaMedic Research 2026</span>
        </div>
        <div className="flex items-center gap-4 text-[9px] text-brand-muted">
          <div className="flex items-center gap-1.5"><PulseDot color={COLORS.green.text} /> API Active</div>
          <div className="flex items-center gap-1.5"><PulseDot color={COLORS.blue.text} /> {rate} msg/s</div>
          <span className="flex items-center gap-1"><FaClock /> {new Date().toLocaleTimeString('id-ID')}</span>
        </div>
      </footer>

    </div>
  );
}
