import React, { useState, useEffect } from 'react';
import { StateBadge } from '../components/common/StateBadge';
import {
  GitCommit,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertOctagon,
  FileText,
  X,
  MessageSquare,
  ShieldAlert,
  ChevronRight,
  Database
} from 'lucide-react';
import { api } from '../services/api';

export const EpisodeView = ({ episodes }) => {
  const [selectedEpisode, setSelectedEpisode] = useState(episodes?.[0] || null);
  const [reviewStatus, setReviewStatus] = useState(selectedEpisode?.reviewStatus || 'Under Review');
  const [reviewerNote, setReviewerNote] = useState(selectedEpisode?.reviewerNote || '');
  const [isSaved, setIsSaved] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState('detail'); // 'detail' | 'audit'

  useEffect(() => {
    console.log('[EpisodeView] API Data (Episodes):', episodes);
  }, [episodes]);

  const handleSelectEpisode = (ep) => {
    setSelectedEpisode(ep);
    setReviewStatus(ep.reviewStatus || ep.validationLabel || 'New');
    setReviewerNote(ep.reviewerNotes || '');
    setIsSaved(false);
  };

  const handleSaveReview = async (e) => {
    e.preventDefault();
    if (!selectedEpisode) return;
    
    try {
      await api.validateEvent(selectedEpisode.id, reviewStatus, reviewerNote);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Failed to save review');
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Episode Lifecycle &amp; Reviewer Governance</h1>
        <p className="page-sub">
          Review episode deviasi dan pemulihan sebagai unit analisis temporal utama. Terintegrasi dengan trajectory chart, EMA, dan validasi ahli.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Left: Episodes List Table */}
        <div className="card-panel" style={{ padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: '#FAFBFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>All Recorded Episodes</div>
            <div style={{ fontSize: 11, color: 'var(--gray)' }}>N={episodes.length} episodes</div>
          </div>

          <div className="table-responsive">
            <table className="dtable">
            <thead>
              <tr>
                <th>Episode ID</th>
                <th>Participant</th>
                <th>Context</th>
                <th>Onset</th>
                <th>Peak</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => {
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
                    <td className="mono">{ep.onset}</td>
                    <td className="mono" style={{ fontWeight: 700, color: ep.peakScore > 2.5 ? 'var(--red)' : 'var(--ink)' }}>
                      {ep.peakScore.toFixed(2)}
                    </td>
                    <td style={{ fontSize: 11.5 }}>{ep.durationMinutes} min</td>
                    <td><StateBadge state={ep.status} /></td>
                    <td>
                      <span className={`badge-soft ${ep.reviewStatus === 'Confirmed' ? 'chip-green' : ep.reviewStatus === 'Needs Follow-up' ? 'chip-red' : 'chip-amber'}`}>
                        {ep.reviewStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        {/* Right: Selected Episode Detail & Review Panel */}
        {selectedEpisode ? (
          <div className="card-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div className="mini-label">Selected Episode Detail</div>
                <h3 className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                  {selectedEpisode.id}
                </h3>
              </div>
              <StateBadge state={selectedEpisode.status} />
            </div>

            {/* Tab Switcher for Detail vs Audit */}
            <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--line)', marginBottom: 16 }}>
              <div 
                style={{ paddingBottom: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12, color: activeRightTab === 'detail' ? 'var(--teal)' : 'var(--gray)', borderBottom: activeRightTab === 'detail' ? '2px solid var(--teal)' : '2px solid transparent' }}
                onClick={() => setActiveRightTab('detail')}
              >
                Analysis & Review
              </div>
              <div 
                style={{ paddingBottom: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12, color: activeRightTab === 'audit' ? 'var(--teal)' : 'var(--gray)', borderBottom: activeRightTab === 'audit' ? '2px solid var(--teal)' : '2px solid transparent' }}
                onClick={() => setActiveRightTab('audit')}
              >
                Audit & Provenance (AC-09)
              </div>
            </div>

            {activeRightTab === 'detail' ? (
              <>
                {/* Episode Summary Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ background: 'var(--gray-soft)', padding: 8, borderRadius: 8 }}>
                <div style={{ fontSize: 9.5, color: 'var(--gray)', textTransform: 'uppercase' }}>Onset</div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 800 }}>{selectedEpisode.onset}</div>
              </div>
              <div style={{ background: 'var(--gray-soft)', padding: 8, borderRadius: 8 }}>
                <div style={{ fontSize: 9.5, color: 'var(--gray)', textTransform: 'uppercase' }}>Peak Score</div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: 'var(--red)' }}>{selectedEpisode.peakScore.toFixed(2)}</div>
              </div>
              <div style={{ background: 'var(--gray-soft)', padding: 8, borderRadius: 8 }}>
                <div style={{ fontSize: 9.5, color: 'var(--gray)', textTransform: 'uppercase' }}>Duration</div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 800 }}>{selectedEpisode.durationMinutes}m</div>
              </div>
            </div>

            {/* Interactive Trajectory SVG Chart */}
            <div style={{ marginBottom: 18 }}>
              <div className="mini-label" style={{ marginBottom: 6 }}>Score Trajectory Curve vs Thresholds</div>
              <div style={{ background: '#0F2337', borderRadius: 10, padding: '14px 10px', color: '#ffffff' }}>
                <svg viewBox="0 0 300 100" style={{ width: '100%', height: 100, overflow: 'visible' }}>
                  {/* Threshold Line tau_in (1.86) */}
                  <line x1="0" y1="35" x2="300" y2="35" stroke="var(--red)" strokeDasharray="3 3" strokeWidth="1" />
                  <text x="5" y="32" fill="var(--red)" fontSize="8" fontFamily="JetBrains Mono">tau_in (1.86)</text>

                  {/* Threshold Line tau_out (1.18) */}
                  <line x1="0" y1="65" x2="300" y2="65" stroke="var(--amber)" strokeDasharray="3 3" strokeWidth="1" />
                  <text x="5" y="62" fill="var(--amber)" fontSize="8" fontFamily="JetBrains Mono">tau_out (1.18)</text>

                  {/* Trajectory Polyline */}
                  <polyline
                    fill="none"
                    stroke="var(--teal)"
                    strokeWidth="2.5"
                    points="0,85 35,75 70,32 105,15 140,10 175,25 210,40 245,67 280,80"
                  />
                  {/* Peak Marker */}
                  <circle cx="140" cy="10" r="4" fill="var(--red)" />
                  <text x="140" y="5" fill="#ffffff" fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono">Peak 2.87</text>
                </svg>
              </div>
            </div>

            {/* Evidence Explanation */}
            <div style={{ marginBottom: 18 }}>
              <div className="mini-label" style={{ marginBottom: 6 }}>Evidence &amp; Feature Contributions</div>
              <ul style={{ listStyle: 'none', fontSize: 11.5, color: 'var(--ink)' }}>
                {(selectedEpisode.evidenceExplanation || []).map((exp, idx) => (
                  <li key={idx} style={{ padding: '3px 0', borderBottom: '1px stroke var(--line)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--teal)' }}>•</span>
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Reviewer Decision Form */}
            <form onSubmit={handleSaveReview} style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <div className="mini-label" style={{ marginBottom: 8 }}>Reviewer Validation &amp; Decision</div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray)', display: 'block', marginBottom: 4 }}>Decision Status</label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--gray-soft)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--navy)'
                  }}
                >
                  <option value="Confirmed">Confirmed (Valid Physiological Episode)</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Suppressed">Suppressed (False Alert / Artefact)</option>
                  <option value="Needs Follow-up">Needs Follow-up (Participant Check)</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray)', display: 'block', marginBottom: 4 }}>Research Note</label>
                <textarea
                  rows={3}
                  value={reviewerNote}
                  onChange={(e) => setReviewerNote(e.target.value)}
                  placeholder="Tambahkan catatan analitis atau konfirmasi klinis..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--gray-soft)',
                    fontSize: 11.5,
                    color: 'var(--ink)',
                    outline: 'none'
                  }}
                />
              </div>

              <button type="submit" className="btn-teal" style={{ width: '100%' }}>
                <CheckCircle2 size={15} />
                <span>Simpan Keputusan Reviewer</span>
              </button>

              {isSaved && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--green)', fontWeight: 600, textAlign: 'center' }}>
                  ✓ Keputusan tersimpan secara terpisah (AC-08) & log tercatat!
                </div>
              )}
            </form>
            </>
            ) : (
              // Audit Tab
              <div>
                <div className="mini-label" style={{ marginBottom: 12 }}>Model Version & Baseline Provenance</div>
                
                <div style={{ background: 'var(--gray-soft)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Database size={14} color="var(--navy)" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>Engine Configuration</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink)' }}>Model: <span className="mono">v2.1.4-beta</span></div>
                  <div style={{ fontSize: 11, color: 'var(--ink)' }}>Baseline Profile ID: <span className="mono">BP-{selectedEpisode.participantId}-004</span></div>
                  <div style={{ fontSize: 11, color: 'var(--ink)' }}>Execution ID: <span className="mono">EXEC-9382104</span></div>
                </div>

                <div className="mini-label" style={{ marginBottom: 12 }}>Audit Trail</div>
                <div style={{ borderLeft: '2px solid var(--line)', paddingLeft: 12, marginLeft: 6 }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--gray)' }}>{selectedEpisode.onset}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>Episode detected by algorithm</div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--gray)' }}>{selectedEpisode.onset} + 15m</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>EMA 1 Sent (Context confirmation)</div>
                  </div>
                  {isSaved && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: 'var(--gray)' }}>Just now</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal)' }}>Reviewer updated decision to: {reviewStatus}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray)' }}>
            Pilih episode untuk melihat detail
          </div>
        )}
      </div>
    </div>
  );
};
