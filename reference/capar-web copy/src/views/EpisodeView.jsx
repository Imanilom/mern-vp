import React, { useState } from 'react';
import { StateBadge } from '../components/common/StateBadge';
import {
  Clock,
  TrendingUp,
  FileText,
  MessageSquare,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Layers,
  X,
  GitCompare
} from 'lucide-react';

export const EpisodeView = ({ episodes }) => {
  const [selectedEpisode, setSelectedEpisode] = useState(episodes[0] || null);
  const [filterState, setFilterState] = useState('ALL');
  const [reviewStatus, setReviewStatus] = useState(selectedEpisode?.reviewStatus || 'Under Review');
  const [reviewerNote, setReviewerNote] = useState(selectedEpisode?.reviewerNote || '');
  const [isSaved, setIsSaved] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const handleSelectEpisode = (ep) => {
    setSelectedEpisode(ep);
    setReviewStatus(ep.reviewStatus || 'Under Review');
    setReviewerNote(ep.reviewerNote || '');
    setIsSaved(false);
  };

  const handleSaveReview = (e) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const filteredEpisodes = episodes.filter(ep => {
    if (filterState !== 'ALL' && ep.status !== filterState) return false;
    return true;
  });

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">W02. Episode Review &amp; Trajectory Audit</h1>
        <p className="page-sub">
          Review onset, persistence, recovery, EMA responses, dan status episode deviasi–recovery yang auditable.
        </p>
      </div>

      {/* Filter Bar (W02 Addendum) */}
      <div className="filter-bar" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
          <Sliders size={14} color="var(--teal)" />
          <span>Filters:</span>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--gray)', background: 'var(--surface)', padding: '5px 10px', borderRadius: 8, border: '1px solid var(--line)' }}>
          Date: 27 May–30 May 2024
        </div>

        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '5px 10px',
            fontSize: 11.5,
            color: 'var(--ink)'
          }}
        >
          <option value="ALL">State Resolved: All</option>
          <option value="RECOVERED">RECOVERED</option>
          <option value="RECOVERY">RECOVERY</option>
          <option value="UNRESOLVED">UNRESOLVED</option>
        </select>

        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--gray)' }}>
          Showing <b>{filteredEpisodes.length}</b> of <b>{episodes.length}</b> episodes
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Left: Episodes List Table */}
        <div className="card-panel" style={{ padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: '#FAFBFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Auditable Deviation-Recovery Records</div>
            <div style={{ fontSize: 11, color: 'var(--gray)' }}>N={filteredEpisodes.length}</div>
          </div>

          <div className="table-responsive">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Episode ID</th>
                  <th>Participant</th>
                  <th>Context</th>
                  <th>Peak Score</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEpisodes.map((ep) => {
                  const isSelected = selectedEpisode?.id === ep.id;
                  return (
                    <tr
                      key={ep.id}
                      onClick={() => handleSelectEpisode(ep)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'var(--teal-soft)' : 'transparent'
                      }}
                    >
                      <td className="mono" style={{ fontWeight: 800, color: 'var(--navy)' }}>
                        {ep.id}
                      </td>
                      <td className="mono" style={{ fontWeight: 600 }}>{ep.participantId}</td>
                      <td style={{ textTransform: 'capitalize' }}>{ep.context}</td>
                      <td className="mono" style={{ fontWeight: 700, color: ep.peakScore > 2.5 ? 'var(--red)' : 'var(--ink)' }}>
                        {ep.peakScore.toFixed(2)}
                      </td>
                      <td style={{ fontSize: 11.5 }}>{ep.durationMinutes} min</td>
                      <td><StateBadge state={ep.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Selected Episode Detail & Trajectory View (W02 Addendum) */}
        {selectedEpisode ? (
          <div className="card-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div className="mini-label">Selected Episode Inspection</div>
                <h3 className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                  {selectedEpisode.id} ({selectedEpisode.participantId})
                </h3>
              </div>
              <StateBadge state={selectedEpisode.status} />
            </div>

            {/* Interactive Trajectory SVG Chart with Light Theme and Window Grid */}
            <div style={{ marginBottom: 18 }}>
              <div className="mini-label" style={{ marginBottom: 6 }}>Trajectory Curve &amp; Threshold Bounds</div>
              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '16px 14px 12px 14px', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray)', fontWeight: 700, marginBottom: 6 }}>
                  <span>Y-AXIS: DEVIATION SCORE (SD)</span>
                  <span>X-AXIS: WINDOW SEQUENCES (W1–W5)</span>
                </div>

                <svg viewBox="0 0 400 130" style={{ width: '100%', height: 130, overflow: 'visible' }}>
                  {/* Vertical Window Gridlines */}
                  <line x1="40" y1="20" x2="40" y2="105" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
                  <line x1="90" y1="20" x2="90" y2="105" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
                  <line x1="170" y1="20" x2="170" y2="105" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
                  <line x1="260" y1="20" x2="260" y2="105" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />
                  <line x1="380" y1="20" x2="380" y2="105" stroke="#CBD5E1" strokeDasharray="3 3" opacity="0.6" />

                  {/* Y-Axis Gridlines & Labels */}
                  <line x1="40" y1="20" x2="380" y2="20" stroke="#E2E8F0" strokeDasharray="2 2" />
                  <text x="34" y="23" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">3.0</text>

                  <line x1="40" y1="50" x2="380" y2="50" stroke="#E2E8F0" strokeDasharray="2 2" />
                  <text x="34" y="53" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">2.0</text>

                  <line x1="40" y1="80" x2="380" y2="80" stroke="#E2E8F0" strokeDasharray="2 2" />
                  <text x="34" y="83" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">1.0</text>

                  <line x1="40" y1="105" x2="380" y2="105" stroke="#94A3B8" strokeWidth="1.2" />
                  <text x="34" y="108" fill="#64748B" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" fontWeight="bold">0.0</text>

                  {/* Threshold Line tau_in */}
                  <line x1="40" y1="54" x2="380" y2="54" stroke="#DC2626" strokeDasharray="4 4" strokeWidth="1.5" />
                  <text x="384" y="57" fill="#DC2626" fontSize="8.5" fontWeight="bold" fontFamily="JetBrains Mono">tau_in</text>

                  {/* Trajectory Area Fill */}
                  <defs>
                    <linearGradient id="epGradLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#DC2626" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#DC2626" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d="M 40 95 L 90 70 L 170 30 L 260 65 L 380 95 L 380 105 L 40 105 Z" fill="url(#epGradLight)" />

                  {/* Trajectory Stroke Line */}
                  <path
                    d="M 40 95 L 90 70 L 170 30 L 260 65 L 380 95"
                    fill="none"
                    stroke="#DC2626"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Onset, Peak, Recovery Markers */}
                  <circle cx="90" cy="70" r="4" fill="#D97706" />
                  <circle cx="170" cy="30" r="4.5" fill="#DC2626" />
                  <circle cx="260" cy="65" r="4" fill="#7C3AED" />

                  {/* X-Axis Ticks & Labels */}
                  <text x="40" y="118" fill="#64748B" fontSize="8.5" textAnchor="middle" fontFamily="JetBrains Mono">11:20</text>
                  <text x="90" y="118" fill="#D97706" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">11:28 (Onset)</text>
                  <text x="170" y="118" fill="#DC2626" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">Peak (2.87)</text>
                  <text x="260" y="118" fill="#7C3AED" fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="JetBrains Mono">15:31 (Recov)</text>
                  <text x="380" y="118" fill="#64748B" fontSize="8.5" textAnchor="middle" fontFamily="JetBrains Mono">16:00</text>
                </svg>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line)', textAlign: 'center', fontSize: 10.5 }}>
                  <div><span style={{ color: 'var(--gray)' }}>Onset</span> <div style={{ color: 'var(--ink)', fontWeight: 800 }}>11:28:36</div></div>
                  <div><span style={{ color: 'var(--gray)' }}>Peak</span> <div style={{ color: 'var(--red)', fontWeight: 800 }}>2.87 SD</div></div>
                  <div><span style={{ color: 'var(--gray)' }}>Persistence</span> <div style={{ color: 'var(--ink)', fontWeight: 800 }}>12 windows</div></div>
                  <div><span style={{ color: 'var(--gray)' }}>Burden AUC</span> <div style={{ color: 'var(--ink)', fontWeight: 800 }}>17.15 score·min</div></div>
                </div>
              </div>
            </div>

            {/* Action Buttons (W02 Addendum) */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              <button
                onClick={() => alert('Annotasi reviewer telah dibuka.')}
                style={{ flex: 1, padding: '9px 14px', background: 'var(--teal)', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                Open Review Annotation
              </button>
              <button
                onClick={() => setShowCompareModal(true)}
                style={{ flex: 1, padding: '9px 14px', background: 'var(--surface)', color: 'var(--navy)', border: '1px solid var(--line)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <GitCompare size={14} />
                <span>Compare Episode</span>
              </button>
            </div>

            {/* Reviewer Annotation Workflow Form */}
            <form onSubmit={handleSaveReview} style={{ background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
                Reviewer Annotation &amp; Protocol Labeling
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 4 }}>Review Label Status</label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12 }}
                >
                  <option value="Confirmed">Confirmed (Validated Episode)</option>
                  <option value="Under Review">Under Review (In Progress)</option>
                  <option value="Needs Follow-up">Needs Follow-up (Artefact / Artifact)</option>
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 4 }}>Reviewer Notes</label>
                <textarea
                  rows="2"
                  value={reviewerNote}
                  onChange={(e) => setReviewerNote(e.target.value)}
                  placeholder="Contoh: Terkonfirmasi deviasi saat aktivitas berjalan. EMA 2 menunjukkan strain sedang."
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 11.5 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10.5, color: 'var(--gray)' }}>
                  Annotations are versioned and separate from engine output.
                </span>
                <button type="submit" style={{ padding: '6px 14px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>
                  {isSaved ? '✓ Saved' : 'Save Annotation'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>

      {/* Compare Episode Overlay Modal */}
      {showCompareModal && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ padding: 24, maxWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--teal)', textTransform: 'uppercase' }}>Cross-Episode Trajectory Comparison</div>
                <h3 className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                  EP-02 vs EP-01 (Participant P-014)
                </h3>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Dual Trajectory Chart SVG */}
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, border: '1px solid var(--line)', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray)', fontWeight: 700, marginBottom: 8 }}>
                <span style={{ color: '#DC2626' }}>● EP-02 (30 May · Peak 2.87 SD)</span>
                <span style={{ color: '#2563EB' }}>● EP-01 (27 May · Peak 2.40 SD)</span>
              </div>

              <svg viewBox="0 0 400 120" style={{ width: '100%', height: 120 }}>
                <line x1="30" y1="20" x2="380" y2="20" stroke="#E2E8F0" strokeDasharray="2 2" />
                <line x1="30" y1="60" x2="380" y2="60" stroke="#E2E8F0" strokeDasharray="2 2" />
                <line x1="30" y1="100" x2="380" y2="100" stroke="#94A3B8" />

                {/* EP-02 Curve (Red) */}
                <path d="M 30 95 L 90 70 L 170 30 L 260 65 L 380 95" fill="none" stroke="#DC2626" strokeWidth="2.5" />
                {/* EP-01 Curve (Blue) */}
                <path d="M 30 92 L 90 78 L 170 45 L 260 78 L 380 92" fill="none" stroke="#2563EB" strokeWidth="2" strokeDasharray="4 2" />
              </svg>
            </div>

            {/* Differential Comparison Metrics Table */}
            <div className="table-responsive" style={{ marginBottom: 16 }}>
              <table className="dtable" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>EP-02 (Latest)</th>
                    <th>EP-01 (Previous)</th>
                    <th>Difference (\(\Delta\))</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Peak Score (SD)</td>
                    <td className="mono" style={{ fontWeight: 800, color: '#DC2626' }}>2.87 SD</td>
                    <td className="mono" style={{ fontWeight: 800, color: '#2563EB' }}>2.40 SD</td>
                    <td className="mono" style={{ fontWeight: 800, color: '#DC2626' }}>+0.47 SD</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Recovery Duration</td>
                    <td className="mono">4h 02m</td>
                    <td className="mono">37m</td>
                    <td className="mono" style={{ fontWeight: 800, color: '#DC2626' }}>+3h 25m</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Burden AUC</td>
                    <td className="mono">17.15</td>
                    <td className="mono">12.03</td>
                    <td className="mono" style={{ fontWeight: 800, color: '#DC2626' }}>+5.12</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCompareModal(false)}
                style={{ padding: '8px 16px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
