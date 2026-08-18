import React from 'react';

export const EvidenceBadge = ({ state }) => {
  let chipClass = "chip-neutral";
  let label = state || "UNKNOWN";

  switch (state) {
    case "EVALUABLE":
      chipClass = "chip-green";
      label = "EVALUABLE";
      break;
    case "QUALITY_WARNING":
      chipClass = "chip-red";
      label = "QUALITY WARNING";
      break;
    case "UNCERTAIN_CONTEXT":
      chipClass = "chip-amber";
      label = "UNCERTAIN CONTEXT";
      break;
    case "INSUFFICIENT_BASELINE":
      chipClass = "chip-amber";
      label = "INSUFFICIENT BASELINE";
      break;
    case "PROVISIONAL_BASELINE":
      chipClass = "chip-blue";
      label = "PROVISIONAL BASELINE";
      break;
    default:
      chipClass = "chip-neutral";
  }

  return (
    <span className={`evidence-chip ${chipClass}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}></span>
      {label}
    </span>
  );
};
