import React, { useState } from 'react';
import {
  Brain,
  Award,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Sliders,
  TrendingUp,
  Flame,
  Layers,
  Lock
} from 'lucide-react';

export const ExperienceView = ({ experienceModels }) => {
  const [activeSubTab, setActiveSubTab] = useState('experience'); // 'experience' | 'gamification'

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">W03 / W04. Personal Experience Memory &amp; Gamification Observability</h1>
        <p className="page-sub">
          Observabilitas Personal Experience Memory, learned recovery profiles, dan pemantauan gamifikasi partisipasi.
        </p>
      </div>

      {/* Sub-Tab Navigation Bar (W03 vs W04 Addendum) */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
        <button
          onClick={() => setActiveSubTab('experience')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: activeSubTab === 'experience' ? 'var(--teal)' : 'var(--surface)',
            color: activeSubTab === 'experience' ? '#ffffff' : 'var(--navy)',
            fontWeight: 700,
            fontSize: 12.5,
            cursor: 'pointer',
            boxShadow: activeSubTab === 'experience' ? '0 2px 6px rgba(22, 124, 128, 0.3)' : 'none'
          }}
        >
          W03. Personal Experience Memory
        </button>

        <button
          onClick={() => setActiveSubTab('gamification')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: activeSubTab === 'gamification' ? 'var(--purple)' : 'var(--surface)',
            color: activeSubTab === 'gamification' ? '#ffffff' : 'var(--navy)',
            fontWeight: 700,
            fontSize: 12.5,
            cursor: 'pointer',
            boxShadow: activeSubTab === 'gamification' ? '0 2px 6px rgba(102, 87, 184, 0.3)' : 'none'
          }}
        >
          W04. Gamification &amp; Evidence Quality
        </button>
      </div>

      {/* TAB 1: W03. Personal Experience Memory */}
      {activeSubTab === 'experience' && (
        <div>
          {/* KPI Cards Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 18 }}>
            <div className="card-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Resolved episodes</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--teal)', margin: '4px 0' }}>12</div>
              <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>participant P-014</div>
            </div>

            <div className="card-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Median recovery</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--purple)', margin: '4px 0' }}>18 min</div>
              <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>P25 11m · P75 27m</div>
            </div>

            <div className="card-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Repeated contexts</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy)', margin: '4px 0' }}>3</div>
              <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>sitting · work · walk</div>
            </div>

            <div className="card-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Experience confidence</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)', margin: '4px 0' }}>0.72</div>
              <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>moderate evidence</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
            {/* Recovery Profile by Context (Bar chart distribution) */}
            <div className="card-panel">
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', marginBottom: 12 }}>
                Recovery Profile by Context
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>Sitting</span>
                    <span className="mono" style={{ fontWeight: 800, color: 'var(--purple)' }}>18m</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--gray-soft)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: '60%', height: '100%', background: 'var(--purple)' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>Work</span>
                    <span className="mono" style={{ fontWeight: 800, color: 'var(--purple)' }}>24m</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--gray-soft)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: '80%', height: '100%', background: 'var(--purple)' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>Walking</span>
                    <span className="mono" style={{ fontWeight: 800, color: 'var(--purple)' }}>9m</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--gray-soft)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: '30%', height: '100%', background: 'var(--purple)' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Learned Transition Probabilities */}
            <div className="card-panel">
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', marginBottom: 12 }}>
                Learned Transition Probabilities
              </div>

              <div className="table-responsive">
                <table className="dtable">
                  <thead>
                    <tr>
                      <th>From</th>
                      <th>To</th>
                      <th>Probability</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="chip-red" style={{ fontSize: 10 }}>PERSISTENT</span></td>
                      <td><span className="chip-purple" style={{ fontSize: 10 }}>RECOVERY</span></td>
                      <td className="mono" style={{ fontWeight: 800 }}>0.63</td>
                      <td style={{ fontSize: 11 }}>8 transitions</td>
                    </tr>
                    <tr>
                      <td><span className="chip-purple" style={{ fontSize: 10 }}>RECOVERY</span></td>
                      <td><span className="chip-green" style={{ fontSize: 10 }}>RECOVERED</span></td>
                      <td className="mono" style={{ fontWeight: 800 }}>0.78</td>
                      <td style={{ fontSize: 11 }}>10 transitions</td>
                    </tr>
                    <tr>
                      <td><span className="chip-purple" style={{ fontSize: 10 }}>RECOVERY</span></td>
                      <td><span className="chip-red" style={{ fontSize: 10 }}>PERSISTENT</span></td>
                      <td className="mono" style={{ fontWeight: 800 }}>0.14</td>
                      <td style={{ fontSize: 11 }}>2 reversals</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Episode Memory Log */}
          <div className="card-panel" style={{ padding: 0 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: '#FAFBFC', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
              Episode Experience &amp; Memory Registry
            </div>
            <div className="table-responsive">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Episode</th>
                    <th>Context</th>
                    <th>Peak Score</th>
                    <th>Recovery Time</th>
                    <th>Learning Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>30 May</td>
                    <td className="mono">EP-02</td>
                    <td>duduk-berdiri</td>
                    <td className="mono">2.87</td>
                    <td>4h 02m</td>
                    <td><span className="badge-soft chip-purple">stored; high duration</span></td>
                  </tr>
                  <tr>
                    <td>27 May</td>
                    <td className="mono">EP-01</td>
                    <td>kegiatan anak</td>
                    <td className="mono">2.40</td>
                    <td>37m</td>
                    <td><span className="badge-soft chip-green">stored</span></td>
                  </tr>
                  <tr>
                    <td>26 May</td>
                    <td className="mono">EP-00</td>
                    <td>sitting</td>
                    <td className="mono">1.96</td>
                    <td>17m</td>
                    <td><span className="badge-soft chip-amber">threshold calibration</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: W04. Gamification & Evidence Quality Observability */}
      {activeSubTab === 'gamification' && (
        <div>
          {/* KPI Cards Row (W04 Addendum) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 18 }}>
            <div className="card-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Active participants</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--teal)', margin: '4px 0' }}>18</div>
              <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>16 evaluable</div>
            </div>

            <div className="card-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Mission completion</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)', margin: '4px 0' }}>78%</div>
              <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>past 7 days</div>
            </div>

            <div className="card-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>EMA completion</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--purple)', margin: '4px 0' }}>71%</div>
              <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>episode-linked</div>
            </div>

            <div className="card-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase' }}>Evidence L4+</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy)', margin: '4px 0' }}>9</div>
              <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>participants</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18 }}>
            {/* Participant Evidence Journeys Table */}
            <div className="card-panel" style={{ padding: 0 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: '#FAFBFC', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
                Participant Evidence Journeys
              </div>
              <div className="table-responsive">
                <table className="dtable">
                  <thead>
                    <tr>
                      <th>Participant</th>
                      <th>Level</th>
                      <th>Mission</th>
                      <th>EMA</th>
                      <th>Baseline Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="mono" style={{ fontWeight: 800 }}>P-014</td>
                      <td><span className="chip-purple" style={{ fontWeight: 800 }}>L4</span></td>
                      <td style={{ fontSize: 11 }}>2/3</td>
                      <td style={{ fontSize: 11 }}>3/4</td>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--green)' }}>82%</td>
                    </tr>
                    <tr>
                      <td className="mono" style={{ fontWeight: 800 }}>P-027</td>
                      <td><span className="chip-purple" style={{ fontWeight: 800 }}>L5</span></td>
                      <td style={{ fontSize: 11 }}>3/3</td>
                      <td style={{ fontSize: 11 }}>4/4</td>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--green)' }}>100%</td>
                    </tr>
                    <tr>
                      <td className="mono" style={{ fontWeight: 800 }}>P-031</td>
                      <td><span className="chip-amber" style={{ fontWeight: 800 }}>L2</span></td>
                      <td style={{ fontSize: 11 }}>1/3</td>
                      <td style={{ fontSize: 11 }}>0/0</td>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--amber)' }}>44%</td>
                    </tr>
                    <tr>
                      <td className="mono" style={{ fontWeight: 800 }}>P-042</td>
                      <td><span className="chip-teal" style={{ fontWeight: 800 }}>L3</span></td>
                      <td style={{ fontSize: 11 }}>2/3</td>
                      <td style={{ fontSize: 11 }}>2/4</td>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--teal)' }}>71%</td>
                    </tr>
                    <tr>
                      <td className="mono" style={{ fontWeight: 800 }}>P-056</td>
                      <td><span className="chip-purple" style={{ fontWeight: 800 }}>L4</span></td>
                      <td style={{ fontSize: 11 }}>3/3</td>
                      <td style={{ fontSize: 11 }}>4/4</td>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--green)' }}>88%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Gamification Safety & Integrity Box (W04 Addendum) */}
            <div className="card-panel" style={{ background: '#F8FAFC' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} />
                <span>Gamification Safety &amp; Integrity</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>
                NON-CLINICAL GUARANTEE
              </div>
              <p style={{ fontSize: 11, color: 'var(--gray)', lineHeight: 1.4, marginBottom: 12 }}>
                Rewards are based on evidence quality, context confirmation, EMA completion, and documentation. Physiological values and recovery speed are strictly excluded.
              </p>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Idempotent events</span>
                  <span style={{ fontWeight: 800, color: 'var(--green)' }}>PASS</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sensitive EMA content</span>
                  <span style={{ fontWeight: 800, color: 'var(--navy)' }}>NOT STORED</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Physiology-based reward</span>
                  <span style={{ fontWeight: 800, color: 'var(--red)' }}>DISABLED</span>
                </div>
              </div>

              <div style={{ marginTop: 14, padding: 10, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--line)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 4 }}>Recent unlock</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--purple)', background: 'var(--purple-soft)', padding: '4px 10px', borderRadius: 12, display: 'inline-block' }}>
                  Context Explorer
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
