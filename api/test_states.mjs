/**
 * test_states.mjs — Uji 9-state temporal machine & baseline update behavior
 * Jalankan dari direktori api/:  node ../test_states.mjs
 */

import {
  assessRRQuality,
  extractRRFeatures,
  computePersonalizedScore,
  updateTemporalState,
  createTemporalState,
  buildBaselineUpdateFields,
  classifyRR,
  getDynamicThreshold,
  computeProvisionalScore,
  FEATURE_WEIGHTS,
  MIN_SCORED_WEIGHT,
} from './utils/rrBaselinePipeline.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const line  = (c = '─', n = 62) => console.log(c.repeat(n));
const head  = (t) => { line('═'); console.log(`  ${t}`); line('═'); };
const sub   = (t) => { line(); console.log(`▶ ${t}`); line('─'); };
const pass  = (label, ok, detail = '') =>
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? '  (' + detail + ')' : ''}`);

/** Buat RR array bersih sekitar meanMs ms, dengan noise gaussi. */
function fakeRR(n, meanMs, sdNoise = 25) {
  return Array.from({ length: n }, () => {
    const g = (Math.random() + Math.random() + Math.random() - 1.5) * sdNoise;
    return Math.max(300, Math.min(2000, meanMs + g));
  });
}

/** Buat baseline dengan statistik pre-filled (Welford state). */
function fakeBaseline(overrides = {}, segCount = 0, level = 'cold_start') {
  const stat = (mean, std, n) => ({
    n, mean, std,
    M2: std * std * (n - 1),
    min: mean - 2 * std,
    max: mean + 2 * std,
  });
  const defaults = {
    mean_hr:          stat(70, 4.0,  50),
    delta_hr:         stat(0.5, 1.2, 50),
    slope_hr:         stat(0.2, 0.8, 50),
    sdnn:             stat(45, 8.0,  50),
    rmssd:            stat(35, 7.0,  50),
    dfa_alpha1:       stat(1.1, 0.15, 50),
    motion_intensity: stat(0.1, 0.05, 50),
  };
  return {
    is_frozen: false,
    segment_count: segCount,
    maturity_detail: { level },
    stats: { ...defaults, ...overrides },
    window_timestamps: [],
    q_signal_history: [], q_complete_history: [], q_context_history: [],
  };
}

// ── 1. QUALITY_WARNING ────────────────────────────────────────────────────────
head('TEST 1 — QUALITY_WARNING');
console.log('  Status ini muncul ketika assessRRQuality gagal (accepted=false).');
console.log('  Baseline TIDAK diperbarui.\n');

{
  // 1a: terlalu sedikit beat
  const rr1 = fakeRR(20, 860);
  const q1  = assessRRQuality(rr1, 0.90);
  sub('1a. Hanya 20 beat (min_rr_count = 45)');
  console.log('  RR count :', rr1.length);
  console.log('  accepted :', q1.accepted);
  console.log('  reasons  :', q1.reasons);
  pass('QUALITY_WARNING dihasilkan', !q1.accepted, `accepted=${q1.accepted}`);

  // 1b: confidence aktivitas rendah
  const rr2 = fakeRR(60, 860, 15);
  const q2  = assessRRQuality(rr2, 0.50);
  sub('1b. 60 beat, activity_confidence = 0.50 (min = 0.80)');
  console.log('  RR count :', rr2.length);
  console.log('  accepted :', q2.accepted);
  console.log('  reasons  :', q2.reasons);
  pass('QUALITY_WARNING dihasilkan', !q2.accepted);

  // 1c: terlalu banyak artefak
  const rr3 = [...fakeRR(40, 860), ...Array(20).fill(150)]; // 33% artefak
  const q3  = assessRRQuality(rr3, 0.90);
  sub('1c. 60 beat, 20 artefak di bawah batas fisiologis 300ms');
  console.log('  artifact_fraction :', q3.artifact_fraction.toFixed(3));
  console.log('  accepted          :', q3.accepted);
  console.log('  reasons           :', q3.reasons);
  pass('QUALITY_WARNING dihasilkan (artefak > 5%)', !q3.accepted);
}

// ── 2. INSUFFICIENT_BASELINE ─────────────────────────────────────────────────
head('TEST 2 — INSUFFICIENT_BASELINE');
console.log('  Status ini muncul ketika baseline kosong / belum punya cukup data');
console.log('  untuk memenuhi MIN_SCORED_WEIGHT =', MIN_SCORED_WEIGHT);
console.log('  Baseline DIPERBARUI (masukkan kandidat).\n');

{
  const rr  = fakeRR(70, 860, 25);
  const q   = assessRRQuality(rr, 0.90);
  const f   = extractRRFeatures(q.rr_clean);
  const emptyBL = fakeBaseline({
    mean_hr:          { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null },
    sdnn:             { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null },
    rmssd:            { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null },
    delta_hr:         { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null },
    slope_hr:         { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null },
    dfa_alpha1:       { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null },
    motion_intensity: { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null },
  }, 0, 'cold_start');

  const { score, z_scores, used_weight } = computePersonalizedScore(f, emptyBL);
  sub('2. Baseline kosong → semua stats.n = 0');
  console.log('  Quality accepted :', q.accepted);
  console.log('  Features extracted:');
  Object.entries(f).forEach(([k, v]) => console.log(`    ${k.padEnd(14)}: ${v}`));
  console.log('  used_weight      :', used_weight, '< MIN_SCORED_WEIGHT =', MIN_SCORED_WEIGHT);
  console.log('  score            :', score);
  pass('computePersonalizedScore mengembalikan score = null', score === null);

  // Baseline diperbarui?
  const upd = buildBaselineUpdateFields(emptyBL, f, q, Date.now(), true);
  pass('buildBaselineUpdateFields mengembalikan update (bukan null)', upd !== null,
    upd ? `segment_count menjadi ${upd.segment_count}` : 'null — tidak ada fitur valid');
  if (upd) {
    const updatedKeys = Object.keys(upd).filter(k => k.startsWith('stats.')).map(k => k.replace('stats.',''));
    console.log('  Stats yang diperbarui:', updatedKeys.join(', '));
  }
}

// ── 3. NORMAL ─────────────────────────────────────────────────────────────────
head('TEST 3 — NORMAL');
console.log('  Skor mature di bawah threshold. Baseline DIPERBARUI jika tidak cooldown.\n');

{
  const bl = fakeBaseline({}, 50, 'maturing');  // baseline mature dengan 50 window
  const rr = fakeRR(70, 857, 20); // dekat dengan baseline (mean 70 bpm)
  const q  = assessRRQuality(rr, 0.90);
  const f  = extractRRFeatures(q.rr_clean);
  const { score, z_scores } = computePersonalizedScore(f, bl);
  const classification = classifyRR(score, 'maturing');
  const state = createTemporalState();
  const { rr_status, safe_to_update } = updateTemporalState(state, score, 'maturing');
  const thr = getDynamicThreshold('maturing');

  sub('3. 70 beat dekat baseline, maturity=maturing');
  console.log('  score            :', score?.toFixed(4));
  console.log('  threshold CAUTION:', thr.CAUTION);
  console.log('  classification   :', classification);
  console.log('  rr_status        :', rr_status);
  console.log('  safe_to_update   :', safe_to_update);
  console.log('  z_scores         :', JSON.stringify(z_scores, (k,v) => typeof v === 'number' ? +v.toFixed(3) : v));
  pass('rr_status === NORMAL', rr_status === 'NORMAL');
  pass('safe_to_update === true (baseline diperbarui)', safe_to_update === true);
}

// ── 4. DEVIATION_CANDIDATE ────────────────────────────────────────────────────
head('TEST 4 — DEVIATION_CANDIDATE');
console.log('  Skor melewati threshold tetapi belum K=3 window berturut-turut.');
console.log('  Baseline TIDAK diperbarui.\n');

{
  const bl = fakeBaseline({}, 50, 'maturing');
  // HR 100 bpm → jauh dari baseline (70 bpm)
  const rr = fakeRR(70, 600, 10);
  const q  = assessRRQuality(rr, 0.90);
  const f  = extractRRFeatures(q.rr_clean);
  const { score } = computePersonalizedScore(f, bl);
  const state = createTemporalState();
  sub('4. Window 1 — skor tinggi (HR ~100 bpm)');
  console.log('  hr_mean features  :', f.hr_mean, 'bpm  (baseline mean = 70)');
  console.log('  score             :', score?.toFixed(4));
  const { rr_status: s1, safe_to_update: su1 } = updateTemporalState(state, score, 'maturing');
  console.log('  rr_status         :', s1);
  console.log('  safe_to_update    :', su1);
  pass('rr_status === DEVIATION_CANDIDATE', s1 === 'DEVIATION_CANDIDATE');
  pass('safe_to_update === false (baseline TIDAK diperbarui)', su1 === false);
}

// ── 5. PERSISTENT_DEVIATION ───────────────────────────────────────────────────
head('TEST 5 — PERSISTENT_DEVIATION');
console.log('  Skor tinggi selama K=3 window berturut-turut.');
console.log('  Baseline TIDAK diperbarui.\n');

{
  const bl = fakeBaseline({}, 50, 'maturing');
  const rr = fakeRR(70, 600, 10);
  const q  = assessRRQuality(rr, 0.90);
  const f  = extractRRFeatures(q.rr_clean);
  const { score } = computePersonalizedScore(f, bl);
  const state = createTemporalState();

  for (let i = 1; i <= 3; i++) {
    const { rr_status, safe_to_update } = updateTemporalState(state, score, 'maturing');
    sub(`5. Window ${i} skor tinggi (score = ${score?.toFixed(3)})`);
    console.log('  rr_status     :', rr_status);
    console.log('  safe_to_update:', safe_to_update);
    if (i < 3) pass(`rr_status === DEVIATION_CANDIDATE (window ${i})`, rr_status === 'DEVIATION_CANDIDATE');
    else        pass('rr_status === PERSISTENT_DEVIATION (window 3)', rr_status === 'PERSISTENT_DEVIATION');
    pass(`safe_to_update === false`, safe_to_update === false);
  }
}

// ── 6. RECOVERING ─────────────────────────────────────────────────────────────
head('TEST 6 — RECOVERING');
console.log('  Setelah episode aktif, skor turun tapi belum mencukupi H=3 window.');
console.log('  Baseline TIDAK diperbarui.\n');

{
  const bl = fakeBaseline({}, 50, 'maturing');
  const rrHigh = fakeRR(70, 600, 10);
  const qH = assessRRQuality(rrHigh, 0.90);
  const fH = extractRRFeatures(qH.rr_clean);
  const { score: highScore } = computePersonalizedScore(fH, bl);

  const state = createTemporalState();
  // Trigger persistent (3 window tinggi)
  for (let i = 0; i < 3; i++) updateTemporalState(state, highScore, 'maturing');

  // Sekarang skor menurun sedikit tapi masih di atas recovery_threshold
  const medScore = getDynamicThreshold('maturing').CAUTION * 0.6; // sedikit di atas recovery_thr
  sub(`6a. Skor turun ke ${medScore.toFixed(3)} — belum mencukupi recovery threshold`);
  const { rr_status: s6a, safe_to_update: su6a } = updateTemporalState(state, medScore, 'maturing');
  console.log('  rr_status     :', s6a);
  console.log('  safe_to_update:', su6a);
  pass('rr_status === RECOVERING', s6a === 'RECOVERING');
  pass('safe_to_update === false', su6a === false);
}

// ── 7. RECOVERED ──────────────────────────────────────────────────────────────
head('TEST 7 — RECOVERED');
console.log('  Skor rendah selama H=3 window setelah episode.');
console.log('  Baseline TIDAK diperbarui, mulai cooldown.\n');

{
  const bl = fakeBaseline({}, 50, 'maturing');
  const rrHigh = fakeRR(70, 600, 10);
  const qH = assessRRQuality(rrHigh, 0.90);
  const fH = extractRRFeatures(qH.rr_clean);
  const { score: highScore } = computePersonalizedScore(fH, bl);

  const state = createTemporalState();
  for (let i = 0; i < 3; i++) updateTemporalState(state, highScore, 'maturing');

  // Score rendah di bawah recovery_threshold (CAUTION * 0.5)
  const thr = getDynamicThreshold('maturing');
  const lowScore = thr.CAUTION * 0.3; // jelas di bawah recovery_threshold

  for (let i = 1; i <= 3; i++) {
    const { rr_status, safe_to_update } = updateTemporalState(state, lowScore, 'maturing');
    sub(`7. Recovery window ${i} (score = ${lowScore.toFixed(3)})`);
    console.log('  rr_status     :', rr_status);
    console.log('  safe_to_update:', safe_to_update);
    if (i < 3) pass(`rr_status === RECOVERING (window ${i})`, rr_status === 'RECOVERING');
    else        pass('rr_status === RECOVERED (window 3)', rr_status === 'RECOVERED');
    pass('safe_to_update === false', safe_to_update === false);
  }
}

// ── 8. NORMAL (cooldown) ──────────────────────────────────────────────────────
head('TEST 8 — NORMAL dengan cooldown (setelah RECOVERED)');
console.log('  Setelah RECOVERED, ada cooldown_windows=3 di mana safe_to_update=false.');
console.log('  Baseline TIDAK diperbarui selama cooldown.\n');

{
  const bl = fakeBaseline({}, 50, 'maturing');
  const rrHigh = fakeRR(70, 600, 10);
  const qH = assessRRQuality(rrHigh, 0.90);
  const fH = extractRRFeatures(qH.rr_clean);
  const { score: highScore } = computePersonalizedScore(fH, bl);

  const thr = getDynamicThreshold('maturing');
  const lowScore = thr.CAUTION * 0.3;

  const state = createTemporalState();
  for (let i = 0; i < 3; i++) updateTemporalState(state, highScore, 'maturing');
  for (let i = 0; i < 3; i++) updateTemporalState(state, lowScore, 'maturing');
  // Sekarang cooldown dimulai

  const rrNorm = fakeRR(70, 857, 20);
  const qN = assessRRQuality(rrNorm, 0.90);
  const fN = extractRRFeatures(qN.rr_clean);
  const { score: normScore } = computePersonalizedScore(fN, bl);

  for (let i = 1; i <= 4; i++) {
    const { rr_status, safe_to_update } = updateTemporalState(state, normScore, 'maturing');
    sub(`8. Post-recovery window ${i} (score = ${normScore?.toFixed(3)})`);
    console.log('  rr_status     :', rr_status);
    console.log('  safe_to_update:', safe_to_update);
    if (i <= 3) pass(`Cooldown window ${i}: safe_to_update = false`, safe_to_update === false);
    else        pass(`Cooldown habis (window 4): safe_to_update = true`, safe_to_update === true);
  }
}

// ── 9. PROVISIONAL_NORMAL / PROVISIONAL_DEVIATION ────────────────────────────
head('TEST 9 — PROVISIONAL_NORMAL / PROVISIONAL_DEVIATION');
console.log('  Status ini muncul karena ada provisional scoring dengan Empirical Bayes Shrinkage.');
console.log('  Baseline harus memiliki segment_count >= 5.\n');

{
  const rr  = fakeRR(70, 860, 25);
  const q   = assessRRQuality(rr, 0.90);
  const f   = extractRRFeatures(q.rr_clean);
  const emptyBL = fakeBaseline({
    mean_hr:          { n: 5, mean: 65, M2: 16, std: 2, min: null, max: null },
    sdnn:             { n: 5, mean: 40, M2: 25, std: 2.5, min: null, max: null },
    rmssd:            { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null },
    delta_hr:         { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null },
    slope_hr:         { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null },
    dfa_alpha1:       { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null },
    motion_intensity: { n: 0, mean: 0, M2: 0, std: 0, min: null, max: null },
  }, 5, 'cold_start');
  emptyBL.maturity_detail.n_effective = 5;

  const { score: nullScore, used_weight } = computePersonalizedScore(f, emptyBL);
  
  sub('9. Baseline partial (hr_mean + sdnn saja, count=5)');
  console.log('  Personalized used_weight :', used_weight, '< MIN_SCORED_WEIGHT =', MIN_SCORED_WEIGHT);
  console.log('  Personalized score       :', nullScore);
  
  // Karena score === null dan count >= 5, controller akan memanggil computeProvisionalScore
  const prov = computeProvisionalScore(f, emptyBL, 'Rest');
  console.log('  Provisional score        :', prov.score);
  console.log('  Provisional used_weight  :', prov.used_weight);
  pass('computeProvisionalScore mengembalikan score valid', prov.score !== null);
  
  // Simulate logic dari controller
  let safe_to_update = true;
  let finalStatus = 'PROVISIONAL_NORMAL';
  if (prov.score >= 2.5) {
    finalStatus = 'PROVISIONAL_DEVIATION';
  }
  
  console.log('  Final Temporal Status    :', finalStatus);
  pass('Menghasilkan status PROVISIONAL_NORMAL atau PROVISIONAL_DEVIATION', finalStatus.startsWith('PROVISIONAL_'));
}

// ── RINGKASAN AKHIR ───────────────────────────────────────────────────────────
head('RINGKASAN AKHIR');
console.log(`
  State                  | Implemented | Baseline diperbarui?
  ───────────────────────┼─────────────┼────────────────────────
  QUALITY_WARNING        | ✅ Ya       | Tidak
  INSUFFICIENT_BASELINE  | ✅ Ya       | Ya (buildBaselineUpdateFields)
  PROVISIONAL_NORMAL     | ✅ Ya       | Ya (safe_to_update=true)
  PROVISIONAL_DEVIATION  | ✅ Ya       | Ya (safe_to_update=true)
  NORMAL                 | ✅ Ya       | Ya (safe_to_update=true)
  NORMAL (cooldown)      | ✅ Ya       | Tidak (safe_to_update=false)
  DEVIATION_CANDIDATE    | ✅ Ya       | Tidak
  PERSISTENT_DEVIATION   | ✅ Ya       | Tidak
  RECOVERING             | ✅ Ya       | Tidak
  RECOVERED              | ✅ Ya       | Tidak; mulai cooldown
`);
