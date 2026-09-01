import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  Brush,
} from 'recharts';

// ── Master Q1-Q10 Data Structure ──────────────────────────────────────────────
const Q_FRAMEWORK = [
  {
    id: 'Q1',
    title: 'Seberapa sering deviasi terjadi?',
    evidence: 'episode_id + valid time, timestamp, state, context',
    metrics: 'episode rate, episode_count, episodes_per_valid_hour',
    level: 'Episode / Day',
    category: 'Frekuensi & Kejadian',
    vectorKey: 'F',
    color: '#0284C7',
    icon: 'fa-chart-line',
    dataLog: ['timestamp', 'valid_window', 'state', 'episode_id', 'context'],
    derivedVars: 'Episode segmentation, durasi monitoring valid, episode count per hari / per konteks.',
    outputXAI: ['episode_count', 'episodes_per_valid_hour', 'episodes_by_day', 'episodes_by_context'],
    formula: 'N_{episode} = \\text{jumlah episode\\_id unik yang valid} \\\\\n\\text{Deviation Rate} = \\frac{N_{episode}}{\\text{valid monitoring hours}}',
    exampleXAI: '“Terdeteksi 4 episode deviasi dalam 12 jam monitoring valid (0,33 episode/jam). Dua episode terjadi saat duduk dan dua saat berdiri.”',
    defaultAnswer: 'Frekuensi deviasi terpantau rendah dan proporsional terhadap durasi pemantauan aktif.',
    whyExplainable: 'Sistem menghitung episode unik yang lolos quality gate, bukan sekadar menjumlahkan baris log state deviasi mentah.',
    limitations: 'Frekuensi bergantung pada parameter onset, hysteresis, dwell time, dan aturan penggabungan episode.',
  },
  {
    id: 'Q2',
    title: 'Seberapa besar deviasinya?',
    evidence: 'deviation_score + baseline personal, HR, RR/HRV, DFA',
    metrics: 'Peak D, AUC-D, Z_HR, Z_dHR, Z_DFA',
    level: 'Episode',
    category: 'Magnitudo & Beban',
    vectorKey: 'M',
    color: '#E11D48',
    icon: 'fa-gauge-high',
    dataLog: ['HR', 'RR/HRV', 'DFA alpha1', 'baseline personal-contextual', 'z_hr', 'z_dhr', 'z_dfa', 'deviation_score'],
    derivedVars: 'Z-score per fitur, weighted deviation score D(t), peak deviation, integral deviasi (AUC-D).',
    outputXAI: ['peak_deviation', 'median_peak', 'max_peak', 'AUC-D'],
    formula: 'Z_{HR}(t) = \\frac{HR(t) - \\mu_{HR, context}}{\\sigma_{HR, context}} \\\\\nD(t) = w_1|Z_{HR}| + w_2|Z_{dHR}| + w_3|Z_{DFA}| \\\\\n\\text{Peak } D = \\max D(t), \\quad \\text{AUC-D} = \\int D(t)\\,dt',
    exampleXAI: '“Episode E12 memiliki peak deviation 2,8 dan AUC-D tertinggi hari ini. Penyumbang deviasi terbesar berasal dari Z_HR dan Z_DFA.”',
    defaultAnswer: 'Besaran deviasi terukur dalam rentang adaptif personal, didominasi oleh pergeseran Z_HR terbobot.',
    whyExplainable: 'Magnitudo dihitung dari jarak relatif terhadap baseline personal-kontekstual yang telah terkalibrasi, bukan angka HR absolut semata.',
    limitations: 'Nilai magnitudo hanya valid jika baseline aktivitas telah matang (mature) dan bobot fitur (weights) telah terkalibrasi.',
  },
  {
    id: 'Q3',
    title: 'Berapa lama deviasi bertahan?',
    evidence: 'onset + persistent_start + recovery_start',
    metrics: 'deviation_duration_sec, persistent_duration_sec',
    level: 'Episode',
    category: 'Durasi & Persistensi',
    vectorKey: 'D',
    color: '#D97706',
    icon: 'fa-stopwatch',
    dataLog: ['episode_id', 'onset', 'persistent_start', 'recovery_start', 'state'],
    derivedVars: 'Deviation duration (waktu hingga mulai pulih) dan persistent duration (waktu dalam state deviasi persisten).',
    outputXAI: ['deviation_duration_sec', 'persistent_duration_sec', 'median_duration', 'longest_episode'],
    formula: '\\text{Deviation Duration} = t_{recovery\\_start} - t_{onset} \\\\\n\\text{Persistent Duration} = t_{recovery\\_start} - t_{persistent\\_start}',
    exampleXAI: '“Deviasi bertahan 210 detik sebelum recovery dimulai; 145 detik di antaranya berada pada state persistent deviation.”',
    defaultAnswer: 'Durasi deviasi bersifat transien dan segera memasuki fase recovery tanpa persistensi berkepanjangan.',
    whyExplainable: 'Timestamp onset dan recovery-start terekam jelas di log state machine sehingga durasi dapat diaudit secara presisi.',
    limitations: 'Episode unresolved (belum tuntas) tidak memiliki recovery_start lengkap dan harus ditandai censored, bukan dipaksakan selesai.',
  },
  {
    id: 'Q4',
    title: 'Seberapa cepat recovery?',
    evidence: 'recovery trajectory, recovery_start, recovered_at',
    metrics: 'TTR (Time-to-Recovery), velocity, acceleration',
    level: 'Episode',
    category: 'Kinetik Pemulihan',
    vectorKey: 'R',
    color: '#059669',
    icon: 'fa-person-running',
    dataLog: ['recovery_start', 'recovered_at', 'deviation_score sepanjang recovery', 'timestamp'],
    derivedVars: 'Time-to-recovery (TTR), recovery velocity (slope penurunan D), dan recovery acceleration.',
    outputXAI: ['TTR', 'recovery_velocity', 'recovery_acceleration', 'recovery_trajectory_shape'],
    formula: 'TTR = t_{recovered} - t_{recovery\\_start} \\\\\nv_{rec} = \\frac{D_{start} - D_{end}}{TTR}, \\quad a_{rec} = \\frac{\\Delta v_{rec}}{\\Delta t}',
    exampleXAI: '“Recovery selesai dalam 92 detik (TTR). Skor deviasi turun konsisten dengan recovery velocity positif tanpa osilasi besar.”',
    defaultAnswer: 'Kinetik pemulihan menunjukkan reaktivasi parasimpatis (vagal tone) yang responsif dengan TTR efisien.',
    whyExplainable: 'TTR menjawab durasi waktu kembali, sedangkan velocity dan acceleration menjelaskan lintasan kurva fisiologis menuju target homeostasis.',
    limitations: 'TTR wajib dibandingkan pada konteks aktivitas yang sama (TTR duduk berbeda secara fisiologis dengan TTR pasca berlari).',
  },
  {
    id: 'Q5',
    title: 'Apakah benar-benar stabil atau relapse?',
    evidence: 'post-recovery states, recovered_at, motion, context',
    metrics: 'relapse rate, relapse count, recovery stability',
    level: 'Episode',
    category: 'Stabilitas & Kambuh',
    vectorKey: 'S',
    color: '#7C3AED',
    icon: 'fa-shield-halved',
    dataLog: ['recovered_at', 'state setelah recovered', 'deviation_score', 'context', 'motion', 'episode_id'],
    derivedVars: 'Post-recovery observation window, relapse count, relapse latency, dan skor stabilitas pemulihan.',
    outputXAI: ['relapse_count', 'relapse_rate', 'relapse_latency_sec', 'recovery_stability_score'],
    formula: '\\text{Relapse} = 1 \\text{ jika deviasi muncul kembali dalam } W_R \\text{ tanpa stimulus baru} \\\\\n\\text{Relapse Rate} = \\frac{N_{relapse}}{N_{recovered}}, \\quad \\text{Stability} = 1 - \\text{Relapse Rate}',
    exampleXAI: '“Tiga dari 10 episode recovered kembali mengalami deviasi dalam 10 menit (relapse rate 30%). Dua kejadian tidak disertai perubahan gerak.”',
    defaultAnswer: 'Fase pasca pemulihan stabil (low relapse rate) dan mampu mempertahankan operating region normal.',
    whyExplainable: 'XAI memperlihatkan sekuens transisi state lengkap: Recovery → Recovered → Stable → Deviation beserta timestamp dan konteks akselerometer.',
    limitations: 'Adanya perubahan aktivitas baru atau intensitas gerak harus mengecualikan episode dari label relapse fisiologis internal.',
  },
  {
    id: 'Q6',
    title: 'Apakah deviasi sesuai aktivitas?',
    evidence: 'context + ACC + motion_intensity + baseline',
    metrics: 'context appropriateness, context-explained vs inappropriate',
    level: 'Episode / Context',
    category: 'Kesesuaian Konteks',
    vectorKey: 'C',
    color: '#2563EB',
    icon: 'fa-person-walking',
    dataLog: ['context', 'ACC', 'motion_intensity', 'HR/RR/HRV/DFA', 'contextual baseline', 'event marker'],
    derivedVars: 'Context appropriateness index, klasifikasi context-explained candidate vs context-inappropriate candidate.',
    outputXAI: ['context_explained_candidate', 'context_inappropriate_candidate', 'evidence_per_context'],
    formula: '\\text{Evaluasi deviasi } D(t) \\text{ terhadap rentang envelope personal pada konteks aktif.} \\\\\n\\text{Explained jika } \\Delta \\text{Fisiologi} \\propto \\text{Motion Intensity / Aktivitas Fisik.}',
    exampleXAI: '“HR meningkat tajam saat posisi duduk dengan motion rendah dan tanpa transisi aktivitas. Deviasi tidak dapat dijelaskan oleh aktivitas fisik.”',
    defaultAnswer: 'Deviasi fisiologis selaras secara proporsional dengan peningkatan tuntutan aktivitas fisik/gerak.',
    whyExplainable: 'Respons dinilai relatif terhadap konteks gerak aktif dan baseline personal, bukan menggunakan batas statis universal.',
    limitations: 'Kesalahan klasifikasi konteks aktivitas dapat memicu false unexplained deviation. Verifikasi via kuesioner EMA membantu akurasi.',
  },
  {
    id: 'Q7',
    title: 'Apakah berbeda pagi-siang-sore-malam?',
    evidence: 'timestamp + time_of_day + contextual metrics',
    metrics: 'time-of-day profile, diurnal TTR variation',
    level: 'Within-day',
    category: 'Pola Sirkadian',
    vectorKey: 'T',
    color: '#EA580C',
    icon: 'fa-cloud-sun',
    dataLog: ['timestamp', 'time_of_day', 'context', 'episode metrics (TTR, peak D, AUC-D, relapse)'],
    derivedVars: 'Stratifikasi time-of-day (Morning, Afternoon, Evening, Night) dan context-adjusted diurnal profile.',
    outputXAI: ['episode_count_by_time', 'median_TTR_by_time', 'median_peak_by_time', 'relapse_rate_by_time'],
    formula: '\\text{Bandingkan metrik pada konteks identik:} \\\\\nTTR_{duduk, pagi} \\quad \\text{vs} \\quad TTR_{duduk, malam}',
    exampleXAI: '“Median TTR pada episode duduk meningkat dari 80 detik di pagi hari menjadi 145 detik di malam hari pada konteks duduk yang sama.”',
    defaultAnswer: 'Fluktuasi regulasi mengikuti kurva sirkadian alami tanpa tanda kelelahan otonom ekstrem (diurnal deterioration).',
    whyExplainable: 'Membandingkan metrik dalam konteks aktivitas yang sama agar perbedaan waktu murni mencerminkan regulasi otonom harian, bukan variasi aktivitas.',
    limitations: 'Perbedaan pagi-malam dapat dipengaruhi faktor perancu (confounders) seperti kualitas tidur, asupan kafein, stres, atau hidrasi.',
  },
  {
    id: 'Q8',
    title: 'Apakah pola itu konsisten lintas hari?',
    evidence: 'daily metrics, date, TTR, peak D, relapse',
    metrics: 'daily profile, CV (Coefficient of Variation), repeatability',
    level: 'Between-day',
    category: 'Konsistensi Longitudinal',
    vectorKey: 'K',
    color: '#4F46E5',
    icon: 'fa-calendar-days',
    dataLog: ['date', 'episode_id', 'TTR', 'peak D', 'AUC-D', 'relapse', 'unexplained flag'],
    derivedVars: 'Daily Autonomic Profile vektor harian, median/IQR lintas hari, Coefficient of Variation (CV).',
    outputXAI: ['daily_profile_vector', 'TTR_day_CV', 'peak_day_CV', 'consistency_label'],
    formula: '\\text{Profile}_d = [N_{dev}, \\text{median } Peak\\,D, \\text{median } AUC\\text{-}D, \\text{median } TTR, \\text{relapse rate}] \\\\\nCV = \\frac{\\sigma_{day}}{\\mu_{day}}',
    exampleXAI: '“Median TTR konsisten selama 5 hari berturut-turut (CV 0,16), sedangkan unexplained episode hanya muncul sporadis pada dua hari.”',
    defaultAnswer: 'Pola kinetik pemulihan konsisten lintas hari dengan koefisien variasi (CV) yang stabil.',
    whyExplainable: 'Fenotipe tidak disimpulkan dari satu hari pengamatan acak; XAI membuktikan apakah karakteristik bersifat persisten atau transient.',
    limitations: 'Hari dengan durasi pemantauan (coverage) rendah atau sampel episode minim diberi penanda kualitas data rendah.',
  },
  {
    id: 'Q9',
    title: 'Apakah ada episode yang tidak dapat dijelaskan konteks?',
    evidence: 'quality + context + motion + EMA exclusion cascade',
    metrics: 'unexplained burden, candidate count, exclusion blockers',
    level: 'Episode / Context',
    category: 'Eksklusi & Unexplained',
    vectorKey: 'U',
    color: '#DC2626',
    icon: 'fa-triangle-exclamation',
    dataLog: ['quality_score', 'valid_window', 'baseline_mature', 'motion_intensity', 'context_transition', 'EMA/event marker', 'persistence'],
    derivedVars: 'Unexplained deviation candidate setelah melalui exclusion cascade bertingkat.',
    outputXAI: ['unexplained_candidate_count', 'unexplained_rate', 'episode_evidence_trace', 'exclusion_blockers'],
    formula: '\\text{Candidate} = \\text{Quality Valid} \\land \\text{Baseline Mature} \\land \\text{Low Motion} \\land \\text{No Transition} \\land \\text{No EMA Event}',
    exampleXAI: '“Episode E21 ditandai Unexplained Candidate: kualitas sinyal 0,97, baseline mature, gerak statis, tidak ada transisi konteks, deviasi 76 detik.”',
    defaultAnswer: 'Tidak terdeteksi beban deviasi unexplained yang persisten pada saat kondisi istirahat.',
    whyExplainable: 'XAI memaparkan secara transparan setiap kriteria penyaring yang lolos maupun syarat yang menggagalkan label unexplained.',
    limitations: 'Label unexplained bukan berarti penyakit pasti; faktor eksternal tak tercatat (stres psikologis, kafein, obat) tetap memungkinkan.',
  },
  {
    id: 'Q10',
    title: 'Apakah pola keseluruhannya menunjukkan fenotipe regulasi tertentu?',
    evidence: 'agregasi Q1-Q9, vektor fenotipe Phi, rule engine',
    metrics: 'Phenotype Vector Phi, candidate label, confidence, reasons',
    level: 'Person / Longitudinal',
    category: 'Digital Autonomic Phenotype',
    vectorKey: 'Pheno',
    color: '#0D9488',
    icon: 'fa-dna',
    dataLog: ['Seluruh agregat data Q1-Q9 pada level episode, harian, kontekstual, dan individu'],
    derivedVars: 'Vektor fenotipe komprehensif Phi = [F, M, D, R, S, C, T, K, U] dan klasifikasi fenotipe otonom.',
    outputXAI: ['candidate_phenotype', 'evidence_reasons', 'confidence_level', 'supporting_episodes_list'],
    formula: '\\Phi = [F, M, D, R, S, C, T, K, U] \\\\\nF=\\text{freq}, M=\\text{mag}, D=\\text{dur}, R=\\text{rec}, S=\\text{stab}, C=\\text{ctx}, T=\\text{time}, K=\\text{cons}, U=\\text{unexpl}',
    exampleXAI: '“Fenotipe Kandidat: Efficient / Stable Regulation. Bukti: Relapse rate rendah, kinetik pemulihan cepat, konsisten multi-hari, dan tanpa deviasi unexplained.”',
    defaultAnswer: 'Fenotipe kandidat: Efficient / Stable Regulation didukung oleh stabilitas otonom dan kinetik pemulihan yang baik.',
    whyExplainable: 'Q10 bukan kotak hitam satu fitur; ia merangkum rantai bukti audit Q1-Q9 yang dapat dilacak kembali hingga ke baris sinyal asal.',
    limitations: 'Fenotipe merupakan konstruk analitik digital biomarker; penetapan diagnosis medis tetap membutuhkan uji konfirmasi klinis standar (ECG/Holter).',
  },
];

