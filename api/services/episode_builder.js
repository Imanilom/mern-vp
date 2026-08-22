// api/services/episode_builder.js

const DEFAULT_CFG = {
  tau_in: 1.86,
  tau_out: 1.18,
  persistence_k: 3,
  persistence_m: 5,
  rebound_delta: 0.40,
  recovery_dwell_min: 5,
  stabilization_min: 10
};

export function processWindow(ep, w, cfg = DEFAULT_CFG) {
  // 1. Quality gating
  if (!w.quality_good) {
    ep.append(w, 'QUALITY_WARNING', 'quality gate failed');
    return ep;
  }

  // 2. Onset
  if (ep.state === 'BASELINE_COMPATIBLE' && w.score >= cfg.tau_in) {
    ep.start(w);
    ep.transition('DEVIATION_CANDIDATE', w.ts, 'tau_in crossed');
    return ep;
  }

  // 3. Persistence
  if (ep.state === 'DEVIATION_CANDIDATE' && ep.k_of_m_pass(cfg.persistence_k, cfg.persistence_m)) {
    ep.transition('PERSISTENT_DEVIATION', w.ts, 'persistence passed');
    ep.freeze_baseline = true;
  }

  // 4. Track peak
  ep.update_peak(w.score, w.ts);

  // 5. Partial recovery or recovery entry
  if (['PERSISTENT_DEVIATION', 'REBOUND_CANDIDATE'].includes(ep.state)) {
    if (w.score < ep.peak_score && w.score > cfg.tau_out) {
      ep.transition_if_changed('PARTIAL_RECOVERY', w.ts, 'declining but tau_out not reached');
    } else if (w.score <= cfg.tau_out && ep.recovery_dwell_pass(cfg.recovery_dwell_min)) {
      ep.recovery_entry_at = w.ts;
      ep.transition('RECOVERY_ENTRY', w.ts, 'tau_out + dwell passed');
    }
  }

  // 6. Rebound inside same episode
  if (ep.state === 'PARTIAL_RECOVERY') {
    const rebound = w.score - ep.partial_recovery_min;
    if (rebound >= cfg.rebound_delta && !w.context_explained) {
      ep.relapse_count += 1;
      ep.transition('REBOUND_CANDIDATE', w.ts, `rebound magnitude=${rebound.toFixed(2)}`);
    }
  }

  // 7. Final recovery
  if (ep.state === 'RECOVERY_ENTRY' && ep.near_baseline_stable(cfg.stabilization_min)) {
    ep.resolved_at = w.ts;
    ep.outcome = 'RECOVERED';
    ep.transition('RECOVERED', w.ts, 'baseline stability passed');
  }

  return ep;
}
