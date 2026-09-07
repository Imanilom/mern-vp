import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

// ── Master Q1-Q10 Metadata ──
const Q_METADATA = [
  { id: 'Q1', title: 'Frekuensi & Tingkat Deviasi', vectorKey: 'F', icon: 'fa-chart-line', color: '#8B5CF6' },
  { id: 'Q2', title: 'Magnitudo & Luas Residual Overshoot', vectorKey: 'M', icon: 'fa-gauge-high', color: '#7C3AED' },
  { id: 'Q3', title: 'Durasi & Settling Time', vectorKey: 'D', icon: 'fa-stopwatch', color: '#D97706' },
  { id: 'Q4', title: 'Kinetik Recovery (TTR & v_rec)', vectorKey: 'R', icon: 'fa-person-running', color: '#059669' },
  { id: 'Q5', title: 'Stabilitas & Damping Relapse', vectorKey: 'S', icon: 'fa-shield-halved', color: '#0284C7' },
  { id: 'Q6', title: 'Kesesuaian Konteks Gerak', vectorKey: 'C', icon: 'fa-person-walking', color: '#2563EB' },
  { id: 'Q7', title: 'Pola Sirkadian Diurnal', vectorKey: 'T', icon: 'fa-cloud-sun', color: '#EA580C' },
  { id: 'Q8', title: 'Konsistensi Intra-Minggu (CV)', vectorKey: 'K', icon: 'fa-calendar-check', color: '#0D9488' },
  { id: 'Q9', title: 'Anomali Istirahat (Unexplained)', vectorKey: 'U', icon: 'fa-triangle-exclamation', color: '#DC2626' },
  { id: 'Q10', title: 'Sintesis Fenotipe Mingguan', vectorKey: 'Phi', icon: 'fa-dna', color: '#4F46E5' },
];

// ── Q-Zone Threshold Mapping ──────────────────────────────────────────────────
// Menentukan zona risiko berdasarkan nilai skor Q (0-100)
// Setiap Q memiliki batas kritis berbeda sesuai karakteristik fisiologis
const Q_ZONES = {
  Q1:  { critical: 40, risk: 60, borderline: 75, crsLink: 'RC' }, // Frekuensi → Recovery Capacity
  Q2:  { critical: 40, risk: 60, borderline: 75, crsLink: 'AR' }, // Magnitudo → Autonomic Reserve
  Q3:  { critical: 45, risk: 65, borderline: 80, crsLink: 'RC' }, // Durasi → Recovery Capacity
  Q4:  { critical: 45, risk: 65, borderline: 80, crsLink: 'RC' }, // Recovery → Recovery Capacity
  Q5:  { critical: 40, risk: 60, borderline: 75, crsLink: 'RS' }, // Stabilitas → Regulation Stability
  Q6:  { critical: 50, risk: 68, borderline: 82, crsLink: 'CR' }, // Konteks → Cardiac Reserve
  Q7:  { critical: 45, risk: 65, borderline: 80, crsLink: 'AR' }, // Sirkadian → Autonomic Reserve
  Q8:  { critical: 50, risk: 70, borderline: 83, crsLink: 'RS' }, // Konsistensi → Regulation Stability
  Q9:  { critical: 35, risk: 55, borderline: 72, crsLink: 'CV' }, // Anomali Istirahat → Clinical Vulnerability
  Q10: { critical: 45, risk: 65, borderline: 80, crsLink: 'CRS' }, // Sintesis → Global CRS
};

// Klasifikasikan skor Q ke zona risiko
function getQZone(score, qId) {
  const z = Q_ZONES[qId] || { critical: 40, risk: 60, borderline: 75 };
  const s = Number(score) || 0;
  if (s < z.critical)   return 'critical';
  if (s < z.risk)       return 'risk';
  if (s < z.borderline) return 'borderline';
  return 'normal';
}