const CANDIDATE_PHENOTYPES = [
  {
    name: 'Efficient / Stable Regulation',
    badge: 'Optimal',
    color: '#10B981',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    desc: 'TTR relatif singkat sesuai baseline personal-kontekstual, relapse rendah, state stabil, dan beban deviasi unexplained minimal.',
  },
  {
    name: 'Delayed Recovery Candidate',
    badge: 'Perlambatan',
    color: '#F59E0B',
    bg: '#FFFBEB',
    border: '#FDE68A',
    desc: 'TTR memanjang melampaui envelope personal dan/atau recovery velocity rendah secara berulang pada konteks aktivitas yang sebanding.',
  },
  {
    name: 'Unstable Recovery Candidate',
    badge: 'Osilatif',
    color: '#8B5CF6',
    bg: '#F5F3FF',
    border: '#DDD6FE',
    desc: 'Terjadi relapse atau state-switching berulang (Recovery → Relapse → Recovery) setelah fase pemulihan awal tercapai.',
  },
  {
    name: 'Persistent Dysregulation Candidate',
    badge: 'Persisten',
    color: '#EF4444',
    bg: '#FEF2F2',
    border: '#FECACA',
    desc: 'Deviasi bertahan lama di atas operating region, beban deviasi (AUC-D) tinggi, dan fase pemulihan tidak tuntas dengan residual tinggi.',
  },
  {
    name: 'Recurrent Unexplained Deviation',
    badge: 'Unexplained',
    color: '#EC4899',
    bg: '#FDF2F8',
    border: '#FBCFE8',
    desc: 'Episode deviasi berulang yang lolos uji kualitas dan baseline mature, namun terjadi saat kondisi istirahat tanpa penjelasan motion/transisi.',
  },
];

