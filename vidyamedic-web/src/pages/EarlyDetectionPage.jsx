import { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Check,
  CircleHelp,
  Clock3,
  HeartPulse,
  ShieldCheck,
  X,
} from 'lucide-react';
import HistoricalDetails from '../components/HistoricalDetails';
import SectionHeading from '../components/SectionHeading';
import { formatDate, formatTime, getStatusLabel, numberOrNull } from '../utils/formatters';

const EVIDENCE_LABELS = {
  physiological_evidence: 'Fisiologi',
  personal_baseline: 'Baseline pribadi',
  multivariate_contribution: 'Kontribusi fitur',
  context_evidence: 'Konteks aktivitas/gejala',
  signal_quality: 'Kualitas sinyal',
};

const CONTEXT_LABELS = {
  mood: 'Mood',
  physical_activity: 'Aktivitas fisik',
  exercise: 'Olahraga',
  mental_stress: 'Stres',
  stress: 'Stres',
  sleep: 'Tidur',
  sleep_duration: 'Durasi tidur',
  caffeine: 'Kafein',
  meal: 'Makan',
  meal_timing: 'Waktu makan',
  medication: 'Obat',
  illness: 'Kondisi sakit',
  pain_discomfort: 'Nyeri/ketidaknyamanan',
  reported_symptom: 'Gejala dilaporkan',
};

function number(value, digits = 1) {
  const parsed = numberOrNull(value);
  return parsed == null ? '—' : Number(parsed.toFixed(digits)).toString();
}

function factorLabel(factor) {
  const labels = {
    mean_hr: 'Denyut jantung',
    hr_mean: 'Denyut jantung',
    motion_intensity: 'Sinyal gerak',
    motion_index: 'Sinyal gerak',
    rmssd: 'RMSSD',
    mean_rr: 'RR interval',
    sdnn: 'SDNN',
    dfa_alpha1: 'DFA alpha1',
  };
  return factor.label || labels[factor.feature] || factor.feature?.replaceAll('_', ' ') || 'Faktor fisiologis';
}

function isWithinTenMinutes(first, second) {
  const firstTime = new Date(first).getTime();
  const secondTime = new Date(second).getTime();
  return Number.isFinite(firstTime)
    && Number.isFinite(secondTime)
    && Math.abs(firstTime - secondTime) <= 10 * 60 * 1000;
}

function activityLabel(value) {
  const labels = {
    rest: 'istirahat',
    sitting: 'duduk',
    standing: 'berdiri',
    walking: 'berjalan',
    running: 'berlari',
    exercise: 'olahraga',
    work: 'bekerja',
    meal: 'makan',
    other: 'lainnya',
  };
  return labels[value] || value;
}

function symptomLabel(value) {
  const labels = {
    fatigue: 'kelelahan',
    dizziness: 'pusing',
    palpitations: 'jantung berdebar',
    breathlessness: 'sesak napas',
    chest_pain: 'nyeri dada',
    headache: 'sakit kepala',
    pain: 'nyeri',
    nausea: 'mual',
    weakness: 'lemas',
    fever: 'demam',
    other: 'gejala lain',
  };
  return labels[value] || value;
}

function checkInContext(checkIn) {
  const details = [];
  const feelings = {
    good: 'baik',
    fair: 'cukup',
    poor: 'kurang baik',
    very_poor: 'sangat kurang baik',
  };
  const sleepQualities = {
    very_good: 'sangat baik',
    good: 'baik',
    fair: 'cukup',
    poor: 'kurang',
  };
  const lifestyle = checkIn.lifestyle || {};
  const factors = checkIn.deviation_follow_up?.perceived_factors || [];

  if (checkIn.feeling) details.push(`Mood: ${feelings[checkIn.feeling] || checkIn.feeling}`);
  if (checkIn.stress_level != null) details.push(`Stres dilaporkan: ${checkIn.stress_level}/3`);
  if (lifestyle.meal != null) details.push(`Makan: ${lifestyle.meal ? 'ya' : 'tidak'}`);
  else if (checkIn.activity === 'meal') details.push('Aktivitas makan dicatat');
  if (lifestyle.meal_count != null || checkIn.deviation_follow_up?.meal_count != null) {
    details.push(`Jumlah makan: ${lifestyle.meal_count ?? checkIn.deviation_follow_up.meal_count}`);
  }
  if (lifestyle.caffeine != null) details.push(`Kafein: ${lifestyle.caffeine ? 'ya' : 'tidak'}`);
  if (lifestyle.alcohol != null) details.push(`Alkohol: ${lifestyle.alcohol ? 'ya' : 'tidak'}`);
  if (lifestyle.smoking != null) details.push(`Merokok: ${lifestyle.smoking ? 'ya' : 'tidak'}`);
  if (checkIn.sleep?.duration_minutes != null) {
    details.push(`Tidur: ${Math.round(checkIn.sleep.duration_minutes / 60 * 10) / 10} jam`);
  }
  if (checkIn.sleep?.quality) {
    details.push(`Kualitas tidur: ${sleepQualities[checkIn.sleep.quality] || checkIn.sleep.quality}`);
  }
  if (factors.length) {
    details.push(`Faktor yang dirasakan: ${factors.map((factor) => (
      CONTEXT_LABELS[factor] || factor.replaceAll('_', ' ')
    )).join(', ')}`);
  }
  if (checkIn.symptoms?.length) {
    details.push(`Gejala: ${checkIn.symptoms.map(symptomLabel).join(', ')}`);
  }
  return details;
}

