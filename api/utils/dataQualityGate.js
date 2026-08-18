/**
 * dataQualityGate.js — Quality assessment at RabbitMQ ingestion level.
 * Performs artifact detection, linear interpolation, and generates a transparency audit.
 */

export function analyzeAndCorrectRR(rrArray, expectedCount) {
  const rr = Array.isArray(rrArray) ? rrArray : [];
  const total_received = rr.length;
  
  if (total_received === 0) {
    return {
      total_received: 0,
      artifact_count: 0,
      corrected_count: 0,
      normalized_count: 0,
      missing_count: expectedCount > 0 ? expectedCount : 0,
      artifact_fraction: 0,
      missing_fraction: 1.0,
      rr_clean: [],
    };
  }

  // 1. Identify valid numeric values
  const validIndices = [];
  const invalidIndices = [];
  rr.forEach((val, i) => {
    if (typeof val === 'number' && isFinite(val) && val >= 300 && val <= 2000) {
      validIndices.push(i);
    } else {
      invalidIndices.push(i);
    }
  });

  const normalized_count = invalidIndices.length;

  // Clone array for working
  const rr_work = [...rr];

  // If there are invalid values, temporally replace them with valid median to do local-median check
  if (invalidIndices.length > 0 && validIndices.length > 0) {
    const validValues = validIndices.map(i => rr[i]).sort((a,b) => a - b);
    const globalMedian = validValues[Math.floor(validValues.length / 2)];
    invalidIndices.forEach(i => {
      rr_work[i] = globalMedian;
    });
  }

  // 2. Local-median rule
  const local_median_beats = 11;
  const local_relative_deviation = 0.20;
  const local_absolute_deviation_ms = 200.0;
  
  const artifacts = new Set(invalidIndices);

  for (let i = 0; i < rr_work.length; i++) {
    const start = Math.max(0, i - Math.floor(local_median_beats / 2));
    const end = Math.min(rr_work.length, i + Math.floor(local_median_beats / 2) + 1);
    
    const window = rr_work.slice(start, end).sort((a,b) => a - b);
    const localMedian = window[Math.floor(window.length / 2)];
    
    const allowed = Math.max(local_absolute_deviation_ms, local_relative_deviation * Math.max(localMedian, 1.0));
    
    if (Math.abs(rr_work[i] - localMedian) > allowed) {
      artifacts.add(i);
    }
  }

  const artifact_count = artifacts.size;
  const artifact_fraction = total_received > 0 ? artifact_count / total_received : 0;
  
  // 3. Interpolation
  const rr_clean = [...rr];
  const finalValidIndices = [];
  const finalMissingIndices = [];
  
  for (let i = 0; i < rr_clean.length; i++) {
    if (artifacts.has(i)) {
      rr_clean[i] = NaN;
      finalMissingIndices.push(i);
    } else {
      finalValidIndices.push(i);
    }
  }

  let corrected_count = 0;

  if (finalMissingIndices.length > 0) {
    if (finalValidIndices.length >= 2) {
      // Linear interpolation
      finalMissingIndices.forEach(missingIdx => {
        // Find left valid
        let leftIdx = -1;
        for (let i = missingIdx - 1; i >= 0; i--) {
          if (!artifacts.has(i)) { leftIdx = i; break; }
        }
        // Find right valid
        let rightIdx = -1;
        for (let i = missingIdx + 1; i < rr_clean.length; i++) {
          if (!artifacts.has(i)) { rightIdx = i; break; }
        }

        if (leftIdx !== -1 && rightIdx !== -1) {
          const t = (missingIdx - leftIdx) / (rightIdx - leftIdx);
          rr_clean[missingIdx] = rr_clean[leftIdx] + t * (rr_clean[rightIdx] - rr_clean[leftIdx]);
          corrected_count++;
        } else if (leftIdx !== -1) {
          rr_clean[missingIdx] = rr_clean[leftIdx];
          corrected_count++;
        } else if (rightIdx !== -1) {
          rr_clean[missingIdx] = rr_clean[rightIdx];
          corrected_count++;
        }
      });
    } else if (finalValidIndices.length === 1) {
      // Only one valid value, use it for all
      const validVal = rr_clean[finalValidIndices[0]];
      finalMissingIndices.forEach(i => {
        rr_clean[i] = validVal;
        corrected_count++;
      });
    }
  }

  const expected = Math.max(expectedCount || total_received, 1);
  const missing_count = Math.max(expected - total_received, 0);
  const missing_fraction = Math.min(Math.max(missing_count / expected, 0), 1.0);

  return {
    total_received,
    artifact_count,
    corrected_count,
    normalized_count,
    missing_count,
    artifact_fraction,
    missing_fraction,
    rr_clean
  };
}

/**
 * Validates the quality audit and context against the pipeline gates.
 */
export function checkQualityGate(audit, activityLabel, activityConfidence) {
  const max_artifact_fraction = 0.05;
  const max_missing_fraction = 0.10;
  const min_activity_confidence = 0.80;

  const hasAnnotation = (activityLabel && activityLabel !== 'Unknown' && activityLabel.trim() !== '');
  
  const reasons = [];
  
  if (audit.artifact_fraction > max_artifact_fraction) {
    reasons.push(`Artefak ${ (audit.artifact_fraction * 100).toFixed(1) }% melebihi batas 5.0%`);
  }
  if (audit.missing_fraction > max_missing_fraction) {
    reasons.push(`Missing data ${ (audit.missing_fraction * 100).toFixed(1) }% melebihi batas 10.0%`);
  }
  if (activityConfidence < min_activity_confidence) {
    reasons.push(`Confidence aktivitas ${(activityConfidence).toFixed(2)} lebih kecil dari 0.80`);
  }

  const passed = reasons.length === 0;

  return {
    annotation_present: hasAnnotation,
    annotation_confidence: activityConfidence,
    gate_passed: passed,
    gate_reasons: reasons,
  };
}
