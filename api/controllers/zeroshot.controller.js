/**
 * zeroshot.controller.js  (v2 — Full Pipeline Context)
 * ─────────────────────────────────────────────────────────────────────────────
 * Zero-Shot LLM Analysis Controller
 * Membaca data dari 6 sumber sekaligus lalu membangun satu prompt zero-shot:
 *
 *   [1] LOG MONITORING   → segmen real-time terbaru (HR, anomaly score, state)
 *   [2] LOG BASELINE     → statistik personal + maturity + tau threshold
 *   [3] STATE TIMELINE   → riwayat transisi FSM per window (log state)
 *   [4] EPISODE LIST     → riwayat episode anomali sebelumnya (konteks jangka panjang)
 *   [5] EXPERIENCE       → memori personal (pola yang sudah dipelajari sistem)
 *   [6] PREDIKSI         → Markov next-state forecast + recovery estimate
 *
 * Alur:
 *   1. Fetch semua sumber data dari MongoDB secara paralel (Promise.all)
 *   2. Bangun prompt zero-shot dari semua data
 *   3. Kirim ke LLM (Gemini / OpenAI)
 *   4. Parse & kembalikan JSON hasil ke client
 */

import Baseline        from '../models/baseline.model.js';
import Segment         from '../models/segment.model.js';
import AnomalyEvent    from '../models/anomalyevent.model.js';
import StateTransition from '../models/state_transition.model.js';
import mongoose        from 'mongoose';
import fetch           from 'node-fetch';
import dns             from 'dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

// Utility functions untuk prediction — import langsung tanpa memanggil controller
import { getTransitionMatrix, getAllTransitions } from '../utils/capar.transitions.js';
import { getRecoveryDistribution }               from '../utils/capar.thresholds.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt      = (v) => (v !== undefined && v !== null ? v : 'N/A');
const fmtFloat = (v, d = 3) => (typeof v === 'number' ? v.toFixed(d) : 'N/A');
const fmtMs    = (ms) => (typeof ms === 'number' ? Math.round(ms / 60000) + ' menit' : 'N/A');

const FSM_LABELS = {
  BASELINE_COMPATIBLE:   'Normal',
  DEVIATION_CANDIDATE:   'Kandidat Deviasi',
  PERSISTENT_DEVIATION:  'Deviasi Persisten',
  RECOVERY_ENTRY:        'Pemulihan',
  RESOLVED:              'Selesai',
  INSUFFICIENT_BASELINE: 'Baseline Kurang',
};
const fsmLabel = (s) => FSM_LABELS[s] || s || '?';

const MATURITY_LABELS = {
  cold_start:  'Cold Start (sangat baru, provisional)',
  provisional: 'Provisional (estimasi awal)',
  maturing:    'Maturing (berkembang)',
  mature:      'Mature (stabil & dipercaya)',
  frozen:      'Frozen (terkunci)',
};
const matLabel = (l) => MATURITY_LABELS[l] || l || 'N/A';

