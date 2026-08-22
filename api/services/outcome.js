// api/services/outcome.js

export function resolveOutcome(ep, cfg) {
  // Outcome physiology. Admin close is evaluated separately.
  if (ep.recovery_entry_at == null) {
    return 'UNRESOLVED';
  }

  if (ep.resolved_at == null) {
    return 'UNRESOLVED';
  }

  if (!ep.baseline_stability_pass) {
    return 'UNRESOLVED';
  }

  return 'RECOVERED';
}

export function closeEpisode(ep, reason, closed_at) {
  ep.admin_status = 'CLOSED';
  ep.closed_reason = reason;
  ep.closed_at = closed_at;
  // DO NOT force physiological outcome to RECOVERED.
  return ep;
}
