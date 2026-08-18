import React from 'react';

export const StateBadge = ({ state }) => {
  let chipClass = "chip-neutral";
  let label = state || "UNKNOWN";

  switch (state) {
    case "BASELINE_COMPATIBLE":
      chipClass = "chip-green";
      label = "BASELINE COMPATIBLE";
      break;
    case "DEVIATION_CANDIDATE":
      chipClass = "chip-amber";
      label = "DEVIATION CANDIDATE";
      break;
    case "PERSISTENT_DEVIATION":
    case "PERSISTENT_DEV":
      chipClass = "chip-red";
      label = "PERSISTENT DEVIATION";
      break;
    case "RECOVERY":
      chipClass = "chip-purple";
      label = "RECOVERY";
      break;
    case "RECOVERED":
      chipClass = "chip-green";
      label = "RECOVERED";
      break;
    case "UNRESOLVED":
      chipClass = "chip-red";
      label = "UNRESOLVED";
      break;
    default:
      chipClass = "chip-neutral";
  }

  return (
    <span className={`evidence-chip ${chipClass}`}>
      {label}
    </span>
  );
};
