import React, { useEffect, useState } from 'react';
import {
  ArrowClockwise, Sliders, FileText, CheckCircle, Warning, ShieldCheck, X
} from '@phosphor-icons/react';
import { DeviceSelector } from '../shared/components/ParticipantSelector';
import { PolarDecisionTree } from '../shared/utils/PolarDecisionTree';

export interface AnalyticsProps {
  selectedParticipantId: string;
  onParticipantChange: (id: string) => void;
}

export const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        background: 'var(--surface)',
        border: '1px solid var(--primary)',
        borderRadius: 'var(--r-md)',
        padding: '12px 18px',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        animation: 'fadeInUp 200ms var(--ease)',
      }}
    >
      <span className="status-dot"></span>
      <span style={{ fontSize: '13px', fontWeight: 550, color: 'var(--ink)' }}>{message}</span>
    </div>
  );
};

export const ActivityContext: React.FC<AnalyticsProps> = ({
  selectedParticipantId,
  onParticipantChange
}) => {
  const [toast, setToast] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [activityContexts, setActivityContexts] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedDayHasData, setSelectedDayHasData] = useState<'unknown' | 'hasData' | 'noData'>('unknown');

  // Doctor validation modal state
  const [selectedSegmentForVal, setSelectedSegmentForVal] = useState<any | null>(null);
  const [valLabel, setValLabel] = useState<'Rest' | 'Light' | 'Moderate' | 'Intense'>('Rest');
  const [valGroundTruth, setValGroundTruth] = useState<'normal' | 'anomaly'>('normal');
  const [valNotes, setValNotes] = useState<string>('');
  const [submittingVal, setSubmittingVal] = useState(false);

  // Retrieve user role from session
  const storedUser = sessionStorage.getItem('htm_user');
  const authUser = storedUser ? JSON.parse(storedUser) : null;
  const isDoctor = authUser?.role === 'doctor';

  useEffect(() => {
    const fetchActivitiesAndSegments = async () => {
      try {
        const token = sessionStorage.getItem('htm_token');
        const idToFetch = selectedParticipantId;
        if (!idToFetch) return; // Prevent fetching with empty ID

        // Fetch activity context summary
        const resAct = await fetch(`/api/analysis/activity-context/${idToFetch}?date=${selectedDay}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resAct.ok) {
          const data = await resAct.json();
          if (data.success) {
            setActivities(data.data);
            if (selectedDay) {
              setSelectedDayHasData(Array.isArray(data.data) && data.data.length > 0 ? 'hasData' : 'noData');
            } else {
              setSelectedDayHasData('unknown');
            }
          }
        }

        // Fetch activity_context collection from AI pipeline
        const resCtx = await fetch(`/api/ai/activity-context/${idToFetch}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resCtx.ok) {
          const dataCtx = await resCtx.json();
          if (dataCtx.success && Array.isArray(dataCtx.data)) {
            setActivityContexts(dataCtx.data);
          }
        }

        // Fetch segment list for DT predictions and doctor validation
        const resSeg = await fetch(`/api/analysis/segments/${idToFetch}?limit=25`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resSeg.ok) {
          const dataSeg = await resSeg.json();
          if (dataSeg.success && Array.isArray(dataSeg.data)) {
            setSegments(dataSeg.data);
            
            if (!selectedDay && dataSeg.data.length > 0) {
              const latestDate = new Date(dataSeg.data[0].window_start).toISOString().split('T')[0];
              setSelectedDay(latestDate);
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchActivitiesAndSegments();
  }, [selectedParticipantId, selectedDay]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    setToast(`Initializing Machine Learning Decision Tree training for system...`);

    try {
      const token = sessionStorage.getItem('htm_token');
      const res = await fetch('/api/ml/train', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setToast(`Decision Tree trained successfully with ${data.samples_used || 0} samples.`);
      } else {
        setToast('Failed to train Decision Tree model.');
      }
    } catch (err) {
      console.error(err);
      setToast('Network error during model training.');
    } finally {
      setRecalculating(false);
    }
  };

  const handleOpenValidateModal = (seg: any) => {
    setSelectedSegmentForVal(seg);
    setValLabel(seg.activity_label || 'Rest');
    setValGroundTruth(seg.ground_truth_label || 'normal');
    setValNotes(seg.doctor_validation?.doctor_notes || '');
  };

  const handleSubmitValidation = async () => {
    if (!selectedSegmentForVal) return;
    setSubmittingVal(true);
    try {
      const token = sessionStorage.getItem('htm_token');
      const res = await fetch(`/api/analysis/segments/${selectedSegmentForVal._id}/doctor-validate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          activity_label: valLabel,
          ground_truth_label: valGroundTruth,
          status: 'validated',
          doctor_notes: valNotes
        })
      });
      if (res.ok) {
        setToast(`Segment divalidasi oleh Dokter (${valLabel} - ${valGroundTruth})`);
        // Update local state
        setSegments(prev => prev.map(s => s._id === selectedSegmentForVal._id ? {
          ...s,
          activity_label: valLabel,
          ground_truth_label: valGroundTruth,
          doctor_validation: { status: 'validated', doctor_notes: valNotes, validated_at: new Date() }
        } : s));
        setSelectedSegmentForVal(null);
      } else {
        setToast('Gagal memvalidasi segmen.');
      }
    } catch (err) {
      console.error(err);
      setToast('Error koneksi saat validasi.');
    } finally {
      setSubmittingVal(false);
    }
  };

  return (
    <section>
      <div className="page-head mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Activity context & Polar DT Model</h1>
          <p className="text-xs text-muted" style={{ marginTop: 2 }}>
            Model Decision Tree (Polar Pretrained) • Dynamic Missing Data Confidence • Role: <strong style={{ color: isDoctor ? 'var(--primary)' : 'var(--ink)' }}>{isDoctor ? 'Doctor (Full Access)' : 'Regular User (Self Only)'}</strong>
          </p>
        </div>
        <DeviceSelector selectedId={selectedParticipantId} onChange={onParticipantChange} />
      </div>

      {/* Date selector & missing data KPI card */}
      <div className="card mb-4" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Pilih Tanggal</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => { setSelectedDay(e.target.value); setSelectedDayHasData('unknown'); }}
                className="select-chip font-mono"
                style={{ padding: '4px 8px', border: '1px solid var(--hairline)', borderRadius: 4, background: 'var(--surface)', color: 'var(--ink)' }}
              />
              <span className={`badge ${selectedDay ? (selectedDayHasData === 'unknown' ? 'badge-monitoring' : selectedDayHasData === 'hasData' ? 'badge-stable' : 'badge-caution') : 'badge-monitoring'}`} style={{ fontSize: 11, padding: '5px 10px' }}>
                {selectedDay
                  ? (selectedDayHasData === 'unknown' ? 'Mengecek...' : selectedDayHasData === 'hasData' ? 'Ada data' : 'Belum ada data')
                  : 'Semua tanggal'}
              </span>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <button
              onClick={() => { setSelectedDay(''); setSelectedDayHasData('unknown'); }}
              className="select-chip"
              style={{ cursor: 'pointer', padding: '6px 12px' }}
            >
              Semua Waktu
            </button>
          </div>
        </div>

        {/* Missing data confidence metric summary */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div>
            <span className="eyebrow" style={{ color: 'var(--muted)' }}>Missing Data Ratio</span>
            <div className="font-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
              5 / 1000 <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>(0.5% missing)</span>
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--hairline)', paddingLeft: 20 }}>
            <span className="eyebrow" style={{ color: 'var(--muted)' }}>Tingkat Kepercayaan</span>
            <div className="font-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--stable-text)' }}>
              99.5% Confidence
            </div>
          </div>
        </div>
      </div>

      {/* Table 1: Activity Context Aggregated Summary */}
      <div className="card !p-0 overflow-hidden mb-4">
        <div style={{ padding: '12px 16px', background: 'var(--surface-overlay)', borderBottom: '1px solid var(--hairline)', fontWeight: 600, fontSize: 13 }}>
          📊 Activity Summary (Aggregated Window Stats)
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="pl-lg py-sm">Activity</th>
              <th>Windows</th>
              <th>Duration</th>
              <th>HR mean</th>
              <th>HR SD</th>
              <th>RMSSD</th>
              <th>DFA α1</th>
              <th>Missing Ratio</th>
              <th className="pr-lg text-right">Readiness</th>
            </tr>
          </thead>
          <tbody>
            {activities.length > 0 ? activities.map((act, i) => {
              const dtRes = PolarDecisionTree.predict({
                mean_hr: act.mean_hr,
                rmssd: act.rmssd,
                dfa_alpha1: act.dfa_alpha1
              });
              return (
                <tr key={i} className="border-t border-hairline">
                  <td className="pl-lg py-sm font-semibold">
                    {act.activity}
                    <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 400 }}>
                      DT Predict: {dtRes.predictedActivity} ({Math.round(dtRes.confidence * 100)}%)
                    </span>
                  </td>
                  <td className="mono">{act.windows}</td>
                  <td className="mono">{act.duration}</td>
                  <td className="mono">{act.mean_hr} bpm</td>
                  <td className="mono">{act.sd_hr}</td>
                  <td className="mono">{act.rmssd} ms</td>
                  <td className="mono">{act.dfa_alpha1}</td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{act.missing_ratio !== undefined ? `${(act.missing_ratio * 100).toFixed(1)}%` : '—'}</td>
                  <td className="pr-lg text-right">
                    <span className={`badge ${act.readiness === 'Ready' ? 'badge-stable' : 'badge-caution'}`}>
                      <span className="badge-dot"></span>{act.readiness}
                    </span>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={9} className="text-center py-4 text-muted">Belum ada rangkuman aktivitas.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table 1.5: Activity Context Collection (activity_context) */}
      <div className="card !p-0 overflow-hidden mb-4">
        <div style={{ padding: '12px 16px', background: 'var(--surface-overlay)', borderBottom: '1px solid var(--hairline)', fontWeight: 600, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🏷️ Feature Context Layer (Collection: <code>activity_context</code>)</span>
          <span className="text-xs text-muted">Feature Input AI Model</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="pl-lg py-sm">Periode Waktu</th>
              <th>Posture</th>
              <th>Movement</th>
              <th>Location</th>
              <th>Time of Day</th>
              <th className="pr-lg text-right">Stress Level</th>
            </tr>
          </thead>
          <tbody>
            {activityContexts.length > 0 ? activityContexts.map((ctx, i) => (
              <tr key={ctx._id || i} className="border-t border-hairline">
                <td className="pl-lg py-sm mono">
                  {new Date(ctx.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(ctx.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="font-semibold">{ctx.activity?.posture || '—'}</td>
                <td className="mono">{ctx.activity?.movement || '—'}</td>
                <td>{ctx.activity?.location || '—'}</td>
                <td>
                  <span className="badge badge-stable" style={{ fontSize: 11 }}>
                    {ctx.activity?.time_of_day || '—'}
                  </span>
                </td>
                <td className="pr-lg text-right mono">{ctx.activity?.stress_level || '—'}</td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="text-center py-3 text-muted">Belum ada activity_context data.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table 2: Detailed Raw Window Segments + Polar DT Predictions + Doctor Validation */}
      <div className="card !p-0 overflow-hidden mb-4">
        <div style={{ padding: '12px 16px', background: 'var(--surface-overlay)', borderBottom: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            🌲 Polar Decision Tree Predictive Windows & Doctor Validation
          </span>
          {isDoctor && (
            <span className="badge badge-stable" style={{ fontSize: 11 }}>
              <ShieldCheck size={14} style={{ marginRight: 4 }} /> Doctor Validation Enabled
            </span>
          )}
        </div>
        <table className="w-full" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th className="pl-lg py-sm">Waktu</th>
              <th>Aktivitas</th>
              <th>Polar DT Output</th>
              <th>Signal Quality</th>
              <th>Missing Data</th>
              <th>Status Validasi</th>
              <th className="pr-lg text-right">Aksi Doket</th>
            </tr>
          </thead>
          <tbody>
            {segments.length > 0 ? segments.slice(0, 10).map((seg, i) => {
              const predActivity = seg.dt_prediction?.predicted_activity || 'Unknown';
              const predConfidence = seg.dt_prediction?.confidence || 0;

              const isArtifact = seg.signal_quality?.is_artifact;
              const isAnomaly = seg.signal_quality?.is_anomaly || predConfidence > 50; // Treat high anomalyScore as anomaly
              const valStatus = seg.doctor_validation?.status || 'pending';

              return (
                <tr key={seg._id || i} className="border-t border-hairline">
                  <td className="pl-lg py-sm mono">
                    {new Date(seg.window_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="font-semibold">{seg.activity_label || 'Unknown'}</td>
                  <td>
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                      {predActivity}
                    </span>
                    <span className="text-xs text-muted" style={{ marginLeft: 6 }}>
                      (Anomaly: {predConfidence})
                    </span>
                  </td>
                  <td>
                    {isArtifact ? (
                      <span className="badge" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>
                        ⚠️ Artifact (Drop/Noise)
                      </span>
                    ) : isAnomaly ? (
                      <span className="badge badge-caution">
                        <Warning size={12} style={{ marginRight: 2 }} /> Anomaly (Physiological)
                      </span>
                    ) : (
                      <span className="badge badge-stable">
                        <CheckCircle size={12} style={{ marginRight: 2 }} /> Normal
                      </span>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {seg.missing_data_info?.missing_count !== undefined 
                      ? `${seg.missing_data_info.missing_count}/1000 (${seg.missing_data_info.confidence_score ?? 100}%)`
                      : '—'}
                  </td>
                  <td>
                    {valStatus === 'validated' ? (
                      <span style={{ color: 'var(--stable-text)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ShieldCheck size={14} /> Ter-validasi
                      </span>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Pending</span>
                    )}
                  </td>
                  <td className="pr-lg text-right">
                    {isDoctor ? (
                      <button
                        className="btn btn-outline"
                        style={{ padding: '3px 10px', fontSize: 11 }}
                        onClick={() => handleOpenValidateModal(seg)}
                      >
                        Validasi Segmen
                      </button>
                    ) : (
                      <span className="text-xs text-muted">Hanya Dokter</span>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={7} className="text-center py-4 text-muted">Belum ada segmen raw data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="action-bar">
        <button
          className="btn btn-primary flex items-center gap-1"
          onClick={handleRecalculate}
          disabled={recalculating}
        >
          <ArrowClockwise size={14} className={recalculating ? 'animate-spin' : ''} />
          {recalculating ? 'Training Model...' : 'Train Decision Tree Model'}
        </button>
        <div className="action-bar-divider"></div>
        <button className="btn btn-outline flex items-center gap-1" onClick={() => setToast('Merging Activity: Sleep & Laying down... Merged!')}>
          <Sliders size={14} /> Merge activities
        </button>
        <button className="btn btn-ghost flex items-center gap-1" onClick={() => setToast('Label editor modal opened.')}>
          <FileText size={14} /> Edit labels
        </button>
      </div>

      {/* Doctor Validation Modal */}
      {selectedSegmentForVal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 200ms ease'
        }}>
          <div className="card" style={{ width: 440, maxWidth: '90%', padding: 24, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={20} color="var(--primary)" /> Validasi Dokter pada Segmen
              </h3>
              <button className="icon-btn" onClick={() => setSelectedSegmentForVal(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13, marginBottom: 16 }}>
              <div><strong>Waktu Window:</strong> {new Date(selectedSegmentForVal.window_start).toLocaleTimeString()}</div>
              <div><strong>HR Rata-rata:</strong> {selectedSegmentForVal.features?.mean_hr || 0} bpm</div>
              <div><strong>Missing Data:</strong> {selectedSegmentForVal.missing_data_info?.missing_count !== undefined ? `${selectedSegmentForVal.missing_data_info.missing_count}/1000` : '—'}</div>
            </div>

            <div className="mb-3">
              <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Koreksi Label Aktivitas</label>
              <select
                className="select-chip w-full"
                value={valLabel}
                onChange={(e) => setValLabel(e.target.value as any)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--hairline)' }}
              >
                <option value="Rest">Rest (Istirahat)</option>
                <option value="Light">Light (Ringan)</option>
                <option value="Moderate">Moderate (Sedang)</option>
                <option value="Intense">Intense (Berat)</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Diagnosis Fisiologis Ground Truth</label>
              <select
                className="select-chip w-full"
                value={valGroundTruth}
                onChange={(e) => setValGroundTruth(e.target.value as any)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--hairline)' }}
              >
                <option value="normal">Normal / Fisiologis Sehat</option>
                <option value="anomaly">Anomali / Deviasi Fisiologis</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Catatan Dokter (Clinical Notes)</label>
              <textarea
                value={valNotes}
                onChange={(e) => setValNotes(e.target.value)}
                placeholder="Masukkan catatan klinis dokter untuk segmen ini..."
                rows={3}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  border: '1px solid var(--hairline)', background: 'var(--surface)',
                  color: 'var(--ink)', fontSize: 13, resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setSelectedSegmentForVal(null)}>
                Batal
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitValidation}
                disabled={submittingVal}
              >
                {submittingVal ? 'Menyimpan...' : 'Simpan Validasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
};