// ── Fetch semua sumber data secara paralel ────────────────────────────────────
async function gatherContext(event) {
  const uid      = event.user_id?.toString();
  const activity = event.activity;

  // Gunakan ObjectId jika valid
  const uidFilter = mongoose.Types.ObjectId.isValid(uid)
    ? { user_id: new mongoose.Types.ObjectId(uid) }
    : { user_id: uid };

  const [
    baseline,
    recentSegments,
    allBaselines,
    episodeHistory,
    stateLog,
    experienceAgg,
    transitionData,
    recoveryData,
  ] = await Promise.allSettled([

    // [2] Baseline utama (user + activity dari event ini)
    Baseline.findOne({ ...uidFilter, activity }).lean(),

    // [1] Monitoring: 5 segmen terbaru user (log real-time)
    Segment.find(uidFilter)
      .sort({ window_start: -1 })
      .limit(5)
      .select('window_start anomaly_score rr_status activity_label features.mean_hr features.sdnn features.rmssd z_scores missing_data_info.confidence_score')
      .lean(),

    // [2b] Semua baseline user (ringkasan per-aktivitas)
    Baseline.find(uidFilter)
      .select('activity time_period segment_count maturity_detail.level learned_tau.tau_in learned_tau.source stats.mean_hr.mean stats.sdnn.mean')
      .lean(),

    // [4] Episode history (10 terakhir)
    AnomalyEvent.find(uidFilter)
      .sort({ onset_time: -1 })
      .limit(10)
      .select('_id onset_time classification physiological_outcome duration_ms peak_score peak_hr relapse admin_status activity')
      .lean(),

    // [3] State log: state_transitions untuk episode ini
    StateTransition.find({ episode_id: event._id?.toString() })
      .sort({ timestamp: 1 })
      .limit(30)
      .lean()
      .catch(() => []),

    // [5] Experience Memory — query langsung aggregat
    AnomalyEvent.aggregate([
      { $match: { ...uidFilter } },
      { $group: {
          _id: null,
          total_episodes:       { $sum: 1 },
          avg_duration_ms:      { $avg: '$duration_ms' },
          relapse_count:        { $sum: { $cond: ['$relapse', 1, 0] } },
          alert_count:          { $sum: { $cond: [{ $eq: ['$classification', 'Alert'] }, 1, 0] } },
          avg_peak_hr:          { $avg: '$peak_hr' },
      }},
    ]).catch(() => []),

    // [6] Markov transition matrix
    getTransitionMatrix(uid, activity).catch(() => ({ matrix: null, total_transitions: 0, source: 'error' })),

    // [6b] Recovery distribution
    getRecoveryDistribution(uid, activity).catch(() => null),
  ]);

  const val = (r) => (r.status === 'fulfilled' ? r.value : null);

  const expAgg = val(experienceAgg) || [];
  const expSummary = expAgg.length > 0 ? {
    total_episodes:  expAgg[0].total_episodes,
    avg_duration_ms: expAgg[0].avg_duration_ms,
    relapse_count:   expAgg[0].relapse_count,
    alert_count:     expAgg[0].alert_count,
    avg_peak_hr:     expAgg[0].avg_peak_hr,
  } : null;

  const trans = val(transitionData);

  return {
    baseline:       val(baseline),
    recentSegments: val(recentSegments) || [],
    allBaselines:   val(allBaselines)   || [],
    episodeHistory: val(episodeHistory) || [],
    stateLog:       val(stateLog)       || [],
    experience:     expSummary,
    forecast:       null,
    recovery:       val(recoveryData),
    transitions:    trans ? { matrix: trans.matrix, total_transitions: trans.total_transitions, source: trans.source } : null,
  };
}

