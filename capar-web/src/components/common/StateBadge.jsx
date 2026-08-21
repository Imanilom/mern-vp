import React from 'react';
import { CheckCircle2, AlertTriangle, Activity, RefreshCw, XCircle, HelpCircle } from 'lucide-react';

export const StateBadge = ({ state }) => {
  let chipClass = "chip-neutral";
  let label = state || "UNKNOWN";
  let Icon = HelpCircle;

  switch (state) {
    case "BASELINE_COMPATIBLE":
    case "BASELINE":
      chipClass = "chip-green";
      label = "BASELINE COMPATIBLE";
      Icon = CheckCircle2;
      break;
    case "BASELINE_PAUSED":
    case "BASELINE_COMPATIBLE_PAUSED":
      chipClass = "chip-neutral";
      label = "BASELINE PAUSED";
      Icon = CheckCircle2;
      break;
    case "DEVIATION_CANDIDATE":
      chipClass = "chip-amber";
      label = "DEVIATION CANDIDATE";
      Icon = Activity;
      break;
    case "DEVIATION_PAUSED":
    case "DEVIATION_CANDIDATE_PAUSED":
      chipClass = "chip-amber";
      label = "DEVIATION PAUSED";
      Icon = Activity;
      break;
    case "PERSISTENT_DEVIATION":
    case "PERSISTENT_DEV":
      chipClass = "chip-red";
      label = "PERSISTENT DEVIATION";
      Icon = AlertTriangle;
      break;
    case "PERSISTENT_PAUSED":
    case "PERSISTENT_DEVIATION_PAUSED":
      chipClass = "chip-red";
      label = "PERSISTENT PAUSED";
      Icon = AlertTriangle;
      break;
    case "RECOVERY":
      chipClass = "chip-purple";
      label = "RECOVERY";
      Icon = RefreshCw;
      break;
    case "RECOVERY_PAUSED":
      chipClass = "chip-purple";
      label = "RECOVERY PAUSED";
      Icon = RefreshCw;
      break;
    case "RECOVERED":
      chipClass = "chip-green";
      label = "RECOVERED";
      Icon = CheckCircle2;
      break;
    case "UNRESOLVED":
      chipClass = "chip-red";
      label = "UNRESOLVED";
      Icon = XCircle;
      break;
    default:
      chipClass = "chip-neutral";
      Icon = HelpCircle;
  }

  return (
    <span className={`evidence-chip ${chipClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <Icon size={12} />
      {label}
    </span>
  );
};
