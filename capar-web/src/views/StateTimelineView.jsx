import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export const StateTimelineView = ({ participantId, globalDateFilter }) => {
  const [range, setRange] = useState('Day');
  const [annotations, setAnnotations] = useState([]);
  const [showAnnotateModal, setShowAnnotateModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (participantId) {
      setLoading(true);
      Promise.all([
        api.getRiwayatDeteksi(participantId).catch(() => null),
        api.getRecentEvents ? api.getRecentEvents(participantId, 50).catch(() => ({})) : Promise.resolve({})
      ]).then(([riwayatData, eventsData]) => {
        setTimelineData(riwayatData);
        
        // Map events with notes to annotations
        const events = Array.isArray(eventsData?.data) ? eventsData.data : [];
        const mappedAnns = events
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
          .map((ev, idx) => ({
            time: ev.onset_time ? new Date(ev.onset_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : (ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown'),
            author: ev.reviewer_name || 'Reviewer',
            note: ev.reviewer_notes || ev.annotation || `Status: ${ev.validation_label}`,
            episode: ev._id || ev.id || `EP-${idx}`
          }));
        
        setAnnotations(mappedAnns);
        setLoading(false);
      });
    }
  }, [participantId]);

  const handleAddAnnotation = (e) => {
    e.preventDefault();
    if (!newNote) return;
    setAnnotations([
      ...annotations,
      { time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), author: 'Operator', note: newNote, episode: `EP-${Date.now().toString().slice(-6)}` }
    ]);
    setNewNote('');
    setShowAnnotateModal(false);
  };

  // Helper to parse time string like "19:17:00" and convert to X coordinate on 700px wide 24h timeline
  const timeToX = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const totalHours = hours + (minutes / 60);
    return (totalHours / 24) * 700;
  };

  // Compute bands dynamically based on riwayat
  const computeBands = () => {
    if (!timelineData || !timelineData.riwayat || timelineData.riwayat.length === 0) {
      return (
        <div style={{ width: '100%', background: 'var(--surface-overlay)', textAlign: 'center', lineHeight: '26px', fontSize: 11, color: 'var(--gray)' }}>
          No timeline data available for {participantId}
        </div>
      );
    }
    
    // Simplification for UI binding: We map logs to a color band
    return timelineData.riwayat.slice(0, 100).map((log, idx) => {
      let color = 'var(--green)'; // default
      let title = 'Baseline-compatible';
      const dfa = log.dfa || 0;
      if (dfa > 1.3) { color = 'var(--red)'; title = 'Persistent (Anomaly)'; }
      else if (dfa > 1.1) { color = 'var(--amber)'; title = 'Candidate'; }
      else if (dfa < 0.5) { color = 'var(--gray)'; title = 'Quality Warning / No Data'; }
      
      return <div key={idx} style={{ flex: 1, background: color }} title={`${title} - ${log.aktifitas} (${log.time}) DFA: ${dfa}`}></div>;
    });
  };

  // Dynamically render context transition overlay based on riwayat
  const renderContextOverlay = () => {
    if (!timelineData || !timelineData.riwayat || timelineData.riwayat.length === 0) return null;

    const colors = ['var(--gray-soft)', 'var(--blue-soft)', 'var(--teal-soft)'];
    const textColors = ['var(--gray)', 'var(--blue)', 'var(--teal)'];

    return (
      <svg viewBox="0 0 700 24" style={{ width: '100%', height: 24 }}>
        {timelineData.riwayat.map((log, idx) => {
          const timeParts = (log.time || '').split(' - ');
          const startX = timeToX(timeParts[0]);
          let endX = timeParts.length > 1 ? timeToX(timeParts[1]) : startX + (700/24); // default 1 hour width if end time missing
          if (endX <= startX) endX = startX + 10; // minimum width
          
          const width = endX - startX;
          const colorIdx = idx % colors.length;
          const rectColor = colors[colorIdx];
          const textColor = textColors[colorIdx];
          
          return (
            <g key={idx}>
              <rect x={startX} y="2" width={width} height="20" rx="3" fill={rectColor} />
              {width > 30 && (
                <text x={startX + 6} y="16" fontSize="9" fill={textColor} fontFamily="Inter">
                  {log.aktifitas}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>W06 — State Timeline</div>
          <h1 className="page-title">{participantId} · Continuous Evidence &amp; State Trace</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Membaca urutan evidence dan state fisiologis sepanjang waktu dalam satu garis waktu kontinu.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
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
            <i className="fa-solid fa-note-sticky me-1"></i>
            Annotate
          </button>
        </div>
      </div>

      {/* Main 24-hour State Trace Panel */}
      <div className="card-panel mb-4">
        <div className="mini-label mb-2">
          {timelineData && timelineData.riwayat?.[0] ? timelineData.riwayat[0].date : 'Today'} · Continuous Trace 
          {loading && <span style={{marginLeft: 8, color: 'var(--teal)'}}>Loading...</span>}
        </div>

        {/* State Color Band */}
        <div className="state-dist mb-1" style={{ height: 26, borderRadius: 6, display: 'flex', overflow: 'hidden' }}>
          {computeBands()}
        </div>

        {/* Time axis SVG */}
        <div style={{ padding: '4px 0' }}>
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

        {/* Context Transition Overlay */}
        <div className="mt-3">
          <div className="mini-label mb-1">Context Transition Overlay</div>
          <div style={{ background: 'var(--gray-soft)', borderRadius: 6, padding: 4 }}>
            {renderContextOverlay()}
          </div>
        </div>

        <div className="d-flex gap-3 frame-note m-0 mt-3 flex-wrap" style={{ fontSize: 10.5 }}>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--green)' }}></i> Baseline-compatible</span>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--amber)' }}></i> Candidate</span>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--red)' }}></i> Persistent</span>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--purple)' }}></i> Recovery</span>
          <span><i className="fa-solid fa-circle me-1" style={{ color: 'var(--gray)' }}></i> Quality warning</span>
          <span><i className="fa-solid fa-flag me-1" style={{ color: 'var(--navy)' }}></i> Annotation</span>
        </div>
      </div>

      {/* Annotations Table */}
      <div className="card-panel">
        <div className="mini-label mb-2">Annotations on this Range</div>
        <div className="table-responsive">
          <table className="dtable">
            <thead>
              <tr>
                <th>Time</th>
                <th>Author</th>
                <th>Annotation Note</th>
                <th>Linked Episode</th>
              </tr>
            </thead>
            <tbody>
              {annotations.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray)' }}>
                    Tidak ada anotasi pada rentang waktu ini.
                  </td>
                </tr>
              ) : (
                annotations.map((ann, idx) => (
                  <tr key={idx}>
                    <td className="mono" style={{ fontWeight: 700 }}>{ann.time}</td>
                    <td style={{ fontWeight: 600 }}>{ann.author}</td>
                    <td>{ann.note}</td>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--navy)' }}>{ann.episode}</td>
                  </tr>
                ))
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
