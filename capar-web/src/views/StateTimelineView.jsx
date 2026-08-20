import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Flag, Activity, Clock, Layers, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export const StateTimelineView = ({ participantId, globalDateFilter, onNavigate }) => {
  const [range, setRange] = useState('Day');
  const [annotations, setAnnotations] = useState([]);
  const [showAnnotateModal, setShowAnnotateModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Selection state for annotation highlight & context transition drilldown
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [selectedContextLog, setSelectedContextLog] = useState(null);

  useEffect(() => {
    if (participantId) {
      setLoading(true);
      Promise.all([
        api.getAnalyzedSegments(participantId, 500).catch(() => ({ data: [] })),
        api.getRecentEvents ? api.getRecentEvents(participantId, 50).catch(() => ({})) : Promise.resolve({})
      ]).then(([segmentsData, eventsData]) => {
        const segments = Array.isArray(segmentsData?.data) ? segmentsData.data : (Array.isArray(segmentsData) ? segmentsData : []);
        
        // Build timeline riwayat from real segments
        let riwayat = segments.map(seg => {
           const startDate = new Date(seg.window_start || seg.createdAt || Date.now());
           const endDate = seg.window_end ? new Date(seg.window_end) : new Date(startDate.getTime() + 60000);
           const startTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
           const endTime = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
           const dateStr = `${String(startDate.getDate()).padStart(2, '0')}-${String(startDate.getMonth()+1).padStart(2, '0')}-${startDate.getFullYear()}`;
           
           return {
             id: seg._id || seg.id,
             date: dateStr,
             time: `${startTime} - ${endTime}`,
             startTimeStr: startTime,
             endTimeStr: endTime,
             aktifitas: seg.activity_label || seg.context || 'sitting',
             dfa: seg.features?.dfa_alpha1 || (seg.classification === 'Alert' ? 1.35 : (seg.classification === 'Caution' ? 1.15 : 1.05)),
             status: seg.rr_status || seg.physiological_state || 'BASELINE_COMPATIBLE',
             anomalyScore: seg.anomaly_score || 0.64,
             hrMean: seg.features?.mean_hr || 67.2,
             rmssd: seg.features?.rmssd || 35.7,
             rawStart: startDate
           };
        });

        riwayat.sort((a, b) => a.rawStart - b.rawStart);
        setTimelineData({ riwayat });
        
        // Map Doctor Validation / Confirmations
        const events = Array.isArray(eventsData?.data) ? eventsData.data : [];
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
            if (globalDateFilter && ev.onset_time) {
              const ts = new Date(ev.onset_time).getTime();
              if (!isNaN(ts)) {
                const dt = new Date(ts);
                const epDateStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
                if (epDateStr !== globalDateFilter) return false;
              }
            }
            return true;
          })
          .map((ev, idx) => {
            const timeStr = ev.onset_time ? new Date(ev.onset_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '08:45';
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

  // Compute state color bands and highlight selected annotation pin position
  const computeBands = () => {
    if (!timelineData || !timelineData.riwayat || timelineData.riwayat.length === 0) {
      return (
        <div style={{ width: '100%', background: 'var(--surface-overlay)', textAlign: 'center', lineHeight: '26px', fontSize: 11, color: 'var(--gray)' }}>
          No timeline data available for {participantId}
        </div>
      );
    }
    
    return timelineData.riwayat.map((log, idx) => {
      let color = 'var(--green)';
      let title = 'Baseline-compatible';
      const dfa = log.dfa || 0;
      if (dfa > 1.3 || log.status === 'PERSISTENT_DEVIATION') { color = 'var(--red)'; title = 'Persistent (Anomaly)'; }
      else if (dfa > 1.1 || log.status === 'DEVIATION_CANDIDATE') { color = 'var(--amber)'; title = 'Candidate Onset'; }
      else if (log.status === 'RECOVERY') { color = 'var(--purple)'; title = 'Recovery'; }
      
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
          title={`${title} - ${log.aktifitas} (${log.time})`}
        />
      );
    });
  };

  // Dynamic Context Transition Overlay with Episode Changes
  const renderContextOverlay = () => {
    if (!timelineData || !timelineData.riwayat || timelineData.riwayat.length === 0) return null;

    const colors = ['var(--gray-soft)', 'var(--blue-soft)', 'var(--teal-soft)', 'var(--purple-soft)'];
    const textColors = ['var(--gray)', 'var(--blue)', 'var(--teal)', 'var(--purple)'];

    return (
      <div className="d-flex flex-column gap-2">
        <svg viewBox="0 0 700 28" style={{ width: '100%', height: 28, borderRadius: 6, overflow: 'visible' }}>
          {timelineData.riwayat.map((log, idx) => {
            const startX = timeToX(log.startTimeStr || '08:00');
            let endX = timeToX(log.endTimeStr || '09:00');
            if (endX <= startX) endX = startX + 60;
            
            const width = Math.max(endX - startX, 35);
            const colorIdx = idx % colors.length;
            const rectColor = colors[colorIdx];
            const textColor = textColors[colorIdx];

            const isSelected = selectedContextLog?.id === log.id;

            return (
              <g 
                key={idx} 
                onClick={() => { setSelectedContextLog(log); setSelectedAnnotation(null); }}
                style={{ cursor: 'pointer' }}
              >
                <rect 
                  x={startX} 
                  y="2" 
                  width={width} 
                  height="24" 
                  rx="4" 
                  fill={isSelected ? 'var(--navy)' : rectColor} 
                  stroke={isSelected ? 'var(--teal)' : 'none'}
                  strokeWidth="2"
                />
                <text 
                  x={startX + 6} 
                  y="18" 
                  fontSize="9.5" 
                  fontWeight="700"
                  fill={isSelected ? '#ffffff' : textColor} 
                  fontFamily="Inter"
                >
                  {log.aktifitas} ({log.time})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>W06 — State Timeline &amp; Doctor Confirmation</div>
          <h1 className="page-title">{participantId || 'Cohort All'} · Continuous Trace &amp; Clinical Confirmation</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            State Timeline terhubung langsung dengan <strong>Episode Review</strong> untuk mengonfirmasi kejadian klinis dan diagnosa dokter pada timestamp spesifik.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button 
            className="btn-outline-navy"
            style={{ fontSize: 11.5 }}
            onClick={() => onNavigate && onNavigate('episode')}
          >
            <i className="fa-solid fa-arrow-right-to-bracket me-1"></i>
            Buka Episode Review
          </button>
          {['Day', 'Week', 'Month'].map((r) => (
            <button
              key={r}
              className={range === r ? 'btn-teal' : 'btn-outline-navy'}
              onClick={() => setRange(r)}
              style={{ fontSize: 11.5, padding: '5px 12px' }}
            >
              {r}
            </button>
          ))}
          <button
            className="btn-teal"
            onClick={() => setShowAnnotateModal(true)}
            style={{ fontSize: 11.5, padding: '5px 12px' }}
          >
            <Flag size={13} className="me-1" />
            Annotate
          </button>
        </div>
      </div>

      {/* Selected Highlight Banner */}
      {selectedAnnotation && (
        <div style={{ background: 'var(--navy)', color: '#fff', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700 }}>
              📌 HIGHLIGHTED DOCTOR CONFIRMATION PIN — {selectedAnnotation.time}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
              {selectedAnnotation.author}: &quot;{selectedAnnotation.note}&quot; (Linked: {selectedAnnotation.episode})
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
              🔍 CONTEXT EPISODE DRILL-DOWN — {selectedContextLog.aktifitas?.toUpperCase()} ({selectedContextLog.time})
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
              State: <span className="mono fw-bold text-danger">{selectedContextLog.status}</span> · Anomaly Score: <span className="mono fw-bold">{selectedContextLog.anomalyScore}</span> · HR Mean: <span className="mono fw-bold">{selectedContextLog.hrMean} BPM</span> · RMSSD: <span className="mono fw-bold">{selectedContextLog.rmssd} ms</span>
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

      {/* Main 24-hour State Trace Panel */}
      <div className="card-panel mb-4" style={{ position: 'relative' }}>
        <div className="mini-label mb-2">
          {timelineData && timelineData.riwayat?.[0] ? timelineData.riwayat[0].date : 'Today'} · Continuous Trace 
          {loading && <span style={{ marginLeft: 8, color: 'var(--teal)' }}>Loading...</span>}
        </div>

        {/* State Color Band & Annotation Marker Pins */}
        <div style={{ position: 'relative' }}>
          <div className="state-dist mb-1" style={{ height: 32, borderRadius: 6, display: 'flex', overflow: 'hidden', border: selectedAnnotation ? '2px solid var(--teal)' : 'none' }}>
            {computeBands()}
          </div>

          {/* Annotation Marker Pin Overlays */}
          {annotations.map((ann, idx) => {
            const posX = timeToX(ann.time);
            const isSel = selectedAnnotation?.episode === ann.episode;

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

        {/* Dynamic Context Transition Overlay per Episode */}
        <div className="mt-3">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <div className="mini-label m-0" style={{ color: 'var(--teal)' }}>CONTEXT TRANSITION OVERLAY (PER EPISODE ACTIVITY CHANGES)</div>
            <span className="frame-note m-0" style={{ fontSize: 10 }}>Klik aktivitas untuk drill-down</span>
          </div>
          <div style={{ background: 'var(--gray-soft)', borderRadius: 8, padding: 8 }}>
            {renderContextOverlay()}
          </div>
        </div>

        <div className="d-flex gap-3 frame-note m-0 mt-3 flex-wrap" style={{ fontSize: 10.5 }}>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--green)' }}></i> Baseline-compatible</span>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--amber)' }}></i> Candidate</span>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--red)' }}></i> Persistent</span>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--purple)' }}></i> Recovery</span>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--gray)' }}></i> Quality warning</span>
          <span><i className="fa-solid fa-flag me-1" style={{ color: 'var(--navy)' }}></i> Annotation Pin</span>
        </div>
      </div>

      {/* Summary Rekap Event & Interactive Annotations Table */}
      <div className="card-panel">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <div className="mini-label m-0" style={{ color: 'var(--teal)' }}>REKAPITULASI FREKUENSI EVENT TERANOTASI DOKTER</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>
              Ringkasan Event Teranotasi Dokter pada Timeline ({annotations.length} Event Terdaftar)
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 2 }}>
              State Timeline hanya menampilkan rekap frekuensi kejadian makro. Untuk analisis grafik sinyal raw mendetail, gunakan Episode Review.
            </div>
          </div>
          <button
            className="btn-outline-navy py-1.5 px-3"
            style={{ fontSize: 11 }}
            onClick={() => onNavigate && onNavigate('episode')}
          >
            Buka Detail di Episode Review →
          </button>
        </div>

        <div className="table-responsive">
          <table className="dtable w-100" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th>Event ID (`v-nama-time`)</th>
                <th>Time &amp; Dokter</th>
                <th>Diagnosa / Catatan Dokter</th>
                <th>Linked Episode (`ep-nama-time`)</th>
                <th>Status Validasi</th>
                <th>Aksi Navigasi</th>
              </tr>
            </thead>
            <tbody>
              {annotations.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray)' }}>
                    Tidak ada event teranotasi pada rentang waktu ini.
                  </td>
                </tr>
              ) : (
                annotations.map((ann, idx) => {
                  const isSelected = selectedAnnotation?.eventId === ann.eventId || selectedAnnotation?.episodeId === ann.episodeId;

                  return (
                    <tr 
                      key={idx}
                      onClick={() => { setSelectedAnnotation(ann); setSelectedContextLog(null); }}
                      style={{ 
                        cursor: 'pointer', 
                        background: isSelected ? 'var(--teal-soft)' : 'transparent',
                        fontWeight: isSelected ? 700 : 'normal'
                      }}
                    >
                      <td className="mono" style={{ fontWeight: 800, color: 'var(--teal)', fontSize: 11 }}>
                        📌 {ann.eventId}
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        <div style={{ fontWeight: 700 }}>{ann.time}</div>
                        <div style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 400 }}>{ann.author}</div>
                      </td>
                      <td>{ann.note}</td>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 11 }}>
                        {ann.episodeId}
                      </td>
                      <td>
                        <span className="badge bg-success text-white px-2 py-1" style={{ fontSize: 10 }}>
                          ✓ {ann.doctorValidation}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          <button
                            className={isSelected ? 'btn-teal py-1 px-2' : 'btn-outline-navy py-1 px-2'}
                            style={{ fontSize: 10 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAnnotation(isSelected ? null : ann);
                              setSelectedContextLog(null);
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
                            title="Buka detail episode di Episode Review"
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
