/**
 * ZeroShotView.jsx  (v2 — Full Pipeline Context)
 * ─────────────────────────────────────────────────────────────────────────────
 * Menu "AI Zero-Shot Analyst" — membaca 6 sumber log CAPAR:
 *   [1] Monitoring  [2] Baseline  [3] State Timeline
 *   [4] Episode List  [5] Experience  [6] Prediksi
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

// ── Konstanta ─────────────────────────────────────────────────────────────────
const RISK_COLORS = {
  rendah:  { bg: '#E7F4E8', text: '#2E7D32', border: '#A5D6A7', icon: 'fa-shield-halved' },
  sedang:  { bg: '#FBF0DD', text: '#D98800', border: '#FFD54F', icon: 'fa-triangle-exclamation' },
  tinggi:  { bg: '#FAE6E6', text: '#B52A2A', border: '#EF9A9A', icon: 'fa-circle-exclamation' },
  kritis:  { bg: '#3D0000', text: '#FF6B6B', border: '#B52A2A', icon: 'fa-skull-crossbones' },
};
const CONF_COLORS = {
  tinggi: { bg: '#E7F4E8', text: '#2E7D32' },
  sedang: { bg: '#FBF0DD', text: '#D98800' },
  rendah: { bg: '#FAE6E6', text: '#B52A2A' },
};

// ── UI Components ─────────────────────────────────────────────────────────────
function Card({ title, icon, children, accent = 'var(--teal)', tag, style = {} }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid var(--line)',
      boxShadow: '0 1px 4px rgba(0,0,0,.05)', overflow: 'hidden', ...style,
    }}>
      {title && (
        <div style={{
          padding: '11px 16px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(90deg, ${accent}10, transparent)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon && <i className={`fa-solid ${icon}`} style={{ color: accent, fontSize: 13 }} />}
            <span style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--navy)' }}>{title}</span>
          </div>
          {tag && (
            <span style={{
              fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
              background: `${accent}20`, color: accent, letterSpacing: '.04em',
            }}>{tag}</span>
          )}
        </div>
      )}
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function AIInsightBlock({ text, color = 'var(--teal)' }) {
  if (!text) return <span style={{ color: 'var(--gray)', fontSize: 12 }}>—</span>;
  return (
    <p style={{
      margin: 0, fontSize: 13, lineHeight: 1.75, color: 'var(--ink)',
      borderLeft: `3px solid ${color}`, paddingLeft: 12,
    }}>{text}</p>
  );
}

function RiskBadge({ level }) {
  const c = RISK_COLORS[level?.toLowerCase()] || RISK_COLORS.sedang;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '6px 14px', borderRadius: 999, fontWeight: 800, fontSize: 12,
      background: c.bg, color: c.text, border: `1.5px solid ${c.border}`,
    }}>
      <i className={`fa-solid ${c.icon}`} />
      {(level || 'N/A').toUpperCase()}
    </div>
  );
}

function DataSourceBadge({ label, active }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
      background: active ? 'var(--teal-soft)' : 'var(--gray-soft)',
      color: active ? 'var(--teal)' : 'var(--gray)',
      border: `1px solid ${active ? 'var(--teal)' : 'var(--line)'}`,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <i className={`fa-solid ${active ? 'fa-check-circle' : 'fa-circle-xmark'}`} style={{ fontSize: 9 }} />
      {label}
    </span>
  );
}

function PromptModal({ prompt, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-container" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 800, width: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-terminal" style={{ color: 'var(--teal)' }} />
            <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--navy)' }}>Zero-Shot Prompt Preview (6 Log Sources)</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: 'var(--gray)' }}>✕</button>
        </div>
        <pre style={{
          margin: 0, padding: 18, overflow: 'auto', flex: 1,
          fontSize: 11, lineHeight: 1.65, fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--ink)', background: '#FAFBFC', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{prompt}</pre>
      </div>
    </div>
  );
}

// ── Result Panel ──────────────────────────────────────────────────────────────
function ResultPanel({ result, meta }) {
  const r = result || {};
  const [activeTab, setActiveTab] = useState('patient');
  const riskLevel = r.risk_level?.toLowerCase() || 'sedang';
  const riskC  = RISK_COLORS[riskLevel]  || RISK_COLORS.sedang;
  const confC  = CONF_COLORS[r.confidence?.toLowerCase()] || CONF_COLORS.sedang;

  const TABS = [
    { id: 'patient',   label: 'Pasien',             icon: 'fa-user-heart' },
    { id: 'monitor',   label: 'Monitoring',         icon: 'fa-satellite-dish' },
    { id: 'baseline',  label: 'Baseline',           icon: 'fa-chart-simple' },
    { id: 'state',     label: 'State',              icon: 'fa-timeline' },
    { id: 'autonomic', label: 'Autonomic Recovery', icon: 'fa-heart-pulse' },
    { id: 'episode',   label: 'Episode',            icon: 'fa-wave-square' },
    { id: 'experience',label: 'Experience',         icon: 'fa-brain' },
    { id: 'predict',   label: 'Prediksi',           icon: 'fa-bullseye' },
    { id: 'clinical',  label: 'Klinis',             icon: 'fa-stethoscope' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Status Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center',
        padding: '12px 16px', borderRadius: 10,
        background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-3) 100%)', color: '#fff',
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>Explain AI — Autonomic & Full Context Grounding</div>
          <div style={{ fontSize: 10.5, color: '#8FB6C4' }}>
            Provider: {meta?.provider?.toUpperCase()} · Mode: {meta?.mode} · {meta?.prompt_length} chars
          </div>
          {meta?.data_sources && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              <DataSourceBadge label="Monitoring"   active={meta.data_sources.recent_segments > 0} />
              <DataSourceBadge label="Baseline"     active={meta.data_sources.has_baseline} />
              <DataSourceBadge label="State Log"    active={meta.data_sources.state_log_entries > 0} />
              <DataSourceBadge label="Autonomic"    active={true} />
              <DataSourceBadge label="Episodes"     active={meta.data_sources.episode_history > 0} />
              <DataSourceBadge label="Experience"   active={meta.data_sources.has_experience} />
              <DataSourceBadge label="Prediksi"     active={meta.data_sources.has_forecast} />
            </div>
          )}
        </div>
        <RiskBadge level={r.risk_level} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9.5, color: '#8FB6C4', marginBottom: 3 }}>CONFIDENCE</div>
          <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: confC.bg, color: confC.text }}>
            {(r.confidence || '—').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: 4, paddingBottom: 2 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              flex: 'none', padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
              border: activeTab === t.id ? '1.5px solid var(--teal)' : '1.5px solid var(--line)',
              background: activeTab === t.id ? 'var(--teal-soft)' : '#fff',
              color: activeTab === t.id ? 'var(--teal)' : 'var(--gray)',
              fontWeight: 700, fontSize: 11.5, whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 5, transition: 'all .12s ease',
            }}>
            <i className={`fa-solid ${t.icon}`} style={{ fontSize: 11 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Patient */}
      {activeTab === 'patient' && (
        <div style={{
          padding: 20, borderRadius: 12,
          background: 'linear-gradient(135deg, #E4F3F3, #F0FAF5)',
          border: '1.5px solid var(--teal)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <i className="fa-solid fa-user-heart" style={{ color: 'var(--teal)', fontSize: 16 }} />
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--teal)' }}>Ringkasan untuk Pasien</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: '#17324D' }}>{r.patient_summary || '—'}</p>
          {r.risk_reason && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: riskC.bg, border: `1px solid ${riskC.border}`, fontSize: 12, color: riskC.text, fontWeight: 600 }}>
              <i className={`fa-solid ${riskC.icon}`} style={{ marginRight: 6 }} />{r.risk_reason}
            </div>
          )}
        </div>
      )}

      {/* Monitoring */}
      {activeTab === 'monitor' && (
        <Card title="Interpretasi Monitoring Real-Time" icon="fa-satellite-dish" accent="var(--blue)" tag="LOG 1">
          <AIInsightBlock text={r.monitoring_insight} color="var(--blue)" />
        </Card>
      )}

      {/* Baseline */}
      {activeTab === 'baseline' && (
        <Card title="Evaluasi Baseline Personal" icon="fa-chart-simple" accent="var(--teal)" tag="LOG 2">
          <AIInsightBlock text={r.baseline_evaluation} color="var(--teal)" />
        </Card>
      )}

      {/* State */}
      {activeTab === 'state' && (
        <Card title="Penjelasan Transisi FSM" icon="fa-timeline" accent="var(--purple)" tag="LOG 3">
          <AIInsightBlock text={r.state_transition_explanation} color="var(--purple)" />
        </Card>
      )}

      {/* Autonomic Recovery */}
      {activeTab === 'autonomic' && (
        <Card title="Analisis Fisiologis Pemulihan Otonom (Autonomic Recovery)" icon="fa-heart-pulse" accent="var(--teal)" tag="ANS GROUNDING">
          <AIInsightBlock text={r.autonomic_recovery_analysis} color="var(--teal)" />
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--teal-soft)', fontSize: 11.5, color: 'var(--navy)', lineHeight: 1.6 }}>
            <i className="fa-solid fa-circle-info" style={{ marginRight: 6, color: 'var(--teal)' }} />
            <strong>Grounding Medis:</strong> Menghubungkan kinetik deselerasi HR dan reaktivasi tonus vagal parasimpatis (RMSSD) pasca-deviasi dengan kapasitas regulasi otonom.
          </div>
        </Card>
      )}

      {/* Episode History */}
      {activeTab === 'episode' && (
        <Card title="Pola Riwayat Episode" icon="fa-wave-square" accent="var(--amber)" tag="LOG 4">
          <AIInsightBlock text={r.episode_history_pattern} color="var(--amber)" />
        </Card>
      )}

      {/* Experience */}
      {activeTab === 'experience' && (
        <Card title="Insight Experience Memory" icon="fa-brain" accent="var(--green)" tag="LOG 5">
          <AIInsightBlock text={r.experience_insight} color="var(--green)" />
        </Card>
      )}

      {/* Prediksi */}
      {activeTab === 'predict' && (
        <Card title="Interpretasi Prediksi & Recovery" icon="fa-bullseye" accent="var(--red)" tag="LOG 6">
          <AIInsightBlock text={r.prediction_interpretation} color="var(--red)" />
        </Card>
      )}

      {/* Clinical */}
      {activeTab === 'clinical' && (
        <Card title="Catatan Klinis (Dokter/Peneliti)" icon="fa-stethoscope" accent="var(--navy)">
          <AIInsightBlock text={r.clinical_notes} color="var(--navy)" />
          {r.confidence_reason && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: 'var(--gray-soft)', fontSize: 11.5, color: 'var(--gray)' }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />{r.confidence_reason}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main View
// ═══════════════════════════════════════════════════════════════════════════════
export function ZeroShotView({ globalParticipantFilter }) {
  const [episodes,       setEpisodes]       = useState([]);
  const [selectedEp,     setSelectedEp]     = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [fetchingEps,    setFetchingEps]    = useState(false);
  const [result,         setResult]         = useState(null);
  const [meta,           setMeta]           = useState(null);
  const [error,          setError]          = useState(null);
  const [showPrompt,     setShowPrompt]     = useState(false);
  const [promptText,     setPromptText]     = useState('');
  const [promptLoading,  setPromptLoading]  = useState(false);
  const [activeMode,     setActiveMode]     = useState('episode');
  const [exportedJson,   setExportedJson]   = useState('');
  const [exportedParsed, setExportedParsed] = useState(null);
  const [exportedError,  setExportedError]  = useState(null);
  const [searchQ,        setSearchQ]        = useState('');

  // Load episodes
  const loadEpisodes = useCallback(async () => {
    setFetchingEps(true);
    try {
      const res = await api.listZeroShotEpisodes(globalParticipantFilter);
      setEpisodes(Array.isArray(res?.data) ? res.data : []);
    } catch { setEpisodes([]); }
    finally { setFetchingEps(false); }
  }, [globalParticipantFilter]);

  useEffect(() => { loadEpisodes(); }, [loadEpisodes]);

  // Filter episodes
  const filteredEps = episodes.filter(ep => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (ep.activity || '').toLowerCase().includes(q)
        || (ep.classification || '').toLowerCase().includes(q)
        || (ep._id || '').toLowerCase().includes(q);
  });

  // Preview prompt
  const handlePreviewPrompt = async () => {
    if (activeMode === 'episode' && !selectedEp) return;
    setPromptLoading(true);
    try {
      if (activeMode === 'exported' && exportedParsed) {
        setPromptText(JSON.stringify(exportedParsed, null, 2));
      } else {
        const res = await api.zeroShotPromptPreview(selectedEp?._id || selectedEp?.id);
        setPromptText(res?.prompt || 'Prompt tidak tersedia.');
      }
      setShowPrompt(true);
    } catch (e) {
      setPromptText('Gagal memuat: ' + e.message);
      setShowPrompt(true);
    } finally { setPromptLoading(false); }
  };

  // Run analysis
  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setMeta(null);
    try {
      let res;
      if (activeMode === 'exported' && exportedParsed) {
        res = await api.zeroShotAnalyze(null, true, exportedParsed);
      } else {
        if (!selectedEp) throw new Error('Pilih episode terlebih dahulu.');
        res = await api.zeroShotAnalyze(selectedEp?._id || selectedEp?.id);
      }
      if (!res?.success) throw new Error(res?.message || 'Analisis gagal.');
      setResult(res.result);
      setMeta({ provider: res.provider, mode: res.mode, prompt_length: res.prompt_length, data_sources: res.data_sources });
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const handleExportedChange = (val) => {
    setExportedJson(val);
    try { setExportedParsed(JSON.parse(val)); setExportedError(null); }
    catch { setExportedParsed(null); setExportedError('JSON tidak valid'); }
  };

  const canAnalyze = activeMode === 'episode' ? !!selectedEp : (!!exportedParsed && !exportedError);

  return (
    <div style={{ padding: '20px 24px', minHeight: '100%', background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--navy), var(--teal))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="fa-solid fa-lightbulb" style={{ color: '#fff', fontSize: 17 }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--navy)' }}>Explain</h1>
            <div style={{ fontSize: 12, color: 'var(--gray)' }}>
              AI Multimodal Grounding: 6 Log Sources + Autonomic Nervous System (ANS) Recovery Model
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT: Input Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Mode selector */}
          <Card title="Sumber Input" icon="fa-database" style={{ padding: 0 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[
                { id: 'episode', label: 'Episode DB', icon: 'fa-wave-square' },
                { id: 'exported', label: 'Paste JSON', icon: 'fa-code' },
              ].map(m => (
                <button key={m.id} onClick={() => { setActiveMode(m.id); setResult(null); setError(null); setMeta(null); }}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    border: activeMode === m.id ? '1.5px solid var(--teal)' : '1.5px solid var(--line)',
                    background: activeMode === m.id ? 'var(--teal-soft)' : '#fff',
                    color: activeMode === m.id ? 'var(--teal)' : 'var(--gray)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}>
                  <i className={`fa-solid ${m.icon}`} style={{ fontSize: 10 }} />{m.label}
                </button>
              ))}
            </div>

            {activeMode === 'episode' ? (
              <>
                {/* Search */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray)', fontSize: 12 }} />
                  <input
                    placeholder="Cari aktivitas / klasifikasi..."
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 11.5, color: 'var(--ink)', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gray)', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  <span>Episode {fetchingEps && <i className="fa-solid fa-spinner fa-spin" style={{ marginLeft: 4 }} />}</span>
                  <span style={{ color: 'var(--teal)' }}>{filteredEps.length} item</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 310, overflowY: 'auto', paddingRight: 2 }}>
                  {filteredEps.length === 0 && !fetchingEps && (
                    <div style={{ padding: 12, textAlign: 'center', color: 'var(--gray)', fontSize: 12 }}>Tidak ada episode</div>
                  )}
                  {filteredEps.map(ep => {
                    const isActive = (selectedEp?._id || selectedEp?.id) === (ep._id || ep.id);
                    const ts = ep.onset_time ? new Date(ep.onset_time < 1e12 ? ep.onset_time * 1000 : ep.onset_time) : null;
                    const isAlert = ep.classification === 'Alert';
                    const col = isAlert ? 'var(--red)' : 'var(--amber)';

                    return (
                      <button key={ep._id || ep.id} onClick={() => { setSelectedEp(ep); setResult(null); setError(null); setMeta(null); }}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left',
                          padding: '8px 11px', borderRadius: 8, cursor: 'pointer',
                          border: isActive ? '1.5px solid var(--teal)' : '1.5px solid var(--line)',
                          background: isActive ? 'var(--teal-soft)' : '#fff',
                          transition: 'all .12s ease',
                        }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: col, marginBottom: 2 }}>
                            {ep.classification || '?'} · {ep.activity || '?'}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--gray)' }}>
                            {ep.duration_ms ? Math.round(ep.duration_ms / 60000) + ' mnt' : '—'} · {ep.admin_status || '—'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--gray)' }}>
                            {ts ? ts.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '—'}
                          </div>
                          {ep.relapse && (
                            <span style={{ fontSize: 9.5, color: 'var(--red)', fontWeight: 700 }}>Relapse</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gray)', marginBottom: 6, textTransform: 'uppercase' }}>
                  Paste isi exported_graph_data.json
                </div>
                <textarea
                  placeholder='{"raw_data": {...}, "fsm_states": [...], "thresholds": {...}}'
                  value={exportedJson}
                  onChange={e => handleExportedChange(e.target.value)}
                  style={{
                    width: '100%', minHeight: 180, padding: 10, borderRadius: 8,
                    border: exportedError ? '1.5px solid var(--red)' : '1.5px solid var(--line)',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, resize: 'vertical',
                    color: 'var(--ink)', background: '#FAFBFC', boxSizing: 'border-box',
                  }}
                />
                {exportedError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{exportedError}</div>}
                {exportedParsed && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 3 }}>✓ JSON valid · {exportedJson.length} chars</div>}
              </>
            )}
          </Card>

          {/* Selected Episode Info */}
          {activeMode === 'episode' && selectedEp && (
            <Card title="Episode Terpilih" icon="fa-circle-info" accent="var(--blue)">
              {[
                ['ID', String(selectedEp._id || selectedEp.id).slice(-12)],
                ['Aktivitas', selectedEp.activity],
                ['Klasifikasi', selectedEp.classification],
                ['Outcome', selectedEp.physiological_outcome],
                ['State', selectedEp.current_state],
                ['Durasi', selectedEp.duration_ms ? Math.round(selectedEp.duration_ms / 60000) + ' mnt' : '—'],
                ['Peak HR', selectedEp.peak_hr ? selectedEp.peak_hr.toFixed(1) + ' bpm' : '—'],
                ['Admin', selectedEp.admin_status],
                ['Relapse', selectedEp.relapse ? 'Ya' : 'Tidak'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line)', fontSize: 11.5 }}>
                  <span style={{ color: 'var(--gray)', fontWeight: 600 }}>{k}</span>
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{v ?? '—'}</span>
                </div>
              ))}
            </Card>
          )}

          {/* 6-source indicator */}
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--navy)', color: '#8FB6C4' }}>
            <div style={{ fontSize: 10, fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em', color: '#fff' }}>
              <i className="fa-solid fa-robot" style={{ marginRight: 6 }} />Sumber Prompt (6 Log)
            </div>
            {[
              { n: 1, label: 'Monitoring real-time', icon: 'fa-satellite-dish' },
              { n: 2, label: 'Baseline personal',    icon: 'fa-chart-simple' },
              { n: 3, label: 'State Timeline FSM',   icon: 'fa-timeline' },
              { n: 4, label: 'Episode List history', icon: 'fa-wave-square' },
              { n: 5, label: 'Experience Memory',    icon: 'fa-brain' },
              { n: 6, label: 'Prediksi Markov',      icon: 'fa-bullseye' },
            ].map(({ n, label, icon }) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, fontSize: 11 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--teal)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
                <i className={`fa-solid ${icon}`} style={{ width: 14, textAlign: 'center', fontSize: 11 }} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <button onClick={handlePreviewPrompt} disabled={!canAnalyze || promptLoading}
            style={{
              padding: '9px 14px', borderRadius: 8, cursor: canAnalyze ? 'pointer' : 'not-allowed',
              border: '1.5px solid var(--line)', background: '#fff',
              fontWeight: 700, fontSize: 12, color: 'var(--navy)', opacity: canAnalyze ? 1 : .5,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
            {promptLoading ? <><i className="fa-solid fa-spinner fa-spin" />Loading...</> : <><i className="fa-solid fa-terminal" />Preview Prompt (6 sumber)</>}
          </button>

          <button id="btn-zeroshot-analyze" onClick={handleAnalyze} disabled={!canAnalyze || loading}
            style={{
              padding: '12px 14px', borderRadius: 8, cursor: canAnalyze ? 'pointer' : 'not-allowed',
              border: 'none',
              background: canAnalyze && !loading ? 'linear-gradient(135deg, var(--navy) 0%, var(--teal) 100%)' : 'var(--line)',
              fontWeight: 800, fontSize: 13, color: canAnalyze && !loading ? '#fff' : 'var(--gray)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .2s ease',
              boxShadow: canAnalyze && !loading ? '0 4px 16px rgba(22,124,128,.3)' : 'none',
            }}>
            {loading
              ? <><i className="fa-solid fa-spinner fa-spin" />Menganalisis 6 sumber...</>
              : <><i className="fa-solid fa-brain" />Jalankan Zero-Shot Analysis</>}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>

        {/* ── RIGHT: Output ── */}
        <div>
          {!result && !error && !loading && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: 480, borderRadius: 16, background: 'linear-gradient(135deg, #F8FBFF, var(--teal-soft))',
              border: '2px dashed var(--line)', gap: 16, padding: 32,
            }}>
              <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'linear-gradient(135deg, var(--navy), var(--teal))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(22,124,128,.25)' }}>
                <i className="fa-solid fa-robot" style={{ color: '#fff', fontSize: 32 }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy)', marginBottom: 6 }}>Siap Menganalisis</div>
                <div style={{ fontSize: 12.5, color: 'var(--gray)', maxWidth: 380, lineHeight: 1.65 }}>
                  Pilih episode lalu klik <strong>Jalankan Zero-Shot Analysis</strong>. AI akan membaca <strong>6 sumber log</strong> sekaligus — monitoring, baseline, state, episode history, experience, dan prediksi.
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {[
                  ['fa-satellite-dish','Monitoring','var(--blue)'],
                  ['fa-chart-simple','Baseline','var(--teal)'],
                  ['fa-timeline','State','var(--purple)'],
                  ['fa-wave-square','Episode','var(--amber)'],
                  ['fa-brain','Experience','var(--green)'],
                  ['fa-bullseye','Prediksi','var(--red)'],
                ].map(([icon, label, col]) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 8, background: '#fff', border: '1px solid var(--line)' }}>
                    <i className={`fa-solid ${icon}`} style={{ fontSize: 18, color: col }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: col }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 480, borderRadius: 16, background: 'var(--teal-soft)', border: '1px solid var(--line)', gap: 18 }}>
              <div style={{ position: 'relative', width: 72, height: 72 }}>
                <div style={{ width: 72, height: 72, border: '4px solid var(--line)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                <i className="fa-solid fa-brain" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--teal)', fontSize: 26 }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy)', marginBottom: 6 }}>Menganalisis 6 Sumber Log...</div>
                <div style={{ fontSize: 12, color: 'var(--gray)', maxWidth: 300 }}>Monitoring → Baseline → State → Episode → Experience → Prediksi</div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: 20, borderRadius: 12, background: 'var(--red-soft)', border: '1.5px solid var(--red)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--red)', fontSize: 15 }} />
                <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--red)' }}>Analisis Gagal</span>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>{error}</p>
              {error.includes('GEMINI_API_KEY') && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: '#fff', fontSize: 11.5 }}>
                  💡 Tambahkan <code style={{ color: 'var(--red)' }}>GEMINI_API_KEY</code> ke <code>api/.env</code> → restart server.{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>Dapatkan API Key</a>
                </div>
              )}
            </div>
          )}

          {result && <ResultPanel result={result} meta={meta} />}
        </div>
      </div>

      {showPrompt && <PromptModal prompt={promptText} onClose={() => setShowPrompt(false)} />}
    </div>
  );
}

export default ZeroShotView;