// ── Build Full Zero-Shot Prompt ───────────────────────────────────────────────
function buildFullPrompt(event, ctx) {
  const { baseline, recentSegments, allBaselines, episodeHistory, stateLog, experience, forecast, recovery, transitions } = ctx;

  const tau   = baseline?.learned_tau || {};
  const stats = baseline?.stats || {};

  // Segmen terbaru (monitoring)
  const monLines = recentSegments.map((s, i) => {
    const ts = s.window_start < 10000000000 ? s.window_start * 1000 : s.window_start;
    const time = new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `  [${i + 1}] ${time} | HR=${fmtFloat(s.features?.mean_hr, 1)} bpm | Score=${fmtFloat(s.anomaly_score, 2)} | ${fsmLabel(s.rr_status)} | Aktivitas=${s.activity_label || '?'}`;
  }).join('\n') || '  (tidak ada data monitoring)';

  // Semua baseline user
  const blLines = allBaselines.map(b =>
    `  - ${b.activity || '?'} [${b.time_period || '?'}]: n=${b.segment_count}, maturity=${b.maturity_detail?.level || '?'}, HR_mean=${fmtFloat(b.stats?.mean_hr?.mean, 1)}, SDNN=${fmtFloat(b.stats?.sdnn?.mean, 1)}, tau_in=${fmtFloat(b.learned_tau?.tau_in, 2)} (${b.learned_tau?.source || '?'})`
  ).join('\n') || '  (tidak ada baseline)';

  // State log dari episode ini
  const stLines = stateLog.length > 0
    ? stateLog.map((t, i) => `  W${i + 1}: ${fsmLabel(t.to_state)} [score=${fmtFloat(t.anomaly_score, 2)}]`).join('\n')
    : (Array.isArray(event.trajectory?.sequence_of_states)
        ? event.trajectory.sequence_of_states.map((s, i) => `  W${i + 1}: ${fsmLabel(s)}`).join('\n')
        : '  (tidak ada log state)');

  // Episode history
  const epLines = episodeHistory.map((ep, i) => {
    const ts = ep.onset_time < 10000000000 ? ep.onset_time * 1000 : ep.onset_time;
    const date = new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    const isCurrent = ep._id?.toString() === event._id?.toString();
    return `  [${i + 1}]${isCurrent ? ' ← SEKARANG' : ''} ${date} | ${ep.activity || '?'} | ${ep.classification || '?'} | ${fsmLabel(ep.physiological_outcome)} | ${fmtMs(ep.duration_ms)} | PeakHR=${fmtFloat(ep.peak_hr, 1)} | Relapse=${ep.relapse ? 'Ya' : 'Tidak'} | Admin=${ep.admin_status || '?'}`;
  }).join('\n') || '  (tidak ada riwayat episode)';

  // Experience memory (dari aggregasi AnomalyEvent)
  let expBlock = '  (tidak tersedia)';
  if (experience) {
    expBlock = [
      `  - Total episode anomali: ${experience.total_episodes ?? 'N/A'}`,
      `  - Rata-rata durasi: ${fmtMs(experience.avg_duration_ms)}`,
      `  - Relapse count: ${experience.relapse_count ?? 'N/A'}`,
      `  - Alert count: ${experience.alert_count ?? 'N/A'}`,
      `  - Rata-rata Peak HR: ${fmtFloat(experience.avg_peak_hr, 1)} bpm`,
    ].join('\n');
  }

  // Prediksi next-state (dari Markov transition matrix + segmen terbaru)
  let forecastBlock = '  (tidak tersedia)';
  if (transitions?.matrix && recentSegments.length > 0) {
    const latestState = recentSegments[0]?.rr_status || 'BASELINE_COMPATIBLE';
    const stateKey = latestState.replace('NORMAL', 'BASELINE_COMPATIBLE')
                               .replace('RECOVERING', 'RECOVERY_ENTRY')
                               .replace('RECOVERED', 'RESOLVED');
    const probs = transitions.matrix[stateKey] || transitions.matrix[latestState] || {};
    if (Object.keys(probs).length > 0) {
      const sorted = Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, 3);
      forecastBlock = `  State saat ini: ${fsmLabel(latestState)}\n` +
        sorted.map(([s, p]) => `  → ${fsmLabel(s)} : p=${fmtFloat(p, 3)}`).join('\n') +
        `\n  (sumber matrix: ${transitions.source || '?'}, total=${transitions.total_transitions || 0} transisi)`;
    }
  }

  // Recovery estimate
  let recoveryBlock = '  (tidak tersedia)';
  if (recovery) {
    recoveryBlock = [
      `  - Estimasi waktu pemulihan: ${recovery.estimated_recovery_min ? recovery.estimated_recovery_min + ' menit' : 'N/A'}`,
      `  - Probabilitas pemulihan dalam 30 mnt: ${fmtFloat(recovery.prob_30min ?? recovery.probability_30min, 3)}`,
      `  - Confidence: ${recovery.confidence || 'N/A'}`,
    ].join('\n');
  }

  // Markov transitions (heatmap ringkasan)
  let transBlock = '  (tidak tersedia)';
  if (transitions) {
    const matrix = transitions.matrix || transitions.transition_matrix;
    if (matrix && typeof matrix === 'object') {
      const rows = Object.entries(matrix).slice(0, 4).map(([from, tos]) => {
        const toStr = Object.entries(tos || {})
          .map(([t, p]) => `${fsmLabel(t)}=${fmtFloat(p, 2)}`)
          .join(', ');
        return `  ${fsmLabel(from)} → ${toStr}`;
      });
      transBlock = rows.join('\n');
    }
  }

  // Data episode sekarang
  const segPeak = recentSegments[0] || {};

  return `Anda adalah asisten AI medis ahli sistem CAPAR (Continuous Anomaly Processing and Resolution). Sistem ini memonitor detak jantung (HR) dan HRV peserta secara kontinu menggunakan wearable sensor.

KONTEKS SISTEM: Data di bawah ini merupakan agregasi lengkap dari 6 sumber log CAPAR untuk satu pengguna, terkait dengan episode anomali yang sedang dianalisis. Tugas Anda adalah melakukan analisis holistik, bukan parsial.

══════════════════════════════════════════════════════════════
[LOG 1] MONITORING REAL-TIME (5 Segmen Terbaru Pengguna)
══════════════════════════════════════════════════════════════
Catatan: Setiap segmen = satu window pengukuran (biasanya 1 atau 5 menit).
${monLines}

══════════════════════════════════════════════════════════════
[LOG 2] BASELINE — Profil Fisiologis Personal
══════════════════════════════════════════════════════════════
Baseline Aktif (untuk episode ini):
  Aktivitas        : ${fmt(baseline?.activity)}
  Periode Waktu    : ${fmt(baseline?.time_period)}
  Segment Count    : ${fmt(baseline?.segment_count)}
  Maturitas        : ${matLabel(baseline?.maturity_detail?.level)}
  TAU_IN           : ${fmtFloat(tau.tau_in)}   ← skor anomali ≥ ini = DEVIASI
  TAU_OUT          : ${fmtFloat(tau.tau_out)}  ← skor ≤ ini = mulai RECOVERY
  TAU_NORMAL       : ${fmtFloat(tau.tau_normal)} ← skor ≤ ini = NORMAL kembali
  TAU Source       : ${fmt(tau.source)}
  HR Baseline      : ${fmtFloat(stats.mean_hr?.mean)} bpm (n=${fmt(stats.mean_hr?.n)}, std=${fmtFloat(stats.mean_hr?.std)})
  SDNN Baseline    : ${fmtFloat(stats.sdnn?.mean)} ms
  RMSSD Baseline   : ${fmtFloat(stats.rmssd?.mean)} ms
  DFA Alpha1       : ${fmtFloat(stats.dfa_alpha1?.mean)}
  Bq (quality)     : ${fmtFloat(baseline?.maturity_detail?.bq, 3)}

Semua Baseline Pengguna (per aktivitas):
${blLines}

══════════════════════════════════════════════════════════════
[LOG 3] STATE TIMELINE — Riwayat Transisi FSM Episode Ini
══════════════════════════════════════════════════════════════
Episode ID : ${fmt(event._id)}
Aktivitas  : ${fmt(event.activity)}
Onset      : ${event.onset_time ? new Date(event.onset_time < 1e12 ? event.onset_time * 1000 : event.onset_time).toLocaleString('id-ID') : 'N/A'}
Peak Score : ${fmtFloat(event.peak_score)}
Peak HR    : ${fmtFloat(event.peak_hr)} bpm
Durasi     : ${fmtMs(event.duration_ms)}

Transisi FSM per Window:
${stLines}

State Akhir        : ${fsmLabel(event.current_state || event.physiological_outcome)}
Outcome Fisiologis : ${fmt(event.physiological_outcome)}

══════════════════════════════════════════════════════════════
[LOG 4] EPISODE LIST — Riwayat Anomali Sebelumnya (10 Terakhir)
══════════════════════════════════════════════════════════════
${epLines}

══════════════════════════════════════════════════════════════
[LOG 5] EXPERIENCE MEMORY — Pola yang Telah Dipelajari Sistem
══════════════════════════════════════════════════════════════
${expBlock}

══════════════════════════════════════════════════════════════
[LOG 6] PREDIKSI — Markov Forecast & Recovery Estimate
══════════════════════════════════════════════════════════════
Next-State Forecast (Markov):
${forecastBlock}

Recovery Estimate:
${recoveryBlock}

Markov Transition Matrix (ringkasan):
${transBlock}

══════════════════════════════════════════════════════════════
INSTRUKSI OUTPUT (PENTING: HANYA JSON, tidak ada teks di luar JSON)
══════════════════════════════════════════════════════════════
Analisis SEMUA sumber data di atas secara terintegrasi. Berikan output JSON berikut:

{
  "monitoring_insight": "Interpretasi 5 segmen monitoring terbaru: tren HR dan anomaly score dalam beberapa window terakhir. Apakah tren membaik, memburuk, atau stabil? (2-3 kalimat)",
  "baseline_evaluation": "Evaluasi kesiapan baseline: apakah threshold tau sudah cukup terpersonalisasi? Apakah maturitas cukup untuk diagnosis yang andal? (2-3 kalimat)",
  "state_transition_explanation": "Jelaskan urutan transisi FSM episode ini: mengapa sistem pindah ke setiap state, kaitkan dengan nilai TAU_IN/TAU_OUT dan data segmen. (3-4 kalimat)",
  "episode_history_pattern": "Pola dari riwayat episode sebelumnya: seberapa sering anomali terjadi, adakah pola aktivitas/waktu, apakah ada relapse, tren membaik atau memburuk? (2-3 kalimat)",
  "experience_insight": "Apa yang sudah dipelajari sistem dari pengguna ini? Apakah tau threshold cukup terpersonalisasi? (1-2 kalimat)",
  "prediction_interpretation": "Interpretasi prediksi next-state dan recovery estimate: berapa lama kemungkinan episode berlanjut, berapa peluang pemulihan? (2-3 kalimat)",
  "patient_summary": "Ringkasan LENGKAP dan RAMAH untuk pasien dalam bahasa Indonesia sehari-hari. Jelaskan: apa yang terjadi, sudah berapa lama, apakah berbahaya, apa yang harus dilakukan sekarang dan ke depannya. HINDARI jargon medis teknis. (4-5 kalimat)",
  "clinical_notes": "Catatan komprehensif untuk dokter/peneliti: skor puncak, kualitas data, flag klinis penting, rekomendasi tindakan, evaluasi keandalan prediksi. (3-4 kalimat)",
  "risk_level": "rendah|sedang|tinggi|kritis",
  "risk_reason": "Alasan singkat level risiko (1 kalimat).",
  "confidence": "tinggi|sedang|rendah",
  "confidence_reason": "Alasan singkat level confidence berdasarkan kualitas dan kuantitas data yang tersedia (1 kalimat)."
}`;
}

