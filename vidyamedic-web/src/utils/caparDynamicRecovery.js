export function recoveryHeartRate(timeMinutes, baseline, initial, tau) {
  if (
    ![timeMinutes, baseline, initial, tau].every(Number.isFinite)
    || timeMinutes < 0
    || tau <= 0
  ) {
    throw new RangeError('Recovery inputs must be finite and tau must be positive.');
  }
  return baseline + ((initial - baseline) * Math.exp(-timeMinutes / tau));
}

export function calculateRecoveryTime(baseline, initial, tau, tolerance) {
  if (
    ![baseline, initial, tau, tolerance].every(Number.isFinite)
    || tau <= 0
    || tolerance <= 0
  ) {
    throw new RangeError('Recovery inputs must be finite and tau/tolerance must be positive.');
  }
  const deviation = Math.abs(initial - baseline);
  return deviation <= tolerance ? 0 : tau * Math.log(deviation / tolerance);
}
