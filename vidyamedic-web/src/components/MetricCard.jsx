import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  note,
  tone = 'green',
  trend,
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-top">
        <span className="metric-icon"><Icon size={19} /></span>
        {trend && (
          <span className={`metric-trend ${trend.direction}`}>
            {trend.direction === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend.label}
          </span>
        )}
      </div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value ?? '—'}<span>{value != null ? unit : ''}</span></div>
      <div className="metric-note">{note}</div>
    </article>
  );
}
