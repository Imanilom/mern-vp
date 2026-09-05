import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { 
  Flag, Activity, Clock, Layers, Sparkles, CheckCircle2, AlertCircle,
  Calendar, ShieldAlert, ArrowRight, Zap, TrendingUp, Info, BarChart3, HelpCircle
} from 'lucide-react';

export const StateTimelineView = ({ participantId, globalDateFilter, onNavigate }) => {
  const [range, setRange] = useState('Day');
  const [annotations, setAnnotations] = useState([]);
  const [showAnnotateModal, setShowAnnotateModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  
  const [timelineData, setTimelineData] = useState(null);
  const [eventsList, setEventsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Selection state for annotation highlight & context transition drilldown
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [selectedContextLog, setSelectedContextLog] = useState(null);
  const [activeHierarchyTab, setActiveHierarchyTab] = useState('hierarchy'); // 'hierarchy' | 'damping' | 'blok1'

  useEffect(() => {
    if (participantId) {
      setLoading(true);
      Promise.all([
        api.getAnalyzedSegments(participantId, 500).catch(() => ({ data: [] })),
        api.getRecentEvents ? api.getRecentEvents(participantId, 50).catch(() => ({})) : Promise.resolve({})
      ]).then(([segmentsData, eventsData]) => {
        const segments = Array.isArray(segmentsData?.data) ? segmentsData.data : (Array.isArray(segmentsData) ? segmentsData : []);
        const events = Array.isArray(eventsData?.data) ? eventsData.data : (Array.isArray(eventsData) ? eventsData : []);
        setEventsList(events);

        // Build timeline riwayat from real segments
        let riwayat = segments.map(seg => {
           const startRaw = seg.createdAt || seg.window_start || Date.now();
           let startVal = startRaw;
           if (startVal && typeof startVal === 'object' && startVal.$date) startVal = startVal.$date;
           if (typeof startVal === 'number' && startVal < 20000000000) startVal *= 1000;
           const startDate = new Date(startVal);
           
           const endRaw = seg.window_end;
           let endVal = endRaw;
           if (typeof endVal === 'number' && endVal < 20000000000) endVal *= 1000;
           const endDate = endRaw ? new Date(endVal) : new Date(startDate.getTime() + 60000);
           const startTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
           const endTime = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
           const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
           const displayDate = `${String(startDate.getDate()).padStart(2, '0')}/${String(startDate.getMonth()+1).padStart(2, '0')}/${startDate.getFullYear()}`;
           
           return {
             id: seg._id || seg.id,
             date: dateStr,
             displayDate,
             time: `${startTime} - ${endTime}`,
             startTimeStr: startTime,
             endTimeStr: endTime,
             aktifitas: seg.activity_label || seg.context || 'Sitting',
             dfa: seg.features?.dfa_alpha1 || (seg.classification === 'Alert' ? 1.35 : (seg.classification === 'Caution' ? 1.15 : 1.05)),
             status: seg.rr_status || seg.physiological_state || 'BASELINE_COMPATIBLE',
             anomalyScore: seg.anomaly_score || 0.64,
             hrMean: seg.features?.mean_hr || 67.2,
             rmssd: seg.features?.rmssd || 35.7,
             confidence: typeof seg.signal_quality === 'number' ? Number(seg.signal_quality.toFixed(2)) : 0.96,
             rawStart: startDate
           };
        });

        riwayat.sort((a, b) => a.rawStart - b.rawStart);
        setTimelineData({ riwayat });

        if (riwayat.length > 0 && !selectedDate) {
          setSelectedDate(riwayat[riwayat.length - 1].date);
        }
        
        // Map Doctor Validation / Confirmations
        const formatEpId = (pName, timeStr) => {
          const cleanName = (pName || 'p001').toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanTime = (timeStr || '0845').replace(/[^0-9]/g, '');
          return `ep-${cleanName}-${cleanTime}`;
        };

        const formatEvId = (pName, timeStr) => {
          const cleanName = (pName || 'p001').toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanTime = (timeStr || '0845').replace(/[^0-9]/g, '');
          return `v-${cleanName}-${cleanTime}`;
        };

        let mappedAnns = events
          .filter(ev => {
            if (!ev.reviewer_notes && !ev.annotation && !ev.validation_label) return false;
            return true;
          })
          .map((ev, idx) => {
            let oTs = ev.createdAt || ev.onset_time;
            if (oTs && typeof oTs === 'object' && oTs.$date) oTs = oTs.$date;
            if (typeof oTs === 'number' && oTs < 20000000000) oTs *= 1000;
            const timeStr = oTs ? new Date(oTs).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '08:45';
            const nameStr = participantId || 'p001';
            return {
              time: timeStr,
              author: ev.reviewer_name || 'Dr. Sp.JP (Dokter Penanggung Jawab)',
              note: ev.reviewer_notes || ev.annotation || `Diagnosa Dokter: Sinus Takhikardia saat aktivitas ${ev.activity || 'Berjalan'}`,
              doctorValidation: ev.validation_label || 'TP - Sinus Takhikardia (Validated)',
              eventId: formatEvId(nameStr, timeStr),
              episodeId: formatEpId(nameStr, timeStr)
            };
          });
        
        setAnnotations(mappedAnns);
        setLoading(false);
      });
    }
  }, [participantId]);

  // Group by Daily Progression
  const dailyProgression = useMemo(() => {
    if (!timelineData?.riwayat) return [];
    const groups = {};

    timelineData.riwayat.forEach(item => {
      if (!groups[item.date]) {
        groups[item.date] = {
          date: item.date,
          displayDate: item.displayDate,
          totalWindows: 0,
          deviationWindows: 0,
          persistentWindows: 0,
          recoveringWindows: 0,
          normalWindows: 0,
          activities: new Set(),
          maxScore: 0,
          avgHr: 0,
          hrSum: 0,
          logs: []
        };
      }
      const g = groups[item.date];
      g.totalWindows += 1;
      g.hrSum += item.hrMean;
      g.activities.add(item.aktifitas);
      g.maxScore = Math.max(g.maxScore, item.anomalyScore || 0);
      g.logs.push(item);

      if (item.status === 'PERSISTENT_DEVIATION') g.persistentWindows += 1;
      else if (item.status === 'DEVIATION_CANDIDATE') g.deviationWindows += 1;
      else if (item.status === 'RECOVERY' || item.status === 'RECOVERING') g.recoveringWindows += 1;
      else g.normalWindows += 1;
    });

    return Object.values(groups).map(g => ({
      ...g,
      avgHr: Math.round(g.hrSum / g.totalWindows),
      activitiesCount: g.activities.size,
      hasDeviation: (g.persistentWindows + g.deviationWindows) > 0,
      stabilityRating: g.persistentWindows > 3 ? 'Kritis / High Deviation' : (g.deviationWindows > 0 ? 'Waspada / Moderate' : 'Stabil / Normal')
    }));
  }, [timelineData]);

  // Filter segments for the currently active selected date
  const currentDaySegments = useMemo(() => {
    if (!timelineData?.riwayat || !selectedDate) return [];
    return timelineData.riwayat.filter(r => r.date === selectedDate);
  }, [timelineData, selectedDate]);

  // Filtered Context Overlay: Hanya segmen yang memiliki deviasi / persistence atau transisi aktivitas penting
  const contextDeviationTransitions = useMemo(() => {
    if (!currentDaySegments || currentDaySegments.length === 0) return [];
    
    // Ambil segmen yang ada deviasi, persistence, recovery, atau transisi perubahan aktivitas
    const filtered = [];
    let lastActivity = null;

    currentDaySegments.forEach((seg, idx) => {
      const isDeviation = seg.status === 'PERSISTENT_DEVIATION' || seg.status === 'DEVIATION_CANDIDATE' || seg.status === 'RECOVERING' || seg.status === 'RECOVERY';
      const isActivityTransition = seg.aktifitas !== lastActivity;
      
      if (isDeviation || isActivityTransition || idx === 0 || idx === currentDaySegments.length - 1) {
        filtered.push(seg);
        lastActivity = seg.aktifitas;
      }
    });

    return filtered;
  }, [currentDaySegments]);

  const handleAddAnnotation = (e) => {
    e.preventDefault();
    if (!newNote) return;
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const nameStr = participantId || 'p001';
    const cleanName = (nameStr).toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTime = timeStr.replace(/[^0-9]/g, '');

    const newAnn = {
      time: timeStr,
      author: 'Dr. Sp.JP (Reviewer Klinis)',
      note: newNote,
      doctorValidation: 'Konfirmasi Dokter Baru',
      eventId: `v-${cleanName}-${cleanTime}`,
      episodeId: `ep-${cleanName}-${cleanTime}`
    };
    setAnnotations([...annotations, newAnn]);
    setSelectedAnnotation(newAnn);
    setNewNote('');
    setShowAnnotateModal(false);
  };

  const timeToX = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const totalHours = hours + (minutes / 60);
    return (totalHours / 24) * 700;
  };

  // Compute state color bands for the selected day
  const computeBands = () => {
    if (!currentDaySegments || currentDaySegments.length === 0) {
      return (
        <div style={{ width: '100%', background: 'var(--surface-overlay)', textAlign: 'center', lineHeight: '32px', fontSize: 11, color: 'var(--gray)' }}>
          Tidak ada data telemetri pada tanggal terpilih ({selectedDate})
        </div>
      );
    }
    
    return currentDaySegments.map((log, idx) => {
      let color = 'var(--green)';
      let title = 'Baseline-compatible';
      const dfa = log.dfa || 0;
      if (dfa > 1.3 || log.status === 'PERSISTENT_DEVIATION') { color = 'var(--red)'; title = 'Persistent Deviation (Peak/Relapse)'; }
      else if (dfa > 1.1 || log.status === 'DEVIATION_CANDIDATE') { color = 'var(--amber)'; title = 'Candidate Deviation Onset'; }
      else if (log.status === 'RECOVERY' || log.status === 'RECOVERING') { color = 'var(--purple)'; title = 'Damped Recovery'; }
      
      const isContextSelected = selectedContextLog?.id === log.id;

      return (
        <div 
          key={idx} 
          onClick={() => { setSelectedContextLog(log); setSelectedAnnotation(null); }}
          style={{ 
            flex: 1, 
            background: color,
            cursor: 'pointer',
            border: isContextSelected ? '2px solid var(--navy)' : 'none',
            boxShadow: isContextSelected ? '0 0 10px rgba(0,0,0,0.5)' : 'none',
            transform: isContextSelected ? 'scaleY(1.15)' : 'none',
            transition: 'all 0.2s'
          }} 
          title={`${title} - ${log.aktifitas} (${log.time}) [Score: ${log.anomalyScore}]`}
        />
      );
    });
  };

  // Clean, Aggregated Context Transition Overlay (Harian, Khusus Deviasi & Transisi Konteks)
  const renderContextOverlay = () => {
    if (!contextDeviationTransitions || contextDeviationTransitions.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '12px', fontSize: 11, color: 'var(--gray)' }}>
          Seluruh window pada hari ini berada dalam baseline normal (tidak ada deviasi aktif).
        </div>
      );
    }

    const colors = ['#EEF2FF', '#FEF3C7', '#FEE2E2', '#DCFCE7', '#F3E8FF'];
    const borderColors = ['#6366F1', '#D97706', '#DC2626', '#16A34A', '#9333EA'];

    return (
      <div className="w-100 overflow-x-auto">
        <svg viewBox="0 0 700 36" style={{ width: '100%', minWidth: 600, height: 36, overflow: 'visible' }}>
          {contextDeviationTransitions.map((log, idx) => {
            const startX = timeToX(log.startTimeStr || '08:00');
            let endX = timeToX(log.endTimeStr || '09:00');
            if (endX <= startX) endX = startX + 50;
            
            const width = Math.max(endX - startX, 42);
            const isDev = log.status === 'PERSISTENT_DEVIATION' || log.status === 'DEVIATION_CANDIDATE';
            const colorIdx = isDev ? 2 : (idx % colors.length);
            const rectColor = colors[colorIdx];
            const strokeColor = borderColors[colorIdx];

            const isSelected = selectedContextLog?.id === log.id;

            return (
              <g 
                key={idx} 
                onClick={() => { setSelectedContextLog(log); setSelectedAnnotation(null); }}
                style={{ cursor: 'pointer' }}
              >
                <rect 
                  x={startX} 
                  y="3" 
                  width={width} 
                  height="30" 
                  rx="5" 
                  fill={isSelected ? 'var(--navy)' : rectColor} 
                  stroke={isSelected ? 'var(--teal)' : strokeColor}
                  strokeWidth={isDev ? '2' : '1'}
                />
                <text 
                  x={startX + 5} 
                  y="16" 
                  fontSize="8.5" 
                  fontWeight="800"
                  fill={isSelected ? '#ffffff' : (isDev ? '#B91C1C' : '#334155')} 
                  fontFamily="Inter"
                >
                  {isDev ? '⚡ ' : ''}{log.aktifitas}
                </text>
                <text 
                  x={startX + 5} 
                  y="27" 
                  fontSize="7.5" 
                  fontWeight="600"
                  fill={isSelected ? '#93C5FD' : '#64748B'} 
                  fontFamily="monospace"
                >
                  {log.startTimeStr} (S:{log.anomalyScore})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="container-fluid px-0">
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>W06 — State Timeline &amp; Dynamic Damping Hierarchy</div>
          <h1 className="page-title">{participantId || 'Cohort All'} · Runtutan Hari, Episode, &amp; Transisi Konteks</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Hierarki multi-skala: <strong>Window Telemetri → Episode Damped Oscillation → Runtutan Harian → Lintas Hari (Q1 s/d Q10)</strong>.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button 
            className="btn-outline-navy"
            style={{ fontSize: 11.5 }}
            onClick={() => onNavigate && onNavigate('resilience')}
          >
            <BarChart3 size={13} className="me-1" />
            Buka Q1–Q10 Resilience View
          </button>
          <button 
            className="btn-outline-navy"
            style={{ fontSize: 11.5 }}
            onClick={() => onNavigate && onNavigate('episode')}
          >
            <i className="fa-solid fa-arrow-right-to-bracket me-1"></i>
            Episode Review
          </button>
          <button
            className="btn-teal"
            onClick={() => setShowAnnotateModal(true)}
            style={{ fontSize: 11.5, padding: '5px 12px' }}
          >
            <Flag size={13} className="me-1" />
            Annotate Pin
          </button>
        </div>
      </div>

      {/* ── 1. HIERARKI 4-LEVEL BREADCRUMB ────────────────────────────────────────── */}
      <div className="card-panel mb-4 p-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10 }}>
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-primary text-white px-2 py-1" style={{ fontSize: 10 }}>ARSITEKTUR MULTI-SKALA</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)' }}>
              Pemetaan Data Fisiologis dari Window Mikro ke Analisis Klinis Lintas Hari (Q1–Q10)
            </span>
          </div>
          <div className="d-flex gap-1">
            <button 
              className={`btn btn-sm ${activeHierarchyTab === 'hierarchy' ? 'btn-primary' : 'btn-light'}`}
              style={{ fontSize: 10.5, padding: '2px 8px' }}
              onClick={() => setActiveHierarchyTab('hierarchy')}
            >
              Hierarki 4 Level
            </button>
            <button 
              className={`btn btn-sm ${activeHierarchyTab === 'damping' ? 'btn-primary' : 'btn-light'}`}
              style={{ fontSize: 10.5, padding: '2px 8px' }}
              onClick={() => setActiveHierarchyTab('damping')}
            >
              Model Suspensi &amp; Damping
            </button>
            <button 
              className={`btn btn-sm ${activeHierarchyTab === 'blok1' ? 'btn-primary' : 'btn-light'}`}
              style={{ fontSize: 10.5, padding: '2px 8px' }}
              onClick={() => setActiveHierarchyTab('blok1')}
            >
              Log Blok 1 Schema
            </button>
          </div>
        </div>

        {activeHierarchyTab === 'hierarchy' && (
          <div className="row g-2 text-center mt-1">
            <div className="col-12 col-md-3">
              <div className="p-2.5 rounded border bg-white h-100 text-start">
                <div style={{ fontSize: 10, fontWeight: 800, color: '#6366F1' }}>LEVEL 1: WINDOW MIKRO</div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>30s / 60s Telemetri</div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 3 }}>
                  HR, RMSSD, DFA &alpha;1, Anomaly Score S(t), Signal Quality / Confidence.
                </div>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="p-2.5 rounded border bg-white h-100 text-start" style={{ borderColor: '#F59E0B' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#D97706' }}>LEVEL 2: EPISODE FSM</div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>Damped Oscillation</div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 3 }}>
                  Multi-Peak [P1, P2], Relapse Ascent (t &rarr; t+1), TTR ke &tau;out, Residual Dev.
                </div>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="p-2.5 rounded border bg-white h-100 text-start" style={{ borderColor: '#10B981' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#059669' }}>LEVEL 3: RUNTUTAN HARIAN</div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>Daily Progression</div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 3 }}>
                  Rekapitulasi episode normal vs deviasi per hari, Beban AUC Harian, Diurnal Dip.
                </div>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="p-2.5 rounded border bg-white h-100 text-start" style={{ borderColor: '#3B82F6', background: '#EFF6FF' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#1D4ED8' }}>LEVEL 4: LINTAS HARI</div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>10 Pertanyaan Klinis (Q1–Q10)</div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 3 }}>
                  Vektor Fenotipe &Phi; = [f_dev, m_dev, d_dev, v_rec, r_rel, ...], Trajektori Kerentanan.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeHierarchyTab === 'damping' && (
          <div className="p-3 bg-white rounded border mt-2">
            <div className="d-flex align-items-center gap-2 mb-2">
              <Zap size={16} className="text-warning" />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--navy)' }}>
                Konsep Damped Oscillation: Analogi Suspensi Mobil pada Relapse Fisiologis
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: '#475569', marginBottom: 8, lineHeight: 1.5 }}>
              Fisiologi otonom kardiovaskular adalah <strong>sistem dinamis teredam (damped dynamic system)</strong>. Seperti suspensi mobil saat menghantam polisi tidur, terjadi hentakan awal yang besar (<strong>Peak 1</strong>), kemudian sistem otonom meredam deviasi sehingga terjadi osilasi/relapse sekunder (<strong>Peak 2</strong>) yang kekuatannya semakin mengecil (<em>soft damping</em>) sampai stabil kembali di bawah &tau;<sub>normal</sub>.
            </p>
            <div className="d-flex gap-3 flex-wrap" style={{ fontSize: 11 }}>
              <span className="badge bg-danger text-white p-1.5">★ Peak 1 (Hentakan Awal / Primary Onset)</span>
              <span className="badge bg-warning text-dark p-1.5">⚡ Relapse &amp; Peak 2 (Osilasi Sekunder Teredam)</span>
              <span className="badge bg-info text-dark p-1.5">∫ Residual Deviation (Sisa Residue Overshoot &gt; &tau;<sub>normal</sub>)</span>
              <span className="badge bg-success text-white p-1.5">✓ Final Recovery (Stabil Masuk Zona Baseline)</span>
            </div>
          </div>
        )}

        {activeHierarchyTab === 'blok1' && (
          <div className="p-3 bg-white rounded border mt-2">
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>
              Keluaran Terstruktur Engine Blok 1 (Per-Window &amp; Per-Episode Contract)
            </div>
            <div className="table-responsive">
              <table className="table table-sm table-bordered mono mb-0" style={{ fontSize: 10.5 }}>
                <thead className="table-light">
                  <tr>
                    <th>window_state</th>
                    <th>confidence</th>
                    <th>episode_id</th>
                    <th>onset_time</th>
                    <th>peak</th>
                    <th>duration</th>
                    <th>ttr</th>
                    <th>relapse_count</th>
                    <th>residual_deviation</th>
                    <th>context_tag</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="badge bg-danger">PERSISTENT_DEV</span></td>
                    <td>0.98</td>
                    <td>EP_20260825_01</td>
                    <td>23:20:00</td>
                    <td>3.35</td>
                    <td>10.0m</td>
                    <td>4.0m</td>
                    <td>1</td>
                    <td>7.46</td>
                    <td>Berbaring | Istirahat</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Selected Highlight Banner */}
      {selectedAnnotation && (
        <div style={{ background: 'var(--navy)', color: '#fff', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700 }}>
              📌 HIGHLIGHTED DOCTOR CONFIRMATION PIN — {selectedAnnotation.time}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
              {selectedAnnotation.author}: &quot;{selectedAnnotation.note}&quot; (Linked: {selectedAnnotation.episodeId})
            </div>
            <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700, marginTop: 4 }}>
              ✓ Status Diagnosa Dokter: {selectedAnnotation.doctorValidation}
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn-teal py-1 px-2"
              style={{ fontSize: 11 }}
              onClick={() => onNavigate && onNavigate('episode')}
            >
              Buka di Episode Review →
            </button>
            <button 
              onClick={() => setSelectedAnnotation(null)} 
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14 }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Selected Context Episode Banner */}
      {selectedContextLog && (
        <div style={{ background: 'var(--teal-soft)', border: '1px solid var(--teal)', color: 'var(--navy)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 800 }}>
              🔍 CONTEXT DRILL-DOWN — {selectedContextLog.aktifitas?.toUpperCase()} ({selectedContextLog.time})
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
              State: <span className="mono fw-bold text-danger">{selectedContextLog.status}</span> · Anomaly Score: <span className="mono fw-bold">{selectedContextLog.anomalyScore}</span> · HR Mean: <span className="mono fw-bold">{selectedContextLog.hrMean} BPM</span> · Confidence: <span className="mono fw-bold">{selectedContextLog.confidence}</span>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn-outline-navy py-1 px-2"
              style={{ fontSize: 11 }}
              onClick={() => onNavigate && onNavigate('episode')}
            >
              Buka di Episode Review →
            </button>
            <button 
              onClick={() => setSelectedContextLog(null)} 
              style={{ background: 'transparent', border: 'none', color: 'var(--navy)', cursor: 'pointer', fontSize: 14, fontWeight: 800 }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── 2. RUNTUTAN HARI (DAILY PROGRESSION SELECTOR) ─────────────────────────── */}
      <div className="card-panel mb-4 p-3">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <div>
            <div className="mini-label m-0" style={{ color: 'var(--teal)' }}>RUNTUTAN HARI (DAILY PROGRESSION)</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)' }}>
              Pilih Hari untuk Menampilkan State Timeline &amp; Context Transition
            </div>
          </div>
          <span className="badge bg-light text-dark border" style={{ fontSize: 11 }}>
            Total {dailyProgression.length} Hari Terdaftar
          </span>
        </div>

        <div className="d-flex gap-2 overflow-x-auto pb-1">
          {dailyProgression.map((dp, idx) => {
            const isSel = dp.date === selectedDate;
            return (
              <div
                key={idx}
                onClick={() => { setSelectedDate(dp.date); setSelectedContextLog(null); }}
                className="p-2 rounded border"
                style={{
                  minWidth: 140,
                  cursor: 'pointer',
                  background: isSel ? 'var(--navy)' : (dp.hasDeviation ? '#FFFBEB' : '#FFFFFF'),
                  borderColor: isSel ? 'var(--teal)' : (dp.hasDeviation ? '#F59E0B' : '#E2E8F0'),
                  color: isSel ? '#FFFFFF' : 'var(--navy)',
                  transition: 'all 0.2s'
                }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <span style={{ fontSize: 11, fontWeight: 800 }}>Hari {idx + 1}</span>
                  <span className={`badge ${dp.hasDeviation ? 'bg-danger' : 'bg-success'}`} style={{ fontSize: 9 }}>
                    {dp.hasDeviation ? 'Deviasi' : 'Normal'}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: isSel ? '#93C5FD' : '#64748B', marginTop: 2 }}>
                  {dp.displayDate}
                </div>
                <div style={{ fontSize: 10, marginTop: 4, fontWeight: 600 }}>
                  {dp.totalWindows} Window · HR: {dp.avgHr} bpm
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. MAIN 24-HOUR STATE TRACE PANEL ────────────────────────────────────── */}
      <div className="card-panel mb-4" style={{ position: 'relative' }}>
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <div className="mini-label m-0">
            {selectedDate || 'Today'} · Continuous Physiological State Trace 
            {loading && <span style={{ marginLeft: 8, color: 'var(--teal)' }}>Loading...</span>}
          </div>
          <div style={{ fontSize: 11, color: '#64748B' }}>
            Menampilkan <strong>{currentDaySegments.length} Segmen</strong> pada tanggal {selectedDate}
          </div>
        </div>

        {/* State Color Band & Annotation Marker Pins */}
        <div style={{ position: 'relative' }}>
          <div className="state-dist mb-1" style={{ height: 32, borderRadius: 6, display: 'flex', overflow: 'hidden', border: selectedAnnotation ? '2px solid var(--teal)' : 'none' }}>
            {computeBands()}
          </div>

          {/* Annotation Marker Pin Overlays */}
          {annotations.map((ann, idx) => {
            const posX = timeToX(ann.time);
            const isSel = selectedAnnotation?.episodeId === ann.episodeId;

            return (
              <div
                key={idx}
                onClick={() => { setSelectedAnnotation(ann); setSelectedContextLog(null); }}
                style={{
                  position: 'absolute',
                  left: `${(posX / 700) * 100}%`,
                  top: -8,
                  transform: 'translateX(-50%)',
                  cursor: 'pointer',
                  zIndex: 10
                }}
                title={`Annotation by ${ann.author} at ${ann.time}: ${ann.note}`}
              >
                <div style={{
                  background: isSel ? '#E53935' : 'var(--navy)',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 800,
                  border: '1.5px solid #fff',
                  boxShadow: isSel ? '0 0 10px #E53935' : '0 2px 4px rgba(0,0,0,0.3)',
                  whiteSpace: 'nowrap'
                }}>
                  📌 {ann.time}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time axis SVG */}
        <div style={{ padding: '6px 0' }}>
          <svg viewBox="0 0 700 12" style={{ width: '100%', height: 12 }}>
            <line x1="0" y1="6" x2="700" y2="6" stroke="var(--line)" strokeWidth="1" />
            <line x1="0" y1="0" x2="0" y2="12" stroke="var(--navy)" strokeWidth="1.4" />
            <line x1="175" y1="0" x2="175" y2="12" stroke="var(--navy)" strokeWidth="1.4" />
            <line x1="350" y1="0" x2="350" y2="12" stroke="var(--navy)" strokeWidth="1.4" />
            <line x1="525" y1="0" x2="525" y2="12" stroke="var(--navy)" strokeWidth="1.4" />
            <line x1="700" y1="0" x2="700" y2="12" stroke="var(--navy)" strokeWidth="1.4" />
          </svg>
          <div className="d-flex justify-content-between frame-note m-0" style={{ fontSize: 10 }}>
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>

        {/* ── 4. CONTEXT TRANSITION OVERLAY (KHUSUS DEVIASI & TRANSISI HARIAN) ─── */}
        <div className="mt-3">
          <div className="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
            <div className="mini-label m-0" style={{ color: 'var(--teal)' }}>
              CONTEXT TRANSITION OVERLAY (HARIAN: KHUSUS DEVIASI &amp; PERISTENCE)
            </div>
            <span className="frame-note m-0" style={{ fontSize: 10 }}>
              Menampilkan {contextDeviationTransitions.length} transisi kunci (klik untuk drill-down)
            </span>
          </div>
          <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 8, border: '1px solid #E2E8F0' }}>
            {renderContextOverlay()}
          </div>
        </div>

        <div className="d-flex gap-3 frame-note m-0 mt-3 flex-wrap" style={{ fontSize: 10.5 }}>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--green)' }}></i> Baseline Normal</span>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--amber)' }}></i> Candidate Onset</span>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--red)' }}></i> Persistent Dev / Relapse</span>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--purple)' }}></i> Damped Recovery</span>
          <span><i className="fa-solid fa-flag me-1" style={{ color: 'var(--navy)' }}></i> Doctor Pin</span>
        </div>
      </div>

      {/* ── 5. DETAIL BAR TIMELINE (DAFTAR BAR SEGMEN & EPISODE PADA TIMELINE) ── */}
      <div className="card-panel">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <div className="mini-label m-0" style={{ color: 'var(--teal)' }}>DETAIL BAR TIMELINE</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>
              Daftar Bar Segmen &amp; Episode pada Timeline ({currentDaySegments.length} Bar Terdaftar pada {selectedDate || 'Hari Ini'})
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 2 }}>
              Klik baris untuk menyorot (*highlight*) bar pada timeline di atas atau klik Review untuk membuka analisis episode lengkap.
            </div>
          </div>
          <button
            className="btn-outline-navy py-1.5 px-3"
            style={{ fontSize: 11 }}
            onClick={() => onNavigate && onNavigate('episode')}
          >
            Buka di Episode List →
          </button>
        </div>

        <div className="table-responsive">
          <table className="dtable w-100" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th>Episode ID</th>
                <th>Waktu Bar</th>
                <th>Konteks Aktivitas</th>
                <th>Skor Anomali &amp; HR</th>
                <th>Confidence</th>
                <th>Status FSM / Bar</th>
                <th>Aksi Navigasi</th>
              </tr>
            </thead>
            <tbody>
              {currentDaySegments.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray)' }}>
                    Tidak ada bar telemetri pada tanggal terpilih ({selectedDate}).
                  </td>
                </tr>
              ) : (
                currentDaySegments.map((seg, idx) => {
                  const isSelected = selectedContextLog?.id === seg.id;
                  const cleanTime = (seg.startTimeStr || '0800').replace(/[^0-9]/g, '');
                  const pName = (participantId || 'p001').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 5);
                  const displayEpId = `ep-${pName}-${cleanTime}`;
                  const isDev = seg.status === 'PERSISTENT_DEVIATION' || seg.status === 'DEVIATION_CANDIDATE';

                  return (
                    <tr 
                      key={idx}
                      onClick={() => { setSelectedContextLog(seg); setSelectedAnnotation(null); }}
                      style={{ 
                        cursor: 'pointer', 
                        background: isSelected ? 'var(--teal-soft)' : (isDev ? '#FFFBEB' : 'transparent'),
                        fontWeight: isSelected ? 700 : 'normal'
                      }}
                    >
                      <td className="mono" style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 11 }}>
                        🏷️ {displayEpId}
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        <div style={{ fontWeight: 700 }}>{seg.time}</div>
                        <div style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 400 }}>{seg.displayDate}</div>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border px-2 py-1" style={{ fontSize: 10.5 }}>
                          {seg.aktifitas}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        <span style={{ fontWeight: 800, color: (seg.anomalyScore > 2.0 ? '#DC2626' : (seg.anomalyScore > 1.0 ? '#D97706' : '#16A34A')) }}>
                          S: {seg.anomalyScore}
                        </span> · {seg.hrMean} bpm
                      </td>
                      <td className="mono" style={{ fontSize: 10.5 }}>
                        {(seg.confidence * 100).toFixed(0)}%
                      </td>
                      <td>
                        {seg.status === 'PERSISTENT_DEVIATION' ? (
                          <span className="badge bg-danger text-white px-2 py-1" style={{ fontSize: 10 }}>
                            ⚡ Persistent (Relapse)
                          </span>
                        ) : seg.status === 'DEVIATION_CANDIDATE' ? (
                          <span className="badge bg-warning text-dark px-2 py-1" style={{ fontSize: 10 }}>
                            ⚠️ Candidate Onset
                          </span>
                        ) : (seg.status === 'RECOVERY' || seg.status === 'RECOVERING') ? (
                          <span className="badge bg-purple text-white px-2 py-1" style={{ fontSize: 10, background: '#9333EA' }}>
                            🔄 Damped Recovery
                          </span>
                        ) : (
                          <span className="badge bg-success text-white px-2 py-1" style={{ fontSize: 10 }}>
                            ✓ Baseline Normal
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          <button
                            className={isSelected ? 'btn-teal py-1 px-2' : 'btn-outline-navy py-1 px-2'}
                            style={{ fontSize: 10 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContextLog(isSelected ? null : seg);
                              setSelectedAnnotation(null);
                            }}
                          >
                            {isSelected ? '✓ Highlighted' : 'Highlight Bar'}
                          </button>
                          <button
                            className="btn-teal py-1 px-2"
                            style={{ fontSize: 10 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onNavigate) onNavigate('episode');
                            }}
                            title="Buka detail episode di Episode List"
                          >
                            Review →
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Annotate */}
      {showAnnotateModal && (
        <div 
          onClick={() => setShowAnnotateModal(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(11, 17, 22, 0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ width: '100%', maxWidth: 440, padding: 20, background: 'var(--surface)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Add Timeline Annotation</h3>
              <button onClick={() => setShowAnnotateModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray)' }}><i className="fa-solid fa-xmark"></i></button>
            </div>

            <form onSubmit={handleAddAnnotation}>
              <div className="mb-3">
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--navy)', marginBottom: 4, display: 'block' }}>Annotation Note</label>
                <textarea
                  rows={3}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Tambahkan catatan analitis..."
                  required
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--gray-soft)', fontSize: 12 }}
                />
              </div>
              <button type="submit" className="btn-teal" style={{ width: '100%' }}>Simpan Catatan</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
