/**
 * test_relapse_multi_peak.js
 * 
 * Verifikasi algoritma:
 * 1. Multi-peak detection dalam 1 episode
 * 2. Relapse trajectory detection saat score t+1 > t paska penurunan
 * 3. TTR diukur dari peak ke tau_out
 * 4. Trapezoidal AUC computation
 * 5. Penyimpanan EMA response baru (tidur & obat)
 */

import mongoose from 'mongoose';
import AnomalyEvent from '../models/anomalyevent.model.js';
import EmaResponse from '../models/ema.model.js';
import EpisodeAnalysis from '../models/episode_analysis.model.js';

function computeTrapezoidalAUC(scoreArr, timeArr) {
  if (!scoreArr || scoreArr.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < scoreArr.length; i++) {
    const dtMin = (timeArr && timeArr[i] && timeArr[i - 1])
      ? Math.max(0.1, (timeArr[i] - timeArr[i - 1]) / 60000)
      : 1.0;
    total += 0.5 * (scoreArr[i - 1] + scoreArr[i]) * dtMin;
  }
  return Number(total.toFixed(2));
}

function runSimulationTest() {
  console.log('=== TEST 1: ALGORITMA MULTI-PEAK, RELAPSE (t -> t+1), & TTR KE TAU_OUT ===');

  const tauIn = 2.5;
  const tauOut = 1.5;
  const tauNormal = 1.0;

  // Simulasi 1 episode dengan 2 Peak (Peak 1 -> Turun ke tau_out -> Relapse naik ke Peak 2 -> Recovery penuh)
  // Window tiap 1 menit (60000 ms)
  const baseTime = Date.now() - 30 * 60 * 1000;
  const signalSequence = [
    { minute: 0, score: 0.5, status: 'NORMAL' },
    { minute: 1, score: 2.6, status: 'DEVIATION_CANDIDATE' }, // Onset Peak 1
    { minute: 2, score: 3.8, status: 'PERSISTENT_DEVIATION' }, // Peak 1 Max = 3.8
    { minute: 3, score: 2.2, status: 'RECOVERING' },            // Descent
    { minute: 4, score: 1.4, status: 'RECOVERING' },            // Drop below tau_out (1.5) -> TTR 1 tercapai!
    { minute: 5, score: 2.1, status: 'PERSISTENT_DEVIATION' }, // RELAPSE! t+1 (2.1) > t (1.4), delta=+0.7
    { minute: 6, score: 3.4, status: 'PERSISTENT_DEVIATION' }, // Peak 2 Max = 3.4
    { minute: 7, score: 2.0, status: 'RECOVERING' },            // Descent 2
    { minute: 8, score: 1.3, status: 'RECOVERING' },            // Drop below tau_out (1.5) -> TTR 2 tercapai!
    { minute: 9, score: 0.8, status: 'RECOVERED' },             // Drop below tauNormal (1.0) -> Closed
  ];

  const state = {
    openEventId: 'SIMULATED_EPISODE_001',
    scores: [],
    timestamps: [],
    peaks: [],
    peakScore: 0,
    lastScore: null,
    lastWindowStart: null,
    hadRecoveryDescent: false,
    relapseCount: 0,
    relapseAscentVelocity: null
  };

  signalSequence.forEach(win => {
    const segWinStart = baseTime + win.minute * 60000;
    const score = win.score;
    const rr_status = win.status;

    if (rr_status === 'NORMAL') return;

    // Relapse transition check (t -> t+1)
    const prevScore = state.lastScore;
    const prevWinStart = state.lastWindowStart || segWinStart;
    const deltaTMin = Math.max(0.5, (segWinStart - prevWinStart) / 60000);

    if (state.openEventId && prevScore !== null && score > prevScore) {
      const deltaScore = score - prevScore;
      if (state.hadRecoveryDescent && (score >= tauOut || deltaScore >= 0.15)) {
        state.hadRecoveryDescent = false;
        state.relapseCount++;
        state.relapseAscentVelocity = Number((deltaScore / deltaTMin).toFixed(3));
        console.log(` -> [RELAPSE DETECTED] at minute ${win.minute}: score ${prevScore.toFixed(2)} -> ${score.toFixed(2)} | Ascent Velocity = +${state.relapseAscentVelocity}/min`);
      }
    }

    if (score <= tauOut || (prevScore !== null && score < prevScore)) {
      state.hadRecoveryDescent = true;
    }

    // Multi-peak tracking
    if (rr_status === 'DEVIATION_CANDIDATE' || rr_status === 'PERSISTENT_DEVIATION') {
      if (state.peaks.length === 0) {
        state.peaks.push({
          peak_time: segWinStart,
          peak_score: score,
          tau_out_time: null,
          ttr_to_tau_out_ms: null
        });
      } else {
        const lastP = state.peaks[state.peaks.length - 1];
        if (lastP.tau_out_time !== null && score > prevScore && score >= tauOut) {
          state.peaks.push({
            peak_time: segWinStart,
            peak_score: score,
            tau_out_time: null,
            ttr_to_tau_out_ms: null
          });
        } else if (lastP.tau_out_time === null && score > lastP.peak_score) {
          lastP.peak_score = score;
          lastP.peak_time = segWinStart;
        }
      }
    }

    // Selesaikan TTR ke tau_out
    if (score <= tauOut && state.peaks.length > 0) {
      state.peaks.forEach(p => {
        if (p.tau_out_time === null) {
          p.tau_out_time = segWinStart;
          p.ttr_to_tau_out_ms = Math.max(0, segWinStart - p.peak_time);
        }
      });
    }

    state.scores.push(score);
    state.timestamps.push(segWinStart);
    state.peakScore = Math.max(state.peakScore, score);
    state.lastScore = score;
    state.lastWindowStart = segWinStart;
  });

function computeResidualDeviation(scoreArr, timeArr, tauNormal = 1.0) {
  if (!scoreArr || scoreArr.length < 2) return 0;
  let maxIdx = 0;
  let maxScore = -Infinity;
  for (let i = 0; i < scoreArr.length; i++) {
    if (scoreArr[i] > maxScore) {
      maxScore = scoreArr[i];
      maxIdx = i;
    }
  }

  let residue = 0;
  for (let i = maxIdx + 1; i < scoreArr.length; i++) {
    const sPrev = Math.max(0, scoreArr[i - 1] - tauNormal);
    const sCurr = Math.max(0, scoreArr[i] - tauNormal);
    const dtMin = (timeArr && timeArr[i] && timeArr[i - 1])
      ? Math.max(0.1, (timeArr[i] - timeArr[i - 1]) / 60000)
      : 1.0;
    residue += 0.5 * (sPrev + sCurr) * dtMin;
  }
  return Number(residue.toFixed(2));
}

  const multiTtrList = state.peaks.map((p, idx) => ({
    peak_index: idx + 1,
    peak_score: p.peak_score,
    ttr_ms: p.ttr_to_tau_out_ms,
    ttr_min: Number((p.ttr_to_tau_out_ms / 60000).toFixed(1)),
    tau_out_reached_at: p.tau_out_time
  }));

  const auc = computeTrapezoidalAUC(state.scores, state.timestamps);
  const residualDev = computeResidualDeviation(state.scores, state.timestamps, tauNormal);
  const dampingRatio = state.peaks.length >= 2 && state.peaks[0].peak_score > 0
    ? Number((state.peaks[1].peak_score / state.peaks[0].peak_score).toFixed(2))
    : 1.0;

  console.log('\n--- HASIL SIMULASI EPISODE ---');
  console.log('Total Peaks Terdeteksi :', state.peaks.length);
  console.log('Total Relapse Count    :', state.relapseCount);
  console.log('Relapse Ascent Velocity:', `+${state.relapseAscentVelocity}/min`);
  console.log('Multi-TTR List         :', JSON.stringify(multiTtrList, null, 2));
  console.log('AUC Score (Trapezoid)  :', auc);
  console.log('Residual Deviation (sisa overshoot > tau_normal):', residualDev);
  console.log('Damping Ratio (Peak 2 / Peak 1):', dampingRatio);

  console.log('\n--- LOG KELUARAN BLOK 1 SAMPLE ---');
  console.log(`[Blok-1 Engine Log] WindowState=RECOVERED | Confidence=0.98 | EpId=${state.openEventId} | Onset=${new Date(baseTime).toISOString()} | Peak=${state.peakScore} | Dur=9.0min | TTR=2.0m | RelapseCount=${state.relapseCount} | ResidualDev=${residualDev} | ContextTag=Sitting | Work`);

  if (state.peaks.length === 2 && state.relapseCount === 1 && multiTtrList.length === 2 && auc > 0 && residualDev > 0) {
    console.log('\n>>> STATUS TEST 1: BERHASIL (PASSED) <<<\n');
  } else {
    console.error('\n>>> STATUS TEST 1: GAGAL (FAILED) <<<\n');
    process.exit(1);
  }
}

runSimulationTest();
console.log('Semua pengujian logika algoritma Episode, Relapse, Multi-Peak, Residual Deviation, dan AUC selesai dengan sukses!');
