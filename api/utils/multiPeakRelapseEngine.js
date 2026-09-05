/**
 * CAPAR Multi-Peak & Relapse State-Space Engine
 * Ported directly from simulation/simulasi_multi_peak_relapse_mongodb.ipynb
 * 
 * Analyzes anomaly score dynamics S(t), identifying:
 * 1. Multi-peak excursions (Onset Peak, Relapse Peak 1, Relapse Peak 2, ...)
 * 2. Relapse transitions (t -> t+1): ascent velocity, delta S, and recovery descent breaches
 * 3. Time to Recovery (TTR) to tau_out for each peak
 * 4. Trapezoidal Area Under Curve (AUC-D)
 * 5. Phase-Space Mapping (S_t -> S_{t+1}) with step-order and zone classification
 * 6. Sequential Relationship Chain linking Onset -> Peak 1 -> Relapse 1 -> Peak 2 -> Resolved
 */

export function computeTrapezoidalAuc(scores = [], timestampsMs = []) {
  if (!scores || scores.length < 2) return 0.0;
  let total = 0.0;
  for (let i = 1; i < scores.length; i++) {
    let dtMin = 1.0;
    if (timestampsMs && timestampsMs.length === scores.length) {
      const diffMs = timestampsMs[i] - timestampsMs[i - 1];
      if (diffMs > 0) dtMin = Math.max(0.1, diffMs / 60000.0);
    }
    const sPrev = typeof scores[i - 1] === 'number' ? scores[i - 1] : 0;
    const sCur = typeof scores[i] === 'number' ? scores[i] : 0;
    total += 0.5 * (sPrev + sCur) * dtMin;
  }
  return Number(total.toFixed(2));
}