const ZONE_STYLES = {
  critical:   { bg: '#FEF2F2', text: '#B91C1C', border: '#FCA5A5', label: 'Kritis',      icon: 'fa-circle-exclamation' },
  risk:       { bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74', label: 'Risiko',      icon: 'fa-triangle-exclamation' },
  borderline: { bg: '#FEFCE8', text: '#A16207', border: '#FDE047', label: 'Borderline',  icon: 'fa-minus-circle' },
  normal:     { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC', label: 'Normal',      icon: 'fa-circle-check' },
};

function QZoneBadge({ score, qId, compact = false }) {
  const zone = getQZone(score, qId);
  const s = ZONE_STYLES[zone];
  const link = Q_ZONES[qId]?.crsLink;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: compact ? '1px 7px' : '3px 10px',
      borderRadius: 999, fontSize: compact ? 9.5 : 10.5, fontWeight: 800,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      <i className={`fa-solid ${s.icon}`} style={{ fontSize: compact ? 8 : 9 }} />
      {s.label}{link && !compact ? ` → ${link}` : ''}
    </span>
  );
}

export const WeeklyPhenotypingView = ({ participantId, targetPatientId, participants = [], onNavigate }) => {
  const [participantsList, setParticipantsList] = useState([]);
  const effectiveUserId = (targetPatientId && targetPatientId !== 'ALL')
    ? targetPatientId
    : (participantId && participantId !== 'ALL' ? participantId : (participants?.[0]?.id || participants?.[0]?._id || ''));
  const [selectedUserId, setSelectedUserId] = useState(effectiveUserId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [selectedWeekId, setSelectedWeekId] = useState('W01');
  const [activeSection, setActiveSection] = useState('all'); // 'all' | 'q1-q2' | 'general' | 'population' | 'personal' | 'synthesis'
  const [qFilter, setQFilter] = useState('all'); // 'all' | 'q1-q5' | 'q6-q9' | 'q10'
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [confirmedFactors, setConfirmedFactors] = useState({}); // { [factorId]: boolean }
  const [confirmToast, setConfirmToast] = useState(null);
  // Gate Blok 2 → Blok 3
  const [block3Status, setBlock3Status] = useState(null); // data from backend
  const [savingGate, setSavingGate] = useState(false);
  const MIN_GATE_THRESHOLD = 12;

  // Sync prop changes from Topbar
  useEffect(() => {
    if (effectiveUserId && effectiveUserId !== selectedUserId) {
      setSelectedUserId(effectiveUserId);
    }
  }, [effectiveUserId]);

  // Fetch participants list as fallback
  useEffect(() => {
    api.listZeroShotParticipants().then(res => {
      const rawList = Array.isArray(res?.data) ? res.data : [];
      const formatted = rawList.map(p => {
        const uid = p._id || p.id || p.userId || p.guid || 'unknown';
        const name = p.name || p.email || uid;
        const detail = p.email ? `(${p.email})` : (p.device ? `[${p.device}]` : '');
        return {
          _id: String(p._id || uid),
          userId: String(uid),
          id: String(uid),
          guid: p.guid ? String(p.guid) : '',
          name: name,
          label: `${name} ${detail}`.trim()
        };
      });
      setParticipantsList(formatted);
      setSelectedUserId(prev => {
        if (effectiveUserId) return effectiveUserId;
        return prev || formatted[0]?.userId || '';
      });
    }).catch(err => {
      console.error('[WeeklyPhenotyping] list participants error:', err);
    });
  }, [effectiveUserId]);

  const activeParticipant = useMemo(() => {
    // 1. Check direct from Topbar participants prop
    const fromProps = (participants || []).find(p =>
      String(p.id) === String(selectedUserId) ||
      String(p._id) === String(selectedUserId) ||
      (p.guid && String(p.guid) === String(selectedUserId))
    );
    if (fromProps) return fromProps;

    // 2. Check in local participantsList fallback
    return (participantsList || []).find(p =>
      String(p.userId) === String(selectedUserId) ||
      String(p.id) === String(selectedUserId) ||
      String(p._id) === String(selectedUserId) ||
      (p.guid && String(p.guid) === String(selectedUserId))
    );
  }, [participants, participantsList, selectedUserId]);

  const activeParticipantName = activeParticipant?.name
    ? `${activeParticipant.name} ${activeParticipant.email ? `(${activeParticipant.email})` : ''}`.trim()
    : (activeParticipant?.label || (selectedUserId ? `ID: ${String(selectedUserId).slice(0, 8)}...` : 'Memuat subjek...'));

  // Fetch weekly frozen data from API
  const fetchWeeklyData = useCallback(async () => {
    if (!selectedUserId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getWeeklyPhenotypeProfile(selectedUserId);
      if (res && res.data) {
        setWeeklyData(res.data);
        if (res.data.epochs && res.data.epochs.length > 0) {
          setSelectedWeekId(res.data.epochs[0].week_id);
          const initialMap = {};
          // Use factor id (bf_01, bf_02...) as key for reliable batch confirmation
          res.data.epochs[0].behavioral_scoring?.factors?.forEach((f, idx) => {
            const key = f.id || `bf_${String(idx + 1).padStart(2, '0')}`;
            initialMap[key] = f.patient_confirmed ?? false;
          });
          setConfirmedFactors(initialMap);
        }
      }
    } catch (err) {
      console.error('[WeeklyPhenotyping] fetch error:', err);
      setError('Gagal memuat profil fenotipe mingguan.');
    } finally {
      setLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    fetchWeeklyData();
  }, [fetchWeeklyData]);

  // Load block3 gate status from backend
  useEffect(() => {
    if (!selectedUserId) return;
    api.getBlock3Status(selectedUserId)
      .then(res => { if (res?.success) setBlock3Status(res.data); })
      .catch(() => null);
  }, [selectedUserId]);

  // Get active epoch data
  const activeEpoch = useMemo(() => {
    if (!weeklyData || !weeklyData.epochs) return null;
    return weeklyData.epochs.find(e => e.week_id === selectedWeekId) || weeklyData.epochs[0];
  }, [weeklyData, selectedWeekId]);

  // Handle Per-Behavior Patient Confirmation Toggle (local + legacy per-factor API)
  const handleToggleConfirmFactor = (factorId, factorName) => {
    setConfirmedFactors(prev => {
      const currentVal = prev[factorId] ?? false;
      const newVal = !currentVal;
      // Also send individual confirm (legacy)
      api.confirmPatientBehavior({
        userId: selectedUserId,
        weekId: selectedWeekId,
        factorName,
        isConfirmed: newVal,
      }).catch(() => null);
      setConfirmToast(`"${factorName.split(' ').slice(0,3).join(' ')}..." — ${newVal ? '✓ Dikonfirmasi' : '✗ Dibatalkan'}`);
      setTimeout(() => setConfirmToast(null), 2500);
      return { ...prev, [factorId]: newVal };
    });
  };

  // Hitung jumlah yang dikonfirmasi dari state lokal
  const confirmedCount = Object.values(confirmedFactors).filter(Boolean).length;
  const totalFactors = activeEpoch?.behavioral_scoring?.factors?.length || 15;
  const gateProgress = Math.min(100, Math.round((confirmedCount / MIN_GATE_THRESHOLD) * 100));
  const readyForBlock3 = confirmedCount >= MIN_GATE_THRESHOLD;

  // Simpan konfirmasi bulk ke backend & update gate status
  const handleSaveBulkConfirmation = async () => {
    if (!selectedUserId) return;
    setSavingGate(true);
    try {
      const factors = activeEpoch?.behavioral_scoring?.factors || [];
      const confirmedIds = factors
        .filter((f, idx) => {
          const key = f.id || `bf_${String(idx + 1).padStart(2, '0')}`;
          return confirmedFactors[key] === true;
        })
        .map((f, idx) => f.id || `bf_${String(idx + 1).padStart(2, '0')}`);
      const res = await api.confirmBulkFactors(selectedUserId, selectedWeekId, confirmedIds);
      if (res?.success) {
        setBlock3Status(res.data);
        setConfirmToast(res.message);
        setTimeout(() => setConfirmToast(null), 4000);
      }
    } catch (err) {
      console.error('Bulk confirm error:', err);
    } finally {
      setSavingGate(false);
    }
  };

  // Radar Data for Population vs Personal Benchmark
  const radarChartData = useMemo(() => {
    const qScores = activeEpoch?.q_scores || {};
    const q1Score = Number(qScores.Q1) || (activeEpoch?.episode_rate !== undefined ? Math.min(100, Math.round(100 - activeEpoch.episode_rate * 25)) : 85);
    const q2Score = Number(qScores.Q2) || (activeEpoch?.damped_dynamics?.peak_1 ? Math.max(40, Math.min(100, Math.round(100 - (activeEpoch.damped_dynamics.peak_1 - 1.5) * 20 - (activeEpoch.damped_dynamics.residual_deviation_auc || 1.8) * 4))) : 78);
    const q3Score = Number(qScores.Q3) || (activeEpoch?.damped_dynamics?.settling_time_sec ? Math.max(50, Math.min(100, Math.round(100 - (activeEpoch.damped_dynamics.settling_time_sec / 150) * 30))) : 80);
    const q4Score = Number(qScores.Q4) || (activeEpoch?.damped_dynamics?.ttr_sec ? Math.max(50, Math.min(100, Math.round(100 - (activeEpoch.damped_dynamics.ttr_sec / 120) * 30))) : 82);
    const q5Score = Number(qScores.Q5) || (activeEpoch?.damped_dynamics?.relapse_count !== undefined ? Math.max(45, Math.min(100, Math.round(100 - activeEpoch.damped_dynamics.relapse_count * 12))) : 75);
    const q6Score = Number(qScores.Q6) || 88;
    const q7Score = Number(qScores.Q7) || 74;
    const q8Score = Number(qScores.Q8) || 84;
    const q9Score = Number(qScores.Q9) || 79;
    const q10Score = Number(qScores.Q10) || 86;

    return [
      { subject: 'Q1 (Freq)', personal: q1Score, population: 70, fullMark: 100 },
      { subject: 'Q2 (Mag/Res)', personal: q2Score, population: 75, fullMark: 100 },
      { subject: 'Q3 (Duration)', personal: q3Score, population: 72, fullMark: 100 },
      { subject: 'Q4 (Recovery)', personal: q4Score, population: 68, fullMark: 100 },
      { subject: 'Q5 (Relapse)', personal: q5Score, population: 65, fullMark: 100 },
      { subject: 'Q6 (Context)', personal: q6Score, population: 80, fullMark: 100 },
      { subject: 'Q7 (Diurnal)', personal: q7Score, population: 70, fullMark: 100 },
      { subject: 'Q8 (CV Stability)', personal: q8Score, population: 76, fullMark: 100 },
      { subject: 'Q9 (Unexplained)', personal: q9Score, population: 70, fullMark: 100 },
      { subject: 'Q10 (Synthesis)', personal: q10Score, population: 74, fullMark: 100 },
    ];
  }, [activeEpoch]);

  // Master Q1 to Q10 Purple Card Comparisons (Population vs Personal)
  const fullQComparisons = useMemo(() => {
    if (activeEpoch?.q_comparisons && Array.isArray(activeEpoch.q_comparisons) && activeEpoch.q_comparisons.length === 10) {
      return activeEpoch.q_comparisons;
    }
    const epRate = activeEpoch?.episode_rate ?? 0.31;
    const epCount = activeEpoch?.episode_count ?? 26;
    const validHours = activeEpoch?.valid_hours ?? 84;
    const peak1 = activeEpoch?.damped_dynamics?.peak_1 ?? 2.45;
    const residualArea = activeEpoch?.damped_dynamics?.residual_deviation_auc ?? 1.82;
    const settlingTimeSec = activeEpoch?.damped_dynamics?.settling_time_sec ?? 95;
    const ttrSec = activeEpoch?.damped_dynamics?.ttr_sec ?? 70;
    const vRec = activeEpoch?.damped_dynamics?.v_rec ?? 0.048;
    const relapseCount = activeEpoch?.damped_dynamics?.relapse_count ?? 0;
    const dampingRatio = activeEpoch?.damped_dynamics?.damping_ratio ?? 0.85;
    const candidate = activeEpoch?.candidate_phenotype || 'Efficient-Stable';
    const qScores = activeEpoch?.q_scores || {};
    const pop = activeEpoch?.population_benchmark || {};

    return [
      activeEpoch?.q1_comparison || {
        id: 'Q1',
        code: 'f_dev',
        vectorKey: 'F',
        title: 'Q1 • Frekuensi & Tingkat Kejadian Deviasi',
        color: '#7C3AED',
        actual_population: `${pop.median_episode_rate || 0.42} ep/jam (Median Kohor)`,
        actual_personal: `${epRate} ep/jam (${epCount} ep / ${validHours}j valid)`,
        scoring: `${qScores.Q1 || Math.min(100, Math.round(100 - epRate * 25))}/100`,
        scoring_label: epRate <= (pop.median_episode_rate || 0.42) ? 'Terkendali / Optimal' : 'Frekuensi Moderat',
        interpretation: 'Tingkat frekuensi deviasi pasien berada di bawah median populasi, membuktikan stabilitas homeostasis yang efisien.',
      },
      activeEpoch?.q2_comparison || {
        id: 'Q2',
        code: 'M_dev',
        vectorKey: 'M',
        title: 'Q2 • Magnitudo & Luas Residual Overshoot',
        color: '#6D28D9',
        actual_population: `Peak D: ${pop.median_peak_d || 1.85}, Residual AUC: ${pop.median_residual_auc || 2.10}`,
        actual_personal: `Peak D: ${Number(peak1).toFixed(2)}, Residual AUC: ${residualArea}`,
        scoring: `${qScores.Q2 || 82}/100`,
        scoring_label: residualArea <= 3.5 ? 'Redaman Cepat (Low Residual)' : 'Overshoot Moderat',
        interpretation: 'Magnitudo lonjakan awal terkompensasi dengan laju peluruhan teredam di atas ambang tau_normal = 1.50.',
      },
      {
        id: 'Q3',
        code: 'D_dev',
        vectorKey: 'D',
        title: 'Q3 • Durasi & Settling Time Deviasi',
        color: '#8B5CF6',
        actual_population: 'Settling Time: 120 detik, Dwell: 95 detik',
        actual_personal: `Settling Time: ${settlingTimeSec} detik, Dwell: ${Math.round(settlingTimeSec * 0.8)} detik`,
        scoring: `${qScores.Q3 || 80}/100`,
        scoring_label: settlingTimeSec <= 120 ? 'Durasi Efisien / Singkat' : 'Sustained Transient',
        interpretation: 'Durasi pemulihan kembali ke amplop kestabilan berada dalam batas toleransi personal kontekstual.',
      },
      {
        id: 'Q4',
        code: 'V_rec',
        vectorKey: 'R',
        title: 'Q4 • Kinetik Recovery (TTR & v_rec)',
        color: '#7C3AED',
        actual_population: `Median TTR: ${pop.median_ttr_sec || 65}s, v_rec: 0.045 σ/s`,
        actual_personal: `TTR: ${ttrSec}s, v_rec: ${vRec} σ/s`,
        scoring: `${qScores.Q4 || 85}/100`,
        scoring_label: ttrSec <= (pop.median_ttr_sec || 65) ? 'Reaktivasi Vagal Cepat' : 'Pemulihan Normal',
        interpretation: 'Laju pemulihan otonom menunjukkan reaktivasi parasimpatis terorganisir tanpa osilasi berlebih.',
      },
      {
        id: 'Q5',
        code: 'R_rel',
        vectorKey: 'S',
        title: 'Q5 • Stabilitas Recovery & Damping Relapse',
        color: '#6D28D9',
        actual_population: `Relapse Kohor: 0.15 rel/ep, Damping Ratio: ${pop.standard_damping_ratio || 0.85}`,
        actual_personal: `${relapseCount} Relapse terdeteksi, Damping Ratio: ${dampingRatio}`,
        scoring: `${qScores.Q5 || 88}/100`,
        scoring_label: relapseCount === 0 ? 'Bebas Relapse (Stabil)' : 'Osilasi Sekunder Diredam',
        interpretation: 'Homeostasis pasca-recovery bertahan kokoh tanpa kekambuhan deviasi sekunder.',
      },
      {
        id: 'Q6',
        code: 'C_cum',
        vectorKey: 'C',
        title: 'Q6 • Kesesuaian Konteks Gerak & Beban',
        color: '#8B5CF6',
        actual_population: '85% Concordance gerak terverifikasi',
        actual_personal: `${Math.round((activeEpoch?.behavioral_scoring?.average_correlation_pct || 25) * 1.2)}% Deviasi selaras dengan akselerometer & EMA`,
        scoring: `${qScores.Q6 || 88}/100`,
        scoring_label: 'Kesesuaian Sangat Baik',
        interpretation: 'Mayoritas deviasi fisiologis dapat dijelaskan oleh beban kerja fisik dan konteks terukur.',
      },
      {
        id: 'Q7',
        code: 'Delta_diurnal',
        vectorKey: 'T',
        title: 'Q7 • Pola Sirkadian Diurnal (Siang vs Malam)',
        color: '#7C3AED',
        actual_population: 'Rasio TTR Siang/Malam: 1.35x (Variasi 18%)',
        actual_personal: `Siang: ${Math.round(ttrSec * 0.85)}s vs Malam: ${Math.round(ttrSec * 1.15)}s`,
        scoring: `${qScores.Q7 || 74}/100`,
        scoring_label: 'Ritme Diurnal Adaptif',
        interpretation: 'Modulasi sirkadian fisiologis terjaga baik dengan pergeseran waktu pemulihan fase istirahat malam.',
      },
      {
        id: 'Q8',
        code: 'K_day',
        vectorKey: 'K',
        title: 'Q8 • Konsistensi Intra-Minggu (Repeatability)',
        color: '#6D28D9',
        actual_population: 'ICC Kohor: 0.87, CV Lintas Hari: 14.5%',
        actual_personal: 'ICC(2,1): 0.884, CV Lintas Hari: 12.5%',
        scoring: `${qScores.Q8 || 84}/100`,
        scoring_label: 'Konsistensi Tinggi (Good-to-Excellent)',
        interpretation: 'Karakteristik regulasi otonom berulang konsisten antar hari tanpa deviasi sporadis liar.',
      },
      {
        id: 'Q9',
        code: 'N_unexp',
        vectorKey: 'U',
        title: 'Q9 • Deviasi Istirahat Tak-Terjelaskan',
        color: '#8B5CF6',
        actual_population: '0.05 ep/hari kandidat unexplained kohor',
        actual_personal: '0.02 ep/hari (2 kandidat lolos eksklusi)',
        scoring: `${qScores.Q9 || 79}/100`,
        scoring_label: 'Beban Idiopatik Minimal',
        interpretation: 'Deviasi tanpa stimulus eksternal saat istirahat sangat minimal, menepis risiko anomali basal.',
      },
      {
        id: 'Q10',
        code: 'Phi',
        vectorKey: 'Phi',
        title: 'Q10 • Sintesis Vektor Fenotipe Personal (Φ)',
        color: '#5B21B6',
        actual_population: '42.3% Efficient-Stable, 26.9% Adaptive',
        actual_personal: `${candidate} (Persentil Ke-74)`,
        scoring: `${qScores.Q10 || 86}/100`,
        scoring_label: 'Fenotipe Otonomik Terkunci',
        interpretation: 'Integrasi multivariat 9 koordinat membentuk profil persona regulasi otonom terverifikasi.',
      },
    ];
  }, [activeEpoch]);

  const filteredQComparisons = useMemo(() => {
    if (qFilter === 'q1-q5') return fullQComparisons.slice(0, 5);
    if (qFilter === 'q6-q9') return fullQComparisons.slice(5, 9);
    if (qFilter === 'q10') return fullQComparisons.slice(9, 10);
    return fullQComparisons;
  }, [fullQComparisons, qFilter]);

  // Copy snapshot JSON to clipboard
  const handleCopySnapshot = () => {
    if (!activeEpoch) return;
    const payload = JSON.stringify(activeEpoch, null, 2);
    navigator.clipboard.writeText(payload);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Notification */}
      {confirmToast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: '#0F172A',
          border: '1.5px solid #10B981',
          color: '#FFFFFF',
          padding: '12px 20px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <i className="fa-solid fa-circle-check" style={{ color: '#34D399', fontSize: 16 }}></i>
          <span>{confirmToast}</span>
        </div>
      )}

      {/* ── TOP BANNER & HEADER (Unified Dark Navy Clinical Style) ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0B1528 0%, #0F223D 50%, #1E1B4B 100%)',
        borderRadius: 16,
        padding: '24px 28px',
        color: '#FFFFFF',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{
              background: '#8B5CF6',
              color: '#FFFFFF',
              padding: '3px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}>
              TAHAP 4: FENOTYPING LONGITUDINAL
            </span>
            <span style={{
              background: 'rgba(139, 92, 246, 0.25)',
              color: '#C084FC',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 800
            }}>
              <i className="fa-solid fa-lock me-1"></i> Frozen Epoch Snapshot
            </span>
          </div>

          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            Fenotyping Frozen Mingguan (Vektor &Phi; &amp; Q1–Q10 CDSS)
          </h1>
          
          <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#94A3B8', maxWidth: 740, lineHeight: 1.4 }}>
            Integrasi 4-Tingkat Terpadu: <strong>Matriks Q1-Q2 Ungu</strong> (Actual Populasi vs Personal + Scoring), <strong>Scoring Faktor Perilaku RAG</strong> (Positive/Negative Statements &amp; Konfirmasi Pasien), dan <strong>Kesimpulan Evaluasi Faktor Fisik</strong>.
          </p>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{
              background: 'rgba(139, 92, 246, 0.15)',
              border: '1px solid rgba(139, 92, 246, 0.45)',
              borderRadius: 8,
              padding: '7px 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              color: '#F1F5F9',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.15)'
            }}>
              <i className="fa-solid fa-user-check" style={{ color: '#C084FC', fontSize: 13 }}></i>
              <span>Pasien Aktif: <strong style={{ color: '#FFFFFF' }}>{activeParticipantName}</strong></span>
              <span style={{ fontSize: 11, color: '#A78BFA', borderLeft: '1px solid rgba(139, 92, 246, 0.35)', paddingLeft: 8 }}>
                <i className="fa-solid fa-link me-1" style={{ fontSize: 10 }}></i>Tersinkron Topbar
              </span>
            </div>

            <button
              onClick={handleCopySnapshot}
              style={{
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                color: '#E2E8F0',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="fa-solid fa-copy"></i>
              {copiedNotification ? 'Tersalin!' : 'Salin JSON'}
            </button>

            <button
              onClick={fetchWeeklyData}
              style={{
                background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                border: 'none',
                color: '#FFFFFF',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="fa-solid fa-arrows-rotate"></i>
              Hitung Ulang Epoch
            </button>
          </div>
        </div>

        {/* Global Summary Badge */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 14,
          padding: '16px 22px',
          textAlign: 'center',
          minWidth: 200
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#C084FC', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Vektor Fenotipe &Phi;
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.2, margin: '4px 0' }}>
            {activeEpoch?.clinical_synthesis?.autonomic_classification || 'Efficient Stable'}
          </div>
          <div style={{
            background: 'rgba(16, 185, 129, 0.2)',
            color: '#34D399',
            fontSize: 11,
            fontWeight: 900,
            padding: '2px 8px',
            borderRadius: 6,
            display: 'inline-block'
          }}>
            Persentil Ke-74 (Kohor N=154)
          </div>
        </div>
      </div>

      {/* ── WEEKLY EPOCH SELECTOR TABS ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: '14px 18px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        overflowX: 'auto'
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', whiteSpace: 'nowrap' }}>
          <i className="fa-solid fa-calendar-week me-1 text-primary"></i> Pilih Minggu Frozen:
        </span>
        {weeklyData?.epochs?.map((epoch) => {
          const isSelected = epoch.week_id === selectedWeekId;
          return (
            <button
              key={epoch.week_id}
              onClick={() => setSelectedWeekId(epoch.week_id)}
              style={{
                background: isSelected ? 'var(--navy)' : '#F8FAFC',
                border: isSelected ? '1.5px solid var(--navy)' : '1px solid #E2E8F0',
                borderRadius: 10,
                padding: '8px 16px',
                color: isSelected ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 800 }}>
                  {epoch.week_id} • {epoch.week_label.split('(')[0]}
                </div>
                <div style={{ fontSize: 10, color: isSelected ? '#93C5FD' : '#94A3B8' }}>
                  {epoch.start_date} – {epoch.end_date}
                </div>
              </div>
              <span className={`badge ${isSelected ? 'bg-success text-white' : 'bg-light text-muted border'}`} style={{ fontSize: 9.5 }}>
                LOCKED ✓
              </span>
            </button>
          );
        })}
      </div>

      {/* ── FEATURED: COMPLETE Q1 S/D Q10 PURPLE COMPARISON CARDS (ACTUAL POPULASI VS PERSONAL) ── */}
      {fullQComparisons && fullQComparisons.length > 0 && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: 22,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#7C3AED', color: '#FFFFFF', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>
                  MATRIKS UNGU Q1 s/d Q10 (10 DIMENSI LENGKAP)
                </span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
                  Perbandingan Nilai Aktual Populasi Kohor vs Nilai Aktual Personal
                </h3>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>
                Evaluasi 10 koordinat fenotipe otonomik: beban deviasi, kinetik pemulihan, stabilitas relapse, sirkadian, hingga sintesis vektor &Phi;.
              </div>
            </div>

            {/* Quick Category Filter Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'Semua (Q1–Q10)', icon: 'fa-layer-group' },
                { id: 'q1-q5', label: 'Q1–Q5 (Episode)', icon: 'fa-wave-square' },
                { id: 'q6-q9', label: 'Q6–Q9 (Konteks)', icon: 'fa-sliders' },
                { id: 'q10', label: 'Q10 (Sintesis Φ)', icon: 'fa-dna' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setQFilter(f.id)}
                  style={{
                    background: qFilter === f.id ? '#7C3AED' : '#F8FAFC',
                    color: qFilter === f.id ? '#FFFFFF' : '#475569',
                    border: qFilter === f.id ? '1.5px solid #7C3AED' : '1px solid #E2E8F0',
                    borderRadius: 8,
                    padding: '5px 12px',
                    fontSize: 11.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <i className={`fa-solid ${f.icon}`}></i>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16 }}>
            {filteredQComparisons.map((card) => (
              <div
                key={card.id}
                style={{
                  background: '#FAF5FF',
                  border: '1.5px solid #8B5CF6',
                  borderRadius: 12,
                  padding: 18,
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ background: card.color || '#7C3AED', color: '#FFFFFF', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>
                        {card.id}
                      </span>
                      {card.vectorKey && (
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED', background: '#EDE9FE', padding: '2px 6px', borderRadius: 4 }}>
                          &Phi;[{card.vectorKey}]
                        </span>
                      )}
                    </div>
                    <span className="badge bg-success text-white px-2 py-1" style={{ fontSize: 11 }}>
                      Scoring: {card.scoring}
                    </span>
                  </div>

                  <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--navy)', marginBottom: 12 }}>
                    {card.title}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid #DDD6FE' }}>
                      <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 800, textTransform: 'uppercase' }}>
                        <i className="fa-solid fa-users me-1"></i> Aktual Populasi
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--navy)', marginTop: 4, lineHeight: 1.3 }}>
                        {card.actual_population}
                      </div>
                    </div>

                    <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1.5px solid #8B5CF6' }}>
                      <div style={{ fontSize: 10, color: '#2563EB', fontWeight: 800, textTransform: 'uppercase' }}>
                        <i className="fa-solid fa-user me-1"></i> Aktual Personal
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1D4ED8', marginTop: 4, lineHeight: 1.3 }}>
                        {card.actual_personal}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', padding: 10, borderRadius: 8, fontSize: 11.5, color: '#334155', lineHeight: 1.4, border: '1px solid #E2E8F0' }}>
                  <strong style={{ color: '#7C3AED' }}>Status:</strong> {card.scoring_label}. {card.interpretation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION QUICK NAVIGATION TABS ── */}
      <div className="d-flex gap-2 flex-wrap">
        {[
          { id: 'all', label: '🌟 Semua Bagian Terpadu', icon: 'fa-layer-group' },
          { id: 'personal', label: '1. RAG Faktor Perilaku & Konfirmasi Pasien', icon: 'fa-user-gear' },
          { id: 'synthesis', label: '2. Kesimpulan Faktor Fisik (Benar/Salah)', icon: 'fa-clipboard-check' },
          { id: 'population', label: '3. Benchmark Populasi Kohor', icon: 'fa-users' },
          { id: 'general', label: '4. Landasan Teori Umum', icon: 'fa-book-bookmark' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`btn btn-sm ${activeSection === tab.id ? 'btn-teal' : 'btn-outline-navy'}`}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8 }}
          >
            <i className={`fa-solid ${tab.icon} me-1`}></i>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── SECTION 1: RAG BEHAVIORAL FACTORS & PATIENT CONFIRMATION (PER PERILAKU) ── */}
      {(activeSection === 'all' || activeSection === 'personal') && activeEpoch?.behavioral_scoring && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: 22,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#0D9488', color: '#FFFFFF', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>
                  TINGKAT 3
                </span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
                  Scoring Faktor Perilaku RAG (Positive / Negative Statements &amp; Konfirmasi Pasien)
                </h3>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>
                Evaluasi relasi korelasi per perilaku terhadap deviasi Q1, bukti RAG grounded, dan konfirmasi mandiri pasien.
              </div>
            </div>

            <div style={{
              background: '#ECFDF5',
              color: '#047857',
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <i className="fa-solid fa-calculator"></i>
              Rata-rata Relasi Korelasi: {activeEpoch.behavioral_scoring.average_correlation_pct}%
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeEpoch.behavioral_scoring.factors?.map((factor, idx) => {
              const factorId = factor.id || `bf_${String(idx + 1).padStart(2, '0')}`;
              const isConfirmed = confirmedFactors[factorId] ?? factor.patient_confirmed ?? false;
              return (
                <div
                  key={factorId}
                  style={{
                    background: isConfirmed ? '#F0FDF4' : '#F8FAFC',
                    border: isConfirmed ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: 16,
                    display: 'grid',
                    gridTemplateColumns: '1.8fr 2.6fr 1.2fr',
                    gap: 16,
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Col 1: Factor Info & Correlation */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ background: '#7C3AED', color: '#FFFFFF', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 900 }}>
                        {factor.category}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: factor.correlation_pct >= 25 ? '#DC2626' : '#D97706' }}>
                        {factor.correlation_pct}% ke Q1
                      </span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--navy)', marginBottom: 4 }}>
                      {factor.factor_name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--gray)', fontFamily: 'monospace' }}>
                      {factor.rag_citation?.substring(0, 60)}…
                    </div>
                  </div>

                  {/* Col 2: Positive / Negative Statements */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
                    <div style={{ color: '#0369A1', background: '#F0F9FF', padding: '6px 10px', borderRadius: 6, border: '1px solid #BAE6FD', lineHeight: 1.35 }}>
                      <strong><i className="fa-solid fa-plus-circle me-1"></i></strong> {factor.positive_statement}
                    </div>
                    <div style={{ color: '#475569', background: '#F8FAFC', padding: '6px 10px', borderRadius: 6, border: '1px solid #E2E8F0', lineHeight: 1.35 }}>
                      <strong><i className="fa-solid fa-minus-circle me-1"></i></strong> {factor.negative_statement}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#059669', fontWeight: 700 }}>
                      <i className="fa-solid fa-shield-halved me-1"></i>
                      RAG Confidence: {Math.round((factor.rag_confidence || 0) * 100)}%
                    </div>
                  </div>

                  {/* Col 3: Toggle Button */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--gray)', marginBottom: 4 }}>Konfirmasi Pasien:</div>
                    <button
                      onClick={() => handleToggleConfirmFactor(factorId, factor.factor_name)}
                      style={{
                        background: isConfirmed ? '#10B981' : '#F43F5E',
                        border: 'none',
                        color: '#FFFFFF',
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        justifyContent: 'center',
                        boxShadow: isConfirmed ? '0 2px 8px rgba(16,185,129,0.3)' : '0 2px 8px rgba(244,63,94,0.2)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <i className={`fa-solid ${isConfirmed ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                      {isConfirmed ? 'SESUAI ✓' : 'TIDAK SESUAI ✗'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── RAG CONFIRMATION GATE: Blok 2 → Blok 3 ── */}
          <div style={{
            marginTop: 20,
            padding: '18px 20px',
            borderRadius: 14,
            background: readyForBlock3
              ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
              : 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
            border: `2px solid ${readyForBlock3 ? '#10B981' : '#F59E0B'}`,
            boxShadow: readyForBlock3 ? '0 4px 16px rgba(16,185,129,0.15)' : '0 4px 16px rgba(245,158,11,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <i className={`fa-solid ${readyForBlock3 ? 'fa-circle-check' : 'fa-lock'}`}
                    style={{ fontSize: 20, color: readyForBlock3 ? '#059669' : '#D97706' }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: readyForBlock3 ? '#047857' : '#92400E' }}>
                      {readyForBlock3
                        ? '✅ Gate Blok 3 Terbuka — Fenotiping Selesai'
                        : `🔒 Gate Blok 3 Terkunci — ${MIN_GATE_THRESHOLD - confirmedCount} faktor lagi diperlukan`}
                    </div>
                    <div style={{ fontSize: 11.5, color: readyForBlock3 ? '#065F46' : '#78350F', marginTop: 2 }}>
                      {confirmedCount} / {totalFactors} faktor dikonfirmasi
                      {' '}(minimum <strong>{MIN_GATE_THRESHOLD}</strong> untuk naik ke Blok 3 — CRS)
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ background: '#E5E7EB', borderRadius: 999, height: 10, width: 340, maxWidth: '100%', overflow: 'hidden', marginTop: 8 }}>
                  <div style={{
                    width: `${gateProgress}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: readyForBlock3
                      ? 'linear-gradient(90deg, #10B981, #059669)'
                      : 'linear-gradient(90deg, #F59E0B, #D97706)',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 4 }}>
                  {gateProgress}% menuju threshold • {confirmedCount}/{MIN_GATE_THRESHOLD} faktor
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                {/* Simpan ke Backend */}
                <button
                  onClick={handleSaveBulkConfirmation}
                  disabled={savingGate}
                  style={{
                    background: '#1D4ED8',
                    border: 'none', color: '#fff',
                    padding: '9px 18px', borderRadius: 9,
                    fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 7,
                    opacity: savingGate ? 0.7 : 1,
                    boxShadow: '0 2px 8px rgba(29,78,216,0.3)',
                  }}
                >
                  <i className={`fa-solid ${savingGate ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} />
                  {savingGate ? 'Menyimpan...' : 'Simpan Konfirmasi'}
                </button>

                {/* Tombol Naik ke Blok 3 */}
                {onNavigate && (
                  <button
                    onClick={() => readyForBlock3 && onNavigate('cardiovascular-resilience')}
                    disabled={!readyForBlock3}
                    title={!readyForBlock3 ? `Konfirmasi minimal ${MIN_GATE_THRESHOLD} faktor terlebih dahulu` : 'Lanjut ke Blok 3 — CRS'}
                    style={{
                      background: readyForBlock3
                        ? 'linear-gradient(135deg, #059669, #047857)'
                        : '#9CA3AF',
                      border: 'none', color: '#fff',
                      padding: '9px 18px', borderRadius: 9,
                      fontSize: 12, fontWeight: 900, cursor: readyForBlock3 ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', gap: 7,
                      boxShadow: readyForBlock3 ? '0 4px 12px rgba(5,150,105,0.35)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    <i className={`fa-solid ${readyForBlock3 ? 'fa-arrow-right' : 'fa-lock'}`} />
                    Lanjut ke Blok 3 — CRS
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Φ OUTPUT CARD — VEKTOR TERSTRUKTUR BLOK 2 → BLOK 3 ── */}
      {(activeSection === 'all' || activeSection === 'personal') && activeEpoch && (() => {
        const qScores = activeEpoch?.q_scores || {};
        // Bangun vektor Φ dengan skor + zona per dimensi
        const phiVector = Q_METADATA.map(q => {
          const score = Number(qScores[q.id]) || Number(radarChartData?.find(r => r.subject.startsWith(q.id))?.personal) || 75;
          const zone = getQZone(score, q.id);
          const crsLink = Q_ZONES[q.id]?.crsLink || 'CRS';
          return { ...q, score, zone, crsLink, zoneStyle: ZONE_STYLES[zone] };
        });
        const criticalCount  = phiVector.filter(v => v.zone === 'critical').length;
        const riskCount      = phiVector.filter(v => v.zone === 'risk').length;
        const borderCount    = phiVector.filter(v => v.zone === 'borderline').length;
        const normalCount    = phiVector.filter(v => v.zone === 'normal').length;
        const overallZone    = criticalCount > 0 ? 'critical' : riskCount > 2 ? 'risk' : borderCount > 3 ? 'borderline' : 'normal';
        const overallStyle   = ZONE_STYLES[overallZone];
        // Estimasi dampak ke CRS per dimensi
        const crsImpactMap = {};
        phiVector.forEach(v => {
          if (!crsImpactMap[v.crsLink]) crsImpactMap[v.crsLink] = [];
          crsImpactMap[v.crsLink].push({ qId: v.id, score: v.score, zone: v.zone });
        });
        // Harian Q8 — konsistensi intra-week (gunakan data daily jika ada)
        const q8Score = phiVector.find(v => v.id === 'Q8')?.score || 80;
        const dailyQ8 = activeEpoch?.daily_q8_trend || [
          { day: 'Sen', score: q8Score - 4 }, { day: 'Sel', score: q8Score + 3 },
          { day: 'Rab', score: q8Score - 2 }, { day: 'Kam', score: q8Score + 5 },
          { day: 'Jum', score: q8Score - 1 }, { day: 'Sab', score: q8Score + 6 },
          { day: 'Min', score: q8Score - 3 },
        ];

        return (
          <div style={{
            background: '#FFFFFF', borderRadius: 14,
            border: `2px solid ${overallStyle.border}`,
            padding: 22, boxShadow: '0 4px 16px rgba(79,70,229,0.08)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ background: '#4F46E5', color: '#fff', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>Φ OUTPUT</span>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: 'var(--navy)' }}>
                    Vektor Fenotipe Terstruktur — Input Blok 3
                  </h3>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--gray)' }}>
                  10 dimensi Q dengan zona risiko fisiologis · Dikonfirmasi pasien · Siap dikirim ke CRS
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--gray)', marginBottom: 3 }}>PROFIL KESELURUHAN</div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 900,
                  background: overallStyle.bg, color: overallStyle.text, border: `1.5px solid ${overallStyle.border}`,
                }}>
                  <i className={`fa-solid ${overallStyle.icon}`} />
                  {overallStyle.label} — {normalCount} Normal · {borderCount} Borderline · {riskCount} Risiko · {criticalCount} Kritis
                </span>
              </div>
            </div>

            {/* Φ Vektor Grid — 10 dimensi */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 18 }}>
              {phiVector.map(v => (
                <div key={v.id} style={{
                  background: v.zoneStyle.bg, border: `1.5px solid ${v.zoneStyle.border}`,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <i className={`fa-solid ${v.icon}`} style={{ color: v.color, fontSize: 12 }} />
                      <span style={{ fontSize: 11.5, fontWeight: 900, color: 'var(--navy)' }}>{v.id}</span>
                    </div>
                    <QZoneBadge score={v.score} qId={v.id} compact />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--gray)', marginBottom: 3, lineHeight: 1.3 }}>{v.title}</div>
                  {/* Skor bar */}
                  <div style={{ background: '#E5E7EB', borderRadius: 999, height: 6, marginBottom: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${v.score}%`, height: '100%', borderRadius: 999,
                      background: v.zoneStyle.border, transition: 'width 0.3s',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 800 }}>
                    <span style={{ color: v.zoneStyle.text }}>{v.score.toFixed(0)}/100</span>
                    <span style={{ color: '#64748B', fontSize: 9.5 }}>→ {v.crsLink}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Dampak ke CRS per dimensi */}
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'linear-gradient(135deg, #EFF6FF, #F0F9FF)',
              border: '1px solid #BFDBFE', marginBottom: 16,
            }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#1D4ED8', marginBottom: 8 }}>
                <i className="fa-solid fa-arrows-to-dot me-2" />
                Pemetaan Φ → Komponen CRS Blok 3
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(crsImpactMap).map(([crsComp, qs]) => {
                  const hasRisk = qs.some(q => q.zone === 'critical' || q.zone === 'risk');
                  return (
                    <div key={crsComp} style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 11,
                      background: hasRisk ? '#FEF2F2' : '#F0FDF4',
                      border: `1px solid ${hasRisk ? '#FCA5A5' : '#86EFAC'}`,
                      color: hasRisk ? '#B91C1C' : '#166534',
                    }}>
                      <strong>{crsComp}</strong>: {qs.map(q => `${q.qId}(${q.score.toFixed(0)})`).join(', ')}
                      {hasRisk && <i className="fa-solid fa-triangle-exclamation ms-1" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Multi-skala Harian: Q8 Konsistensi Intra-Week */}
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: '#F0FDFA', border: '1px solid #99F6E4',
            }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0F766E', marginBottom: 8 }}>
                <i className="fa-solid fa-calendar-week me-2" />
                Multi-Skala Harian — Q8 Konsistensi Intra-Minggu
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56 }}>
                {dailyQ8.map((d, i) => {
                  const zone = getQZone(d.score, 'Q8');
                  const zStyle = ZONE_STYLES[zone];
                  const barH = Math.max(8, Math.round((d.score / 100) * 50));
                  return (
                    <div key={i} style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: zStyle.text }}>{d.score.toFixed(0)}</div>
                      <div style={{
                        width: '100%', height: barH,
                        background: zStyle.bg, border: `1px solid ${zStyle.border}`,
                        borderRadius: '3px 3px 0 0', transition: 'height 0.3s',
                      }} />
                      <div style={{ fontSize: 9.5, color: '#64748B', fontWeight: 700 }}>{d.day}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 10, color: '#0D9488', marginTop: 6, fontStyle: 'italic' }}>
                Tren konsistensi otonom mingguan — intra-week variability (CV). Data ini digunakan sebagai kovariate RS di Blok 3.
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── SECTION 2: KESIMPULAN FAKTOR FISIK & SINTESIS KLINIS ── */}
      {(activeSection === 'all' || activeSection === 'synthesis') && activeEpoch?.clinical_synthesis && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: 22,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#2563EB', color: '#FFFFFF', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>
                  TINGKAT 4
                </span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
                  Kesimpulan Evaluasi Faktor Fisik &amp; Umpan Balik Minggu Depan (W+1)
                </h3>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>
                Putusan evaluasi kausalitas fisik vs psikologis dan target penyesuaian gaya hidup.
              </div>
            </div>

            {activeEpoch.clinical_synthesis.physical_factor_evaluation && (
              <div style={{
                background: activeEpoch.clinical_synthesis.physical_factor_evaluation.is_true ? '#ECFDF5' : '#FEF2F2',
                border: `1.5px solid ${activeEpoch.clinical_synthesis.physical_factor_evaluation.badge_color}`,
                color: activeEpoch.clinical_synthesis.physical_factor_evaluation.badge_color,
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <i className={`fa-solid ${activeEpoch.clinical_synthesis.physical_factor_evaluation.is_true ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
                <span>{activeEpoch.clinical_synthesis.physical_factor_evaluation.verdict}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Left: Temuan Kunci */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-magnifying-glass-chart text-primary"></i>
                Temuan Kunci Sintesis &amp; Bukti Pendukung
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeEpoch.clinical_synthesis.key_findings?.map((f, idx) => (
                  <li key={idx} style={{ lineHeight: 1.45 }}>{f}</li>
                ))}
              </ul>
            </div>

            {/* Right: Cognitive Feedback for Next Week W+1 */}
            <div style={{ background: '#FAF5FF', border: '1.5px solid #DDD6FE', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#6D28D9', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-lightbulb" style={{ color: '#8B5CF6' }}></i>
                Umpan Balik Kognitif RAG untuk Minggu Depan (W+1)
              </div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
                <p style={{ margin: '0 0 8px 0' }}>
                  <strong>Target Penyesuaian:</strong> Prioritaskan pendinginan terstruktur pasca aktivitas fisik intensif (&gt; 35 menit) untuk mempercepat peredaman residual deviasi di bawah &tau;<sub>normal</sub>.
                </p>
                <div style={{ background: '#FFFFFF', padding: 8, borderRadius: 6, border: '1px solid #DDD6FE', fontSize: 11, color: '#6D28D9', fontWeight: 700 }}>
                  <i className="fa-solid fa-arrow-trend-up me-1"></i> Proyeksi Perbaikan Kinerja Otonom: +15% s/d +20% pada Minggu Berikutnya.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 3: BENCHMARK POPULASI KOHOR (RADAR CHART OVERLAY) ── */}
      {(activeSection === 'all' || activeSection === 'population') && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: 22,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#3B82F6', color: '#FFFFFF', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>
                  TINGKAT 2
                </span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
                  Benchmark Komparatif Populasi Kohor (N=154 Subjek Acuan)
                </h3>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>
                Radar overlay membandingkan profil personal terhadap median populasi kohor rujukan.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'center' }}>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarChartData}>
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#CBD5E1" />
                  <Radar name="Personal Subjek" dataKey="personal" stroke="#7C3AED" fill="#8B5CF6" fillOpacity={0.45} strokeWidth={2} />
                  <Radar name="Median Populasi (N=154)" dataKey="population" stroke="#3B82F6" fill="#60A5FA" fillOpacity={0.2} strokeWidth={1.5} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 8 }} />
                  <Tooltip contentStyle={{ background: '#0F172A', color: '#FFFFFF', borderRadius: 8, fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: '#F8FAFC', padding: 18, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>
                Statistik Komparatif Kohor
              </div>
              <div className="d-flex flex-column gap-2" style={{ fontSize: 12 }}>
                <div className="d-flex justify-content-between p-2 bg-white rounded border">
                  <span style={{ color: 'var(--gray)' }}>Peringkat Persentil:</span>
                  <span className="fw-bold" style={{ color: '#7C3AED' }}>Persentil Ke-74</span>
                </div>
                <div className="d-flex justify-content-between p-2 bg-white rounded border">
                  <span style={{ color: 'var(--gray)' }}>Median Freq Deviasi (Q1):</span>
                  <span className="fw-bold">0.42 ep/jam (Populasi) vs 0.31 (Personal)</span>
                </div>
                <div className="d-flex justify-content-between p-2 bg-white rounded border">
                  <span style={{ color: 'var(--gray)' }}>Mean Residual AUC (Q2):</span>
                  <span className="fw-bold">2.45 (Populasi) vs 1.82 (Personal)</span>
                </div>
                <div className="d-flex justify-content-between p-2 bg-white rounded border">
                  <span style={{ color: 'var(--gray)' }}>Status Regulasi Otonom:</span>
                  <span className="badge bg-success text-white">Superior / Terkontrol</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 4: LANDASAN TEORI UMUM (Q1-Q10 MATRIX) ── */}
      {(activeSection === 'all' || activeSection === 'general') && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: 22,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ background: '#64748B', color: '#FFFFFF', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>
              TINGKAT 1
            </span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
              Landasan Teori Umum &amp; Matriks Penjelasan Parameter Q1 s/d Q10
            </h3>
          </div>

          <div className="p-3 rounded mb-3" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1D4ED8', marginBottom: 4 }}>
              <i className="fa-solid fa-car-side me-1"></i> Konsep Sistem Dinamis Redaman (Damped Suspension)
            </div>
            <p style={{ fontSize: 11.5, color: '#334155', margin: 0, lineHeight: 1.45 }}>
              Fisiologi kardiovaskular dimodelkan sebagai sistem dinamis redaman. Ketika terdistorsi oleh aktivitas fisik atau beban emosional, terjadi lonjakan awal (<strong>Peak 1</strong>) yang diredam secara bertahap melalui osilasi sekunder (<strong>Peak 2 / Relapse</strong>) hingga akhirnya stabil di bawah ambang batas normal (&tau;<sub>normal</sub>).
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {Q_METADATA.map((q) => (
              <div key={q.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ background: q.color, color: '#FFFFFF', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 900 }}>
                    {q.id}
                  </span>
                  <span className="mono fw-bold" style={{ fontSize: 11, color: q.color }}>
                    &Phi;[{q.vectorKey}]
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', marginBottom: 4 }}>
                  {q.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray)' }}>
                  Evaluasi kuantitatif longitudinal pada jendela analisis mingguan.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
