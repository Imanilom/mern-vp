/**
 * resilienceEngine.js
 * Cardiovascular Resilience State (CRS) Calculation Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Combines 5 resilience dimensions:
 * 1. Clinical Vulnerability (CV) - Weight: 20%
 * 2. Cardiac Reserve (CR)        - Weight: 20%
 * 3. Autonomic Reserve (AR)      - Weight: 25%
 * 4. Recovery Capacity (RC)      - Weight: 20%
 * 5. Regulation Stability (RS)   - Weight: 15%
 *
 * Formula: CRS = 0.20*CV + 0.20*CR + 0.25*AR + 0.20*RC + 0.15*RS
 */

export function calculateResilience(data) {
  const clinical = Number(data.clinical || 0);
  const cardiac = Number(data.cardiac || 0);
  const autonomic = Number(data.autonomic || 0);
  const recovery = Number(data.recovery || 0);
  const stability = Number(data.stability || 0);

  const score = (
    0.20 * clinical +
    0.20 * cardiac +
    0.25 * autonomic +
    0.20 * recovery +
    0.15 * stability
  );

  return Number(score.toFixed(1));
}

export function classify(score) {
  const s = Number(score);
  if (s >= 85) {
    return {
      label: 'HIGH RESILIENCE',
      color: '#10B981',
      bgColor: '#DCFCE7',
      textColor: '#15803D',
      description: 'Kapasitas otonom dan cadangan pemulihan kardiovaskular sangat prima dan adaptif terhadap stres.'
    };
  }
  if (s >= 70) {
    return {
      label: 'MODERATE RESILIENCE',
      color: '#F59E0B',
      bgColor: '#FEF3C7',
      textColor: '#B45309',
      description: 'Resiliensi kardiovaskular memadai namun memerlukan perhatian pada reaktivasi vagal dan stabilisasi beban fisik.'
    };
  }
  return {
    label: 'LOW RESILIENCE',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    textColor: '#B91C1C',
    description: 'Terdeteksi penurunan cadangan kardiovaskular dan kelambatan pemulihan. Disarankan penyesuaian aktivitas dan evaluasi klinis.'
  };
}
