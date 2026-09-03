/**
 * CardiovascularResilienceView.jsx
 * Cardiovascular Resilience State (CRS) Dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * Layer state estimation on top of CAPAR Engine:
 * 1. Clinical Vulnerability (CV, 20%)
 * 2. Cardiac Reserve (CR, 20%)
 * 3. Autonomic Reserve (AR, 25%)
 * 4. Recovery Capacity (RC, 20%)
 * 5. Regulation Stability (RS, 15%)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { calculateResilience, classify } from '../engines/resilienceEngine';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from 'recharts';

export function CardiovascularResilienceView({ targetPatientId }) {
  const defaultUserId = targetPatientId && targetPatientId !== 'ALL' ? targetPatientId : '6a6609326bf83196b1d73e97';
  const [selectedUserId, setSelectedUserId] = useState(defaultUserId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [resilienceData, setResilienceData] = useState(null);
  const [participantsList, setParticipantsList] = useState([]);
  const [selectedDimension, setSelectedDimension] = useState('clinical'); // 'clinical' | 'cardiac' | 'autonomic' | 'recovery' | 'stability'

  // Interactive state for simulation
  const [simState, setSimState] = useState({
    clinical: 76,
    cardiac: 84,
    autonomic: 88,
    recovery: 81,
    stability: 79
  });

  // Fetch participants
  useEffect(() => {
    api.listZeroShotParticipants().then(res => {
      setParticipantsList(res?.data || []);
    }).catch(() => {});
  }, []);

  // Sync prop changes
  useEffect(() => {
    if (targetPatientId && targetPatientId !== 'ALL' && targetPatientId !== selectedUserId) {
      setSelectedUserId(targetPatientId);
    }
  }, [targetPatientId]);

  // Load Resilience State
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCardiovascularResilienceState(selectedUserId);
      if (res?.data) {
        setResilienceData(res.data);
        const dims = res.data.dimensions || {};
        setSimState({
          clinical: dims.clinical?.score || 76,
          cardiac: dims.cardiac?.score || 84,
          autonomic: dims.autonomic?.score || 88,
          recovery: dims.recovery?.score || 81,
          stability: dims.stability?.score || 79
        });
      }
    } catch (err) {
      console.error('[CardiovascularResilienceView] Error:', err);
      setError('Gagal memuat Cardiovascular Resilience State.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedUserId]);

  // Calculate live global score
  const liveGlobalScore = useMemo(() => {
    return calculateResilience(simState);
  }, [simState]);

  const liveClassification = useMemo(() => {
    return classify(liveGlobalScore);
  }, [liveGlobalScore]);

  // Chart data for 5 dimensions
  const radarChartData = useMemo(() => {
    return [
      { subject: '1. Clinical Vulnerability', score: simState.clinical, benchmark: 80, fullMark: 100 },
      { subject: '2. Cardiac Reserve', score: simState.cardiac, benchmark: 75, fullMark: 100 },
      { subject: '3. Autonomic Reserve', score: simState.autonomic, benchmark: 85, fullMark: 100 },
      { subject: '4. Recovery Capacity', score: simState.recovery, benchmark: 80, fullMark: 100 },
      { subject: '5. Regulation Stability', score: simState.stability, benchmark: 85, fullMark: 100 },
    ];
  }, [simState]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 42, height: 42, border: '4px solid #E2E8F0', borderTopColor: '#0EA5E9', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 14, color: '#64748B', fontWeight: 700 }}>Memuat Cardiovascular Resilience State...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const engineStatus = resilienceData?.caparEngineStatus || {
    baseline: 'Mature',
    currentState: 'Recovery Phase',
    lastEpisodeTime: '14:32 WIB',
    recoveryTimeMin: 3.8,
    relapse: 'None',
    totalSegments: 269
  };

  const currentDimData = resilienceData?.dimensions?.[selectedDimension] || {};

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* ── TOP HEADER & PATIENT SELECTOR ─────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        paddingBottom: 18,
        borderBottom: '1px solid #E2E8F0'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
              color: '#FFFFFF',
              width: 38,
              height: 38,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)'
            }}>
              <i className="fa-solid fa-heart-circle-bolt" style={{ fontSize: 19 }}></i>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                Cardiovascular Resilience State (CRS)
              </h1>
              <span style={{ fontSize: 12.5, color: '#64748B' }}>
                State Estimation Layer Terintegrasi di atas CAPAR Engine (High-Level Phenotypic Resilience Trajectory)
              </span>
            </div>
          </div>
        </div>

        {/* User Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: '#DCFCE7',
            color: '#15803D',
            border: '1px solid #86EFAC',
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: 11.5,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }}></span>
            CAPAR Engine Active ({engineStatus.totalSegments} Segmen)
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', padding: '6px 12px', borderRadius: 10, border: '1px solid #CBD5E1' }}>
            <i className="fa-solid fa-user" style={{ color: '#0EA5E9', fontSize: 13 }}></i>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Subjek:</span>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontWeight: 800,
                fontSize: 13,
                color: '#0F172A',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="6a6609326bf83196b1d73e97">User 6a660932 (patient 27-30 Mei 2024)</option>
              <option value="67652725d40f2b664e88deb0">User 67652725 (patient - 1003 Segmen)</option>
              <option value="675ba1e92b8428e4dd641cd0">User 675ba1e9 (Dokter / Telemetri 390 Segmen)</option>
              {participantsList.filter(p => !['6a6609326bf83196b1d73e97', '67652725d40f2b664e88deb0', '675ba1e92b8428e4dd641cd0'].includes(p.userId)).map(p => (
                <option key={p.userId} value={p.userId}>{p.name} ({p.userId.slice(0, 8)}...)</option>
              ))}
            </select>
          </div>

          <button
            onClick={loadData}
            style={{
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              padding: '8px 14px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 12,
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <i className="fa-solid fa-arrows-rotate"></i>
            Refresh
          </button>
        </div>
      </div>

      {/* ── 1. MAIN RESILIENCE DASHBOARD BANNER ───────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        borderRadius: 16,
        padding: '24px 28px',
        color: '#FFFFFF',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: 24,
        alignItems: 'center'
      }}>
        {/* Left: Overall Score & Bar */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{
              background: liveClassification.bgColor,
              color: liveClassification.textColor,
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '0.05em'
            }}>
              STATE: {liveClassification.label}
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              Formula: CRS = 0.20·CV + 0.20·CR + 0.25·AR + 0.20·RC + 0.15·RS
            </span>
          </div>

          <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>
            Overall Cardiovascular Resilience Score
          </h2>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
            <span style={{
              fontSize: 52,
              fontWeight: 900,
              color: liveClassification.color,
              lineHeight: 1,
              letterSpacing: '-0.03em'
            }}>
              {liveGlobalScore}
            </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>/ 100</span>
          </div>

          {/* ASCII-like High-Resilience Bar Gauge */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              width: '100%',
              height: 12,
              background: 'rgba(255,255,255,0.12)',
              borderRadius: 6,
              overflow: 'hidden',
              display: 'flex'
            }}>
              <div style={{
                width: `${liveGlobalScore}%`,
                height: '100%',
                background: `linear-gradient(90deg, #0EA5E9, ${liveClassification.color})`,
                borderRadius: 6,
                transition: 'width 0.4s ease'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              <span>0 (Vulnerable)</span>
              <span>70 (Moderate)</span>
              <span>85 (High Resilience)</span>
              <span>100 (Optimal)</span>
            </div>
          </div>

          <p style={{ margin: '14px 0 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
            {liveClassification.description}
          </p>
        </div>

        {/* Right: CAPAR Engine Status Box */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 14,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '18px 20px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 13.5, fontWeight: 800, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-solid fa-microchip"></i>
            Status Engine CAPAR (Live Underlying Layer)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontSize: 10.5 }}>Baseline Sirkadian</span>
              <strong style={{ color: '#FFFFFF', fontSize: 12.5 }}>{engineStatus.baseline}</strong>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontSize: 10.5 }}>Current FSM State</span>
              <strong style={{ color: '#38BDF8', fontSize: 12.5 }}>{engineStatus.currentState}</strong>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontSize: 10.5 }}>Waktu Recovery (TTR)</span>
              <strong style={{ color: '#FBBF24', fontSize: 12.5 }}>{engineStatus.recoveryTimeMin} Menit</strong>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontSize: 10.5 }}>Status Relapse</span>
              <strong style={{ color: '#34D399', fontSize: 12.5 }}>{engineStatus.relapse}</strong>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Ambang FSM: &tau;<sub>in</sub>=1.86, &tau;<sub>out</sub>=1.18</span>
            <span>Last Episode: {engineStatus.lastEpisodeTime}</span>
          </div>
        </div>
      </div>

      {/* ── 2. 5 DIMENSIONAL MENU CARDS ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {[
          { id: 'clinical', num: '1', title: 'Clinical Vulnerability', score: simState.clinical, weight: 20, icon: 'fa-shield-heart', color: '#6366F1' },
          { id: 'cardiac', num: '2', title: 'Cardiac Reserve', score: simState.cardiac, weight: 20, icon: 'fa-heart-pulse', color: '#EC4899' },
          { id: 'autonomic', num: '3', title: 'Autonomic Reserve', score: simState.autonomic, weight: 25, icon: 'fa-dna', color: '#10B981' },
          { id: 'recovery', num: '4', title: 'Recovery Capacity', score: simState.recovery, weight: 20, icon: 'fa-person-walking-arrow-loop-left', color: '#F59E0B' },
          { id: 'stability', num: '5', title: 'Regulation Stability', score: simState.stability, weight: 15, icon: 'fa-sliders', color: '#0EA5E9' }
        ].map(item => {
          const isSelected = selectedDimension === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setSelectedDimension(item.id)}
              style={{
                background: '#FFFFFF',
                borderRadius: 14,
                border: isSelected ? `2px solid ${item.color}` : '1px solid #E2E8F0',
                padding: '16px 14px',
                cursor: 'pointer',
                boxShadow: isSelected ? `0 6px 16px ${item.color}20` : '0 2px 6px rgba(0,0,0,0.02)',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: item.color }}>
                    [{item.num}] Bobot {item.weight}%
                  </span>
                  <i className={`fa-solid ${item.icon}`} style={{ color: item.color, fontSize: 14 }}></i>
                </div>
                <strong style={{ fontSize: 13, color: '#0F172A', display: 'block', lineHeight: 1.3 }}>
                  {item.title}
                </strong>
              </div>

              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Score</span>
                <span style={{ fontSize: 24, fontWeight: 900, color: item.color }}>
                  {item.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 3. DETAILED ATTRIBUTES & SIMULATION SECTION ───────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: 24
      }}>
        
        {/* Left: Detail Atribut Dimensi Terpilih */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: 22,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                Detail Dimensi: {currentDimData.name || 'Clinical Vulnerability'}
              </h3>
              <span style={{ fontSize: 12, color: '#64748B' }}>
                Sumber: {currentDimData.source || 'Engine CAPAR'} • Interpretasi: <strong>{currentDimData.interpretation}</strong>
              </span>
            </div>
            <span style={{
              background: '#EEF2FF',
              color: '#4F46E5',
              fontSize: 12,
              fontWeight: 900,
              padding: '4px 10px',
              borderRadius: 8
            }}>
              Skor: {simState[selectedDimension]} / 100
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569', fontWeight: 700 }}>Atribut CAPAR / Klinis</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', color: '#475569', fontWeight: 700 }}>Nilai Pasien</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#475569', fontWeight: 700 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {currentDimData.attributes?.map((attr, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 12px', color: '#334155', fontWeight: 600 }}>{attr.label}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#0F172A' }}>{attr.value}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <span style={{
                      background: attr.status === 'Optimal' || attr.status === 'Normal' || attr.status === 'Good' || attr.status === 'None' || attr.status === 'Low' || attr.status === 'Aligned' || attr.status === 'Stable' ? '#DCFCE7' : '#FEF3C7',
                      color: attr.status === 'Optimal' || attr.status === 'Normal' || attr.status === 'Good' || attr.status === 'None' || attr.status === 'Low' || attr.status === 'Aligned' || attr.status === 'Stable' ? '#15803D' : '#B45309',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 800
                    }}>
                      {attr.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Slider for What-If Simulation */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed #E2E8F0' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Simulasi What-If Skor {currentDimData.name}:</span>
              <span style={{ color: '#0EA5E9', fontWeight: 800 }}>{simState[selectedDimension]} pts</span>
            </label>
            <input
              type="range"
              min="20"
              max="100"
              step="1"
              value={simState[selectedDimension]}
              onChange={(e) => setSimState({ ...simState, [selectedDimension]: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#0EA5E9' }}
            />
            <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 4 }}>
              Geser slider untuk melihat dampak perubahan dimensi terhadap Global Resilience Score seketika.
            </span>
          </div>
        </div>

        {/* Right: Radar Chart of 5 Dimensions */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: 22,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 800, color: '#0F172A', alignSelf: 'flex-start' }}>
            Profil Radar 5 Dimensi Resiliensi
          </h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarChartData}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Radar name="Skor Aktual Pasien" dataKey="score" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.4} />
                <Radar name="Benchmark Standar" dataKey="benchmark" stroke="#10B981" fill="#10B981" fillOpacity={0.15} />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
