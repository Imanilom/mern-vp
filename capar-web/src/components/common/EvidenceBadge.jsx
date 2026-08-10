import React from 'react';
import { CheckCircle, AlertOctagon, HelpCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

export const EvidenceBadge = ({ state }) => {
  let chipClass = "chip-neutral";
  let label = state || "UNKNOWN";
  let Icon = HelpCircle;

  switch (state) {
    case "EVALUABLE":
      chipClass = "chip-green";
      label = "EVALUABLE";
      Icon = CheckCircle;
      break;
    case "QUALITY_WARNING":
      chipClass = "chip-red";
      label = "QUALITY WARNING";
      Icon = AlertOctagon;
      break;
    case "UNCERTAIN_CONTEXT":
      chipClass = "chip-amber";
      label = "UNCERTAIN CONTEXT";
      Icon = HelpCircle;
      break;
    case "INSUFFICIENT_BASELINE":
      chipClass = "chip-amber";
      label = "INSUFFICIENT BASELINE";
      Icon = AlertTriangle;
      break;
    case "PROVISIONAL_BASELINE":
      chipClass = "chip-blue";
      label = "PROVISIONAL BASELINE";
      Icon = ShieldCheck;
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