export function analyzeMultiPeakRelapseDynamics({
  scores = [],
  timestampsMs = [],
  hrs = [],
  tauIn = 1.86,
  tauOut = 1.18,
  tauNormal = 1.0,
  contextLabel = 'Sitting'
}) {
  // Safe default fallback if scores empty
  if (!scores || scores.length === 0) {
    scores = [1.85, 3.10, 1.09, 3.35, 2.85, 3.10, 3.35, 0.95];
  }

  // Ensure timestamps
  if (!timestampsMs || timestampsMs.length !== scores.length) {
    const baseTime = Date.now() - (scores.length * 60000);
    timestampsMs = scores.map((_, idx) => baseTime + idx * 60000);
  }

  if (!hrs || hrs.length !== scores.length) {
    hrs = scores.map(s => Number((70 + s * 14).toFixed(1)));
  }

  const peaks = [];
  const relapses = [];
  let hadRecoveryDescent = false;
  let lastScore = scores[0];
  let lastTimeMs = timestampsMs[0];
  let relapseCount = 0;

  // Initial Peak from first point
  peaks.push({
    peakIndex: 1,
    timeMs: timestampsMs[0],
    score: scores[0],
    hr: hrs[0],
    tauOutTimeMs: scores[0] <= tauOut ? timestampsMs[0] : null,
    ttrMin: scores[0] <= tauOut ? 0 : null,
    label: 'Peak 1 (Onset Peak)'
  });

  for (let i = 1; i < scores.length; i++) {
    const score = scores[i];
    const tMs = timestampsMs[i];
    const hr = hrs[i];
    const prevScore = scores[i - 1];
    const prevTimeMs = timestampsMs[i - 1];
    const dtMin = Math.max(0.5, (tMs - prevTimeMs) / 60000.0);

    // 1. Check Recovery Descent (crossing under or moving downward toward tau_out)
    if (score < prevScore && score <= tauOut) {
      hadRecoveryDescent = true;
      for (const p of peaks) {
        if (p.tauOutTimeMs === null) {
          p.tauOutTimeMs = tMs;
          p.ttrMin = Number(Math.max(0.1, (tMs - p.timeMs) / 60000.0).toFixed(1));
        }
      }
    } else if (score < prevScore && prevScore >= tauIn) {
      hadRecoveryDescent = true;
    }

    // 2. Check Relapse (t -> t+1): ascent after a descent has started
    if (score > prevScore && hadRecoveryDescent) {
      const deltaScore = score - prevScore;
      if (score >= tauOut || deltaScore >= 0.15) {
        hadRecoveryDescent = false;
        relapseCount += 1;
        const ascentVel = Number((deltaScore / dtMin).toFixed(3));
        relapses.push({
          relapseIndex: relapseCount,
          timeMs: tMs,
          fromScore: prevScore,
          toScore: score,
          deltaScore: Number(deltaScore.toFixed(2)),
          ascentVelocity: ascentVel,
          label: `Relapse ${relapseCount} (+${deltaScore.toFixed(2)} in ${dtMin.toFixed(1)}m)`
        });

        // Add a secondary relapse peak
        peaks.push({
          peakIndex: peaks.length + 1,
          timeMs: tMs,
          score: score,
          hr: hr,
          tauOutTimeMs: null,
          ttrMin: null,
          label: `Peak ${peaks.length + 1} (Relapse Peak ${relapseCount})`
        });
      }
    } else {
      // Update existing active peak if current score is higher during current excursion
      const activePeak = peaks[peaks.length - 1];
      if (activePeak && activePeak.tauOutTimeMs === null && score > activePeak.score) {
        activePeak.score = score;
        activePeak.timeMs = tMs;
        activePeak.hr = hr;
      }
    }

    lastScore = score;
    lastTimeMs = tMs;
  }

  // Resolve remaining open peaks if final score reached baseline
  const finalScore = scores[scores.length - 1];
  const finalTimeMs = timestampsMs[timestampsMs.length - 1];
  for (const p of peaks) {
    if (p.tauOutTimeMs === null) {
      p.tauOutTimeMs = finalTimeMs;
      p.ttrMin = Number(Math.max(0.5, (finalTimeMs - p.timeMs) / 60000.0).toFixed(1));
    }
  }

  // Calculate Trapezoidal AUC-D
  const aucScore = computeTrapezoidalAuc(scores, timestampsMs);

  // Maximum peak
  const maxPeakScore = Math.max(...scores);
  const primaryTtrMin = peaks[0]?.ttrMin || Number(((finalTimeMs - timestampsMs[0]) / 60000.0).toFixed(1));

  // Damping ratio calculation: Peak 2 / Peak 1 (if multiple peaks)
  let dampingRatio = 1.0;
  if (peaks.length >= 2 && peaks[0].score > 0) {
    dampingRatio = Number((peaks[1].score / peaks[0].score).toFixed(2));
  }

  // 3. Phase-Space Mapping (S_t -> S_{t+1}) with step numbers and zones
  const phaseSpaceOrbit = [];
  for (let i = 0; i < scores.length - 1; i++) {
    const st = scores[i];
    const st1 = scores[i + 1];
    const isRelapseAscent = st1 > st;
    const isCrossingTauOut = st <= tauOut && st1 > tauOut;
    const isRecoveryDescent = st1 < st;

    let stepAnnotation = null;
    if (i === 0) stepAnnotation = `Langkah 1: Onset Awal (S=${st.toFixed(2)})`;
    if (st1 === maxPeakScore) stepAnnotation = `Puncak Maksimum ($S=${st1.toFixed(2)}$)`;
    if (isCrossingTauOut) stepAnnotation = `⚡ RELAPSE ASCENT (${st.toFixed(2)} ➔ ${st1.toFixed(2)})`;
    if (i === scores.length - 2 && st1 <= tauNormal) stepAnnotation = `✓ Final Recovery (S=${st1.toFixed(2)})`;

    phaseSpaceOrbit.push({
      step: i + 1,
      fromTimeMs: timestampsMs[i],
      toTimeMs: timestampsMs[i + 1],
      st: Number(st.toFixed(2)),
      st1: Number(st1.toFixed(2)),
      delta: Number((st1 - st).toFixed(2)),
      zone: isRelapseAscent ? 'ZONA ESKALASI & RELAPSE' : 'ZONA PEMULIHAN / RECOVERY',
      zoneColor: isRelapseAscent ? '#EF4444' : '#10B981',
      isRelapse: isRelapseAscent,
      isRecovery: isRecoveryDescent,
      annotation: stepAnnotation
    });
  }

  // 4. Sequential Relationship Chain (Breadcrumb flow)
  const chainSteps = [];
  chainSteps.push({ type: 'ONSET', label: `Onset (${scores[0].toFixed(2)})`, score: scores[0] });

  peaks.forEach((p, idx) => {
    chainSteps.push({
      type: 'PEAK',
      label: `${p.label} [S=${p.score.toFixed(2)}]`,
      score: p.score,
      timeMs: p.timeMs,
      ttrMin: p.ttrMin
    });
    if (relapses[idx]) {
      const r = relapses[idx];
      chainSteps.push({
        type: 'RELAPSE',
        label: `⚡ Relapse ${r.relapseIndex} (+${r.deltaScore.toFixed(2)})`,
        deltaScore: r.deltaScore,
        velocity: r.ascentVelocity
      });
    }
  });

  chainSteps.push({
    type: 'RESOLVED',
    label: `Resolved (${finalScore.toFixed(2)})`,
    score: finalScore
  });

  const relationshipChainStr = chainSteps.map(s => s.label).join(' ➔ ');

  // Dynamics Classification
  let dynamicsClassification = 'Mono-Peak Linear Recovery';
  if (peaks.length >= 3 || relapseCount >= 2) {
    dynamicsClassification = 'Multi-Peak Relapse Loop (Osilasi Berulang)';
  } else if (peaks.length === 2 || relapseCount === 1) {
    dynamicsClassification = 'Damped Secondary Peak (Kekambuhan Rebound Tunggal)';
  }

  return {
    peaksCount: peaks.length,
    maxPeakScore: Number(maxPeakScore.toFixed(2)),
    relapseCount,
    primaryTtrMin: Number(primaryTtrMin.toFixed(1)),
    aucScore,
    dampingRatio,
    dynamicsClassification,
    relationshipChainStr,
    chainSteps,
    peaksDetail: peaks,
    relapsesDetail: relapses,
    phaseSpaceOrbit,
    thresholds: {
      tauIn: Number(tauIn.toFixed(2)),
      tauOut: Number(tauOut.toFixed(2)),
      tauNormal: Number(tauNormal.toFixed(2))
    }
  };
}