function safeParseJSON(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Respons LLM kosong.');
  }

  let text = rawText.trim();
  // Strip markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // 1. Direct parse attempt
  try {
    return JSON.parse(text);
  } catch (_) {}

  // 2. Try parsing from first { to end
  const firstBrace = text.indexOf('{');
  if (firstBrace !== -1) {
    const candidate = text.slice(firstBrace);
    try {
      return JSON.parse(candidate);
    } catch (_) {}

    // 3. Truncation recovery: fix unclosed strings & close open braces
    let inString = false;
    let escaped = false;
    let openBraces = 0;

    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === '{') openBraces++;
        else if (ch === '}') openBraces--;
      }
    }

    let repaired = candidate;
    if (inString) {
      repaired += '"';
    }
    // Remove any trailing dangling comma before closing braces
    repaired = repaired.replace(/,\s*$/, '');
    while (openBraces > 0) {
      repaired += '}';
      openBraces--;
    }

    try {
      return JSON.parse(repaired);
    } catch (_) {}
  }

  throw new Error('Respons LLM bukan JSON yang valid: ' + text.slice(0, 200));
}

// ── Call LLM (Gemini via REST) ────────────────────────────────────────────────
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY tidak dikonfigurasi di environment.');

  const requestedModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const candidateModels = Array.from(new Set([
    requestedModel,
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ]));

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  let lastError = null;
  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(90000),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = new Error(`Gemini API (${model}) error ${res.status}: ${errText.slice(0, 300)}`);
        // If 404 (model not found), continue to try next fallback model
        if (res.status === 404) {
          console.warn(`[ZeroShot] Model ${model} not found (404), mencoba fallback berikutnya...`);
          continue;
        }
        throw lastError;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return safeParseJSON(text);
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('timeout')) {
        lastError = new Error(`Koneksi ke Gemini API timeout setelah 90 detik (${model}). Periksa koneksi internet.`);
        console.warn(`[ZeroShot] Timeout pada model ${model}, mencoba model fallback...`);
        continue;
      }
      lastError = err;
      if (!err.message.includes('404')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Semua model Gemini candidate gagal.');
}