// Helper colors for FSM states
const STATE_COLORS = {
  BASELINE_COMPATIBLE: '#10B981',
  DEVIATION_CANDIDATE: '#F59E0B',
  PERSISTENT_DEVIATION: '#EF4444',
  RECOVERY: '#0284C7',
  RELAPSE: '#8B5CF6',
};

// ── Custom Trajectory Tooltip ──────────────────────────────────────────────────
function TrajectoryCustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload || {};
  const stateColor = STATE_COLORS[data.state] || '#64748B';

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(8px)',
      border: '1px solid #334155', borderRadius: 10, padding: '12px 16px',
      color: '#F8FAFC', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      minWidth: 260, maxWidth: 340
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid #334155', paddingBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 900, color: '#38BDF8', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fa-solid fa-calendar-days" style={{ color: '#38BDF8' }} />
            {data.dateFull || data.date || 'Tanggal'}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
            <i className="fa-regular fa-clock" style={{ marginRight: 4 }} />
            Pukul {data.time || label} WIB
          </div>
        </div>
        <span style={{
          background: `${stateColor}25`, color: stateColor, border: `1px solid ${stateColor}50`,
          padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 800
        }}>
          {data.state || 'NORMAL'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 11.5 }}>
        <div>Aktivitas: <strong style={{ color: '#F1F5F9' }}>{data.activity || '-'}</strong></div>
        <div>Skor D(t): <strong style={{ color: data.anomalyScore > 2 ? '#F87171' : '#4EECD6' }}>{data.anomalyScore ?? '-'}</strong></div>
        
        {data.hr !== null && <div>Mean HR: <strong style={{ color: '#38BDF8' }}>{data.hr} bpm</strong></div>}
        {data.deltaHr !== null && <div>Delta HR: <strong style={{ color: '#7DD3FC' }}>{data.deltaHr > 0 ? `+${data.deltaHr}` : data.deltaHr} bpm</strong></div>}
        
        {data.rmssd !== null && <div>RMSSD: <strong style={{ color: '#34D399' }}>{data.rmssd} ms</strong></div>}
        {data.sdnn !== null && <div>SDNN: <strong style={{ color: '#6EE7B7' }}>{data.sdnn} ms</strong></div>}
        
        {data.dfa !== null && <div>DFA &alpha;1: <strong style={{ color: '#FBBF24' }}>{data.dfa}</strong></div>}
        {data.zHr !== null && <div>Z-HR: <strong style={{ color: '#FDA4AF' }}>{data.zHr}</strong></div>}
      </div>

      {data.classification && data.classification !== 'Normal' && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px dashed #334155', color: '#FCA5A5', fontSize: 10.5, fontWeight: 700 }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />
          Status Episode: {data.classification}
        </div>
      )}
    </div>
  );
}

