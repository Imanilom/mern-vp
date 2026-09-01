/**
 * ZeroShotView.jsx  (v3 — User-Centric 360° Explain & Longitudinal Grounding)
 * ─────────────────────────────────────────────────────────────────────────────
 * Menu "Explain" — Analisis Komprehensif Berpusat pada Pengguna (User-Centric):
 *   [1] Profil Pasien & Kepatuhan Rekam Wearable
 *   [2] Portofolio Baseline (Tercapai / Mature vs Belum Tercapai / Gaps)
 *   [3] Beban Anomali & Riwayat Disregulasi (Anomaly Burden %)
 *   [4] Autonomic Recovery & Digital Phenotype (Level 2)
 *   [5] Clinical Risk Stratification & Rekomendasi Uji Konfirmasi (Level 3)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

// ── Konstanta ─────────────────────────────────────────────────────────────────
const RISK_COLORS = {
  rendah: { bg: '#E7F4E8', text: '#2E7D32', border: '#A5D6A7', icon: 'fa-shield-halved' },
  sedang: { bg: '#FBF0DD', text: '#D98800', border: '#FFD54F', icon: 'fa-triangle-exclamation' },
  tinggi: { bg: '#FAE6E6', text: '#B52A2A', border: '#EF9A9A', icon: 'fa-circle-exclamation' },
  kritis: { bg: '#3D0000', text: '#FF6B6B', border: '#B52A2A', icon: 'fa-skull-crossbones' },
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

function DataSourceBadge({ label, count, active }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
      background: active ? 'var(--teal-soft)' : 'var(--gray-soft)',
      color: active ? 'var(--teal)' : 'var(--gray)',
      border: `1px solid ${active ? 'var(--teal)' : 'var(--line)'}`,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <i className={`fa-solid ${active ? 'fa-check-circle' : 'fa-circle-xmark'}`} style={{ fontSize: 9 }} />
      {label} {count !== undefined && `(${count})`}
    </span>
  );
}

function PromptModal({ prompt, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-container" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 840, width: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-terminal" style={{ color: 'var(--teal)' }} />
            <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--navy)' }}>User-Centric 360° Explain Prompt Preview</span>
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
function ResultPanel({ result, meta, profileSummary, selectedUser }) {
  const r = result || {};
  const [activeTab, setActiveTab] = useState('overview');
  const riskLevel = r.risk_level?.toLowerCase() || 'sedang';
  const riskC = RISK_COLORS[riskLevel] || RISK_COLORS.sedang;
  const confC = CONF_COLORS[r.confidence?.toLowerCase()] || CONF_COLORS.sedang;

  const TABS = [
    { id: 'overview', label: 'Overview 360°', icon: 'fa-user-check' },
    { id: 'baseline', label: 'Portofolio Baseline', icon: 'fa-chart-simple' },
    { id: 'anomaly', label: 'Beban Anomali', icon: 'fa-wave-square' },
    { id: 'autonomic', label: 'Autonomic Recovery', icon: 'fa-heart-pulse' },
    { id: 'patient', label: 'Ringkasan Pasien', icon: 'fa-user-heart' },
    { id: 'clinical', label: 'Klinis & Diagnosis', icon: 'fa-stethoscope' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Status Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center',
        padding: '14px 18px', borderRadius: 12,
        background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-3) 100%)', color: '#fff',
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>
            Explain 360° — {selectedUser?.name || 'Profil Pengguna'}
          </div>
          <div style={{ fontSize: 11, color: '#8FB6C4' }}>
            Provider: {meta?.provider?.toUpperCase()} · Perangkat: {selectedUser?.device || 'Wearable'} · {meta?.prompt_length} chars context
          </div>
          {meta?.data_sources && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              <DataSourceBadge label="Monitoring" count={meta.data_sources.total_segments} active={meta.data_sources.total_segments > 0} />
              <DataSourceBadge label="Baseline" count={`${meta.data_sources.mature_baselines}/${meta.data_sources.all_baselines}`} active={meta.data_sources.all_baselines > 0} />
              <DataSourceBadge label="Anomali" count={meta.data_sources.episode_history} active={meta.data_sources.episode_history > 0} />
              <DataSourceBadge label="State FSM" count={meta.data_sources.state_log_entries} active={meta.data_sources.state_log_entries > 0} />
              <DataSourceBadge label="Autonomic Profile" active={true} />
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
              flex: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              border: activeTab === t.id ? '1.5px solid var(--teal)' : '1.5px solid var(--line)',
              background: activeTab === t.id ? 'var(--teal-soft)' : '#fff',
              color: activeTab === t.id ? 'var(--teal)' : 'var(--gray)',
              fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all .12s ease',
            }}>
            <i className={`fa-solid ${t.icon}`} style={{ fontSize: 12 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. Overview 360° */}
      {activeTab === 'overview' && (
        <Card title="Profil Pengguna & Pola Penggunaan Wearable" icon="fa-user-check" accent="var(--blue)" tag="LONGITUDINAL 360°">
          <AIInsightBlock text={r.user_profile_summary} color="var(--blue)" />
          {profileSummary && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10,
              marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)',
            }}>
              <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 700 }}>TOTAL REKAMAN</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--navy)' }}>{profileSummary.total_segments} window</div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 700 }}>BASELINE TERKALIBRASI</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--teal)' }}>{profileSummary.mature_baselines} / {profileSummary.total_baselines}</div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 700 }}>TOTAL ANOMALI</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: profileSummary.total_episodes > 0 ? 'var(--amber)' : 'var(--teal)' }}>
                  {profileSummary.total_episodes} episode
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 700 }}>ANOMALY BURDEN</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: profileSummary.anomaly_burden_pct > 10 ? 'var(--red)' : 'var(--navy)' }}>
                  {profileSummary.anomaly_burden_pct?.toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 2. Baseline Portfolio */}
      {activeTab === 'baseline' && (
        <Card title="Evaluasi Portofolio Baseline (Tercapai vs Belum Tercapai)" icon="fa-chart-simple" accent="var(--teal)" tag="BASELINE GAPS">
          <AIInsightBlock text={r.baseline_portfolio_evaluation} color="var(--teal)" />
          <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 8, background: 'var(--teal-soft)', fontSize: 12, color: 'var(--navy)', lineHeight: 1.6 }}>
            <i className="fa-solid fa-circle-check" style={{ marginRight: 6, color: 'var(--teal)' }} />
            <strong>Rekomendasi Kalibrasi:</strong> Baseline yang masih berstatus <em>cold_start</em> atau <em>missing</em> membutuhkan penambahan rekaman pada aktivitas terkait agar ambang batas $\tau$ terpersonalisasi optimal.
          </div>
        </Card>
      )}

      {/* 3. Anomaly Burden */}
      {activeTab === 'anomaly' && (
        <Card title="Analisis Beban Anomali & Riwayat Disregulasi" icon="fa-wave-square" accent="var(--amber)" tag="BURDEN & RELAPSE">
          <AIInsightBlock text={r.anomaly_burden_analysis} color="var(--amber)" />
          <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 8, background: '#FFF8E7', border: '1px solid #FFD54F', fontSize: 12, color: '#6A4300', lineHeight: 1.6 }}>
            <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: 6, color: '#D98800' }} />
            <strong>Beban Anomali ($AB$):</strong> Mengukur persentase waktu tubuh berada dalam keadaan deviasi fisiologis dibandingkan total durasi pemantauan.
          </div>
        </Card>
      )}

      {/* 4. Autonomic Recovery */}
      {activeTab === 'autonomic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {r.autonomic_phenotype && (
            <div style={{
              padding: '16px 18px', borderRadius: 12,
              background: 'linear-gradient(135deg, #0B2545 0%, #134074 100%)',
              color: '#fff', border: '1.5px solid #8DA9C4',
              boxShadow: '0 4px 16px rgba(11,37,69,.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fa-solid fa-dna" style={{ color: '#64DFDF', fontSize: 16 }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#8DA9C4', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Level 2 — Digital Autonomic Phenotype
                  </span>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
                  background: 'rgba(100,223,223,0.2)', color: '#64DFDF', border: '1px solid #64DFDF',
                }}>
                  LONGITUDINAL PROFILE
                </span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#FFFFFF', marginBottom: 6 }}>
                {r.autonomic_phenotype}
              </div>
              {r.phenotype_explanation && (
                <div style={{ fontSize: 12.5, color: '#EEF4F8', lineHeight: 1.65 }}>
                  {r.phenotype_explanation}
                </div>
              )}
            </div>
          )}

          <Card title="Analisis Respons Sistem Saraf Otonom (ANS Dynamics)" icon="fa-heart-pulse" accent="var(--teal)" tag="PHYSIOLOGICAL GROUNDING">
            <AIInsightBlock text={r.autonomic_recovery_analysis} color="var(--teal)" />
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--teal-soft)', fontSize: 11.5, color: 'var(--navy)', lineHeight: 1.6 }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 6, color: 'var(--teal)' }} />
              <strong>Kerangka Ilmiah:</strong> Signal → Anomaly → Recovery State → Trajectory → Phenotype → Risk Stratification → Confirmatory Diagnostics.
            </div>
          </Card>
        </div>
      )}

      {/* 5. Patient Summary */}
      {activeTab === 'patient' && (
        <div style={{
          padding: 20, borderRadius: 12,
          background: 'linear-gradient(135deg, #E4F3F3, #F0FAF5)',
          border: '1.5px solid var(--teal)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <i className="fa-solid fa-user-heart" style={{ color: 'var(--teal)', fontSize: 16 }} />
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--teal)' }}>Ringkasan 360° untuk Pasien</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: '#17324D' }}>{r.patient_summary || '—'}</p>
          {r.risk_reason && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: riskC.bg, border: `1px solid ${riskC.border}`, fontSize: 12.5, color: riskC.text, fontWeight: 600 }}>
              <i className={`fa-solid ${riskC.icon}`} style={{ marginRight: 6 }} />{r.risk_reason}
            </div>
          )}
        </div>
      )}

      {/* 6. Clinical & Confirmatory */}
      {activeTab === 'clinical' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {r.clinical_suspicion && (
            <div style={{
              padding: '14px 16px', borderRadius: 10,
              background: '#FFF8E7', border: '1.5px solid #FFD54F',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#D98800', fontSize: 14 }} />
                <span style={{ fontWeight: 800, fontSize: 12.5, color: '#B26B00', textTransform: 'uppercase' }}>
                  Level 3 — Clinical Risk Stratification & Suspicion
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: '#4A3B18' }}>
                {r.clinical_suspicion}
              </p>
              <div style={{ marginTop: 8, fontSize: 11, color: '#8C6D1F', fontStyle: 'italic' }}>
                *Bukan diagnosis definitif penyakit jantung. Data wearable berfungsi sebagai indikasi penapisan otonom longitudinal.
              </div>
            </div>
          )}

          {r.confirmatory_recommendations && (
            <div style={{
              padding: '14px 16px', borderRadius: 10,
              background: '#F0F9FF', border: '1.5px solid #7DD3FC',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <i className="fa-solid fa-stethoscope" style={{ color: '#0284C7', fontSize: 14 }} />
                <span style={{ fontWeight: 800, fontSize: 12.5, color: '#0369A1' }}>
                  Rekomendasi Uji Konfirmasi Medis
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: '#0C4A6E' }}>
                {r.confirmatory_recommendations}
              </p>
            </div>
          )}

          <Card title="Catatan Komprehensif Dokter & Peneliti" icon="fa-clipboard-medical" accent="var(--navy)">
            <AIInsightBlock text={r.clinical_notes} color="var(--navy)" />
            {r.confidence_reason && (
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: 'var(--gray-soft)', fontSize: 11.5, color: 'var(--gray)' }}>
                <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />{r.confidence_reason}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main View
// ═══════════════════════════════════════════════════════════════════════════════
export function ZeroShotView({ globalParticipantFilter }) {
  const [participants, setParticipants] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpId, setSelectedEpId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [profileSummary, setProfileSummary] = useState(null);
  const [error, setError] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [activeMode, setActiveMode] = useState('user');
  const [exportedJson, setExportedJson] = useState('');
  const [exportedParsed, setExportedParsed] = useState(null);
  const [exportedError, setExportedError] = useState(null);
  const [searchQ, setSearchQ] = useState('');

  // 1. Load participants list
  const loadParticipants = useCallback(async () => {
    setFetchingUsers(true);
    try {
      const res = await api.listZeroShotParticipants();
      const list = Array.isArray(res?.data) ? res.data : [];
      setParticipants(list);

      // Auto-select based on globalParticipantFilter or first user
      if (globalParticipantFilter && globalParticipantFilter !== 'ALL') {
        const found = list.find(p => p.id === globalParticipantFilter || p._id === globalParticipantFilter);
        if (found) setSelectedUser(found);
        else if (list.length > 0) setSelectedUser(list[0]);
      } else if (list.length > 0 && !selectedUser) {
        setSelectedUser(list[0]);
      }
    } catch {
      setParticipants([]);
    } finally {
      setFetchingUsers(false);
    }
  }, [globalParticipantFilter]);

  useEffect(() => { loadParticipants(); }, [loadParticipants]);

  // 2. Load episodes for selected user
  useEffect(() => {
    if (!selectedUser) { setEpisodes([]); return; }
    const uid = selectedUser.id || selectedUser._id;
    api.listZeroShotEpisodes(uid).then(res => {
      setEpisodes(Array.isArray(res?.data) ? res.data : []);
    }).catch(() => setEpisodes([]));
    setSelectedEpId('');
  }, [selectedUser]);

  // Filter users by search query
  const filteredUsers = participants.filter(p => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q);
  });

  // Prompt preview
  const handlePreviewPrompt = async () => {
    if (!selectedUser && activeMode === 'user') return;
    setPromptLoading(true);
    try {
      const uid = selectedUser?.id || selectedUser?._id;
      const res = await api.zeroShotPromptPreview(uid, selectedEpId || null);
      setPromptText(res?.prompt || 'Prompt tidak tersedia.');
      setShowPrompt(true);
    } catch (e) {
      alert('Gagal memuat preview: ' + e.message);
    } finally { setPromptLoading(false); }
  };

  // Run analysis
  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setMeta(null);
    setProfileSummary(null);

    try {
      let res;
      if (activeMode === 'exported' && exportedParsed) {
        res = await api.zeroShotAnalyze(null, null, true, exportedParsed);
      } else {
        if (!selectedUser) throw new Error('Pilih pengguna/pasien terlebih dahulu.');
        const uid = selectedUser.id || selectedUser._id;
        res = await api.zeroShotAnalyze(uid, selectedEpId || null);
      }
      if (!res?.success) throw new Error(res?.message || 'Analisis gagal.');
      setResult(res.result);
      setProfileSummary(res.profile_summary);
      setMeta({
        provider: res.provider,
        mode: res.mode,
        prompt_length: res.prompt_length,
        data_sources: res.data_sources,
      });
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const handleExportedChange = (val) => {
    setExportedJson(val);
    try { setExportedParsed(JSON.parse(val)); setExportedError(null); }
    catch { setExportedParsed(null); setExportedError('JSON tidak valid'); }
  };

  const canAnalyze = activeMode === 'user' ? !!selectedUser : (!!exportedParsed && !exportedError);

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
              Analisis Komprehensif 360°: Profil Pasien · Portofolio Baseline & Gaps · Beban Anomali · Fenotipe Otonom
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT: Selector Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Mode Selector */}
          <div style={{ display: 'flex', background: '#fff', borderRadius: 8, padding: 3, border: '1px solid var(--line)' }}>
            <button
              onClick={() => setActiveMode('user')}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 12,
                background: activeMode === 'user' ? 'var(--navy)' : 'transparent',
                color: activeMode === 'user' ? '#fff' : 'var(--gray)',
              }}>
              <i className="fa-solid fa-user" style={{ marginRight: 6 }} />Pilih Pasien (360°)
            </button>
            <button
              onClick={() => setActiveMode('exported')}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 12,
                background: activeMode === 'exported' ? 'var(--navy)' : 'transparent',
                color: activeMode === 'exported' ? '#fff' : 'var(--gray)',
              }}>
              <i className="fa-solid fa-file-code" style={{ marginRight: 6 }} />Manual JSON
            </button>
          </div>

          {activeMode === 'user' ? (
            <Card title="Daftar Pengguna / Pasien" icon="fa-users" accent="var(--navy)">
              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <i className="fa-solid fa-search" style={{ position: 'absolute', left: 10, top: 10, color: 'var(--gray)', fontSize: 11 }} />
                <input
                  type="text"
                  placeholder="Cari nama atau email..."
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  style={{
                    width: '100%', padding: '7px 10px 7px 28px', borderRadius: 6,
                    border: '1px solid var(--line)', fontSize: 12, boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* User list */}
              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fetchingUsers && <div style={{ fontSize: 12, color: 'var(--gray)', textAlign: 'center', padding: 12 }}>Memuat peserta...</div>}
                {!fetchingUsers && filteredUsers.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--gray)', textAlign: 'center', padding: 12 }}>Tidak ada pengguna ditemukan.</div>
                )}
                {filteredUsers.map(u => {
                  const uid = u.id || u._id;
                  const isSel = selectedUser && (selectedUser.id === uid || selectedUser._id === uid);
                  return (
                    <div key={uid} onClick={() => setSelectedUser(u)}
                      style={{
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        border: isSel ? '1.5px solid var(--teal)' : '1px solid var(--line)',
                        background: isSel ? 'var(--teal-soft)' : '#fff',
                        transition: 'all .12s',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontWeight: 800, fontSize: 12.5, color: isSel ? 'var(--teal)' : 'var(--navy)' }}>
                          {u.name}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--gray)' }}>{u.role}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, fontSize: 10.5, color: 'var(--gray)' }}>
                        <span><i className="fa-solid fa-signal" style={{ marginRight: 3 }} />{u.total_segments} win</span>
                        <span>·</span>
                        <span><i className="fa-solid fa-chart-simple" style={{ marginRight: 3 }} />{u.mature_baselines}/{u.total_baselines} base</span>
                        <span>·</span>
                        <span style={{ color: u.total_episodes > 0 ? 'var(--amber)' : 'inherit' }}>
                          <i className="fa-solid fa-wave-square" style={{ marginRight: 3 }} />{u.total_episodes} anom
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Optional Episode Focus */}
              {selectedUser && episodes.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 5 }}>
                    Fokus Episode Spesifik (Opsional):
                  </label>
                  <select
                    value={selectedEpId}
                    onChange={e => setSelectedEpId(e.target.value)}
                    style={{
                      width: '100%', padding: '7px 10px', borderRadius: 6,
                      border: '1px solid var(--line)', fontSize: 11.5, background: '#fff',
                    }}>
                    <option value="">Analisis Seluruh Profil Pasien (360° Rekomendasi)</option>
                    {episodes.map(ep => {
                      const onsetStr = ep.onset_time ? new Date(ep.onset_time < 1e12 ? ep.onset_time * 1000 : ep.onset_time).toLocaleDateString('id-ID') : '';
                      return (
                        <option key={ep._id} value={ep._id}>
                          [{ep.classification}] {ep.activity || 'Anomali'} - {onsetStr} (HR: {ep.peak_hr?.toFixed(0)} bpm)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </Card>
          ) : (
            <Card title="Input JSON Exported" icon="fa-file-code" accent="var(--purple)">
              <textarea
                placeholder="Paste JSON dari exported_graph_data.json..."
                value={exportedJson}
                onChange={e => handleExportedChange(e.target.value)}
                style={{
                  width: '100%', minHeight: 180, borderRadius: 6,
                  border: `1px solid ${exportedError ? 'var(--red)' : 'var(--line)'}`,
                  fontSize: 11, fontFamily: 'monospace', padding: 8, boxSizing: 'border-box',
                }}
              />
              {exportedError && <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>{exportedError}</div>}
            </Card>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              id="btn-zeroshot-analyze"
              onClick={handleAnalyze}
              disabled={!canAnalyze || loading}
              style={{
                padding: '12px 16px', borderRadius: 10, border: 'none', cursor: canAnalyze && !loading ? 'pointer' : 'not-allowed',
                background: canAnalyze && !loading ? 'linear-gradient(135deg, var(--teal) 0%, var(--navy) 100%)' : '#ccc',
                color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: canAnalyze && !loading ? '0 4px 12px rgba(0,168,150,.3)' : 'none',
              }}>
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
                  Menganalisis...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wand-magic-sparkles" />
                  Jelaskan
                </>
              )}
            </button>

            {activeMode === 'user' && selectedUser && (
              <button
                onClick={handlePreviewPrompt}
                disabled={promptLoading}
                style={{
                  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)',
                  background: '#fff', color: 'var(--gray)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                <i className="fa-solid fa-terminal" />
                {promptLoading ? 'Memuat Preview...' : 'Lihat Data Prompt yang Dikirim'}
              </button>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <div style={{
              padding: '12px 14px', borderRadius: 8, background: '#FAE6E6', border: '1px solid #EF9A9A',
              color: '#B52A2A', fontSize: 12, lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 800, marginBottom: 3 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />Analisis Gagal
              </div>
              {error}
            </div>
          )}
        </div>

        {/* ── RIGHT: Results Panel ── */}
        <div>
          {result ? (
            <ResultPanel
              result={result}
              meta={meta}
              profileSummary={profileSummary}
              selectedUser={selectedUser}
            />
          ) : (
            <div style={{
              padding: '48px 24px', borderRadius: 12, background: '#fff', border: '1px dashed var(--line)',
              textAlign: 'center', color: 'var(--gray)',
            }}>
              <div style={{
                width: 54, height: 54, borderRadius: '50%', background: 'var(--teal-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
              }}>
                <i className="fa-solid fa-lightbulb" style={{ color: 'var(--teal)', fontSize: 24 }} />
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--navy)', fontWeight: 800 }}>
                Explain AI — Analisis Longitudinal 360°
              </h3>
              <p style={{ margin: 0, fontSize: 12.5, maxWidth: 440, marginInline: 'auto', lineHeight: 1.6 }}>
                Pilih seorang pasien di sebelah kiri dan klik <strong>"Jalankan Explain AI (360°)"</strong> untuk menganalisis portofolio baseline, beban anomali harian, kepatuhan rekam sensor, dan fenotipe otonom secara menyeluruh.
              </p>
            </div>
          )}
        </div>
      </div>

      {showPrompt && <PromptModal prompt={promptText} onClose={() => setShowPrompt(false)} />}
    </div>
  );
}

export default ZeroShotView;