// ── Call LLM (OpenAI-compatible fallback) ─────────────────────────────────────
async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY tidak dikonfigurasi di environment.');

  const url   = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';
  const model = process.env.OPENAI_MODEL    || 'gpt-4o-mini';

  const payload = {
    model,
    messages: [
      { role: 'system', content: 'Anda adalah asisten AI medis ahli CAPAR. Selalu balas dalam JSON valid.' },
      { role: 'user',   content: prompt },
    ],
    temperature:     0.2,
    max_tokens:      4096,
    response_format: { type: 'json_object' },
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body:    JSON.stringify(payload),
    signal:  AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return safeParseJSON(data?.choices?.[0]?.message?.content || '{}');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /api/ai/zero-shot/analyze ───────────────────────────────────────────
export async function zeroShotAnalyze(req, res) {
  try {
    const { episodeId, userId, useExported } = req.body;

    let event = null;

    // Mode 1: Data exported (dari exported_graph_data.json — pakai prompt simpel v1)
    if (useExported && req.body.raw_data) {
      const raw      = req.body.raw_data;
      const baseline = raw.baseline_doc;
      const segment  = raw.segment_doc;
      event          = raw.event_doc || {};
      const fsmStates  = req.body.fsm_states || [];
      const thresholds = req.body.thresholds  || {};

      // Build minimal prompt untuk mode exported
      const prompt = buildExportedPrompt({ baseline, segment, event, fsmStates, thresholds });
      const provider = process.env.LLM_PROVIDER || 'gemini';
      let result;
      try {
        result = provider === 'openai' ? await callOpenAI(prompt) : await callGemini(prompt);
      } catch (llmErr) {
        return res.status(502).json({ success: false, message: `LLM Error: ${llmErr.message}`, prompt_preview: prompt.slice(0, 500) });
      }
      return res.json({ success: true, provider, mode: 'exported', episode_id: event._id, result, prompt_length: prompt.length });
    }

    // Mode 2: Fetch dari MongoDB — lengkap 6 sumber
    if (!episodeId) {
      return res.status(400).json({ success: false, message: 'Sediakan episodeId atau useExported=true dengan raw_data.' });
    }

    event = await AnomalyEvent.findById(episodeId).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Episode tidak ditemukan.' });

    // Override user_id jika disuplai
    if (userId) event = { ...event, user_id: userId };

    // Kumpulkan semua context secara paralel
    const ctx = await gatherContext(event);

    // Build full prompt
    const prompt   = buildFullPrompt(event, ctx);
    const provider = process.env.LLM_PROVIDER || 'gemini';

    let result;
    try {
      result = provider === 'openai' ? await callOpenAI(prompt) : await callGemini(prompt);
    } catch (llmErr) {
      return res.status(502).json({
        success:        false,
        message:        `LLM Error: ${llmErr.message}`,
        prompt_preview: prompt.slice(0, 500) + '...',
      });
    }

    return res.json({
      success:    true,
      provider,
      mode:       'full_context',
      episode_id: episodeId,
      data_sources: {
        has_baseline:        !!ctx.baseline,
        recent_segments:     ctx.recentSegments.length,
        all_baselines:       ctx.allBaselines.length,
        episode_history:     ctx.episodeHistory.length,
        state_log_entries:   ctx.stateLog.length,
        has_experience:      !!ctx.experience,
        has_forecast:        !!ctx.forecast,
        has_recovery:        !!ctx.recovery,
        has_transitions:     !!ctx.transitions,
      },
      result,
      prompt_length: prompt.length,
    });

  } catch (err) {
    console.error('[ZeroShot] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/ai/zero-shot/episodes ────────────────────────────────────────────
export async function listZeroShotEpisodes(req, res) {
  try {
    const userId = req.query.userId;
    const filter = {};
    if (userId && userId !== 'ALL') {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        filter.user_id = new mongoose.Types.ObjectId(userId);
      } else {
        // userId is not a valid ObjectId, so no record will match in AnomalyEvent
        return res.json({ success: true, data: [] });
      }
    }

    const episodes = await AnomalyEvent
      .find(filter, {
        _id: 1, user_id: 1, activity: 1, classification: 1,
        physiological_outcome: 1, current_state: 1,
        onset_time: 1, duration_ms: 1,
        peak_score: 1, peak_hr: 1,
        baseline_hr: 1, relapse: 1,
        status: 1, admin_status: 1,
      })
      .sort({ onset_time: -1 })
      .limit(50)
      .lean();

    return res.json({ success: true, data: episodes });
  } catch (err) {
    console.error('[ZeroShot] listEpisodes error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/ai/zero-shot/prompt-preview ─────────────────────────────────────
export async function promptPreview(req, res) {
  try {
    const { episodeId, userId } = req.query;
    if (!episodeId) return res.status(400).json({ success: false, message: 'episodeId diperlukan.' });

    let event = await AnomalyEvent.findById(episodeId).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Episode tidak ditemukan.' });
    if (userId) event = { ...event, user_id: userId };

    const ctx    = await gatherContext(event);
    const prompt = buildFullPrompt(event, ctx);

    return res.json({
      success:      true,
      episode_id:   episodeId,
      prompt,
      prompt_length: prompt.length,
      data_summary: {
        has_baseline:      !!ctx.baseline,
        maturity:          ctx.baseline?.maturity_detail?.level || 'N/A',
        recent_segments:   ctx.recentSegments.length,
        episode_history:   ctx.episodeHistory.length,
        state_log_entries: ctx.stateLog.length,
        has_experience:    !!ctx.experience,
        has_forecast:      !!ctx.forecast,
        has_recovery:      !!ctx.recovery,
        has_transitions:   !!ctx.transitions,
      },
    });
  } catch (err) {
    console.error('[ZeroShot] promptPreview error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── Helper: prompt untuk mode exported (data JSON manual) ────────────────────
function buildExportedPrompt({ baseline, segment, event, fsmStates, thresholds }) {
  const tau   = baseline?.learned_tau || {};
  const stats = baseline?.stats || {};
  const f     = segment?.features || {};
  const z     = segment?.z_scores || {};
  const tauIn     = fmtFloat(tau.tau_in     ?? thresholds?.TAU_IN     ?? 1.7);
  const tauOut    = fmtFloat(tau.tau_out    ?? thresholds?.TAU_OUT    ?? 0.85);
  const tauNormal = fmtFloat(tau.tau_normal ?? thresholds?.TAU_NORMAL ?? 0.595);
  const stLines   = (Array.isArray(fsmStates) ? fsmStates : []).map((s, i) => `  W${i}: ${fsmLabel(s)}`).join('\n') || '  (tidak ada)';

  return `Anda adalah asisten AI medis CAPAR. Analisis data berikut secara zero-shot.

[BASELINE] Aktivitas=${fmt(baseline?.activity)}, Maturity=${matLabel(baseline?.maturity_detail?.level)}, TAU_IN=${tauIn}, TAU_OUT=${tauOut}, TAU_NORMAL=${tauNormal}
  HR Mean=${fmtFloat(stats.mean_hr?.mean)} bpm, SDNN=${fmtFloat(stats.sdnn?.mean)} ms, RMSSD=${fmtFloat(stats.rmssd?.mean)} ms

[SEGMEN] Activity=${fmt(segment?.activity_label)}, Score=${fmtFloat(segment?.anomaly_score)}, State=${fsmLabel(segment?.rr_status)}
  HR=${fmtFloat(f.mean_hr)} bpm, SDNN=${fmtFloat(f.sdnn)}, RMSSD=${fmtFloat(f.rmssd)}, DFA=${fmtFloat(f.dfa_alpha1)}
  Z-Scores: z_hr=${fmtFloat(z.z_hr)}, z_sdnn=${fmtFloat(z.z_sdnn)}, z_rmssd=${fmtFloat(z.z_rmssd)}, z_dfa=${fmtFloat(z.z_dfa)}

[FSM HISTORY]
${stLines}

[EPISODE] Class=${fmt(event?.classification)}, Outcome=${fmt(event?.physiological_outcome)}, Durasi=${fmtMs(event?.duration_ms)}, Peak HR=${fmtFloat(event?.peak_hr)} bpm

Output JSON (HANYA JSON):
{
  "monitoring_insight": "...",
  "baseline_evaluation": "...",
  "state_transition_explanation": "...",
  "episode_history_pattern": "Data terbatas (mode exported, riwayat tidak tersedia).",
  "experience_insight": "Data tidak tersedia (mode exported).",
  "prediction_interpretation": "Data tidak tersedia (mode exported).",
  "patient_summary": "...",
  "clinical_notes": "...",
  "risk_level": "rendah|sedang|tinggi|kritis",
  "risk_reason": "...",
  "confidence": "rendah",
  "confidence_reason": "Data exported parsial, hanya 4 sumber dari 6 yang tersedia."
}`;
}