export function AutonomicProfileView() {
  const [participants, setParticipants] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'trajectory' | 'q1-q10' | 'phenotypes' | 'contract'
  const [expandedQ, setExpandedQ] = useState('Q1');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('ALL');

  // Form State for Q1-Q10 Answers & Phenotype
  const [answers, setAnswers] = useState({});
  const [phenotypeVector, setPhenotypeVector] = useState({
    F: 'Normal', M: 'Low', D: 'Short', R: 'Fast', S: 'Stable', C: 'High', T: 'Circadian', K: 'High', U: 'None'
  });
  const [candidatePhenotype, setCandidatePhenotype] = useState('Efficient / Stable Regulation');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [savedProfile, setSavedProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // ── Trajectory Segments State ──
  const [trajectorySegments, setTrajectorySegments] = useState([]);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [segmentLimit, setSegmentLimit] = useState(100);
  const [featureTrackView, setFeatureTrackView] = useState('ALL'); // 'ALL' | 'HR' | 'HRV' | 'DFA' | 'DEVIATION'

  const [computing, setComputing] = useState(false);

  // 1. Load participants list
  useEffect(() => {
    setLoading(true);
    api.listZeroShotParticipants()
      .then(res => {
        const list = Array.isArray(res?.data) ? res.data : [];
        setParticipants(list);
        if (list.length > 0 && !selectedUser) {
          setSelectedUser(list[0]);
        }
      })
      .catch(() => setParticipants([]))
      .finally(() => setLoading(false));
  }, []);

  // 2. Load saved or dynamically computed profile when user changes
  const loadSavedProfile = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await api.getPhenotypeProfile(userId);
      const data = res?.data;
      if (data) {
        setSavedProfile(res.is_saved ? data : null);
        if (data.candidate_phenotype) setCandidatePhenotype(data.candidate_phenotype);
        if (data.clinical_notes) setClinicalNotes(data.clinical_notes);
        if (data.phenotype_vector) setPhenotypeVector(prev => ({ ...prev, ...data.phenotype_vector }));
        if (data.answers) {
          const loadedAns = data.answers instanceof Map ? Object.fromEntries(data.answers) : data.answers;
          setAnswers(loadedAns);
        }
      }
    } catch {
      setSavedProfile(null);
    }
  }, []);

  // 2b. Explicitly recompute dynamic inference from raw telemetry logs
  const handleRecompute = async () => {
    if (!selectedUser) return;
    const uid = selectedUser.id || selectedUser._id;
    setComputing(true);
    setSaveMessage(null);
    try {
      const res = await api.computePhenotypeProfile(uid);
      if (res?.success && res.data) {
        const data = res.data;
        if (data.candidate_phenotype) setCandidatePhenotype(data.candidate_phenotype);
        if (data.phenotype_vector) setPhenotypeVector(data.phenotype_vector);
        if (data.answers) {
          const loadedAns = data.answers instanceof Map ? Object.fromEntries(data.answers) : data.answers;
          setAnswers(loadedAns);
        }
        setSaveMessage({ type: 'success', text: `Berhasil menghitung ulang Q1–Q10 dan Vektor Fenotipe secara dinamis untuk ${selectedUser.name || 'pasien'} dari log telemetri!` });
      } else {
        throw new Error(res?.message || 'Gagal menghitung inferensi.');
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: `Gagal menghitung: ${err.message}` });
    } finally {
      setComputing(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  // 3. Load trajectory segments for feature charts
  useEffect(() => {
    if (!selectedUser) return;
    const uid = selectedUser.id || selectedUser._id;
    setLoadingSegments(true);
    api.getAnalyzedSegments(uid, segmentLimit)
      .then(res => {
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setTrajectorySegments(list);
      })
      .catch(() => setTrajectorySegments([]))
      .finally(() => setLoadingSegments(false));
  }, [selectedUser, segmentLimit]);

  useEffect(() => {
    if (selectedUser) {
      const uid = selectedUser.id || selectedUser._id;
      loadSavedProfile(uid);
    }
  }, [selectedUser, loadSavedProfile]);

  // Handle saving profile to MongoDB
  const handleSaveProfile = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const uid = selectedUser.id || selectedUser._id;
      const payload = {
        userId: uid,
        answers,
        phenotype_vector: phenotypeVector,
        candidate_phenotype: candidatePhenotype,
        clinical_notes: clinicalNotes,
        status: 'saved',
      };
      const res = await api.savePhenotypeProfile(payload);
      if (res?.success) {
        setSavedProfile(res.data);
        setSaveMessage({ type: 'success', text: 'Profil Fenotipe & Jawaban Q1–Q10 berhasil disimpan ke MongoDB!' });
      } else {
        throw new Error(res?.message || 'Gagal menyimpan');
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: `Gagal menyimpan: ${err.message}` });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  // Handle input changes for Q answers
  const handleAnswerChange = (qId, field, val) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: {
        ...(prev[qId] || {}),
        q_id: qId,
        [field]: val,
      }
    }));
  };

  const filteredUsers = useMemo(() => {
    if (!searchQ) return participants;
    const q = searchQ.toLowerCase();
    return participants.filter(p => (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q));
  }, [participants, searchQ]);

  const filteredQuestions = useMemo(() => {
    if (selectedFilterCategory === 'ALL') return Q_FRAMEWORK;
    return Q_FRAMEWORK.filter(q => q.category === selectedFilterCategory);
  }, [selectedFilterCategory]);

  const categories = useMemo(() => {
    return ['ALL', ...Array.from(new Set(Q_FRAMEWORK.map(q => q.category)))];
  }, []);

  const [selectedDateFilter, setSelectedDateFilter] = useState('ALL');

  // Format trajectory data for Recharts with explicit Dates
  const chartData = useMemo(() => {
    if (!Array.isArray(trajectorySegments) || trajectorySegments.length === 0) return [];
    
    return trajectorySegments.map((seg, idx) => {
      const wStart = seg.window_start;
      let timeMs = wStart;
      if (typeof timeMs === 'number' && timeMs < 1e12) timeMs *= 1000;
      const d = timeMs ? new Date(timeMs) : new Date();

      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');

      const dateShort = `${day}/${month}`;
      const dateFull = `${day}/${month}/${year}`;
      const timeStr = `${hours}:${minutes}:${seconds}`;
      const timeShort = `${hours}:${minutes}`;
      const displayLabel = `${dateShort} ${timeShort}`;
      const feat = seg.features || {};
      const z = seg.z_scores || {};
      
      return {
        idx: idx + 1,
        time: timeStr,
        timeShort: timeShort,
        date: dateShort,
        dateFull: dateFull,
        displayLabel: displayLabel,
        dateTime: `${dateFull} ${timeStr}`,
        timestamp: timeMs,
        hr: feat.mean_hr !== undefined && feat.mean_hr !== null ? Number(feat.mean_hr.toFixed(1)) : null,
        deltaHr: feat.delta_hr !== undefined && feat.delta_hr !== null ? Number(feat.delta_hr.toFixed(1)) : null,
        slopeHr: feat.slope_hr !== undefined && feat.slope_hr !== null ? Number(feat.slope_hr.toFixed(3)) : null,
        rmssd: feat.rmssd !== undefined && feat.rmssd !== null ? Number(feat.rmssd.toFixed(1)) : null,
        sdnn: feat.sdnn !== undefined && feat.sdnn !== null ? Number(feat.sdnn.toFixed(1)) : null,
        meanRr: feat.mean_rr !== undefined && feat.mean_rr !== null ? Number(feat.mean_rr.toFixed(1)) : null,
        dfa: feat.dfa_alpha1 !== undefined && feat.dfa_alpha1 !== null ? Number(feat.dfa_alpha1.toFixed(3)) : null,
        dfa2: feat.dfa_alpha2 !== undefined && feat.dfa_alpha2 !== null ? Number(feat.dfa_alpha2.toFixed(3)) : null,
        anomalyScore: seg.anomaly_score !== undefined && seg.anomaly_score !== null ? Number(seg.anomaly_score.toFixed(2)) : 0,
        zHr: z.z_hr !== undefined && z.z_hr !== null ? Number(z.z_hr.toFixed(2)) : null,
        zDfa: z.z_dfa !== undefined && z.z_dfa !== null ? Number(z.z_dfa.toFixed(2)) : null,
        zDeltaHr: z.z_delta_hr !== undefined && z.z_delta_hr !== null ? Number(z.z_delta_hr.toFixed(2)) : null,
        motion: feat.motion_intensity !== undefined && feat.motion_intensity !== null ? Number(feat.motion_intensity.toFixed(2)) : null,
        activity: seg.activity_label || 'duduk',
        state: seg.rr_status || seg.physiological_state || 'BASELINE_COMPATIBLE',
        classification: seg.classification || 'Normal',
      };
    });
  }, [trajectorySegments]);

  // Unique available dates in the dataset
  const availableDates = useMemo(() => {
    return Array.from(new Set(chartData.map(d => d.dateFull).filter(Boolean)));
  }, [chartData]);

  // Filtered dataset by date
  const activeChartData = useMemo(() => {
    if (selectedDateFilter === 'ALL') return chartData;
    return chartData.filter(d => d.dateFull === selectedDateFilter);
  }, [chartData, selectedDateFilter]);

  // Trajectory Summary Metrics
  const summaryStats = useMemo(() => {
    if (activeChartData.length === 0) return null;
    const hrVals = activeChartData.map(d => d.hr).filter(v => v !== null);
    const rmssdVals = activeChartData.map(d => d.rmssd).filter(v => v !== null);
    const dfaVals = activeChartData.map(d => d.dfa).filter(v => v !== null);
    const scoreVals = activeChartData.map(d => d.anomalyScore).filter(v => v !== null);

    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const max = arr => arr.length ? Math.max(...arr) : 0;
    const min = arr => arr.length ? Math.min(...arr) : 0;

    const minDate = activeChartData[0]?.dateFull || '-';
    const maxDate = activeChartData[activeChartData.length - 1]?.dateFull || '-';

    return {
      totalPoints: activeChartData.length,
      minDate,
      maxDate,
      daysCount: availableDates.length,
      avgHr: avg(hrVals).toFixed(1),
      maxHr: max(hrVals).toFixed(1),
      minHr: min(hrVals).toFixed(1),
      avgRmssd: avg(rmssdVals).toFixed(1),
      avgDfa: avg(dfaVals).toFixed(3),
      maxScore: max(scoreVals).toFixed(2),
      alertCount: activeChartData.filter(d => d.classification === 'Alert').length,
      cautionCount: activeChartData.filter(d => d.classification === 'Caution').length,
    };
  }, [activeChartData, availableDates]);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* ── Top Hero Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%)',
        borderRadius: 16, padding: '26px 30px', color: '#fff', marginBottom: 24,
        boxShadow: '0 8px 24px rgba(15, 32, 39, 0.15)', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, opacity: 0.08, fontSize: 200 }}>
          <i className="fa-solid fa-dna" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{
            background: 'rgba(0, 168, 150, 0.25)', border: '1px solid rgba(0, 168, 150, 0.6)',
            color: '#4EECD6', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8
          }}>
            Explainable AI (XAI) Architecture
          </span>
          <span style={{
            background: 'rgba(255, 255, 255, 0.12)', color: '#E2E8F0', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600
          }}>
            Framework Pertanyaan Q1–Q10
          </span>
          {savedProfile && (
            <span style={{
              background: '#059669', color: '#FFFFFF', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800
            }}>
              <i className="fa-solid fa-cloud-check" style={{ marginRight: 5 }} />Tersimpan di MongoDB
            </span>
          )}
        </div>

        <h1 style={{ margin: '0 0 8px 0', fontSize: 23, fontWeight: 900, letterSpacing: -0.5, color: '#FFFFFF' }}>
          PETA DATA LOG & XAI AUTONOMIC REGULATION PHENOTYPE
        </h1>
        <p style={{ margin: '0 0 18px 0', fontSize: 13.5, color: '#CBD5E1', maxWidth: 960, lineHeight: 1.6 }}>
          Kerangka Pertanyaan Q1–Q10, Variabel Turunan, Aturan Inferensi State Machine, dan Grafik Lintasan Fitur Per Waktu untuk Rekonstruksi Fenotipe Regulasi Otonom Longitudinal.
        </p>

        {/* Pipeline Diagram Bar */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.35)', backdropFilter: 'blur(8px)',
          borderRadius: 10, padding: '12px 16px', border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto'
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#38BDF8', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
            <i className="fa-solid fa-arrows-split-up-and-left" style={{ marginRight: 6 }} />Pipeline Flow:
          </span>
          {[
            'Raw Log', 'Valid Window', 'Contextual Baseline', 'Deviation',
            'State Machine', 'Episode', 'Recovery Metrics', 'Daily Pattern', 'Longitudinal Phenotype'
          ].map((step, idx, arr) => (
            <React.Fragment key={step}>
              <span style={{
                background: idx === arr.length - 1 ? 'var(--teal, #00A896)' : 'rgba(255, 255, 255, 0.12)',
                color: idx === arr.length - 1 ? '#0F2027' : '#F1F5F9',
                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap'
              }}>
                {step}
              </span>
              {idx < arr.length - 1 && <i className="fa-solid fa-chevron-right" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Top Bar Controls: Patient Selector & Actions ── */}
      <div style={{
        background: '#FFFFFF', borderRadius: 12, padding: '14px 18px', border: '1px solid #E2E8F0',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        {/* Patient Selection Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12.5, fontWeight: 800, color: '#0F2027', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-solid fa-user-check" style={{ color: 'var(--teal, #00A896)' }} />
            Pilih Pasien:
          </label>
          <select
            value={selectedUser ? (selectedUser.id || selectedUser._id) : ''}
            onChange={e => {
              const u = participants.find(p => (p.id || p._id) === e.target.value);
              if (u) setSelectedUser(u);
            }}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1',
              fontSize: 12.5, fontWeight: 700, background: '#F8FAFC', color: '#0F2027', minWidth: 260
            }}>
            {participants.map(p => (
              <option key={p.id || p._id} value={p.id || p._id}>
                {p.name} ({p.total_segments} win, {p.mature_baselines}/{p.total_baselines} base, {p.total_episodes} anom)
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons: Compute, Save & Use in Explain AI */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleRecompute}
            disabled={computing || !selectedUser}
            title="Hitung ulang evaluasi Q1–Q10 dan vektor fenotipe secara dinamis dari rekaman sensor telemetri pasien ini"
            style={{
              padding: '9px 15px', borderRadius: 8, border: '1.5px solid #00A896',
              background: '#E6FFFA', color: '#00A896', cursor: computing ? 'not-allowed' : 'pointer',
              fontWeight: 800, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: '0 2px 6px rgba(0, 168, 150, 0.1)', transition: 'all .15s'
            }}>
            <i className={computing ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-rotate'} />
            {computing ? 'Menghitung dari Sensor...' : 'Hitung Otomatis Dari Sensor'}
          </button>

          <button
            onClick={handleSaveProfile}
            disabled={saving || !selectedUser}
            style={{
              padding: '9px 16px', borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg, #00A896, #028090)', color: '#FFFFFF',
              fontWeight: 800, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: '0 4px 12px rgba(0, 168, 150, 0.25)', transition: 'all .15s'
            }}>
            <i className={saving ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-floppy-disk'} />
            {saving ? 'Menyimpan...' : 'Simpan Evaluasi ke MongoDB'}
          </button>

          <a
            href="#//zero-shot"
            style={{
              padding: '9px 16px', borderRadius: 8, border: '1.5px solid #0F2027',
              background: '#0F2027', color: '#FFFFFF', textDecoration: 'none',
              fontWeight: 800, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: '0 4px 12px rgba(15, 32, 39, 0.15)', transition: 'all .15s'
            }}>
            <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#4EECD6' }} />
            Gunakan di Explain AI (360°)
          </a>
        </div>
      </div>

      {/* Save Feedback Banner */}
      {saveMessage && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 18, fontSize: 12.5, fontWeight: 700,
          background: saveMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${saveMessage.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          color: saveMessage.type === 'success' ? '#065F46' : '#991B1B',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <i className={saveMessage.type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation'} />
          {saveMessage.text}
        </div>
      )}

      {/* ── Main Navigation Tabs ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, background: '#F1F5F9', padding: 4, borderRadius: 10, border: '1px solid #E2E8F0' }}>
          {[
            { id: 'matrix', label: 'Matriks Ringkas Q1–Q10', icon: 'fa-table-cells-large' },
            { id: 'trajectory', label: 'Grafik Lintasan Fitur Per Waktu', icon: 'fa-chart-area' },
            { id: 'q1-q10', label: 'Form Jawaban & Bukti Q1–Q10', icon: 'fa-list-check' },
            { id: 'phenotypes', label: 'Peta 5 Fenotipe Kandidat', icon: 'fa-dna' },
            { id: 'contract', label: 'Data Contract & Arsitektur', icon: 'fa-database' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontWeight: activeTab === t.id ? 800 : 600, fontSize: 12.5,
                background: activeTab === t.id ? '#FFFFFF' : 'transparent',
                color: activeTab === t.id ? '#0F2027' : '#64748B',
                boxShadow: activeTab === t.id ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all .15s'
              }}>
              <i className={`fa-solid ${t.icon}`} style={{ marginRight: 6, color: activeTab === t.id ? 'var(--teal, #00A896)' : 'inherit' }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Medical Disclaimer Alert ── */}
      <div style={{
        background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
        padding: '10px 14px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 10
      }}>
        <i className="fa-solid fa-circle-info" style={{ color: '#D97706', fontSize: 16 }} />
        <span style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
          <strong>Prinsip Klinis:</strong> Seluruh grafik lintasan dan inferensi Q1–Q10 membentuk <em>longitudinal autonomic regulation phenotype</em>. Data wearable berfungsi sebagai penapisan dan stratifikasi risiko otonom, dan <strong>bukan diagnosis definitif penyakit jantung</strong>. Konfirmasi diagnosis klinis tetap membutuhkan uji medis standar (12-lead ECG, Holter, atau konsultasi dokter spesialis).
        </span>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: MATRIKS RINGKAS Q1–Q10 & PETA ARSITEKTUR                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Matrix Card */}
          <div style={{
            background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20,
            boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0F2027', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fa-solid fa-table-cells" style={{ color: 'var(--teal, #00A896)' }} />
                  Matriks Ringkas Inferensi Regulasi Otonom (Q1–Q10) Pasien
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: 12, color: '#64748B' }}>
                  Hasil evaluasi aktual dan metrik turunan yang dihitung spesifik untuk <strong>{selectedUser?.name || 'Pasien'}</strong>.
                </p>
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedFilterCategory(cat)}
                    style={{
                      padding: '4px 9px', borderRadius: 6, border: '1px solid',
                      fontSize: 11, fontWeight: selectedFilterCategory === cat ? 800 : 600,
                      cursor: 'pointer',
                      borderColor: selectedFilterCategory === cat ? 'var(--teal, #00A896)' : '#E2E8F0',
                      background: selectedFilterCategory === cat ? '#E6FFFA' : '#F8FAFC',
                      color: selectedFilterCategory === cat ? 'var(--teal, #00A896)' : '#64748B',
                    }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 800 }}>
                    <th style={{ padding: '12px 16px', width: 55, textAlign: 'center' }}>Q</th>
                    <th style={{ padding: '12px 16px', minWidth: 200 }}>Pertanyaan Regulasi</th>
                    <th style={{ padding: '12px 16px', minWidth: 280 }}>Hasil Evaluasi Aktual Pasien ({selectedUser?.name || 'Pasien'})</th>
                    <th style={{ padding: '12px 16px', minWidth: 180 }}>Metrik Inti Turunan</th>
                    <th style={{ padding: '12px 16px', minWidth: 120, textAlign: 'center' }}>Keyakinan</th>
                    <th style={{ padding: '12px 16px', width: 90, textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map((row, idx) => {
                    const ans = answers[row.id] || {};
                    const patientAnswer = ans.answer_label || row.defaultAnswer;
                    const patientMetrics = ans.metrics || row.metrics;

                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                          transition: 'background .1s'
                        }}>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            background: `${row.color}15`, color: row.color,
                            padding: '3px 8px', borderRadius: 6, fontWeight: 900, fontSize: 11
                          }}>
                            {row.id}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1E293B' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <i className={`fa-solid ${row.icon}`} style={{ color: row.color, fontSize: 13 }} />
                            <span>{row.title}</span>
                          </div>
                          <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 3 }}>
                            Level: {row.level} · Vektor: &Phi;[{row.vectorKey}]
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#0F2027', fontWeight: 600 }}>
                          <div style={{ background: '#F8FAFC', padding: '6px 10px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }}>
                            {patientAnswer}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#0284C7', fontFamily: 'monospace', fontSize: 11.5, fontWeight: 700 }}>
                          {patientMetrics}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0',
                            padding: '2px 8px', borderRadius: 12, fontSize: 10.5, fontWeight: 800,
                            display: 'inline-flex', alignItems: 'center', gap: 4
                          }}>
                            <i className="fa-solid fa-shield-check" style={{ color: '#059669', fontSize: 10 }} />
                            Tinggi
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setExpandedQ(row.id);
                              setActiveTab('q1-q10');
                            }}
                            style={{
                              padding: '4px 10px', borderRadius: 6, border: `1px solid ${row.color}`,
                              background: '#FFFFFF', color: row.color, fontSize: 11, fontWeight: 700,
                              cursor: 'pointer', transition: 'all .15s'
                            }}>
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: GRAFIK LINTASAN TIAP FITUR PER WAKTU (TRAJECTORY CHARTS)          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'trajectory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Header Bar: Summary Metrics & Controls */}
          <div style={{
            background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: '16px 20px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0F2027', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fa-solid fa-wave-square" style={{ color: 'var(--teal, #00A896)' }} />
                    Grafik Lintasan Temporal Fitur Fisiologis & Regulasi Otonom
                  </h3>
                  {summaryStats && summaryStats.minDate && (
                    <span style={{
                      background: '#0F2027', color: '#4EECD6', padding: '3px 10px',
                      borderRadius: 20, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5
                    }}>
                      <i className="fa-solid fa-calendar-days" />
                      {summaryStats.minDate === summaryStats.maxDate ? summaryStats.minDate : `${summaryStats.minDate} s/d ${summaryStats.maxDate}`}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                  Evolusi dinamika time-series beat-to-beat dan window agregasi dari waktu ke waktu untuk pasien <strong>{selectedUser?.name || 'Pasien'}</strong>.
                </p>
              </div>

              {/* View Filters, Date Filter & Limit */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                
                {/* Feature View Switcher */}
                <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  {[
                    { id: 'ALL', label: 'Semua Lintasan' },
                    { id: 'HR', label: 'HR & Delta' },
                    { id: 'HRV', label: 'HRV (RMSSD/SDNN)' },
                    { id: 'DFA', label: 'Fraktal DFA α1' },
                    { id: 'DEVIATION', label: 'Skor Deviasi D(t)' },
                  ].map(btn => (
                    <button
                      key={btn.id}
                      onClick={() => setFeatureTrackView(btn.id)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11.5,
                        fontWeight: featureTrackView === btn.id ? 800 : 600, cursor: 'pointer',
                        background: featureTrackView === btn.id ? '#FFFFFF' : 'transparent',
                        color: featureTrackView === btn.id ? '#0F2027' : '#64748B',
                        boxShadow: featureTrackView === btn.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      }}>
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Date Dropdown Filter */}
                <select
                  value={selectedDateFilter}
                  onChange={e => setSelectedDateFilter(e.target.value)}
                  style={{
                    padding: '5px 10px', borderRadius: 8, border: '1.5px solid #00A896',
                    fontSize: 11.5, fontWeight: 700, background: '#E6FFFA', color: '#006D63'
                  }}>
                  <option value="ALL">📅 Semua Tanggal ({availableDates.length} Hari)</option>
                  {availableDates.map(dStr => (
                    <option key={dStr} value={dStr}>📅 Tanggal {dStr}</option>
                  ))}
                </select>

                {/* Sample Limit */}
                <select
                  value={segmentLimit}
                  onChange={e => setSegmentLimit(Number(e.target.value))}
                  style={{
                    padding: '5px 10px', borderRadius: 8, border: '1px solid #CBD5E1',
                    fontSize: 11.5, fontWeight: 700, background: '#F8FAFC', color: '#0F2027'
                  }}>
                  <option value={50}>50 Window Terakhir</option>
                  <option value={100}>100 Window Terakhir</option>
                  <option value={150}>150 Window Terakhir</option>
                </select>
              </div>
            </div>

            {/* Summary Stat Cards */}
            {summaryStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', padding: '10px 12px', borderRadius: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0369A1' }}>RATA-RATA HR</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#0284C7' }}>{summaryStats.avgHr} <span style={{ fontSize: 11 }}>bpm</span></div>
                  <div style={{ fontSize: 10, color: '#0284C7' }}>Min: {summaryStats.minHr} | Max: {summaryStats.maxHr}</div>
                </div>

                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '10px 12px', borderRadius: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#065F46' }}>VAGAL TONE (RMSSD)</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#059669' }}>{summaryStats.avgRmssd} <span style={{ fontSize: 11 }}>ms</span></div>
                  <div style={{ fontSize: 10, color: '#059669' }}>Modulasi Parasimpatis</div>
                </div>

                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '10px 12px', borderRadius: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#92400E' }}>DFA &alpha;1 (FRAKTAL)</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#D97706' }}>{summaryStats.avgDfa}</div>
                  <div style={{ fontSize: 10, color: '#D97706' }}>Ideal: 0.90 – 1.10</div>
                </div>

                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 12px', borderRadius: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#991B1B' }}>PEAK DEVIATION D(t)</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#E11D48' }}>{summaryStats.maxScore}</div>
                  <div style={{ fontSize: 10, color: '#E11D48' }}>{summaryStats.alertCount} Alert · {summaryStats.cautionCount} Caution</div>
                </div>

                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px 12px', borderRadius: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>TOTAL OBSERVASI</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A' }}>{summaryStats.totalPoints} <span style={{ fontSize: 11 }}>window</span></div>
                  <div style={{ fontSize: 10, color: '#64748B' }}>{summaryStats.minDate} {summaryStats.minDate !== summaryStats.maxDate ? `– ${summaryStats.maxDate}` : ''}</div>
                </div>
              </div>
            )}
          </div>

          {loadingSegments ? (
            <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 60, textAlign: 'center', color: '#64748B' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 10, color: 'var(--teal, #00A896)' }} />
              <div>Memuat lintasan data sensor time-series...</div>
            </div>
          ) : activeChartData.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 60, textAlign: 'center', color: '#64748B', border: '1px solid #E2E8F0' }}>
              <i className="fa-solid fa-calendar-xmark" style={{ fontSize: 32, marginBottom: 12, color: '#CBD5E1' }} />
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {selectedDateFilter === 'ALL'
                  ? 'Belum ada data segmen time-series untuk pasien ini.'
                  : `Tidak ada rekaman data pada tanggal ${selectedDateFilter}.`}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {selectedDateFilter !== 'ALL' && (
                  <button
                    onClick={() => setSelectedDateFilter('ALL')}
                    style={{ marginTop: 8, padding: '4px 12px', borderRadius: 6, border: '1px solid #00A896', background: '#E6FFFA', color: '#00A896', fontWeight: 800, cursor: 'pointer' }}>
                    Tampilkan Semua Tanggal
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              
              {/* ── TRACK 1: Heart Rate (HR) & Delta HR Lintasan ── */}
              {(featureTrackView === 'ALL' || featureTrackView === 'HR') && (
                <div style={{
                  background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 900, color: '#0284C7', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <i className="fa-solid fa-heart-pulse" />
                        Lintasan 1: Heart Rate (bpm) & Delta HR (Perubahan Kecepatan Denyut)
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Respons chronotropic adaptif terhadap aktivitas & deviasi terhadap baseline personal. Sumbu X menampilkan Tanggal (DD/MM) dan Jam (HH:mm).
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 700 }}>
                      <span style={{ color: '#0284C7' }}>— Mean HR (bpm)</span>
                      <span style={{ color: '#38BDF8' }}>- - Delta HR (bpm)</span>
                    </div>
                  </div>

                  <div style={{ height: 230, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={activeChartData} syncId="autonomic-trajectory" margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="displayLabel" tick={{ fontSize: 10, fill: '#64748B' }} minTickGap={35} />
                        <YAxis domain={['dataMin - 5', 'dataMax + 10']} tick={{ fontSize: 10, fill: '#64748B' }} />
                        <Tooltip content={<TrajectoryCustomTooltip />} />
                        <ReferenceLine y={100} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Tachycardia (100 bpm)', fill: '#EF4444', fontSize: 10, position: 'insideTopRight' }} />
                        <ReferenceLine y={60} stroke="#3B82F6" strokeDasharray="3 3" label={{ value: 'Bradycardia (60 bpm)', fill: '#3B82F6', fontSize: 10, position: 'insideBottomRight' }} />
                        <Area type="monotone" dataKey="hr" fill="url(#hrGrad)" stroke="#0284C7" strokeWidth={2.5} name="Mean HR" />
                        <Line type="monotone" dataKey="deltaHr" stroke="#38BDF8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Delta HR" />
                        <defs>
                          <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0284C7" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#0284C7" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── TRACK 2: HRV (RMSSD & SDNN) Vagal Tone Lintasan ── */}
              {(featureTrackView === 'ALL' || featureTrackView === 'HRV') && (
                <div style={{
                  background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 900, color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <i className="fa-solid fa-wave-square" />
                        Lintasan 2: Vagal Dynamics & Heart Rate Variability (RMSSD / SDNN)
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Refleksi reaktivasi modulasi parasimpatis saat transisi fase deviasi ke fase pemulihan (homeostasis). Sumbu X menampilkan Tanggal dan Waktu.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 700 }}>
                      <span style={{ color: '#059669' }}>— RMSSD (ms)</span>
                      <span style={{ color: '#10B981' }}>- - SDNN (ms)</span>
                    </div>
                  </div>

                  <div style={{ height: 220, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={activeChartData} syncId="autonomic-trajectory" margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="displayLabel" tick={{ fontSize: 10, fill: '#64748B' }} minTickGap={35} />
                        <YAxis domain={['dataMin - 5', 'dataMax + 10']} tick={{ fontSize: 10, fill: '#64748B' }} />
                        <Tooltip content={<TrajectoryCustomTooltip />} />
                        <ReferenceLine y={25} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: 'Low Vagal Envelope (25 ms)', fill: '#D97706', fontSize: 10, position: 'insideBottomRight' }} />
                        <Area type="monotone" dataKey="rmssd" fill="url(#rmssdGrad)" stroke="#059669" strokeWidth={2.5} name="RMSSD (ms)" />
                        <Line type="monotone" dataKey="sdnn" stroke="#10B981" strokeWidth={1.8} strokeDasharray="3 3" dot={false} name="SDNN (ms)" />
                        <defs>
                          <linearGradient id="rmssdGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── TRACK 3: Fractal Complexity Scaling DFA alpha1 ── */}
              {(featureTrackView === 'ALL' || featureTrackView === 'DFA') && (
                <div style={{
                  background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 900, color: '#D97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <i className="fa-solid fa-circle-nodes" />
                        Lintasan 3: Non-linear Autonomic Fractal Scaling (DFA &alpha;1)
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Detrended Fluctuation Analysis (&alpha;1 &asymp; 1.0 = normal 1/f pink noise, &gt; 1.35 = loss of fractal complexity).
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 700 }}>
                      <span style={{ color: '#D97706' }}>— DFA &alpha;1 Exponent</span>
                      <span style={{ color: '#10B981' }}>-- Homeostasis Sehat (1.00)</span>
                    </div>
                  </div>

                  <div style={{ height: 210, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={activeChartData} syncId="autonomic-trajectory" margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="displayLabel" tick={{ fontSize: 10, fill: '#64748B' }} minTickGap={35} />
                        <YAxis domain={[0.4, 1.7]} tick={{ fontSize: 10, fill: '#64748B' }} />
                        <Tooltip content={<TrajectoryCustomTooltip />} />
                        <ReferenceArea y1={0.85} y2={1.15} fill="#10B981" fillOpacity={0.08} />
                        <ReferenceLine y={1.0} stroke="#10B981" strokeWidth={1.5} label={{ value: 'Sehat (1.0)', fill: '#059669', fontSize: 10, position: 'insideTopLeft' }} />
                        <ReferenceLine y={1.35} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Rigid / Autonomic Stress (>1.35)', fill: '#DC2626', fontSize: 10, position: 'insideTopRight' }} />
                        <Line type="monotone" dataKey="dfa" stroke="#D97706" strokeWidth={2.2} dot={{ r: 2, fill: '#D97706' }} name="DFA alpha1" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── TRACK 4: Composite Deviation Score D(t) & Z-Scores ── */}
              {(featureTrackView === 'ALL' || featureTrackView === 'DEVIATION') && (
                <div style={{
                  background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 900, color: '#E11D48', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <i className="fa-solid fa-gauge-high" />
                        Lintasan 4: Composite Deviation Score D(t) & Z-Score Components
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Beban deviasi terbobot integrasi w1|Z_HR| + w2|Z_dHR| + w3|Z_DFA| terhadap baseline kontekstual.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 700 }}>
                      <span style={{ color: '#E11D48' }}>— Skor Deviasi D(t)</span>
                      <span style={{ color: '#FB7185' }}>- - Z-Score HR</span>
                      <span style={{ color: '#F59E0B' }}>· · Z-Score DFA</span>
                    </div>
                  </div>

                  <div style={{ height: 210, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={activeChartData} syncId="autonomic-trajectory" margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="displayLabel" tick={{ fontSize: 10, fill: '#64748B' }} minTickGap={35} />
                        <YAxis domain={[0, 'dataMax + 1.5']} tick={{ fontSize: 10, fill: '#64748B' }} />
                        <Tooltip content={<TrajectoryCustomTooltip />} />
                        <ReferenceLine y={2.0} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Caution (Tau = 2.0)', fill: '#D97706', fontSize: 10, position: 'insideTopLeft' }} />
                        <ReferenceLine y={3.5} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Alert Anomaly (Tau = 3.5)', fill: '#DC2626', fontSize: 10, position: 'insideTopRight' }} />
                        <Area type="monotone" dataKey="anomalyScore" fill="url(#scoreGrad)" stroke="#E11D48" strokeWidth={2.5} name="Skor Deviasi D(t)" />
                        <Line type="monotone" dataKey="zHr" stroke="#FB7185" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Z-Score HR" />
                        <Line type="monotone" dataKey="zDfa" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="2 2" dot={false} name="Z-Score DFA" />
                        <defs>
                          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#E11D48" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#E11D48" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── TRACK 5: State Machine & Activity Sequential Ribbon (Synchronized Bar) ── */}
              <div style={{
                background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 900, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="fa-solid fa-timeline" />
                      Lintasan 5: State Machine Homeostasis & Sekuensi Transisi FSM
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      Sumbu waktu tersinkronisasi presisi 1-ke-1 dengan grafik denyut jantung, HRV, dan skor deviasi di atasnya.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 10.5, fontWeight: 700, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: STATE_COLORS.BASELINE_COMPATIBLE }} /> Normal (Baseline)</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: STATE_COLORS.DEVIATION_CANDIDATE }} /> Deviation Candidate</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: STATE_COLORS.PERSISTENT_DEVIATION }} /> Persistent</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: STATE_COLORS.RECOVERY }} /> Recovery</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: STATE_COLORS.RELAPSE }} /> Relapse</span>
                  </div>
                </div>

                <div style={{ height: 115, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activeChartData} syncId="autonomic-trajectory" margin={{ top: 5, right: 20, left: -10, bottom: 0 }} barCategoryGap={1}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="displayLabel" tick={{ fontSize: 10, fill: '#64748B' }} minTickGap={35} />
                      <YAxis domain={[0, 1]} hide />
                      <Tooltip content={<TrajectoryCustomTooltip />} />
                      <Bar dataKey={() => 1} isAnimationActive={false} name="Status FSM">
                        {activeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STATE_COLORS[entry.state] || '#10B981'} />
                        ))}
                      </Bar>
                      <Brush dataKey="displayLabel" height={24} stroke="#CBD5E1" fill="#F8FAFC" tickFormatter={v => v} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: MATRIKS RINGKAS Q1–Q10 (TABLE VIEW DARI BAGIAN 4)              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div style={{
            background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0',
            overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #E2E8F0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F2027' }}>
                  Matriks 10 Pertanyaan Inti Regulasi Otonom (Q1–Q10)
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: 12, color: '#64748B' }}>
                  Struktur evidence, metrik inti, dan tingkatan hierarki analisis data log wearable.
                </p>
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedFilterCategory(cat)}
                    style={{
                      padding: '4px 9px', borderRadius: 6, border: '1px solid',
                      fontSize: 11, fontWeight: selectedFilterCategory === cat ? 800 : 600,
                      cursor: 'pointer',
                      borderColor: selectedFilterCategory === cat ? 'var(--teal, #00A896)' : '#E2E8F0',
                      background: selectedFilterCategory === cat ? '#E6FFFA' : '#F8FAFC',
                      color: selectedFilterCategory === cat ? 'var(--teal, #00A896)' : '#64748B',
                    }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 800 }}>
                    <th style={{ padding: '12px 16px', width: 60, textAlign: 'center' }}>Q</th>
                    <th style={{ padding: '12px 16px', minWidth: 220 }}>Pertanyaan Regulasi Otonom</th>
                    <th style={{ padding: '12px 16px', minWidth: 240 }}>Evidence Utama (Data Log)</th>
                    <th style={{ padding: '12px 16px', minWidth: 200 }}>Metrik Inti Keluaran</th>
                    <th style={{ padding: '12px 16px', minWidth: 140 }}>Level Analisis</th>
                    <th style={{ padding: '12px 16px', width: 100, textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map((row, idx) => (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                        transition: 'background .1s'
                      }}>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          background: `${row.color}15`, color: row.color,
                          padding: '3px 8px', borderRadius: 6, fontWeight: 900, fontSize: 11
                        }}>
                          {row.id}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1E293B' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <i className={`fa-solid ${row.icon}`} style={{ color: row.color, fontSize: 13 }} />
                          <span>{row.title}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155', fontFamily: 'monospace', fontSize: 11.5 }}>
                        {row.evidence}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: 600 }}>
                        {row.metrics}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: '#F1F5F9', color: '#475569', padding: '3px 8px',
                          borderRadius: 12, fontSize: 11, fontWeight: 700, border: '1px solid #E2E8F0'
                        }}>
                          {row.level}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            setExpandedQ(row.id);
                            setActiveTab('q1-q10');
                          }}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: `1px solid ${row.color}`,
                            background: '#FFFFFF', color: row.color, fontSize: 11, fontWeight: 700,
                            cursor: 'pointer', transition: 'all .15s'
                          }}>
                          Edit / Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: FORM & INPUT JAWABAN Q1–Q10                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'q1-q10' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
          
          {/* Sidebar Nav Q1-Q10 */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#64748B', marginBottom: 8, padding: '0 6px', textTransform: 'uppercase' }}>
              Daftar Pertanyaan Q1–Q10
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Q_FRAMEWORK.map(q => {
                const isSel = expandedQ === q.id;
                return (
                  <button
                    key={q.id}
                    onClick={() => setExpandedQ(q.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                      borderRadius: 8, border: isSel ? `1.5px solid ${q.color}` : '1px solid transparent',
                      background: isSel ? `${q.color}10` : 'transparent',
                      color: isSel ? q.color : '#334155',
                      fontWeight: isSel ? 800 : 600, fontSize: 12, cursor: 'pointer', textAlign: 'left',
                      transition: 'all .12s'
                    }}>
                    <span style={{
                      background: isSel ? q.color : '#E2E8F0', color: isSel ? '#fff' : '#64748B',
                      padding: '2px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 900
                    }}>
                      {q.id}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {q.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Q Detail & Input Card */}
          {(() => {
            const currentQ = Q_FRAMEWORK.find(q => q.id === expandedQ) || Q_FRAMEWORK[0];
            const currentAns = answers[currentQ.id] || {
              answer_label: currentQ.defaultAnswer,
              narrative: currentQ.exampleXAI,
              confidence: 'tinggi'
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Header Card */}
                <div style={{
                  background: '#FFFFFF', borderRadius: 12, border: `1.5px solid ${currentQ.color}40`,
                  padding: 22, boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        background: currentQ.color, color: '#FFFFFF', padding: '4px 10px',
                        borderRadius: 6, fontWeight: 900, fontSize: 13
                      }}>
                        {currentQ.id}
                      </span>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0F2027' }}>
                        {currentQ.title}
                      </h2>
                    </div>
                    <span style={{
                      background: `${currentQ.color}15`, color: currentQ.color, padding: '4px 10px',
                      borderRadius: 20, fontSize: 11, fontWeight: 800
                    }}>
                      Level: {currentQ.level}
                    </span>
                  </div>

                  {/* 4 Pillars Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
                    <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                        <i className="fa-solid fa-database" style={{ marginRight: 5, color: currentQ.color }} />DATA LOG UTAMA
                      </div>
                      <div style={{ fontSize: 12, color: '#1E293B', fontFamily: 'monospace' }}>
                        {currentQ.dataLog.join(', ')}
                      </div>
                    </div>

                    <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                        <i className="fa-solid fa-code-branch" style={{ marginRight: 5, color: currentQ.color }} />VARIABEL TURUNAN
                      </div>
                      <div style={{ fontSize: 12, color: '#1E293B' }}>
                        {currentQ.derivedVars}
                      </div>
                    </div>

                    <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                        <i className="fa-solid fa-square-poll-vertical" style={{ marginRight: 5, color: currentQ.color }} />METRIK KELUARAN XAI
                      </div>
                      <div style={{ fontSize: 12, color: '#1E293B', fontFamily: 'monospace' }}>
                        {currentQ.outputXAI.join(', ')}
                      </div>
                    </div>
                  </div>

                  {/* Formula / Rules Box */}
                  <div style={{
                    marginTop: 16, background: '#0F172A', color: '#F8FAFC',
                    borderRadius: 8, padding: '14px 18px', border: '1px solid #334155'
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#38BDF8', marginBottom: 6, textTransform: 'uppercase' }}>
                      <i className="fa-solid fa-calculator" style={{ marginRight: 6 }} />Perhitungan & Aturan Inferensi
                    </div>
                    <pre style={{
                      margin: 0, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6,
                      whiteSpace: 'pre-wrap', color: '#E2E8F0'
                    }}>
                      {currentQ.formula}
                    </pre>
                  </div>

                  {/* Interactive Editable Answer for this Q */}
                  <div style={{
                    marginTop: 18, background: '#F8FAFC', border: '1.5px solid #CBD5E1',
                    borderRadius: 10, padding: '16px 18px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <label style={{ fontSize: 12.5, fontWeight: 800, color: '#0F2027' }}>
                        <i className="fa-solid fa-pen-to-square" style={{ marginRight: 6, color: currentQ.color }} />
                        Hasil / Jawaban Evaluasi untuk Pasien Ini ({selectedUser?.name || 'Pasien'}):
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0',
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                          display: 'flex', alignItems: 'center', gap: 5
                        }}>
                          <i className="fa-solid fa-shield-check" style={{ color: '#059669' }} />
                          Tingkat Keyakinan: Tinggi (Quality Gate Verified)
                        </span>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={currentAns.answer_label || ''}
                      onChange={e => handleAnswerChange(currentQ.id, 'answer_label', e.target.value)}
                      placeholder={`Contoh: ${currentQ.defaultAnswer}`}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1',
                        fontSize: 12.5, fontWeight: 600, marginBottom: 8, boxSizing: 'border-box'
                      }}
                    />

                    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                      Narasi Penjelasan Lengkap (Audit Trail XAI):
                    </label>
                    <textarea
                      rows={3}
                      value={currentAns.narrative || ''}
                      onChange={e => handleAnswerChange(currentQ.id, 'narrative', e.target.value)}
                      placeholder="Masukkan catatan naratif hasil audit..."
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1',
                        fontSize: 12, lineHeight: 1.5, boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Why Explainable & Limitations */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px 14px', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#15803D', marginBottom: 4 }}>
                        <i className="fa-solid fa-check-double" style={{ marginRight: 5 }} />MENGAPA SISTEM DAPAT MENJELASKAN?
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#166534', lineHeight: 1.5 }}>
                        {currentQ.whyExplainable}
                      </p>
                    </div>

                    <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', padding: '12px 14px', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#BE123C', marginBottom: 4 }}>
                        <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 5 }} />KETERBATASAN INTERPRETASI
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#9F1239', lineHeight: 1.5 }}>
                        {currentQ.limitations}
                      </p>
                    </div>
                  </div>

                </div>

              </div>
            );
          })()}

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: PETA 5 FENOTIPE KANDIDAT & KLASIFIKASI PASIEN                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'phenotypes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Candidate Selector Box */}
          <div style={{
            background: '#FFFFFF', borderRadius: 12, border: '1.5px solid var(--teal, #00A896)',
            padding: 20, boxShadow: '0 4px 14px rgba(0, 168, 150, 0.08)'
          }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 900, color: '#0F2027' }}>
              Klasifikasi Fenotipe Kandidat untuk Pasien ({selectedUser?.name || 'Pasien'})
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: 12, color: '#64748B' }}>
              Tentukan kandidat fenotipe regulasi otonom berdasarkan evaluasi rantai bukti Q1 hingga Q9.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: '#0F2027', display: 'block', marginBottom: 5 }}>
                  Pilih Taksonomi Fenotipe:
                </label>
                <select
                  value={candidatePhenotype}
                  onChange={e => setCandidatePhenotype(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1',
                    fontSize: 13, fontWeight: 700, background: '#F8FAFC', color: '#0F2027'
                  }}>
                  {CANDIDATE_PHENOTYPES.map(p => (
                    <option key={p.name} value={p.name}>{p.name} ({p.badge})</option>
                  ))}
                  <option value="Pending Evaluation">Pending Evaluation</option>
                  <option value="Other">Lainnya (Other)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: '#0F2027', display: 'block', marginBottom: 5 }}>
                  Catatan Evaluasi Klinis:
                </label>
                <input
                  type="text"
                  value={clinicalNotes}
                  onChange={e => setClinicalNotes(e.target.value)}
                  placeholder="Catatan tambahan untuk dokter / peneliti..."
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1',
                    fontSize: 12.5, boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: 22 }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 800, color: '#0F2027' }}>
              Taksonomi 5 Kandidat Fenotipe Regulasi Otonom Longitudinal
            </h3>
            <p style={{ margin: '0 0 18px 0', fontSize: 12.5, color: '#64748B' }}>
              Hasil sintesis vektor komprehensif $\Phi = [F, M, D, R, S, C, T, K, U]$ dari agregasi bukti Q1 hingga Q9.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
              {CANDIDATE_PHENOTYPES.map(p => {
                const isSelected = candidatePhenotype === p.name;
                return (
                  <div
                    key={p.name}
                    onClick={() => setCandidatePhenotype(p.name)}
                    style={{
                      background: p.bg, border: isSelected ? `2px solid ${p.color}` : `1.5px solid ${p.border}`,
                      borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column',
                      justifyContent: 'space-between', cursor: 'pointer', transition: 'all .15s',
                      boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : 'none'
                    }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 900, fontSize: 14, color: p.color }}>
                          {p.name}
                        </span>
                        <span style={{
                          background: '#FFFFFF', color: p.color, border: `1px solid ${p.border}`,
                          padding: '2px 8px', borderRadius: 12, fontSize: 10.5, fontWeight: 800
                        }}>
                          {p.badge}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: '#334155', lineHeight: 1.6 }}>
                        {p.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vektor Phi Formula */}
          <div style={{
            background: 'linear-gradient(135deg, #1E293B, #0F172A)', borderRadius: 12,
            padding: '20px 24px', color: '#FFFFFF', border: '1px solid #334155'
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 800, color: '#38BDF8' }}>
              Vektor Konstruksi Fenotipe: $\Phi = [F, M, D, R, S, C, T, K, U]$
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 12 }}>
              {[
                { k: 'F', label: 'Frequency (Q1)', key: 'F', desc: 'Tingkat frekuensi kemunculan episode' },
                { k: 'M', label: 'Magnitude (Q2)', key: 'M', desc: 'Besar deviasi Z-score & Peak D' },
                { k: 'D', label: 'Duration (Q3)', key: 'D', desc: 'Lama deviasi bertahan & persistensi' },
                { k: 'R', label: 'Recovery (Q4)', key: 'R', desc: 'Kinetik TTR, slope & velocity' },
                { k: 'S', label: 'Stability (Q5)', key: 'S', desc: 'Tingkat kekambuhan & relapse rate' },
                { k: 'C', label: 'Context (Q6)', key: 'C', desc: 'Kesesuaian respon terhadap gerak' },
                { k: 'T', label: 'Time-of-day (Q7)', key: 'T', desc: 'Variasi sirkadian pagi vs malam' },
                { k: 'K', label: 'Consistency (Q8)', key: 'K', desc: 'Pengulangan & CV lintas hari' },
                { k: 'U', label: 'Unexplained (Q9)', key: 'U', desc: 'Beban deviasi tanpa pemicu fisik' },
              ].map(item => (
                <div key={item.k} style={{ background: 'rgba(255,255,255,0.06)', padding: '8px 10px', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 900, color: '#4EECD6', fontSize: 12 }}>{item.k}: {item.label}</span>
                  </div>
                  <input
                    type="text"
                    value={phenotypeVector[item.key] || ''}
                    onChange={e => setPhenotypeVector(prev => ({ ...prev, [item.key]: e.target.value }))}
                    style={{
                      width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(0,0,0,0.3)', color: '#FFFFFF', fontSize: 11, marginTop: 4, boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: DATA CONTRACT & ARSITEKTUR (BAGIAN 2 & 3 & 6)                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'contract' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: 22 }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 800, color: '#0F2027' }}>
              Data Contract Minimum (10 Kelompok Field Log)
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 12.5, color: '#64748B' }}>
              Spesifikasi minimum data mentah dan turunan yang wajib tersedia untuk menjalankan pipeline XAI regulasi otonom.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 800 }}>
                    <th style={{ padding: '10px 14px', width: 140 }}>Kelompok</th>
                    <th style={{ padding: '10px 14px', minWidth: 260 }}>Field Data Log</th>
                    <th style={{ padding: '10px 14px' }}>Peran Fisiologis & Komputasi</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { g: 'Waktu', f: 'timestamp, date, time_of_day', p: 'Menentukan urutan temporal, periode pagi-siang-sore-malam, dan analisis lintas hari.' },
                    { g: 'Fisiologi', f: 'HR, RR, RMSSD/SDNN, DFA alpha1', p: 'Mewakili observasi fisiologis dan perubahan beat-to-beat / modulasi otonom.' },
                    { g: 'Aktivitas', f: 'ACC, motion_intensity, steps', p: 'Membedakan respons fisiologis akibat aktivitas dari deviasi yang tidak dijelaskan oleh motion.' },
                    { g: 'Konteks', f: 'duduk, berdiri, berjalan, tidur, dll.', p: 'Menentukan baseline dan target operating region yang sesuai konteks personal.' },
                    { g: 'Kualitas', f: 'quality_score, valid_window, artifact_flag', p: 'Mencegah inferensi dari sinyal yang mengandung artefak atau tidak layak.' },
                    { g: 'Baseline', f: 'baseline_mature, mean_context, sd_context', p: 'Menjadi referensi personal-contextual untuk menghitung skor deviasi.' },
                    { g: 'Deviasi', f: 'z_hr, z_dhr, z_dfa, deviation_score', p: 'Menentukan besar penyimpangan terbobot terhadap baseline aktif.' },
                    { g: 'State', f: 'stable, deviation, persistent, recovery, relapse', p: 'Menyatakan posisi sistem dalam trajectory regulasi homeostasis.' },
                    { g: 'Episode', f: 'episode_id, onset, peak, recovery_start, recovered_at', p: 'Menggabungkan baris log menjadi unit kejadian fisiologis terisolasi.' },
                    { g: 'Ground truth', f: 'EMA, event_marker, clinical_marker', p: 'Memberi penjelasan konteks subjektif atau validasi eksternal terhadap episode.' },
                  ].map((row, i) => (
                    <tr key={row.g} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0F2027' }}>{row.g}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0369A1' }}>{row.f}</td>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>{row.p}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Hierarki Inferensi */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', padding: 22 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 800, color: '#0F2027' }}>
              Hierarki Inferensi 6 Tingkat
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {[
                { lvl: '1. Sample', desc: 'Raw Polar HR/RR' },
                { lvl: '2. Window', desc: '1-min Aggregate' },
                { lvl: '3. State', desc: 'FSM Transition' },
                { lvl: '4. Episode', desc: 'Q1–Q6 Events' },
                { lvl: '5. Day', desc: 'Q7–Q8 Diurnal' },
                { lvl: '6. Person', desc: 'Q9–Q10 Phenotype' },
              ].map((h, idx, arr) => (
                <React.Fragment key={h.lvl}>
                  <div style={{
                    background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 8,
                    padding: '8px 12px', textAlign: 'center'
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 12, color: '#0F2027' }}>{h.lvl}</div>
                    <div style={{ fontSize: 10.5, color: '#64748B' }}>{h.desc}</div>
                  </div>
                  {idx < arr.length - 1 && <i className="fa-solid fa-arrow-right" style={{ color: '#94A3B8', fontSize: 11 }} />}
                </React.Fragment>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
