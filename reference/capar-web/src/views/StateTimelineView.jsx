import React, { useState } from 'react';

export const StateTimelineView = () => {
  const [range, setRange] = useState('Day');
  const [annotations, setAnnotations] = useState([
    { time: '08:20', author: 'Rina S. (Reviewer)', note: 'Kegiatan pagi anak — kemungkinan aktivitas fisik non-fisiologis', episode: 'EP-240527-01' },
    { time: '15:04', author: 'Dr. Aditya (PI)', note: 'Durasi persistent lama, cek device strap sebelum sesi berikutnya', episode: 'EP-240530-02' }
  ]);
  const [showAnnotateModal, setShowAnnotateModal] = useState(false);
  const [newNote, setNewNote] = useState('');

  const handleAddAnnotation = (e) => {
    e.preventDefault();
    if (!newNote) return;
    setAnnotations([
      ...annotations,
      { time: '14:30', author: 'Rina S. (Reviewer)', note: newNote, episode: 'EP-260808-07' }
    ]);
    setNewNote('');
    setShowAnnotateModal(false);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mini-label" style={{ color: 'var(--teal)' }}>W06 — State Timeline</div>
          <h1 className="page-title">P-014 · Continuous Evidence &amp; State Trace</h1>
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
        <div className="mini-label mb-2">27 May 2024 · 00:00 – 24:00 Continuous Trace</div>

        {/* State Color Band */}
        <div className="state-dist mb-1" style={{ height: 26, borderRadius: 6 }}>
          <div style={{ width: '22%', background: 'var(--green)' }} title="Baseline-compatible (22%)"></div>
          <div style={{ width: '6%', background: 'var(--gray)' }} title="Quality warning (6%)"></div>
          <div style={{ width: '14%', background: 'var(--amber)' }} title="Candidate (14%)"></div>
          <div style={{ width: '10%', background: 'var(--red)' }} title="Persistent (10%)"></div>
          <div style={{ width: '8%', background: 'var(--purple)' }} title="Recovery (8%)"></div>
          <div style={{ width: '40%', background: 'var(--green)' }} title="Baseline-compatible (40%)"></div>
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
            <svg viewBox="0 0 700 24" style={{ width: '100%', height: 24 }}>
              <rect x="0" y="2" width="150" height="20" rx="3" fill="var(--gray-soft)" />
              <rect x="150" y="2" width="80" height="20" rx="3" fill="var(--blue-soft)" />
              <rect x="230" y="2" width="222" height="20" rx="3" fill="var(--gray-soft)" />
              <rect x="452" y="2" width="130" height="20" rx="3" fill="var(--teal-soft)" />
              <rect x="582" y="2" width="118" height="20" rx="3" fill="var(--gray-soft)" />
              <text x="6" y="16" fontSize="9" fill="var(--gray)" fontFamily="Inter">sleep</text>
              <text x="156" y="16" fontSize="9" fill="var(--blue)" fontFamily="Inter">kegiatan anak</text>
              <text x="236" y="16" fontSize="9" fill="var(--gray)" fontFamily="Inter">sitting</text>
              <text x="458" y="16" fontSize="9" fill="var(--teal)" fontFamily="Inter">duduk-berdiri</text>
              <text x="588" y="16" fontSize="9" fill="var(--gray)" fontFamily="Inter">rest</text>
            </svg>
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
              {annotations.map((ann, idx) => (
                <tr key={idx}>
                  <td className="mono" style={{ fontWeight: 700 }}>{ann.time}</td>
                  <td style={{ fontWeight: 600 }}>{ann.author}</td>
                  <td>{ann.note}</td>
                  <td className="mono" style={{ fontWeight: 700, color: 'var(--navy)' }}>{ann.episode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Annotate */}
      {showAnnotateModal && (
        <div className="modal-overlay" onClick={() => setShowAnnotateModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, padding: 20 }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Add Timeline Annotation</h3>
              <button onClick={() => setShowAnnotateModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button>
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
