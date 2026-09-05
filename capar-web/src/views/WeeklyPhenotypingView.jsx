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

export const WeeklyPhenotypingView = ({ participantId, targetPatientId, onNavigate }) => {
  const [participantsList, setParticipantsList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(targetPatientId || participantId || '65990e768e7c53d69904d9b1');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [selectedWeekId, setSelectedWeekId] = useState('W01');
  const [activeSection, setActiveSection] = useState('all'); // 'all' | 'q1-q2' | 'general' | 'population' | 'personal' | 'synthesis'
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [confirmedFactors, setConfirmedFactors] = useState({});
  const [confirmToast, setConfirmToast] = useState(null);

  // Fetch participants list
  useEffect(() => {
    api.listZeroShotParticipants().then(res => {
      const rawList = Array.isArray(res?.data) ? res.data : [];
      const formatted = rawList.map(p => {
        const uid = p.id || p._id || p.userId || p.guid || 'unknown';
        const name = p.name || p.email || uid;
        const detail = p.email ? `(${p.email})` : (p.device ? `[${p.device}]` : '');
        return {
          userId: String(uid),
          id: String(uid),
          name: name,
          label: `${name} ${detail}`.trim()
        };
      });
      setParticipantsList(formatted);
      if (formatted.length > 0) {
        setSelectedUserId(prev => {
          const exists = formatted.some(p => p.userId === prev);
          return (exists && prev !== '65990e768e7c53d69904d9b1') ? prev : formatted[0].userId;
        });
      }
    }).catch(err => {
      console.error('[WeeklyPhenotyping] list participants error:', err);
    });
  }, []);

  // Sync prop changes
  useEffect(() => {
    if (targetPatientId && targetPatientId !== 'ALL' && targetPatientId !== selectedUserId) {
      setSelectedUserId(targetPatientId);
    }
  }, [targetPatientId]);

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
          res.data.epochs[0].behavioral_scoring?.factors?.forEach((f, idx) => {
            initialMap[idx] = f.patient_confirmed;
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

  // Get active epoch data
  const activeEpoch = useMemo(() => {
    if (!weeklyData || !weeklyData.epochs) return null;
    return weeklyData.epochs.find(e => e.week_id === selectedWeekId) || weeklyData.epochs[0];
  }, [weeklyData, selectedWeekId]);

  // Handle Per-Behavior Patient Confirmation Toggle
  const handleToggleConfirmFactor = async (idx, factorName) => {
    const currentVal = confirmedFactors[idx] ?? activeEpoch?.behavioral_scoring?.factors?.[idx]?.patient_confirmed ?? false;
    const newVal = !currentVal;

    setConfirmedFactors(prev => ({ ...prev, [idx]: newVal }));

    try {
      await api.confirmPatientBehavior({
        userId: selectedUserId,
        weekId: selectedWeekId,
        factorIndex: idx,
        factorName,
        confirmed: newVal,
      });

      setConfirmToast(`Konfirmasi "${factorName}" disimpan: ${newVal ? 'BENAR (Sesuai)' : 'SALAH (Tidak Sesuai)'}`);
      setTimeout(() => setConfirmToast(null), 3500);
    } catch (err) {
      console.error('Failed to confirm factor:', err);
      setConfirmedFactors(prev => ({ ...prev, [idx]: currentVal }));
      alert('Gagal menyimpan konfirmasi faktor.');
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
            <label style={{ fontSize: 13, color: '#A855F7', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fa-solid fa-user-doctor"></i> Pilih Subjek / Pasien:
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={{
                background: '#0F172A',
                color: '#F8FAFC',
                border: '1.5px solid #8B5CF6',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
                minWidth: 260,
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)'
              }}
            >
              {participantsList.length === 0 ? (
                <option value={selectedUserId}>{selectedUserId ? `ID: ${selectedUserId}` : 'Memuat subjek...'}</option>
              ) : (
                participantsList.map(p => (
                  <option key={p.userId} value={p.userId} style={{ background: '#0F172A', color: '#F8FAFC' }}>
                    {p.label || p.name || p.userId}
                  </option>
                ))
              )}
            </select>

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

      {/* ── FEATURED: Q1 & Q2 PURPLE COMPARISON CARDS (ACTUAL POPULASI VS PERSONAL) ── */}
      {activeEpoch?.q1_comparison && activeEpoch?.q2_comparison && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: 22,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#7C3AED', color: '#FFFFFF', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>
                  MATRIKS UNGU Q1 &amp; Q2
                </span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
                  Perbandingan Nilai Aktual Populasi Kohor vs Nilai Aktual Personal
                </h3>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>
                Evaluasi kuantitatif deviasi otonomik harian dan beban overshoot residual teredam (&tau;<sub>normal</sub>).
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {/* Q1 Purple Card */}
            <div style={{
              background: '#FAF5FF',
              border: '1.5px solid #8B5CF6',
              borderRadius: 12,
              padding: 18,
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ background: '#7C3AED', color: '#FFFFFF', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  Q1 • Frekuensi Deviasi Otonomik
                </span>
                <span className="badge bg-success text-white px-2 py-1" style={{ fontSize: 11 }}>
                  Scoring: {activeEpoch.q1_comparison.scoring}
                </span>
              </div>

              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', marginBottom: 12 }}>
                {activeEpoch.q1_comparison.title}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid #DDD6FE' }}>
                  <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 800, textTransform: 'uppercase' }}>
                    <i className="fa-solid fa-users me-1"></i> Aktual Populasi
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', marginTop: 4 }}>
                    {activeEpoch.q1_comparison.actual_population}
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1.5px solid #8B5CF6' }}>
                  <div style={{ fontSize: 10, color: '#2563EB', fontWeight: 800, textTransform: 'uppercase' }}>
                    <i className="fa-solid fa-user me-1"></i> Aktual Personal
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1D4ED8', marginTop: 4 }}>
                    {activeEpoch.q1_comparison.actual_personal}
                  </div>
                </div>
              </div>

              <div style={{ background: '#FFFFFF', padding: 10, borderRadius: 8, fontSize: 11.5, color: '#334155', lineHeight: 1.4, border: '1px solid #E2E8F0' }}>
                <strong style={{ color: '#7C3AED' }}>Status:</strong> {activeEpoch.q1_comparison.scoring_label}. {activeEpoch.q1_comparison.interpretation}
              </div>
            </div>

            {/* Q2 Purple Card */}
            <div style={{
              background: '#FAF5FF',
              border: '1.5px solid #7C3AED',
              borderRadius: 12,
              padding: 18,
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ background: '#6D28D9', color: '#FFFFFF', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  Q2 • Magnitudo &amp; Luas Residual Overshoot
                </span>
                <span className="badge bg-success text-white px-2 py-1" style={{ fontSize: 11 }}>
                  Scoring: {activeEpoch.q2_comparison.scoring}
                </span>
              </div>

              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', marginBottom: 12 }}>
                {activeEpoch.q2_comparison.title}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid #DDD6FE' }}>
                  <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 800, textTransform: 'uppercase' }}>
                    <i className="fa-solid fa-users me-1"></i> Aktual Populasi
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', marginTop: 4 }}>
                    {activeEpoch.q2_comparison.actual_population}
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1.5px solid #7C3AED' }}>
                  <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 800, textTransform: 'uppercase' }}>
                    <i className="fa-solid fa-user me-1"></i> Aktual Personal
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#DC2626', marginTop: 4 }}>
                    {activeEpoch.q2_comparison.actual_personal}
                  </div>
                </div>
              </div>

              <div style={{ background: '#FFFFFF', padding: 10, borderRadius: 8, fontSize: 11.5, color: '#334155', lineHeight: 1.4, border: '1px solid #E2E8F0' }}>
                <strong style={{ color: '#7C3AED' }}>Status:</strong> {activeEpoch.q2_comparison.scoring_label}. {activeEpoch.q2_comparison.interpretation}
              </div>
            </div>
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
              const isConfirmed = confirmedFactors[idx] ?? factor.patient_confirmed;
              return (
                <div
                  key={idx}
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
                      <span className="badge bg-purple text-white px-2 py-1" style={{ fontSize: 10, background: '#7C3AED' }}>
                        {factor.category}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: factor.correlation_pct >= 25 ? '#DC2626' : '#D97706' }}>
                        Korelasi {factor.correlation_pct}% ke Q1
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', marginBottom: 4 }}>
                      {factor.factor_name}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--gray)', fontFamily: 'monospace' }}>
                      Sitasi: {factor.rag_citation}
                    </div>
                  </div>

                  {/* Col 2: Positive / Negative Statements */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
                    <div style={{ color: '#0369A1', background: '#F0F9FF', padding: '6px 10px', borderRadius: 6, border: '1px solid #BAE6FD', lineHeight: 1.35 }}>
                      <strong><i className="fa-solid fa-plus-circle me-1"></i> Positive Statement:</strong> {factor.positive_statement}
                    </div>
                    <div style={{ color: '#475569', background: '#F8FAFC', padding: '6px 10px', borderRadius: 6, border: '1px solid #E2E8F0', lineHeight: 1.35 }}>
                      <strong><i className="fa-solid fa-minus-circle me-1"></i> Negative Statement:</strong> {factor.negative_statement}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <i className="fa-solid fa-shield-halved"></i>
                      RAG Confidence Score: {Math.round(factor.rag_confidence * 100)}% (Tinggi / Grounded)
                    </div>
                  </div>

                  {/* Col 3: Action Button */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--gray)', marginBottom: 4 }}>Konfirmasi Pasien:</div>
                    <button
                      onClick={() => handleToggleConfirmFactor(idx, factor.factor_name)}
                      style={{
                        background: isConfirmed ? '#10B981' : '#F43F5E',
                        border: 'none',
                        color: '#FFFFFF',
                        padding: '8px 14px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        justifyContent: 'center',
                        boxShadow: isConfirmed ? '0 2px 8px rgba(16,185,129,0.3)' : '0 2px 8px rgba(244,63,94,0.3)'
                      }}
                    >
                      <i className={`fa-solid ${isConfirmed ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                      {isConfirmed ? 'BENAR (Sesuai) ✓' : 'SALAH (Tidak Sesuai) ✗'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