function EvidenceCoverage({ uncertainty, checkIns = [], eventTime }) {
  const dimensions = uncertainty?.evidence_dimensions || {};
  const entries = Object.entries(EVIDENCE_LABELS).map(([key, label]) => ({
    key,
    label,
    available: dimensions[key]?.available === true,
  }));
  const available = entries.filter((item) => item.available).length;
  const percentage = entries.length ? Math.round((available / entries.length) * 100) : 0;
  const eventTimestamp = new Date(eventTime).getTime();
  const associatedCheckIns = Number.isFinite(eventTimestamp)
    ? checkIns
      .filter((checkIn) => {
        const recordedAt = new Date(checkIn.recorded_at).getTime();
        return Number.isFinite(recordedAt)
          && recordedAt <= eventTimestamp
          && recordedAt >= eventTimestamp - 6 * 60 * 60 * 1000;
      })
      .sort((first, second) => (
        new Date(second.recorded_at) - new Date(first.recorded_at)
      ))
      .slice(0, 3)
    : [];

  return (
    <section className="panel evidence-resolution">
      <div className="panel-heading">
        <div><h2>Kecukupan bukti</h2><p>Cakupan dimensi yang tersedia untuk penjelasan</p></div>
        <span className="panel-icon"><CircleHelp size={18} /></span>
      </div>
      {entries.some((item) => item.available) ? (
        <>
          <div className="evidence-coverage-summary">
            <strong>{percentage}%</strong>
            <span>{available} dari {entries.length} dimensi tersedia</span>
          </div>
          <div
            aria-label={`Cakupan dimensi bukti ${percentage} persen`}
            className="evidence-progress"
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span style={{ width: `${percentage}%` }} />
          </div>
          <div className="evidence-dimensions">
            {entries.map((item) => (
              <span className={item.available ? 'evidence-dimension available' : 'evidence-dimension'} key={item.key}>
                {item.available ? <Check size={12} /> : <X size={12} />}
                {item.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state small-empty">
          <strong>Belum ada penilaian bukti untuk ditampilkan</strong>
          <p>CAPAR akan menampilkan kecukupan bukti saat analisis penyimpangan tersedia.</p>
        </div>
      )}
      <p className="baseline-footnote">
        Persentase ini adalah cakupan dimensi data, bukan tingkat keyakinan atau probabilitas bahwa suatu penyebab benar.
      </p>
      {uncertainty?.interpretation && <p className="evidence-interpretation">{uncertainty.interpretation}</p>}
      <div className="evidence-context">
        <strong>Catatan mood, aktivitas, dan gaya hidup sebelum event</strong>
        {associatedCheckIns.length ? associatedCheckIns.map((checkIn) => {
          const details = checkInContext(checkIn);
          return (
            <div className="evidence-context-item" key={checkIn._id || checkIn.recorded_at}>
              <span>{formatTime(checkIn.recorded_at)} · {activityLabel(checkIn.activity || 'aktivitas belum dicatat')}</span>
              {details.length
                ? <small>{details.join(' · ')}</small>
                : <small>Mood, makan, stres, tidur, atau gejala tidak dicatat pada check-in ini.</small>}
            </div>
          );
        }) : (
          <p>Tidak ada check-in yang tercatat dalam 6 jam sebelumnya.</p>
        )}
        <small>Faktor gaya hidup dan mood berasal dari laporan pengguna; kedekatan waktu hanya menunjukkan asosiasi, bukan kontribusi kausal.</small>
      </div>
    </section>
  );
}

function QualityGateCard({ capar, deviation, followUp }) {
  const baselines = capar.baseline?.contexts || [];
  const matureCount = capar.baseline?.mature_contexts
    ?? baselines.filter((item) => item.level === 'mature' || item.level === 'mature_legacy').length;
  const followUpTime = followUp?.peak_time || followUp?.onset_time;
  const nearestTrajectory = followUpTime
    ? (capar.trajectory_24h || [])
      .filter((item) => isWithinTenMinutes(item.recorded_at, followUpTime))
      .sort((first, second) => (
        Math.abs(new Date(first.recorded_at) - new Date(followUpTime))
        - Math.abs(new Date(second.recorded_at) - new Date(followUpTime))
      ))[0]
    : null;
  const signalQuality = numberOrNull(deviation?.signal_quality ?? nearestTrajectory?.quality);
  const gateFailed = deviation?.explanation_reason === 'peak_segment_failed_quality_gate';
  const gatePassed = deviation?.explanation_status === 'available'
    || followUp?.status === 'requested';
  const qualityStatus = gateFailed
    ? 'Segmen tidak lolos gate CAPAR'
    : gatePassed
      ? 'Bukti segmen digunakan CAPAR'
      : 'Belum dapat dipastikan';
  const matchingActivity = deviation?.activity || nearestTrajectory?.activity;
  const matchingBaseline = baselines.find((item) => (
    item.activity?.toLowerCase() === matchingActivity?.toLowerCase()
  ));
  const qualityScore = numberOrNull(matchingBaseline?.quality);
  const failedGates = matchingBaseline?.maturity_detail?.failed_gates || [];

  return (
    <section className="panel capar-quality-card">
      <div className="panel-heading">
        <div><h2>Quality gate CAPAR</h2><p>Kelayakan sinyal dan baseline untuk analisis</p></div>
        <span className={`quality-state ${gateFailed ? 'failed' : gatePassed ? 'passed' : ''}`}>
          {qualityStatus}
        </span>
      </div>
      <div className="quality-metrics">
        <div><span>Q-signal segmen</span><strong>{signalQuality == null ? '—' : `${Math.round(signalQuality * 100)}%`}</strong></div>
        <div><span>Baseline matang</span><strong>{matureCount} / {capar.baseline?.total_contexts ?? baselines.length}</strong></div>
        <div><span>Kualitas baseline konteks</span><strong>{qualityScore == null ? '—' : `${Math.round(qualityScore * 100)}%`}</strong></div>
      </div>
      {failedGates.length > 0 && (
        <div className="quality-gate-reasons">
          <strong>Gate baseline belum terpenuhi:</strong>
          <span>{failedGates.map((gate) => String(gate).replaceAll('_', ' ')).join(', ')}</span>
        </div>
      )}
      <p className="baseline-footnote">
        Nilai dan status mengikuti hasil CAPAR yang tersedia; tidak ada ambang klinis yang disimpulkan oleh dashboard.
      </p>
    </section>
  );
}

function ObservationCard({ deviation, factors, followUp, onAskActivity }) {
  const hr = factors.find((factor) => ['hr_mean', 'mean_hr'].includes(factor.feature));
  const motion = factors.find((factor) => ['motion_index', 'motion_intensity'].includes(factor.feature));
  const conflictList = deviation?.evidence_conflicts || [];
  const contexts = deviation?.temporally_associated_context || [];
  const activity = deviation?.activity || contexts.find((item) => item.activity)?.activity;
  const shouldAsk = followUp?.status === 'requested'
    && followUp?.triggered_by_segment_id
    && (numberOrNull(hr?.delta_from_baseline ?? hr?.delta) || 0) > 0
    && (numberOrNull(motion?.delta_from_baseline ?? motion?.delta) || 0) > 0;
  const alertClassification = String(deviation?.classification || '').toLowerCase() === 'alert';
  const candidate = followUp?.status === 'requested'
    || String(deviation?.state || '').toLowerCase().includes('candidate')
    || String(deviation?.mahalanobis?.state || '').toLowerCase().includes('candidate');
  const status = alertClassification
    ? 'CAPAR mencatat alert'
    : candidate
      ? 'Kandidat penyimpangan · belum alert'
      : deviation?.explanation_status === 'available'
        ? 'Perubahan teramati · tinjau konteks'
        : 'Belum cukup data untuk interpretasi';
  const hasObservation = Boolean(
    deviation || (followUp?.status === 'requested' && factors.length),
  );

  return (
    <section className="panel observation-card">
      <div className="panel-heading">
        <div><h2>Observasi vs baseline personal</h2><p>Bandingkan nilai terukur dengan konteks aktivitas yang sama</p></div>
        <span className={`observation-state ${alertClassification ? 'alert' : candidate ? 'candidate' : ''}`}>
          {status}
        </span>
      </div>
      {hasObservation ? (
        <>
          <div className="observation-time">
            <Clock3 size={14} />
            <span>
              {formatDate(followUp?.status === 'requested'
                ? followUp.peak_time || followUp.onset_time
                : deviation?.occurred_at, { day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}{formatTime(followUp?.status === 'requested'
                ? followUp.peak_time || followUp.onset_time
                : deviation?.occurred_at)}
            </span>
            {activity && <strong>Aktivitas: {activity}</strong>}
          </div>
          {hr ? (
            <div className="observed-expected">
              <div>
                <span>Terukur (HR)</span>
                <strong>{number(hr.value, 0)} <small>{hr.unit || 'bpm'}</small></strong>
              </div>
              <div className="observed-divider"><span>vs</span></div>
              <div>
                <span>Baseline aktivitas sama</span>
                <strong>{number(hr.baseline_mean, 0)} <small>{hr.unit || 'bpm'}</small></strong>
              </div>
              <div className="observed-delta">
                Selisih {number(hr.delta_from_baseline ?? hr.delta, 1)} {hr.unit || 'bpm'} dari rerata pribadi
              </div>
            </div>
          ) : (
            <div className="notice notice-info observation-no-hr">
              <CircleHelp size={16} />
              <span>Nilai HR terukur dan baseline aktivitas yang sama belum tersedia untuk perbandingan ini.</span>
            </div>
          )}
          {motion && (
            <div className="motion-observation">
              <Activity size={16} />
              <span>
                Sinyal gerak berbeda dari baseline
                {motion.unit ? ` (${number(motion.value, 2)} ${motion.unit})` : ''}
                {motion.z_score != null ? ` · z ${number(motion.z_score, 2)}` : ''}.
                {' '}Ini menunjukkan gerakan terukur, bukan memastikan jenis aktivitas.
              </span>
            </div>
          )}
          {conflictList.length > 0 && (
            <div className="notice notice-warning observation-conflict">
              <AlertCircle size={16} />
              <span>{conflictList.map((item) => item.interpretation || item.description).filter(Boolean).join(' ')}</span>
            </div>
          )}
          {shouldAsk && (
            <button className="button button-primary observation-confirm" onClick={onAskActivity} type="button">
              Konfirmasi kontribusi
            </button>
          )}
          {factors.length > 0 && !shouldAsk && followUp?.status === 'requested' && (
            <p className="baseline-footnote">
              CAPAR meminta tindak lanjut. Jawab di aplikasi Vidyamedic untuk mengirim respons lengkap yang terhubung ke segmen.
            </p>
          )}
        </>
      ) : (
        <div className="empty-state small-empty">
          <div className="empty-chart-icon"><Activity size={20} /></div>
          <strong>Belum ada observasi penyimpangan terbaru</strong>
          <p>Sistem membandingkan pengukuran dengan baseline pribadi setelah data CAPAR tersedia.</p>
        </div>
      )}
    </section>
  );
}

function SignalContributionCard({
  factors = [],
  contextContributors = [],
  reportedRankings = [],
  reportedContext = null,
}) {
  const contributors = useMemo(
    () => factors
      .filter((factor) => numberOrNull(factor.contribution_share) != null)
      .sort((first, second) => second.contribution_share - first.contribution_share)
      .slice(0, 5),
    [factors],
  );

  return (
    <section className="panel signal-contribution-card">
      <div className="panel-heading">
        <div><h2>Kontribusi sinyal terhadap event</h2><p>Komponen yang membentuk jarak statistik dari baseline</p></div>
        <span className="panel-icon green-icon"><HeartPulse size={18} /></span>
      </div>
      {contributors.length ? (
        <div className="signal-contributors">
          {contributors.map((factor) => {
            const share = Math.max(0, Math.min(100, factor.contribution_share * 100));
            return (
              <div className="signal-contributor" key={factor.feature}>
                <div><span>{factorLabel(factor)}</span><strong>{Math.round(share)}%</strong></div>
                <div className="evidence-progress"><span style={{ width: `${share}%` }} /></div>
                <small>
                  {number(factor.value, 2)} {factor.unit || ''}
                  {factor.delta_from_baseline != null
                    ? ` · selisih ${number(factor.delta_from_baseline, 2)} dari baseline`
                    : ''}
                </small>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state small-empty">
          <strong>Kontribusi multivariat belum tersedia</strong>
          <p>CAPAR belum memiliki kontribusi fitur untuk event terbaru. Tidak ada persentase yang diperkirakan.</p>
        </div>
      )}
      <div className="context-contributor-list">
        <strong>Konteks pendamping yang tercatat</strong>
        {contextContributors.length ? contextContributors.map((item) => (
          <div className="context-contributor-item" key={item.type}>
            <span>{CONTEXT_LABELS[item.type] || item.type?.replaceAll('_', ' ') || 'Konteks lain'}</span>
            <small>
              {(item.associated_contexts || []).length
                ? item.associated_contexts.map((context) => context.label || context.type?.replaceAll('_', ' ')).join(', ')
                : (item.evidence || []).join(', ').replaceAll('_', ' ')}
              {item.association === 'consistent_with'
                ? ' · selaras menurut aturan sistem'
                : ' · tercatat berdekatan waktu'}
            </small>
          </div>
        )) : (
          <p>Belum ada konteks mood, makan, stres, atau gaya hidup yang tercatat berdekatan dengan event.</p>
        )}
      </div>
      {reportedRankings.length > 0 && (
        <div className="context-contributor-list reported-factor-ranking">
          <strong>Urutan kontribusi menurut pengguna</strong>
          {reportedRankings.map((item) => (
            <div className="context-contributor-item" key={`${item.rank}:${item.factor}`}>
              <span>{item.rank}. {CONTEXT_LABELS[item.factor] || item.factor.replaceAll('_', ' ')}</span>
              <small>Masukan pengguna untuk dibandingkan dengan sinyal terukur; bukan kontribusi kausal.</small>
            </div>
          ))}
        </div>
      )}
      {reportedContext && (
        <div className="context-contributor-list reported-factor-ranking">
          <strong>Konfirmasi pengguna untuk event ini</strong>
          <div className="context-contributor-item">
            <span>
              Aktivitas: {reportedContext.activity
                ? activityLabel(reportedContext.activity)
                : 'tidak dicatat'}
            </span>
            <small>
              {[
                reportedContext.feeling
                  ? `Mood: ${reportedContext.feeling.replaceAll('_', ' ')}`
                  : null,
                reportedContext.meal == null
                  ? null
                  : `Makan: ${reportedContext.meal ? 'ya' : 'tidak'}`,
                reportedContext.stress_level == null
                  ? null
                  : `Stres: ${reportedContext.stress_level}/3`,
              ].filter(Boolean).join(' · ') || 'Mood, makan, dan stres tidak dicatat.'}
            </small>
          </div>
        </div>
      )}
      <p className="baseline-footnote">
        Persentase menunjukkan bagian relatif dalam dekomposisi statistik. Konteks adalah bukti laporan/temporal; keduanya bukan probabilitas atau bukti penyebab.
      </p>
    </section>
  );
}

function BayesianReasoningCard({ model = {} }) {
  const statusLabel = model.status === 'validation_required'
    ? 'Model kandidat · validasi diperlukan'
    : model.status === 'insufficient_data'
      ? 'Label historis CAPAR belum cukup'
      : 'Belum tersedia';
  const training = model.training_samples || {};
  const validation = model.validation_samples || {};
  const validationMetrics = model.validation || {};

  return (
    <section className="panel bayesian-reasoning-card">
      <div className="panel-heading">
        <div>
          <h2>Reasoning Bayesian untuk deteksi perubahan</h2>
          <p>Model kandidat berbasis segmen CAPAR berlabel dan baseline aktivitas/waktu personal</p>
        </div>
        <span className="quality-state">{statusLabel}</span>
      </div>
      {model.status ? (
        <>
          <div className="quality-metrics">
            <div><span>Segmen stabil untuk pelatihan</span><strong>{training.stable ?? 0}</strong></div>
            <div><span>Segmen deviasi untuk pelatihan</span><strong>{training.deviation ?? 0}</strong></div>
            <div><span>Segmen holdout</span><strong>{(validation.stable ?? 0) + (validation.deviation ?? 0)}</strong></div>
          </div>
          <div className="bayesian-method-details">
            <strong>{model.method?.replaceAll('_', ' ') || 'personal gaussian naive bayes'}</strong>
            <span>Fitur: {(model.feature_keys || []).join(', ') || 'belum tersedia'}</span>
            {model.validation?.brier_score != null && (
              <span>
                Brier holdout: {Number(model.validation.brier_score).toFixed(3)}
                {' '}({model.validation.scored_samples} sampel; metrik evaluasi, bukan confidence)
              </span>
            )}
          </div>
          <p className="baseline-footnote">
            {model.reason || 'Probabilitas individual belum dipublikasikan.'}
            {' '}Prior dihitung dari frekuensi label CAPAR; likelihood memakai asumsi Gaussian dan independensi fitur.
            Probabilitas tetap disembunyikan sampai kalibrasi holdout, peninjauan bias, dan tata kelola model disetujui.
          </p>
        </>
      ) : (
        <div className="empty-state small-empty">
          <strong>Model Bayesian belum dapat dijalankan untuk konteks terbaru</strong>
          <p>Model membutuhkan segmen CAPAR berkualitas yang berlabel stabil dan deviasi pada aktivitas serta waktu yang sama.</p>
        </div>
      )}
    </section>
  );
}

function ContributionConfirmationDialog({ onClose, onSubmit, saving, error }) {
  const [wasMoving, setWasMoving] = useState(null);
  const [feeling, setFeeling] = useState('');
  const [meal, setMeal] = useState('unknown');
  const [stressLevel, setStressLevel] = useState('');
  const [rankedFactors, setRankedFactors] = useState([]);
  const availableFactors = [
    ...(feeling ? ['mood'] : []),
    ...(meal !== 'unknown' ? ['meal'] : []),
    ...(stressLevel ? ['stress'] : []),
  ];
  const effectiveRankedFactors = rankedFactors.filter((factor) => availableFactors.includes(factor));
  const factorNames = { mood: 'Mood', meal: 'Makan', stress: 'Stres' };
  function toggleFactor(factor) {
    setRankedFactors((current) => current.includes(factor)
      ? current.filter((item) => item !== factor)
      : [...current, factor]);
  }

  return (
    <div className="activity-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section
        aria-labelledby="activity-dialog-title"
        aria-modal="true"
        className="activity-dialog"
        role="dialog"
      >
        <button
          aria-label="Tutup konfirmasi"
          className="icon-button activity-dialog-close"
          disabled={saving}
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>
        <span className="eyebrow">KONFIRMASI KONTRIBUSI</span>
        <h2 id="activity-dialog-title">Apa yang Anda alami saat event ini?</h2>
        <p>
          CAPAR melihat perubahan fisiologis dan sinyal gerak. Catat apakah Anda bergerak,
          lalu pilih informasi mood, makan, atau stres yang relevan pada waktu event.
        </p>
        <fieldset className="contribution-fieldset">
          <legend>Aktivitas saat itu</legend>
          <div className="contribution-choice-row">
            <button
              aria-pressed={wasMoving === true}
              className={wasMoving === true ? 'period-option active' : 'period-option'}
              onClick={() => setWasMoving(true)}
              type="button"
            >
              Ya, sedang bergerak
            </button>
            <button
              aria-pressed={wasMoving === false}
              className={wasMoving === false ? 'period-option active' : 'period-option'}
              onClick={() => setWasMoving(false)}
              type="button"
            >
              Tidak, istirahat / duduk
            </button>
          </div>
        </fieldset>
        <div className="contribution-input-grid">
          <label>Mood
            <select value={feeling} onChange={(event) => setFeeling(event.target.value)}>
              <option value="">Tidak dicatat</option>
              <option value="good">Baik</option>
              <option value="fair">Cukup</option>
              <option value="poor">Kurang baik</option>
              <option value="very_poor">Sangat kurang baik</option>
            </select>
          </label>
          <label>Makan saat / sekitar event
            <select value={meal} onChange={(event) => setMeal(event.target.value)}>
              <option value="unknown">Tidak diketahui</option>
              <option value="yes">Ya</option>
              <option value="no">Tidak</option>
            </select>
          </label>
          <label>Stres yang dirasakan
            <select value={stressLevel} onChange={(event) => setStressLevel(event.target.value)}>
              <option value="">Tidak dicatat</option>
              <option value="1">Rendah</option>
              <option value="2">Sedang</option>
              <option value="3">Tinggi</option>
            </select>
          </label>
        </div>
        {availableFactors.length > 0 && (
          <fieldset className="contribution-fieldset">
            <legend>Urutkan faktor yang menurut Anda paling berkontribusi</legend>
            <p className="contribution-hint">Pilih dari faktor yang tercatat. Urutan pilihan menjadi ranking kontribusi pengguna.</p>
            <div className="contribution-choice-row">
              {availableFactors.map((factor) => (
                <label className="contribution-factor-option" key={factor}>
                  <input
                    checked={rankedFactors.includes(factor)}
                    onChange={() => toggleFactor(factor)}
                    type="checkbox"
                  />
                  {factorNames[factor]}
                </label>
              ))}
            </div>
            {effectiveRankedFactors.length > 0 && (
              <ol className="contribution-ranking">
                {effectiveRankedFactors.map((factor) => <li key={factor}>{factorNames[factor]}</li>)}
              </ol>
            )}
          </fieldset>
        )}
        <p className="baseline-footnote">
          Ranking ini adalah penilaian pengguna, bukan bukti penyebab. Jika data tidak diketahui,
          biarkan kosong; sistem tidak akan mengarang faktor.
        </p>
        {error && <div className="form-error" role="alert"><AlertCircle size={15} />{error}</div>}
        <div className="activity-dialog-actions">
          <button
            className="button button-primary"
            disabled={saving || wasMoving == null}
            onClick={() => onSubmit({
              wasMoving,
              feeling,
              meal,
              stressLevel: stressLevel ? Number(stressLevel) : null,
              rankedFactors: effectiveRankedFactors,
            })}
            type="button"
          >
            Simpan konfirmasi kontribusi
          </button>
        </div>
        {saving && <span className="activity-saving">Menyimpan jawaban…</span>}
      </section>
    </div>
  );
}

export default function EarlyDetectionPage({ dashboard, onContributionConfirmation }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const capar = dashboard.insights?.capar || {};
  const pedagogy = capar.pedagogy || {};
  const latest = capar.latest_state;
  const recovery = capar.recovery || {};
  const redFlags = pedagogy.red_flags || {};
  const status = capar.status;
  const isLinkRequired = status === 'link_required';
  const isInsufficient = !status || status === 'insufficient_data';
  const deviationExplanations = capar.deviation_explanations || [];
  const followUp = pedagogy.follow_up || {};
  const matchedDeviation = followUp.status === 'requested'
    ? deviationExplanations.find((item) => isWithinTenMinutes(
      item.occurred_at,
      followUp.peak_time || followUp.onset_time,
    )) || null
    : null;
  const deviation = matchedDeviation || (
    followUp.status === 'requested' ? null : deviationExplanations[0] || null
  );
  const uncertainty = deviation?.reasoning_uncertainty
    || (followUp.status === 'requested' ? null : pedagogy.why?.reasoning_uncertainty);
  const factors = followUp.status === 'requested'
    ? followUp.main_factors || []
    : deviation?.main_deviation_factors || pedagogy.why?.main_factors || [];

  async function submitContribution(contribution) {
    const segmentId = followUp.triggered_by_segment_id;
    if (!segmentId || !onContributionConfirmation) {
      setSubmitError('Tindak lanjut CAPAR tidak tersedia untuk event ini.');
      return;
    }
    setSaving(true);
    setSubmitError('');
    try {
      await onContributionConfirmation(segmentId, contribution);
      setDialogOpen(false);
    } catch (error) {
      setSubmitError(error.message || 'Jawaban gagal disimpan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionHeading
        description="Lihat apa yang berubah, bandingkan dengan baseline aktivitas yang sama, lalu bantu menilai apakah konteks yang tercatat sesuai."
        eyebrow="WAWASAN BERBASIS DATA"
        title="AI & deteksi dini"
      />
      {isLinkRequired && (
        <div className="notice notice-warning">
          <AlertCircle size={18} />
          <span>Akun CAPAR belum terhubung. Hubungkan akun melalui Profil atau aplikasi Vidyamedic agar riwayat CAPAR dapat ditampilkan.</span>
        </div>
      )}
      {isInsufficient && !isLinkRequired && (
        <div className="notice notice-info">
          <CircleHelp size={18} />
          <span>Data CAPAR belum cukup untuk membentuk ringkasan personal. Lanjutkan pencatatan wearable dan check-in secara berkala.</span>
        </div>
      )}
      {redFlags.red_flag && (
        <div className="notice notice-danger">
          <AlertCircle size={19} />
          <span>
            <strong>Ada laporan gejala yang perlu diperhatikan.</strong>
            {' '}{redFlags.message || redFlags.reason || 'Pertimbangkan untuk menghubungi tenaga kesehatan, terutama bila gejala berat atau memburuk.'}
          </span>
        </div>
      )}
      <div className="detection-banner">
        <div className={`detection-emblem ${isInsufficient || isLinkRequired ? 'muted' : ''}`}>
          <ShieldCheck size={28} />
        </div>
        <div>
          <span className="eyebrow">STATUS DATA CAPAR</span>
          <h2>{getStatusLabel(status)}</h2>
          <p>{capar.disclaimer || dashboard.insights?.disclaimer || 'Status merangkum kesiapan dan ketersediaan data, bukan penilaian risiko klinis.'}</p>
        </div>
        <span className="detection-date">
          <Clock3 size={15} />
          {formatDate(dashboard.insights?.generated_at, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
      <div className="content-grid detection-grid">
        <ObservationCard
          deviation={deviation}
          factors={factors}
          followUp={followUp}
          onAskActivity={() => {
            setSubmitError('');
            setDialogOpen(true);
          }}
        />
        <QualityGateCard capar={capar} deviation={deviation} followUp={followUp} />
        <EvidenceCoverage
          checkIns={dashboard.checkIns}
          eventTime={followUp.status === 'requested'
            ? followUp.peak_time || followUp.onset_time
            : deviation?.occurred_at}
          uncertainty={uncertainty}
        />
        <SignalContributionCard
          contextContributors={deviation?.candidate_context_contributors || []}
          factors={factors}
          reportedContext={deviation?.user_reported_context}
          reportedRankings={deviation?.user_reported_factor_ranking || []}
        />
      </div>
      <BayesianReasoningCard model={capar.reasoning_pipeline?.probabilistic_posterior} />
      <div className="content-grid detection-grid">
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Perubahan yang tercatat</h2><p>Status observasi terbaru dari CAPAR</p></div>
            <span className="panel-icon"><Activity size={18} /></span>
          </div>
          {latest ? (
            <div className="detection-detail">
              <div className="detail-row">
                <span>Status terakhir</span><strong>{getStatusLabel(latest.status || latest)}</strong>
              </div>
              <div className="detail-row">
                <span>Waktu pembaruan</span>
                <strong>{formatDate(latest.recorded_at || latest.updated_at, { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </div>
              {deviation?.explanation_status && (
                <div className="detail-row">
                  <span>Status penjelasan</span><strong>{deviation.explanation_status.replaceAll('_', ' ')}</strong>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-chart-icon"><Activity size={22} /></div>
              <strong>Belum ada perubahan personal untuk ditampilkan</strong>
              <p>Ringkasan akan muncul setelah data CAPAR yang memadai tersedia.</p>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Pemulihan & tindak lanjut</h2><p>Catatan hasil pemantauan, bukan prediksi</p></div>
            <span className="panel-icon green-icon"><HeartPulse size={18} /></span>
          </div>
          <div className="recovery-stat">
            <div className="recovery-number">
              {recovery.median_recovery_minutes ?? '—'}
              <span>{recovery.median_recovery_minutes != null ? 'menit' : ''}</span>
            </div>
            <span>Median pemulihan tercatat · 30 hari</span>
          </div>
          {recovery.recovery_rate_definition && <p className="muted-copy">{recovery.recovery_rate_definition}</p>}
          <div className="followup-card">
            <ShieldCheck size={17} />
            <span>{pedagogy.action?.message || followUp.message || 'Teruskan pencatatan secara berkala dan diskusikan kekhawatiran kesehatan dengan tenaga kesehatan.'}</span>
          </div>
          <div className="caption-note">Ringkasan observasi ini tidak menetapkan penyebab atau diagnosis.</div>
        </section>
      </div>
      <HistoricalDetails capar={capar} checkIns={dashboard.checkIns} />
      {dialogOpen && (
        <ContributionConfirmationDialog
          error={submitError}
          onClose={() => setDialogOpen(false)}
          onSubmit={submitContribution}
          saving={saving}
        />
      )}
    </>
  );
}
